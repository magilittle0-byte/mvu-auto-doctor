import { fingerprint } from './core.mjs';

export const SERENDIPITY_VERSION = 1;
export const SERENDIPITY_MAX_RECEIPTS = 240;

const FREQUENCIES = new Set(['off', 'sparse', 'standard', 'frequent', 'extreme']);
const AMPLITUDES = new Set(['small', 'useful', 'rare', 'extreme']);
const BIASES = new Set(['harsh', 'balanced', 'balanced-lucky', 'lucky']);
const EXPLANATION_SPEEDS = new Set(['never', 'slow', 'natural', 'fast']);
const SOURCE_STATES = new Set(['unknown', 'possible', 'revealed', 'irrelevant']);
const DIRECTIONS = new Set(['favorable', 'adverse', 'neutral', 'absurd']);
const CHANNELS = new Set(['actor', 'faction', 'environment']);

export const DEFAULT_SERENDIPITY_SETTINGS = Object.freeze({
    frequency: 'standard',
    maxAmplitude: 'extreme',
    bias: 'balanced-lucky',
    explanationSpeed: 'natural',
});

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function cleanText(value, limit = 240) {
    return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function nonNegativeInteger(value, fallback = 0) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function normalizedObjectKey(value) {
    return cleanText(value, 160)
        .toLocaleLowerCase()
        .replace(/[\s\p{P}\p{S}]+/gu, '')
        .replace(/^(?:再|重新|继续|仔细|认真|彻底|试着|尝试|帮我|我要|我想|请)+/gu, '')
        .replace(/^(?:搜索|搜查|搜寻|翻找|翻翻|检查|查看|看看|调查|摸索)+/gu, '')
        .replace(/^(?:这个|那个|此处|这里|那里|一遍|一下)+/gu, '')
        .replace(/(?:一遍|一下|看看|里面|内部|附近)$/gu, '')
        || 'general-opportunity';
}

function similarObjectKey(left, right) {
    if (left === right) return true;
    if (left.length < 2 || right.length < 2) return false;
    return left.includes(right) || right.includes(left);
}

function hashUnit(seed, lane) {
    const digest = fingerprint(`${cleanText(seed, 1000)}|${lane}`);
    const hex = digest.split(':').at(-1) || '0';
    return Number.parseInt(hex, 16) / 0xffffffff;
}

function weightedChoice(seed, lane, entries) {
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    let cursor = hashUnit(seed, lane) * total;
    for (const [value, weight] of entries) {
        cursor -= weight;
        if (cursor <= 0) return value;
    }
    return entries.at(-1)[0];
}

export function normalizeSerendipitySettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        frequency: FREQUENCIES.has(source.frequency)
            ? source.frequency
            : DEFAULT_SERENDIPITY_SETTINGS.frequency,
        maxAmplitude: AMPLITUDES.has(source.maxAmplitude)
            ? source.maxAmplitude
            : DEFAULT_SERENDIPITY_SETTINGS.maxAmplitude,
        bias: BIASES.has(source.bias)
            ? source.bias
            : DEFAULT_SERENDIPITY_SETTINGS.bias,
        explanationSpeed: EXPLANATION_SPEEDS.has(source.explanationSpeed)
            ? source.explanationSpeed
            : DEFAULT_SERENDIPITY_SETTINGS.explanationSpeed,
    };
}

export function emptySerendipityLedger(chatId = '') {
    return {
        version: SERENDIPITY_VERSION,
        chatId: cleanText(chatId, 180),
        receipts: [],
    };
}

function normalizeTarget(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        chatId: cleanText(source.chatId, 180),
        messageId: cleanText(source.messageId, 180),
        swipeId: nonNegativeInteger(source.swipeId),
        generation: nonNegativeInteger(source.generation),
        generationId: cleanText(source.generationId, 220),
        branchId: cleanText(source.branchId, 220),
        contentFingerprint: cleanText(source.contentFingerprint, 160),
    };
}

