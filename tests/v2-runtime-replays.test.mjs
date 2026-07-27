import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    MemoryVersionedAdapter,
    NarrativeBarrierCoordinator,
    TaskLeaseManager,
    buildReplayAutomationReport,
    runPhase6Replay,
} from '../v2/runtime/index.mjs';
import {
    createBranch,
    createMessageFingerprint,
    hashText,
} from '../v2/transaction/index.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.resolve(TEST_DIR, '..', 'fixtures', '2.0', 'replay-cases.json');
const corpus = JSON.parse(await readFile(CORPUS_PATH, 'utf8'));
const replayById = new Map(corpus.cases.map((entry) => [entry.id, entry]));

function replay(id) {
    const fixture = replayById.get(id);
    assert.ok(fixture, `missing replay fixture ${id}`);
    return fixture;
}

function target() {
    return createMessageFingerprint({
        chatId: 'chat-replay',
        logicalIndex: 4,
        messageId: 'message-replay',
        swipeId: 0,
        generation: 1,
        branchId: 'branch-current',
        parentHash: hashText('parent'),
        content: 'repair not settled',
    }).value;
}

function branch(fingerprint) {
    return createBranch({
        id: fingerprint.branchId,
        divergenceFingerprint: fingerprint,
        headFingerprint: fingerprint,
        checkpointRef: 'checkpoint:replay',
    }).value;
}

test('replay.repair.database_barrier — RR-REPAIR-DB-BARRIER', async () => {
    const fingerprint = target();
    const adapter = new MemoryVersionedAdapter();
    let releaseRepair;
    const gate = new Promise((resolve) => {
        releaseRepair = resolve;
    });
    const runtime = new NarrativeBarrierCoordinator({
        adapter,
        host: {
            captureCurrent: async () => ({
                fingerprint,
                branch: branch(fingerprint),
            }),
            executePlannedDomainTransaction: async (planResult) => ({
                status: 'committed',
                transaction: {
                    ...planResult.value.transaction,
                    status: 'committed',
                },
            }),
        },
    });
    const planResult = {
        value: {
            transaction: {
                id: 'transaction:replay',
                branchId: fingerprint.branchId,
                target: fingerprint,
            },
        },
    };
    const execution = runtime.execute(planResult, {
        repair: async () => {
            await gate;
            return { status: 'completed' };
        },
    });
    await new Promise((resolve) => setImmediate(resolve));
    const result = await runPhase6Replay(
        replay('RR-REPAIR-DB-BARRIER'),
        { barrier: runtime, target: fingerprint },
    );
    assert.equal(result.decision, 'hold');
    assert.equal(result.databaseWrite, false);
    assert.equal(result.pass, true);
    releaseRepair();
    await execution;
});

test('replay.task.watchdog — RR-TASK-WATCHDOG', async () => {
    const fingerprint = target();
    const fixture = replay('RR-TASK-WATCHDOG');
    let clock = 0;
    const leases = new TaskLeaseManager(new MemoryVersionedAdapter(), {
        now: () => clock,
        heartbeatTimeoutMs: 10 * 60 * 1000,
    });
    await leases.create({
        id: 'lease:replay',
        branchId: fingerprint.branchId,
        target: fingerprint,
        softDeadlineAt: 30 * 60 * 1000,
        hardDeadlineAt: 60 * 60 * 1000,
    });
    await leases.start('lease:replay', 'model');
    clock = 10 * 60 * 1000;
    await leases.heartbeat('lease:replay');
    clock = fixture.input.context.elapsedMinutes * 60 * 1000;
    const result = await runPhase6Replay(fixture, {
        leases,
        leaseId: 'lease:replay',
        now: clock,
    });
    assert.equal(result.decision, fixture.expected.decision);
    assert.equal(result.taskStatus, 'timed-out');
    assert.equal(result.unverifiedWrite, false);
    assert.equal(result.pass, true);
});

test('replay.database.safety — RR-DATABASE-LENGTH-SQL-CONCURRENCY', async () => {
    const fixture = replay('RR-DATABASE-LENGTH-SQL-CONCURRENCY');
    const result = await runPhase6Replay(fixture);
    assert.equal(result.decision, fixture.expected.decision);
    assert.equal(result.committed, false);
    assert.equal(result.pass, true);
});

test('phase-6 report covers the complete matrix after phase-7 release gate activation', async () => {
    const results = [
        { id: 'RR-REPAIR-DB-BARRIER', pass: true },
        { id: 'RR-TASK-WATCHDOG', pass: true },
        { id: 'RR-DATABASE-LENGTH-SQL-CONCURRENCY', pass: true },
    ];
    const report = buildReplayAutomationReport(corpus, results, {
        generatedAt: '2026-07-27T00:00:00.000Z',
    });
    assert.equal(report.totals.cases, 17);
    assert.equal(report.totals.fail, 0);
    const release = report.cases.find(
        (entry) => entry.id === 'RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION',
    );
    assert.equal(release.automation, 'unit-active');
    assert.equal(release.status, 'covered-by-phase-suite');
});
