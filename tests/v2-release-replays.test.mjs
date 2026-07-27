import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runPhase7ReleaseReplay } from '../v2/release/index.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.resolve(TEST_DIR, '..', 'fixtures', '2.0', 'replay-cases.json');
const corpus = JSON.parse(await readFile(CORPUS_PATH, 'utf8'));

test('replay.release.real_qc_wins — RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION', () => {
    const fixture = corpus.cases.find(
        (entry) => entry.id === 'RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION',
    );
    assert.ok(fixture);
    const result = runPhase7ReleaseReplay(fixture);
    assert.equal(result.decision, fixture.expected.decision);
    assert.equal(result.release.status, 'blocked');
    assert.equal(result.release.real_qc_failure, true);
    assert.equal(Object.hasOwn(result.release, 'publish'), false);
    assert.equal(result.pass, true);
});