function normalizeReceipt(value) {
    const source = value && typeof value === 'object' ? value : {};
    const direction = DIRECTIONS.has(source.direction) ? source.direction : 'neutral';
    const sourceState = SOURCE_STATES.has(source.sourceState)
        ? source.sourceState
        : 'unknown';
    return {
        version: SERENDIPITY_VERSION,
        licenseId: cleanText(source.licenseId, 220),
        opportunityKey: cleanText(source.opportunityKey, 220),
        objectKey: normalizedObjectKey(source.objectKey),
        worldStateDigest: cleanText(source.worldStateDigest, 160),
        triggered: source.triggered === true,
        decision: cleanText(source.decision, 80) || 'no-trigger',
        direction,
        magnitude: AMPLITUDES.has(source.magnitude) ? source.magnitude : 'small',
        channel: CHANNELS.has(source.channel) ? source.channel : 'environment',
        landing: cleanText(source.landing, 80) || 'background',
        sourceState,
        explanationSpeed: EXPLANATION_SPEEDS.has(source.explanationSpeed)
            ? source.explanationSpeed
            : DEFAULT_SERENDIPITY_SETTINGS.explanationSpeed,
        pressureCost: direction === 'adverse'
            ? nonNegativeInteger(source.pressureCost)
            : 0,
        responseWindowRequired: direction === 'adverse'
            && source.responseWindowRequired === true,
        actualBenefitRequired: direction === 'favorable'
            && source.actualBenefitRequired !== false,
        antiBalancePunishment: false,
        constraints: (Array.isArray(source.constraints) ? source.constraints : [])
            .map((item) => cleanText(item, 220))
            .filter(Boolean)
            .slice(0, 16),
        target: normalizeTarget(source.target),
        drawHash: cleanText(source.drawHash, 160),
        createdAt: nonNegativeInteger(source.createdAt),
        settledAt: nonNegativeInteger(source.settledAt),
    };
}

export function normalizeSerendipityLedger(value, { chatId = '' } = {}) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        version: SERENDIPITY_VERSION,
        chatId: cleanText(chatId || source.chatId, 180),
        receipts: (Array.isArray(source.receipts) ? source.receipts : [])
            .map(normalizeReceipt)
            .filter((receipt) => receipt.licenseId && receipt.opportunityKey)
            .slice(-SERENDIPITY_MAX_RECEIPTS),
    };
}

export function serendipityOpportunityKey({
    chatId = '',
    objectKey = '',
    worldStateDigest = '',
} = {}) {
    const object = normalizedObjectKey(objectKey);
    const world = cleanText(worldStateDigest, 160) || 'world:unknown';
    return `serendipity:${fingerprint(`${cleanText(chatId, 180)}|${object}|${world}`)}`;
}

function findDuplicate(ledger, objectKey, worldStateDigest, opportunityKey) {
    const object = normalizedObjectKey(objectKey);
    const world = cleanText(worldStateDigest, 160) || 'world:unknown';
    return ledger.receipts.find((receipt) => (
        receipt.opportunityKey === opportunityKey
        || (
            receipt.worldStateDigest === world
            && similarObjectKey(receipt.objectKey, object)
        )
    ));
}

function magnitudeWeights(maxAmplitude) {
    if (maxAmplitude === 'small') return [['small', 1]];
    if (maxAmplitude === 'useful') return [['small', 0.72], ['useful', 0.28]];
    if (maxAmplitude === 'rare') {
        return [['small', 0.56], ['useful', 0.31], ['rare', 0.13]];
    }
    return [['small', 0.49], ['useful', 0.30], ['rare', 0.19], ['extreme', 0.02]];
}

function directionWeights(bias) {
    if (bias === 'harsh') {
        return [['favorable', 0.18], ['neutral', 0.24], ['absurd', 0.10], ['adverse', 0.48]];
    }
    if (bias === 'balanced') {
        return [['favorable', 0.32], ['neutral', 0.30], ['absurd', 0.12], ['adverse', 0.26]];
    }
    if (bias === 'lucky') {
        return [['favorable', 0.62], ['neutral', 0.21], ['absurd', 0.09], ['adverse', 0.08]];
    }
    return [['favorable', 0.43], ['neutral', 0.29], ['absurd', 0.10], ['adverse', 0.18]];
}

function recentTriggerPenalty(ledger) {
    const recent = ledger.receipts.slice(-12);
    const triggered = recent.filter((receipt) => receipt.triggered).length;
    const lastTriggeredDistance = [...recent].reverse().findIndex((receipt) => receipt.triggered);
    return {
        multiplier: 1 / (1 + triggered * 0.7),
        coolingDown: lastTriggeredDistance >= 0 && lastTriggeredDistance < 2,
    };
}

