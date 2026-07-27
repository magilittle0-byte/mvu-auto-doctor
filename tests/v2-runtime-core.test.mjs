import assert from 'node:assert/strict';
import test from 'node:test';

import {
    MemoryVersionedAdapter,
    NarrativeBarrierCoordinator,
    PersistentIdempotencyStore,
    PersistentRecoveryStore,
    TaskLeaseManager,
    executeDatabaseWrite,
    validateDatabaseWrite,
} from '../v2/runtime/index.mjs';
import {
    createBranch,
    createMessageFingerprint,
    hashText,
} from '../v2/transaction/index.mjs';

function target({
    branchId = 'branch-current',
    messageId = 'message-current',
    content = 'final narrative',
} = {}) {
    const result = createMessageFingerprint({
        chatId: 'chat-runtime',
        logicalIndex: 7,
        messageId,
        swipeId: 0,
        generation: 3,
        branchId,
        parentHash: hashText('parent'),
        content,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function branch(fingerprint = target()) {
    const result = createBranch({
        id: fingerprint.branchId,
        divergenceFingerprint: fingerprint,
        headFingerprint: fingerprint,
        checkpointRef: 'checkpoint:runtime',
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function plan(fingerprint = target()) {
    return {
        status: 'valid',
        value: {
            transaction: {
                id: 'transaction:runtime',
                protocolVersion: '2.0',
                branchId: fingerprint.branchId,
                target: fingerprint,
                idempotencyKey: 'runtime:exact-write',
                kind: 'compound',
                status: 'proposed',
                preconditions: [],
                effects: [],
                touchedRefs: ['/state/value'],
                createdAt: 1,
                audit: [],
            },
        },
    };
}

test('persistent idempotency and recovery records survive store recreation', async () => {
    const adapter = new MemoryVersionedAdapter();
    const first = new PersistentIdempotencyStore(adapter);
    const scope = 'branch-current\u0000runtime:exact-write';
    const claimed = await first.claim(scope, 'transaction:runtime');
    assert.equal(claimed.status, 'claimed');
    assert.equal(claimed.transactionId, 'transaction:runtime');
    assert.equal(typeof claimed.claimedAt, 'number');
    await first.settle(scope, {
        id: 'transaction:runtime',
        status: 'committed',
    });

    const reopened = new PersistentIdempotencyStore(adapter);
    const settled = await reopened.get(scope);
    assert.equal(settled.status, 'settled');
    assert.equal(settled.transaction.status, 'committed');
    assert.equal(
        (await reopened.claim(scope, 'transaction:other')).transactionId,
        'transaction:runtime',
    );

    const recovery = new PersistentRecoveryStore(adapter);
    await recovery.persist({
        id: 'recovery:runtime',
        status: 'prepared',
        beforeTouched: [{ path: '/state/value', value: 1 }],
        afterTouched: [{ path: '/state/value', value: 2 }],
    });
    const reopenedRecovery = new PersistentRecoveryStore(adapter);
    assert.equal((await reopenedRecovery.get('recovery:runtime')).status, 'prepared');
    await reopenedRecovery.settle('recovery:runtime', 'committed');
    assert.equal((await recovery.get('recovery:runtime')).status, 'committed');
});

test('narrative barrier blocks downstream until exact state commit and readback settle', async () => {
    const adapter = new MemoryVersionedAdapter();
    const fingerprint = target();
    const activeBranch = branch(fingerprint);
    const events = [];
    let releaseRepair;
    const repairGate = new Promise((resolve) => {
        releaseRepair = resolve;
    });
    const host = {
        captureCurrent: async () => ({
            fingerprint,
            branch: activeBranch,
        }),
        executePlannedDomainTransaction: async (planResult) => {
            events.push('transaction.committed');
            return {
                status: 'committed',
                transaction: {
                    ...planResult.value.transaction,
                    status: 'committed',
                },
            };
        },
        readFinalNarrative: async () => {
            events.push('downstream.read');
            return 'final narrative';
        },
        publishBarrier: (barrier) => events.push(`barrier.${barrier.state}`),
    };
    const runtime = new NarrativeBarrierCoordinator({ adapter, host });
    const execution = runtime.execute(plan(fingerprint), {
        repair: async () => {
            events.push('repairing');
            await repairGate;
            events.push('repair.verified');
            return { status: 'completed' };
        },
    });

    await new Promise((resolve) => setImmediate(resolve));
    const blocked = await runtime.runDownstream(fingerprint, () => {
        events.push('database.write');
    });
    assert.equal(blocked.status, 'blocked');
    assert.equal(events.includes('database.write'), false);

    releaseRepair();
    const settled = await execution;
    assert.equal(settled.status, 'settled');
    const downstream = await runtime.runDownstream(
        fingerprint,
        ({ narrative }) => {
            events.push('database.write');
            return narrative;
        },
    );
    assert.equal(downstream.status, 'completed');
    assert.equal(downstream.value, 'final narrative');
    assert.ok(
        events.indexOf('transaction.committed') < events.indexOf('downstream.read'),
    );
    assert.ok(
        events.indexOf('barrier.settled') < events.indexOf('database.write'),
    );
});

test('stale and failed barriers abandon downstream with zero late writes', async () => {
    const adapter = new MemoryVersionedAdapter();
    const original = target();
    let current = {
        fingerprint: original,
        branch: branch(original),
    };
    let writes = 0;
    const runtime = new NarrativeBarrierCoordinator({
        adapter,
        host: {
            captureCurrent: async () => current,
            executePlannedDomainTransaction: async () => {
                current = {
                    fingerprint: target({
                        branchId: 'branch-new',
                        messageId: 'message-reroll',
                        content: 'rerolled narrative',
                    }),
                    branch: branch(target({
                        branchId: 'branch-new',
                        messageId: 'message-reroll',
                        content: 'rerolled narrative',
                    })),
                };
                return {
                    status: 'committed',
                    transaction: {
                        ...plan(original).value.transaction,
                        status: 'committed',
                    },
                };
            },
        },
    });
    const result = await runtime.execute(plan(original));
    assert.equal(result.status, 'stale');
    const downstream = await runtime.runDownstream(original, () => {
        writes += 1;
    });
    assert.equal(downstream.status, 'abandoned');
    assert.equal(writes, 0);
});

test('TaskLease exposes progress, soft cancellation, watchdog timeout and late-result rejection', async () => {
    let now = 0;
    const adapter = new MemoryVersionedAdapter();
    const fingerprint = target();
    const activeBranch = branch(fingerprint);
    const leases = new TaskLeaseManager(adapter, {
        now: () => now,
        heartbeatTimeoutMs: 10 * 60 * 1000,
    });
    await leases.create({
        id: 'lease:watchdog',
        branchId: fingerprint.branchId,
        target: fingerprint,
        softDeadlineAt: 30 * 60 * 1000,
        hardDeadlineAt: 60 * 60 * 1000,
    });
    await leases.start('lease:watchdog', 'model-analysis');
    now = 10 * 60 * 1000;
    await leases.heartbeat('lease:watchdog', {
        phase: 'model-analysis',
        progress: { current: 2, total: 4, label: 'validated chunks' },
    });
    assert.equal((await leases.read('lease:watchdog')).progress.current, 2);

    now = 65 * 60 * 1000;
    const watched = await leases.watchdog('lease:watchdog');
    assert.equal(watched.status, 'timed-out');
    assert.equal(watched.diagnostic.code, 'task.hard_timeout');
    assert.equal(
        await leases.acceptsResult('lease:watchdog', {
            fingerprint,
            branch: activeBranch,
        }),
        false,
    );
});

test('database gate reports length, SQL parameterization and revision conflicts together', async () => {
    const rejected = validateDatabaseWrite({
        payload: 'x'.repeat(601),
        fieldLimit: 600,
        statement: 'UPDATE memory SET summary = concatenated_value',
        parameters: [],
        parameterized: false,
        expectedRevision: 8,
        observedRevision: 9,
    });
    assert.equal(rejected.status, 'rejected');
    assert.deepEqual(
        rejected.issues.map((entry) => entry.code),
        [
            'database.field_length',
            'database.statement_not_parameterized',
            'database.revision_conflict',
        ],
    );

    let commits = 0;
    const accepted = await executeDatabaseWrite({
        payload: 'safe',
        fieldLimit: 600,
        statement: 'UPDATE memory SET summary = ? WHERE id = ? AND revision = ?',
        parameters: ['safe', 'row-1', 9],
        parameterized: true,
        expectedRevision: 9,
        observedRevision: 9,
    }, {
        executeParameterized: async () => {
            commits += 1;
            return { committed: true, revision: 10 };
        },
    });
    assert.equal(accepted.status, 'committed');
    assert.equal(commits, 1);
});
