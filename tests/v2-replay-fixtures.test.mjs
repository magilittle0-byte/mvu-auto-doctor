import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(TEST_DIR, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs', '2.0');
const SCHEMA_PATH = path.join(DOCS_DIR, 'replay-fixture.schema.json');
const CORPUS_PATH = path.join(ROOT_DIR, 'fixtures', '2.0', 'replay-cases.json');

const readUtf8 = (filePath) => readFile(filePath, 'utf8');
const readJson = async (filePath) => JSON.parse(await readUtf8(filePath));

function resolveLocalRef(rootSchema, ref) {
  assert.match(ref, /^#\//, `only local JSON Schema references are allowed: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, token) => value[token], rootSchema);
}

function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function validateSchemaValue(value, schema, rootSchema, location = '$') {
  if (schema.$ref) {
    validateSchemaValue(value, resolveLocalRef(rootSchema, schema.$ref), rootSchema, location);
    return;
  }

  if (schema.const !== undefined) {
    assert.deepEqual(value, schema.const, `${location} must equal schema const`);
  }
  if (schema.enum) {
    assert.ok(schema.enum.some((item) => Object.is(item, value)), `${location} is outside enum`);
  }

  if (schema.type) {
    const actualType = valueType(value);
    const typeMatches = schema.type === 'number'
      ? actualType === 'number' || actualType === 'integer'
      : actualType === schema.type;
    assert.ok(typeMatches, `${location} must be ${schema.type}, got ${actualType}`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined) {
      assert.ok(value.length >= schema.minLength, `${location} is shorter than ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined) {
      assert.ok(value.length <= schema.maxLength, `${location} is longer than ${schema.maxLength}`);
    }
    if (schema.pattern) {
      assert.match(value, new RegExp(schema.pattern), `${location} does not match ${schema.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined) {
      assert.ok(value >= schema.minimum, `${location} is less than ${schema.minimum}`);
    }
    if (schema.maximum !== undefined) {
      assert.ok(value <= schema.maximum, `${location} exceeds ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) {
      assert.ok(value.length >= schema.minItems, `${location} has too few items`);
    }
    if (schema.maxItems !== undefined) {
      assert.ok(value.length <= schema.maxItems, `${location} has too many items`);
    }
    if (schema.uniqueItems) {
      const serialized = value.map((item) => JSON.stringify(item));
      assert.equal(new Set(serialized).size, serialized.length, `${location} must contain unique items`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateSchemaValue(item, schema.items, rootSchema, `${location}[${index}]`);
      });
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const requiredKey of schema.required ?? []) {
      assert.ok(Object.hasOwn(value, requiredKey), `${location}.${requiredKey} is required`);
    }
    if (schema.additionalProperties === false) {
      const knownKeys = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        assert.ok(knownKeys.has(key), `${location}.${key} is not declared by schema`);
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        validateSchemaValue(value[key], childSchema, rootSchema, `${location}.${key}`);
      }
    }
  }
}

const REQUIRED_CASE_IDS = [
  'RR-AGENCY-NO-MOVE',
  'RR-BULLSHIT-REASONABLE',
  'RR-BULLSHIT-ADVANTAGE',
  'RR-BULLSHIT-REWRITE',
  'RR-FACT-RANDOM-CODE',
  'RR-FINGERPRINT-PREVIOUS-REPLY',
  'RR-SOCIAL-ORDINARY-KINDNESS',
  'RR-SOCIAL-COERCION-VOLUNTARY',
  'RR-EQUIPMENT-SLOTS',
  'RR-ITEM-CONSUMABLE-EFFECT',
  'RR-SKILL-TEXT-COST',
  'RR-REROLL-IDEMPOTENCY',
  'RR-REPAIR-DB-BARRIER',
  'RR-TASK-WATCHDOG',
  'RR-DATABASE-LENGTH-SQL-CONCURRENCY',
  'RR-UI-ANDROID-EXPAND',
  'RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION',
];

const ACTIVE_UNIT_CASE_IDS = new Set([
  'RR-AGENCY-NO-MOVE',
  'RR-BULLSHIT-REASONABLE',
  'RR-BULLSHIT-ADVANTAGE',
  'RR-BULLSHIT-REWRITE',
  'RR-FACT-RANDOM-CODE',
  'RR-SOCIAL-ORDINARY-KINDNESS',
  'RR-SOCIAL-COERCION-VOLUNTARY',
  'RR-EQUIPMENT-SLOTS',
  'RR-ITEM-CONSUMABLE-EFFECT',
  'RR-SKILL-TEXT-COST',
  'RR-FINGERPRINT-PREVIOUS-REPLY',
  'RR-REROLL-IDEMPOTENCY',
  'RR-REPAIR-DB-BARRIER',
  'RR-TASK-WATCHDOG',
  'RR-DATABASE-LENGTH-SQL-CONCURRENCY',
  'RR-UI-ANDROID-EXPAND',
]);

test('2.0 replay corpus conforms to the checked-in JSON Schema', async () => {
  const [schema, corpus] = await Promise.all([
    readJson(SCHEMA_PATH),
    readJson(CORPUS_PATH),
  ]);

  validateSchemaValue(corpus, schema, schema);
});

test('2.0 replay corpus covers every stage-0 historical fault exactly once', async () => {
  const corpus = await readJson(CORPUS_PATH);
  const caseIds = corpus.cases.map((entry) => entry.id);
  const futureTestIds = corpus.cases.map((entry) => entry.automation.futureTestId);

  assert.deepEqual([...caseIds].sort(), [...REQUIRED_CASE_IDS].sort());
  assert.equal(new Set(caseIds).size, caseIds.length, 'fixture ids must be unique');
  assert.equal(
    new Set(futureTestIds).size,
    futureTestIds.length,
    'future behavior test ids must be unique',
  );
  for (const entry of corpus.cases) {
    const expectedStatus = ACTIVE_UNIT_CASE_IDS.has(entry.id)
      ? 'unit-active'
      : 'structural-only';
    assert.equal(entry.automation.status, expectedStatus, `${entry.id} automation status drifted`);
    if (ACTIVE_UNIT_CASE_IDS.has(entry.id)) {
      const phase2Ids = new Set([
        'RR-FINGERPRINT-PREVIOUS-REPLY',
        'RR-REROLL-IDEMPOTENCY',
      ]);
      const phase3Ids = new Set([
        'RR-AGENCY-NO-MOVE',
        'RR-BULLSHIT-REASONABLE',
        'RR-BULLSHIT-ADVANTAGE',
        'RR-BULLSHIT-REWRITE',
        'RR-FACT-RANDOM-CODE',
      ]);
      const phase4Ids = new Set([
        'RR-SOCIAL-ORDINARY-KINDNESS',
      ]);
      const phase5Ids = new Set([
        'RR-UI-ANDROID-EXPAND',
      ]);
      const phase6Ids = new Set([
        'RR-REPAIR-DB-BARRIER',
        'RR-TASK-WATCHDOG',
        'RR-DATABASE-LENGTH-SQL-CONCURRENCY',
      ]);
      const expectedPhase = phase6Ids.has(entry.id)
        ? 'phase-6'
        : phase5Ids.has(entry.id)
        ? 'phase-5'
        : phase4Ids.has(entry.id)
        ? 'phase-4'
        : phase3Ids.has(entry.id)
          ? 'phase-3'
          : phase2Ids.has(entry.id)
            ? 'phase-2'
            : 'phase-1';
      assert.equal(entry.automation.activateAt, expectedPhase);
    }
  }
});

test('2.0 replay corpus stays minimal and excludes credentials and private paths', async () => {
  const corpusText = await readUtf8(CORPUS_PATH);
  const corpus = JSON.parse(corpusText);
  const forbiddenPatterns = [
    /[A-Za-z]:\\Users\\/i,
    /\bAuthorization\b/i,
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
    /\bsk-[A-Za-z0-9_-]{12,}\b/i,
    /\b(api[_-]?key|access[_-]?token|client[_-]?secret|password)\b\s*[:=]/i,
    /https?:\/\/[^/\s:@]+:[^/\s@]+@/i,
    /\b(cookie|set-cookie)\b\s*[:=]/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(corpusText, pattern);
  }
  for (const replayCase of corpus.cases) {
    assert.equal(replayCase.privacy.synthetic, true);
    for (const turn of replayCase.input.turns) {
      assert.ok(
        turn.text.length <= corpus.redactionPolicy.maxTurnChars,
        `${replayCase.id} contains an overlong turn`,
      );
    }
  }
});

test('2.0 authority documents and replay cases cross-reference one another', async () => {
  const [index, matrix, roadmap, handoff, protocol, product, corpus] = await Promise.all([
    readUtf8(path.join(DOCS_DIR, 'README.md')),
    readUtf8(path.join(DOCS_DIR, 'REAL_REPLAY_ACCEPTANCE_MATRIX.md')),
    readUtf8(path.join(DOCS_DIR, 'PHASE_ROADMAP.md')),
    readUtf8(path.join(DOCS_DIR, 'PHASE_HANDOFF_TEMPLATE.md')),
    readUtf8(path.join(DOCS_DIR, 'DATA_TRANSACTION_PROTOCOL.md')),
    readUtf8(path.join(DOCS_DIR, 'PRODUCT_SPEC.md')),
    readJson(CORPUS_PATH),
  ]);

  for (const authorityFile of [
    'PRODUCT_SPEC.md',
    'DATA_TRANSACTION_PROTOCOL.md',
    'REAL_REPLAY_ACCEPTANCE_MATRIX.md',
    'PHASE_ROADMAP.md',
    'PHASE_HANDOFF_TEMPLATE.md',
    'replay-fixture.schema.json',
    'replay-cases.json',
  ]) {
    assert.ok(index.includes(authorityFile), `authority index must mention ${authorityFile}`);
  }
  for (const replayCase of corpus.cases) {
    assert.ok(matrix.includes(`\`${replayCase.id}\``), `matrix must mention ${replayCase.id}`);
    assert.ok(
      matrix.includes(`\`${replayCase.automation.futureTestId}\``),
      `matrix must mention ${replayCase.automation.futureTestId}`,
    );
  }
  for (let phase = 1; phase <= 7; phase += 1) {
    assert.match(roadmap, new RegExp(`阶段${phase}(?![0-9])`));
  }
  for (const requiredHandoffField of [
    '权威文件',
    '未决决策',
    '测试命令',
    '已知风险',
    '提交 SHA',
    '下一阶段',
  ]) {
    assert.ok(handoff.includes(requiredHandoffField), `handoff template lacks ${requiredHandoffField}`);
  }
  assert.match(product, /叙事优先/);
  assert.match(product, /口胡四级/);
  assert.match(protocol, /MessageFingerprint/);
  assert.match(protocol, /Transaction/);
  assert.match(protocol, /Branch/);
});

test('phase 4 activates every replay assigned to the domain-transaction stage', async () => {
  const corpus = await readJson(CORPUS_PATH);
  const phase4Cases = corpus.cases.filter((entry) => (
    entry.automation.activateAt === 'phase-4'
  ));

  assert.deepEqual(
    phase4Cases.map((entry) => entry.id),
    ['RR-SOCIAL-ORDINARY-KINDNESS'],
  );
  assert.ok(phase4Cases.every((entry) => entry.automation.status === 'unit-active'));
});
test('phase 5 activates natural-language and UI parity replays', async () => {
  const corpus = await readJson(CORPUS_PATH);
  const phase5Cases = corpus.cases.filter((entry) => (
    entry.automation.activateAt === 'phase-5'
  ));

  assert.deepEqual(
    phase5Cases.map((entry) => entry.id),
    ['RR-UI-ANDROID-EXPAND'],
  );
  assert.ok(phase5Cases.every((entry) => entry.automation.status === 'unit-active'));
});
test('phase 6 activates repair barrier, database and watchdog behavior replays', async () => {
  const corpus = await readJson(CORPUS_PATH);
  const phase6Cases = corpus.cases.filter((entry) => (
    entry.automation.activateAt === 'phase-6'
  ));

  assert.deepEqual(
    phase6Cases.map((entry) => entry.id),
    [
      'RR-REPAIR-DB-BARRIER',
      'RR-TASK-WATCHDOG',
      'RR-DATABASE-LENGTH-SQL-CONCURRENCY',
    ],
  );
  assert.ok(phase6Cases.every((entry) => entry.automation.status === 'unit-active'));
});
test.todo('phase 7 activates the real-SillyTavern release gate replay');