function triggerChance(frequency) {
    return {
        off: 0,
        sparse: 0.05,
        standard: 0.12,
        frequent: 0.22,
        extreme: 0.38,
    }[frequency];
}

function pressureCostFor(magnitude) {
    return magnitude === 'extreme' ? 3 : magnitude === 'rare' ? 2 : 1;
}

function baseConstraints(sourceState) {
    return [
        '只突破可预测性，不得突破明确事实、角色卡硬约束、原作锚点或玩家主权',
        '外部scene/act/then只作候选，不得事实化',
        '不得读取、消耗、修改或模拟角色卡骰池',
        '医生不得改写、截断或重生成正文<content>',
        sourceState === 'unknown'
            ? '来源保持unknown，不得提前确认身份或成因；允许延后解释或永久成谜'
            : sourceState === 'possible'
                ? '来源仅为possible，不得写成已确认事实'
                : sourceState === 'irrelevant'
                    ? '来源解释与本次效果无关，不得强行补写'
                    : '只能使用已经revealed的来源事实',
    ];
}

export function drawSerendipityLicense({
    ledger: ledgerInput,
    settings: settingsInput,
    chatId = '',
    objectKey = '',
    worldStateDigest = '',
    sourceState = 'unknown',
    constraints = {},
    pressure = {},
    target = {},
    entropy = '',
    now = Date.now(),
} = {}) {
    const ledger = normalizeSerendipityLedger(ledgerInput, { chatId });
    const settings = normalizeSerendipitySettings(settingsInput);
    const object = normalizedObjectKey(objectKey);
    const world = cleanText(worldStateDigest, 160) || 'world:unknown';
    const opportunityKey = serendipityOpportunityKey({ chatId, objectKey: object, worldStateDigest: world });
    const duplicate = findDuplicate(ledger, object, world, opportunityKey);
    if (duplicate) {
        return {
            status: 'duplicate',
            ledger,
            opportunityKey: duplicate.opportunityKey,
            license: clone(duplicate),
        };
    }
    const normalizedSourceState = SOURCE_STATES.has(sourceState) ? sourceState : 'unknown';
    const hardContradiction = constraints.explicitContradiction === true
        || constraints.explicitEmpty === true
        || constraints.characterHardConstraint === true
        || constraints.canonAnchorConflict === true
        || constraints.playerAuthorityConflict === true;
    const seed = [
        entropy || `${now}`,
        chatId,
        object,
        world,
        cleanText(target?.generationId, 220),
        nonNegativeInteger(target?.generation),
    ].join('|');
    const cooling = recentTriggerPenalty(ledger);
    const chance = triggerChance(settings.frequency) * cooling.multiplier;
    const rolledTrigger = settings.frequency !== 'off'
        && !cooling.coolingDown
        && hashUnit(seed, 'trigger') < chance;
    const triggered = rolledTrigger && !hardContradiction;
    let direction = triggered
        ? weightedChoice(seed, 'direction', directionWeights(settings.bias))
        : 'neutral';
    let magnitude = triggered
        ? weightedChoice(seed, 'magnitude', magnitudeWeights(settings.maxAmplitude))
        : 'small';
    let decision = settings.frequency === 'off'
        ? 'disabled'
        : hardContradiction
            ? 'rejected-explicit-contradiction'
            : cooling.coolingDown
                ? 'throttled-long-session'
                : triggered
                    ? 'licensed'
                    : 'no-trigger';
    let pressureCost = direction === 'adverse' ? pressureCostFor(magnitude) : 0;
    const cap = Math.max(0, nonNegativeInteger(pressure.cap, 3));
    const used = Math.max(0, nonNegativeInteger(pressure.used, 0));
    const recoveryDebt = Math.max(0, nonNegativeInteger(pressure.recoveryDebt, 0));
    if (
        triggered
        && direction === 'adverse'
        && (recoveryDebt > 0 || used + pressureCost > cap || constraints.minimumPlayability === false)
    ) {
        direction = 'neutral';
        magnitude = 'small';
        pressureCost = 0;
        decision = 'converted-non-harm-anomaly';
    }
    const channel = triggered
        ? weightedChoice(seed, 'channel', [
            ['actor', 0.24],
            ['faction', 0.28],
            ['environment', 0.48],
        ])
        : 'environment';
    const landing = triggered
        ? weightedChoice(seed, 'landing', [
            ['discovery', 0.25],
            ['encounter', 0.15],
            ['background', 0.20],
            ['environmental-shift', 0.20],
            ['message', 0.10],
            ['resource', 0.10],
        ])
        : 'background';
    const licenseId = `serendipity:${fingerprint(`${opportunityKey}|${seed}`).replace(':', '-')}`;
    const license = normalizeReceipt({
        version: SERENDIPITY_VERSION,
        licenseId,
        opportunityKey,
        objectKey: object,
        worldStateDigest: world,
        triggered,
        decision,
        direction,
        magnitude,
        channel,
        landing,
        sourceState: normalizedSourceState,
        explanationSpeed: settings.explanationSpeed,
        pressureCost,
        responseWindowRequired: direction === 'adverse'
            && ['rare', 'extreme'].includes(magnitude),
        actualBenefitRequired: direction === 'favorable',
        constraints: [
            ...baseConstraints(normalizedSourceState),
            ...(direction === 'favorable' ? [
                '收益必须先真实、持续生效；不得自动追加假货、诱饵、诅咒、立即追兵、突然损坏或更强首领来找平衡',
                '只把机会或收益放到玩家可感知的位置，不得替玩家拾取、装备、接受或使用',
            ] : []),
            ...(direction === 'adverse' ? [
                '不利事件只能消耗医生压力预算并保留最低可玩性',
                '重大坏事必须先给玩家可理解的响应窗口，不得直接结算不可逆失败',
            ] : []),
            ...(magnitude === 'extreme' && direction === 'favorable' ? [
                '允许极低概率的顶级武器、高权限身份卡等大奖，但必须不与明确事实冲突且不得替玩家拾取、装备、接受或使用',
            ] : []),
        ],
        target: {
            chatId,
            generation: target?.generation,
            generationId: target?.generationId,
        },
        drawHash: fingerprint(seed),
        createdAt: now,
    });
    return {
        status: hardContradiction ? 'rejected' : settings.frequency === 'off' ? 'disabled' : 'drawn',
        ledger,
        opportunityKey,
        license,
    };
}

