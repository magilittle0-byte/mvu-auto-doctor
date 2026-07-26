import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    compareMessageFingerprints,
    createBranch,
    createMessageFingerprint,
    createTransaction,
    createTransactionKernel,
    hashCanonical,
    hashText,
    transitionBranch,
} from '../v2/transaction/index.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.resolve(TEST_DIR, '..', 'fixtures', '2.0', 'replay-cases.json');
const corpus = JSON.parse(await readFile(CORPUS_PATH, 'utf8'));
const replayById = new Map(corpus.cases.map((entry) => [entry.id, entry]));

function replay(id) {
    const value = replayById.get(id);
    assert.ok(value, `missing replay fixture ${id}`);
    return value;
}

function messageFingerprint({
    logicalIndex,
    messageId,
    contentHash,
    generation,
    branchId,
    parentHash = 'digest-parent',
}) {
    const result = createMessageFingerprint({
        chatId: 'fixture-chat',
        logicalIndex,
        messageId,
        swipeId: 0,
        generation,
        branchId,
        parentHash,
        contentHash,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function activeBranch(fingerprint, checkpointRef = 'fixture:checkpoint') {
    const result = createBranch({
        id: fingerprint.branchId,
        divergenceFingerprint: fingerprint,
        headFingerprint: fingerprint,
        checkpointRef,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

class ReplayHost {
    constructor(fingerprint, branch, state) {
        this.fingerprint = structuredClone(fingerprint);
        this.branch = structuredClone(branch);
        this.states = new Map([[hashCanonical(fingerprint), structuredClone(state)]]);
        this.writeCount = 0;
        this.transactions = [];
        this.recoveries = [];
    }

    async captureCurrent() {
        return {
            fingerprint: structuredClone(this.fingerprint),
            branch: structuredClone(this.branch),
        };
    }

    async readExact(target) {
        const value = this.states.get(hashCanonical(target));
        return value === undefined ? null : structuredClone(value);
    }

    async writeExact(target, state) {
        this.writeCount += 1;
        this.states.set(hashCanonical(target), structuredClone(state));
    }

    async persistRecovery(record) {
        this.recoveries.push(structuredClone(record));
    }

    async persistTransaction(transaction) {
        this.transactions.push(structuredClone(transaction));
    }

    switchBranch(fingerprint, branch, state) {
        this.fingerprint = structuredClone(fingerprint);
        this.branch = structuredClone(branch);
        this.states.set(hashCanonical(fingerprint), structuredClone(state));
    }

    currentState() {
        return structuredClone(this.states.get(hashCanonical(this.fingerprint)));
    }
}

function proposal(target, idempotencyKey) {
    const result = createTransaction({
        branchId: target.branchId,
        target,
        idempotencyKey,
        kind: 'resource',
        effects: [],
        createdAt: 100,
        audit: [],
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

test('replay.fingerprint.previous_reply — RR-FINGERPRINT-PREVIOUS-REPLY', () => {
    const fixture = replay('RR-FINGERPRINT-PREVIOUS-REPLY');
    const { expectedFingerprint, candidateFingerprint } = fixture.input.context;
    const expected = messageFingerprint({
        logicalIndex: 4,
        messageId: expectedFingerprint.logicalMessageId,
        contentHash: expectedFingerprint.contentDigest,
        generation: 4,
        branchId: fixture.input.context.branchId,
    });
    const candidate = messageFingerprint({
        logicalIndex: 2,
        messageId: candidateFingerprint.logicalMessageId,
        contentHash: candidateFingerprint.contentDigest,
        generation: 2,
        branchId: fixture.input.context.branchId,
    });
    const result = compareMessageFingerprints(expected, candidate);
    assert.equal(result.status, fixture.expected.decision);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((entry) => entry.field === 'messageId'));
    assert.ok(result.mismatches.some((entry) => entry.field === 'contentHash'));
});

test('replay.reroll.idempotency — RR-REROLL-IDEMPOTENCY', async () => {
    const fixture = replay('RR-REROLL-IDEMPOTENCY');
    const oldFingerprint = messageFingerprint({
        logicalIndex: 42,
        messageId: 'msg-42-old',
        contentHash: hashText('old reply'),
        generation: 1,
        branchId: fixture.input.context.parentBranchId,
    });
    const oldBranch = activeBranch(oldFingerprint, 'checkpoint:before-msg-42');
    const host = new ReplayHost(oldFingerprint, oldBranch, {
        wallet: { gold: 0 },
        quests: { old: 'absent' },
    });
    const kernel = createTransactionKernel(host);
    const latePrepared = await kernel.prepare(
        proposal(oldFingerprint, 'msg-42:late-old-task'),
        {
            writePlan: [{
                operation: 'set',
                path: '/quests/old',
                value: 'active',
            }],
        },
    );
    const oldPrepared = await kernel.prepare(
        proposal(oldFingerprint, fixture.input.context.idempotencyKey),
        {
            writePlan: [{
                operation: 'set',
                path: '/wallet/gold',
                value: fixture.input.operation.payload.oldBranch.rewardCommitted,
            }],
        },
    );
    const oldCommitted = await kernel.commit(oldPrepared);
    assert.equal(oldCommitted.status, 'committed');
    assert.equal(host.currentState().wallet.gold, 10);

    const newFingerprint = messageFingerprint({
        logicalIndex: 42,
        messageId: 'msg-42-new',
        contentHash: hashText('rerolled reply'),
        generation: 2,
        branchId: fixture.input.context.branchId,
        parentHash: oldFingerprint.parentHash,
    });
    const rerolled = transitionBranch(oldBranch, newFingerprint, {
        kind: 'regenerate',
        checkpointRef: 'checkpoint:before-msg-42',
    });
    assert.equal(rerolled.status, 'forked');
    assert.equal(rerolled.abandonedBranch.status, 'abandoned');
    host.switchBranch(newFingerprint, rerolled.activeBranch, {
        wallet: { gold: 0 },
        quests: { old: 'cancelled_or_superseded' },
    });

    const staleLate = await kernel.commit(latePrepared);
    assert.equal(staleLate.status, 'stale');
    assert.equal(host.currentState().quests.old, 'cancelled_or_superseded');

    const newProposal = proposal(
        newFingerprint,
        fixture.input.context.idempotencyKey,
    );
    const writePlan = [{
        operation: 'set',
        path: '/wallet/gold',
        value: fixture.input.operation.payload.newCandidate.rewardDelta,
    }];
    const firstPrepared = await kernel.prepare(newProposal, { writePlan });
    const secondPrepared = await kernel.prepare(newProposal, { writePlan });
    const [first, duplicate] = await Promise.all([
        kernel.commit(firstPrepared),
        kernel.commit(secondPrepared),
    ]);
    assert.equal(first.status, 'committed');
    assert.equal(duplicate.status, 'duplicate');
    assert.equal(host.currentState().wallet.gold, 10);
    assert.equal(host.writeCount, 2, 'old branch and new branch each settle once');
});
