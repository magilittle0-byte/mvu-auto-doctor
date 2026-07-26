import assert from 'node:assert/strict';
import test from 'node:test';

import { validateItemV2 } from '../v2/domain/index.mjs';
import * as transactionApi from '../v2/transaction/index.mjs';
import {
    SingleWriteQueue,
    abortTransaction,
    adaptHostMessageFingerprint,
    compareMessageFingerprints,
    createBranch,
    createMessageFingerprint,
    createIdempotencyKey,
    createTransaction,
    createTransactionKernel,
    hashCanonical,
    hashText,
    migrateLegacyBranchCheckpoint,
    transitionBranch,
    transitionTransaction,
} from '../v2/transaction/index.mjs';

test('transaction public entry exposes the phase-2 host-free API', () => {
    for (const name of [
        'adaptHostMessageFingerprint',
        'compareMessageFingerprints',
        'transitionBranch',
        'migrateLegacyBranchCheckpoint',
        'prepareTransaction',
        'transitionTransaction',
        'createTransactionKernel',
        'createSingleWriteQueue',
        'validateTransactionHostBridge',
        'buildCompareAndRestoreRollback',
    ]) {
        assert.equal(typeof transactionApi[name], 'function', `${name} must be public`);
    }
});

function fingerprint({
    chatId = 'chat-a',
    logicalIndex = 2,
    messageId = 'message-a',
    swipeId = 0,
    generation = 1,
    branchId = 'branch-a',
    parentHash = hashText('parent'),
    content = 'reply-a',
    contentHash,
} = {}) {
    const result = createMessageFingerprint({
        chatId,
        logicalIndex,
        messageId,
        swipeId,
        generation,
        branchId,
        parentHash,
        ...(contentHash === undefined ? { content } : { contentHash }),
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function branch(head, checkpointRef = 'checkpoint:root') {
    const result = createBranch({
        id: head.branchId,
        divergenceFingerprint: head,
        headFingerprint: head,
        checkpointRef,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function transaction(target, {
    idempotencyKey = 'reward:gold:10',
    kind = 'resource',
    id,
} = {}) {
    const result = createTransaction({
        ...(id ? { id } : {}),
        branchId: target.branchId,
        target,
        idempotencyKey,
        kind,
        effects: [],
        createdAt: 10,
        audit: [],
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

class MemoryHost {
    constructor({ fingerprint: currentFingerprint, branch: currentBranch, state }) {
        this.currentFingerprint = structuredClone(currentFingerprint);
        this.currentBranch = structuredClone(currentBranch);
        this.states = new Map();
        this.transactions = [];
        this.recoveries = [];
        this.readTargets = [];
        this.writeTargets = [];
        this.writeCount = 0;
        this.onWrite = null;
        this.addTarget(currentFingerprint, state);
    }

    key(target) {
        return hashCanonical(target);
    }

    addTarget(target, state) {
        this.states.set(this.key(target), structuredClone(state));
    }

    setCurrent(currentFingerprint, currentBranch, state) {
        this.currentFingerprint = structuredClone(currentFingerprint);
        this.currentBranch = structuredClone(currentBranch);
        if (state !== undefined) this.addTarget(currentFingerprint, state);
    }

    async captureCurrent() {
        return {
            fingerprint: structuredClone(this.currentFingerprint),
            branch: structuredClone(this.currentBranch),
        };
    }

    async readExact(target) {
        assert.equal(typeof target, 'object', 'exact reads cannot use latest');
        assert.ok(target.messageId, 'exact reads require a stable message ID');
        this.readTargets.push(structuredClone(target));
        const value = this.states.get(this.key(target));
        return value === undefined ? null : structuredClone(value);
    }

    async writeExact(target, state) {
        assert.equal(typeof target, 'object', 'exact writes cannot use latest');
        this.writeCount += 1;
        this.writeTargets.push(structuredClone(target));
        let next = structuredClone(state);
        if (this.onWrite) {
            next = await this.onWrite(next, this.writeCount, this) ?? next;
        }
        this.states.set(this.key(target), structuredClone(next));
    }

    async persistRecovery(record) {
        this.recoveries.push(structuredClone(record));
    }

    async persistTransaction(record) {
        this.transactions.push(structuredClone(record));
    }

    stateAt(target = this.currentFingerprint) {
        return structuredClone(this.states.get(this.key(target)));
    }
}

test('canonical hashes are deterministic and SHA-256 based', () => {
    assert.equal(
        hashText('abc'),
        'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    assert.equal(
        hashCanonical({ b: 2, a: 1 }),
        hashCanonical({ a: 1, b: 2 }),
    );
});

test('host fingerprint migration uses durable identity tiers and rejects ambiguity', () => {
    const migrated = adaptHostMessageFingerprint({
        chatId: 'chat-a',
        index: 2,
        message_id: 'native-id',
        swipe_id: 0,
        generationSerial: 4,
        branchId: 'branch-a',
        parentHash: 'parent',
        mes: 'current reply',
        extra: {
            mvu_auto_doctor_source_id: 'persisted-id',
        },
        swipe_info: [{
            extra: {
                mvu_auto_doctor_source_id: 'persisted-id',
            },
        }],
    });
    assert.equal(migrated.status, 'valid');
    assert.equal(migrated.value.messageId, 'persisted-id');
    assert.equal(migrated.identitySource, 'persisted');

    const ambiguous = adaptHostMessageFingerprint({
        chatId: 'chat-a',
        index: 2,
        swipe_id: 0,
        generationSerial: 4,
        branchId: 'branch-a',
        parentHash: 'parent',
        mes: 'current reply',
        extra: {
            mvu_auto_doctor_source_id: 'persisted-a',
        },
        swipe_info: [{
            extra: {
                mvu_auto_doctor_source_id: 'persisted-b',
            },
        }],
    });
    assert.ok(
        ['unresolved', 'rejected'].includes(ambiguous.status),
        'ambiguous host identity must never become valid',
    );
    assert.ok(ambiguous.issues.some((issue) => (
        issue.code === 'fingerprint.host_identity_ambiguous'
    )));
});

test('fingerprint comparison marks previous-reply results stale', () => {
    const expected = fingerprint({
        logicalIndex: 4,
        messageId: 'msg-current',
        generation: 4,
        contentHash: 'digest-red-83',
    });
    const candidate = fingerprint({
        logicalIndex: 2,
        messageId: 'msg-previous',
        generation: 2,
        contentHash: 'digest-silver-59',
    });
    const compared = compareMessageFingerprints(expected, candidate);
    assert.equal(compared.status, 'stale');
    assert.deepEqual(
        compared.mismatches.map((entry) => entry.field),
        ['logicalIndex', 'messageId', 'generation', 'contentHash'],
    );
});

test('continue stays in one branch while regenerate creates an isolated branch', () => {
    const rootFingerprint = fingerprint();
    const rootBranch = branch(rootFingerprint);
    const continuedFingerprint = fingerprint({
        generation: 2,
        parentHash: rootFingerprint.parentHash,
        content: 'reply-a continued',
    });
    const continued = transitionBranch(rootBranch, continuedFingerprint, {
        kind: 'continue',
    });
    assert.equal(continued.status, 'advanced');
    assert.equal(continued.activeBranch.id, rootBranch.id);
    assert.equal(continued.abandonedBranch, null);

    const rerolledFingerprint = fingerprint({
        messageId: 'message-rerolled',
        generation: 3,
        branchId: 'branch-b',
        parentHash: continuedFingerprint.parentHash,
        content: 'replacement reply',
    });
    const rerolled = transitionBranch(continued.activeBranch, rerolledFingerprint, {
        kind: 'regenerate',
        checkpointRef: 'checkpoint:before-floor-2',
    });
    assert.equal(rerolled.status, 'forked');
    assert.equal(rerolled.abandonedBranch.status, 'abandoned');
    assert.equal(rerolled.activeBranch.status, 'active');
    assert.equal(rerolled.activeBranch.parentBranchId, rootBranch.id);
    assert.deepEqual(rerolled.activeBranch.transactionIds, []);

    const ambiguousContinue = transitionBranch(
        rootBranch,
        fingerprint({
            messageId: 'different-message',
            generation: 2,
            parentHash: rootFingerprint.parentHash,
            content: 'not a valid continue',
        }),
        { kind: 'continue' },
    );
    assert.equal(ambiguousContinue.ok, false);
});

test('legacy branch checkpoints require explicit missing identity evidence', () => {
    const unresolved = migrateLegacyBranchCheckpoint({
        targetIndex: 2,
        messageId: 'legacy-message',
        swipeId: 0,
        state: { turn: 0, threads: [] },
    }, {
        chatId: 'chat-a',
        branchId: 'branch-a',
    });
    assert.ok(
        ['unresolved', 'rejected'].includes(unresolved.status),
        'missing checkpoint identity must never be guessed',
    );
    assert.ok(unresolved.issues.some((issue) => (
        issue.code === 'checkpoint.migration_identity_unresolved'
    )));

    const mapped = migrateLegacyBranchCheckpoint({
        targetIndex: 2,
        messageId: 'legacy-message',
        swipeId: 0,
        state: { turn: 0, threads: [] },
        authorSpecific: { keep: true },
    }, {
        chatId: 'chat-a',
        branchId: 'branch-a',
        generation: 1,
        parentHash: 'parent-hash',
        contentHash: 'content-hash',
        checkpointRef: 'checkpoint:migrated',
    });
    assert.equal(mapped.status, 'valid');
    assert.equal(mapped.migration.status, 'mapped');
    assert.deepEqual(mapped.value.payload, { turn: 0, threads: [] });
    assert.deepEqual(
        mapped.value.extensions.legacy.authorSpecific,
        { keep: true },
    );
});

test('transaction prepare blocks unresolved domain results', async () => {
    const target = fingerprint();
    const currentBranch = branch(target);
    const host = new MemoryHost({
        fingerprint: target,
        branch: currentBranch,
        state: { inventory: { potion: 1 } },
    });
    const kernel = createTransactionKernel(host);
    const unresolvedItem = validateItemV2({
        id: 'potion',
        schemaVersion: '2.0',
        revision: 0,
        name: 'untyped potion',
        kind: 'consumable',
        quantity: 1,
        stackable: false,
        description: 'heals a lot',
        provenance: [],
    }, {
        mechanicalEffectClaimed: true,
    });
    const prepared = await kernel.prepare(transaction(target), {
        domainResults: [unresolvedItem],
        writePlan: [{
            operation: 'set',
            path: '/inventory/potion',
            value: 0,
        }],
    });
    assert.equal(prepared.status, 'aborted');
    assert.equal(host.writeCount, 0);
    assert.ok(prepared.issues.some((issue) => (
        issue.code === 'transaction.domain_unresolved'
    )));
});

test('idempotency keys survive reroll identity changes but remain operation-specific', () => {
    const before = fingerprint();
    const rerolled = fingerprint({
        messageId: 'message-rerolled',
        branchId: 'branch-b',
        generation: 2,
        content: 'rerolled',
    });
    assert.equal(
        createIdempotencyKey({
            operation: 'reward',
            target: before,
            subject: 'quest-a',
            effect: 'gold-10',
        }),
        createIdempotencyKey({
            operation: 'reward',
            target: rerolled,
            subject: 'quest-a',
            effect: 'gold-10',
        }),
    );
    assert.notEqual(
        createIdempotencyKey({
            operation: 'reward',
            target: before,
            subject: 'quest-a',
            effect: 'gold-10',
        }),
        createIdempotencyKey({
            operation: 'reward',
            target: before,
            subject: 'quest-a',
            effect: 'gold-20',
        }),
    );
});

test('explicit path preconditions are enforced and unknown kinds are unresolved', async () => {
    const target = fingerprint();
    const currentBranch = branch(target);
    const host = new MemoryHost({
        fingerprint: target,
        branch: currentBranch,
        state: { wallet: { gold: 5 } },
    });
    const kernel = createTransactionKernel(host);
    const failed = await kernel.prepare({
        ...transaction(target),
        preconditions: [{
            type: 'path-equals',
            path: '/wallet/gold',
            value: 0,
        }],
    }, {
        writePlan: [{
            operation: 'set',
            path: '/wallet/gold',
            value: 10,
        }],
    });
    assert.equal(failed.status, 'aborted');
    assert.ok(failed.issues.some((issue) => (
        issue.code === 'transaction.precondition_failed'
    )));

    const unknown = await kernel.prepare({
        ...transaction(target, { idempotencyKey: 'unknown-precondition' }),
        preconditions: [{
            type: 'domain-magic',
            path: '/wallet/gold',
        }],
    }, {
        writePlan: [{
            operation: 'set',
            path: '/wallet/gold',
            value: 10,
        }],
    });
    assert.equal(unknown.status, 'aborted');
    assert.ok(unknown.issues.some((issue) => (
        issue.code === 'transaction.precondition_kind_unresolved'
    )));
    assert.equal(host.writeCount, 0);
});

test('transaction state machine makes terminal states final', () => {
    const proposed = transaction(fingerprint());
    const aborted = abortTransaction(proposed, 'cancelled');
    assert.equal(aborted.value.status, 'aborted');
    const invalid = transitionTransaction(aborted.value, 'prepared');
    assert.equal(invalid.status, 'rejected');
    assert.ok(invalid.issues.some((issue) => (
        issue.code === 'transaction.invalid_transition'
    )));
});

test('single write queue never overlaps concurrent tasks', async () => {
    const queue = new SingleWriteQueue();
    let active = 0;
    let maximum = 0;
    const order = [];
    const run = (id, delay) => queue.enqueue(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        order.push(`start-${id}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        order.push(`end-${id}`);
        active -= 1;
    });
    await Promise.all([
        run('a', 15),
        run('b', 1),
        run('c', 1),
    ]);
    assert.equal(maximum, 1);
    assert.deepEqual(order, [
        'start-a',
        'end-a',
        'start-b',
        'end-b',
        'start-c',
        'end-c',
    ]);
});

test('concurrent duplicate settlement commits once per branch and key', async () => {
    const target = fingerprint();
    const currentBranch = branch(target);
    const host = new MemoryHost({
        fingerprint: target,
        branch: currentBranch,
        state: { wallet: { gold: 0 }, external: { marker: 'keep' } },
    });
    const kernel = createTransactionKernel(host);
    const proposal = transaction(target);
    const options = {
        writePlan: [{
            operation: 'set',
            path: '/wallet/gold',
            value: 10,
        }],
    };
    const [firstPrepared, secondPrepared] = await Promise.all([
        kernel.prepare(proposal, options),
        kernel.prepare(proposal, options),
    ]);
    assert.equal(firstPrepared.status, 'prepared');
    assert.equal(secondPrepared.status, 'prepared');
    const [first, second] = await Promise.all([
        kernel.commit(firstPrepared),
        kernel.commit(secondPrepared),
    ]);
    assert.deepEqual(
        [first.status, second.status].sort(),
        ['committed', 'duplicate'],
    );
    assert.equal(host.writeCount, 1);
    assert.equal(host.stateAt().wallet.gold, 10);
    assert.equal(host.stateAt().external.marker, 'keep');
    assert.ok(host.readTargets.every((readTarget) => readTarget.messageId === 'message-a'));
});

test('a result that becomes late after prepare is stale and cannot write', async () => {
    const target = fingerprint();
    const currentBranch = branch(target);
    const host = new MemoryHost({
        fingerprint: target,
        branch: currentBranch,
        state: { wallet: { gold: 0 } },
    });
    const kernel = createTransactionKernel(host);
    const prepared = await kernel.prepare(transaction(target), {
        writePlan: [{
            operation: 'set',
            path: '/wallet/gold',
            value: 10,
        }],
    });
    assert.equal(prepared.status, 'prepared');

    const replacement = fingerprint({
        messageId: 'replacement',
        branchId: 'branch-b',
        generation: 2,
        content: 'replacement',
    });
    const replacementBranch = branch(replacement, 'checkpoint:replacement');
    host.setCurrent(replacement, replacementBranch, { wallet: { gold: 0 } });
    const result = await kernel.commit(prepared);
    assert.equal(result.status, 'stale');
    assert.equal(host.writeCount, 0);
    assert.equal(host.stateAt(replacement).wallet.gold, 0);
});

test('readback failure rolls back only matching write-after paths', async () => {
    const target = fingerprint();
    const currentBranch = branch(target);
    const host = new MemoryHost({
        fingerprint: target,
        branch: currentBranch,
        state: {
            wallet: { gold: 0 },
            quest: { status: 'idle' },
            marker: { done: false },
            external: { flag: 'before' },
        },
    });
    host.onWrite = (next, writeCount) => {
        if (writeCount !== 1) return next;
        next.wallet.gold = 99;
        next.marker.done = false;
        next.external.flag = 'changed-concurrently';
        return next;
    };
    const kernel = createTransactionKernel(host);
    const prepared = await kernel.prepare(transaction(target), {
        writePlan: [
            {
                operation: 'set',
                path: '/wallet/gold',
                value: 10,
            },
            {
                operation: 'set',
                path: '/quest/status',
                value: 'active',
            },
            {
                operation: 'set',
                path: '/marker/done',
                value: true,
            },
        ],
    });
    const result = await kernel.commit(prepared);
    assert.equal(result.status, 'rolled_back');
    assert.deepEqual(
        result.transaction.rollback.revertedPaths,
        ['/quest/status'],
    );
    assert.deepEqual(
        result.transaction.rollback.preservedConcurrentPaths,
        ['/wallet/gold', '/marker/done'],
    );
    const state = host.stateAt();
    assert.equal(state.wallet.gold, 99, 'same-path concurrent change must survive');
    assert.equal(state.quest.status, 'idle', 'matching transaction value must roll back');
    assert.equal(state.marker.done, false, 'already-restored path must not be overwritten');
    assert.equal(state.external.flag, 'changed-concurrently');
    assert.equal(host.writeCount, 2, 'one commit attempt and one rollback write');
});