export function bindAndSettleSerendipityLicense(ledgerInput, draftInput, targetInput, {
    now = Date.now(),
} = {}) {
    const target = normalizeTarget(targetInput);
    const ledger = normalizeSerendipityLedger(ledgerInput, { chatId: target.chatId });
    const draft = normalizeReceipt(draftInput);
    const exactGeneration = Boolean(
        draft.licenseId
        && target.chatId
        && draft.target.chatId === target.chatId
        && draft.target.generation === target.generation
        && draft.target.generationId === target.generationId
        && target.messageId
        && target.branchId
        && target.contentFingerprint
    );
    if (!exactGeneration) {
        return { ok: false, status: 'stale', ledger, license: null };
    }
    const duplicate = findDuplicate(
        ledger,
        draft.objectKey,
        draft.worldStateDigest,
        draft.opportunityKey,
    );
    if (duplicate) {
        return { ok: true, status: 'duplicate', ledger, license: clone(duplicate) };
    }
    const license = normalizeReceipt({
        ...draft,
        target,
        settledAt: now,
    });
    ledger.receipts = [...ledger.receipts, license].slice(-SERENDIPITY_MAX_RECEIPTS);
    return { ok: true, status: 'settled', ledger, license: clone(license) };
}

export function serendipityLicensePrompt(value) {
    const license = normalizeReceipt(value);
    if (!license.triggered) return '';
    const explanation = {
        never: '无需解释来源，可永久保持谜团。',
        slow: '只在后续多轮自然积累证据，不要本轮揭底。',
        natural: '仅在剧情自然触及时逐步揭示，不为解释而解释。',
        fast: '若当前已有可见证据，可较快解释；仍不得越过有限认知。',
    }[license.explanationSpeed];
    return [
        '【偶发许可证：仅供本次主模型自然实现】',
        `方向=${license.direction}；量级=${license.magnitude}；通道=${license.channel}；落点=${license.landing}；来源状态=${license.sourceState}。`,
        `来源处理=${explanation}`,
        ...license.constraints.map((constraint) => `- ${constraint}`),
        '- 许可证只允许一次偶发机会，不要求采用固定scene/act/then，也不授予医生改写正文或写变量的权限。',
    ].join('\n');
}
