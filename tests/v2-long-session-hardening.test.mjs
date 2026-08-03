import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildContinuitySourcePlan,
    DownstreamBarrierProtocol,
    MemoryVersionedAdapter,
} from '../v2/runtime/index.mjs';
import {
    diagnosticPrivacyCanaryFindings,
    createPrivacySafeDiagnosticProjection,
} from '../v2/surface/index.mjs';
import {
    prepareLegacyUpgradeDrill,
    rollbackLegacyUpgrade,
} from '../v2/release/index.mjs';

test('optional cooperative clients get receipts whose failed/stale states permanently reject writes', async () => {
    const adapter = new MemoryVersionedAdapter();
    const first = new DownstreamBarrierProtocol(adapter, { now: () => 10 });
    assert.equal((await first.clientStatus('taverndb')).ok, false);
    const rejectedRegistration = await first.register({
        id: 'taverndb',
        protocolVersion: 1,
        settledOnly: false,
        terminalReceipts: true,
    });
    assert.equal(rejectedRegistration.ok, false);
    assert.ok(rejectedRegistration.issues.some(
        (entry) => entry.code === 'barrier.settled_only',
    ));
    assert.equal((await first.register({
        id: 'taverndb',
        protocolVersion: 1,
        settledOnly: true,
        terminalReceipts: true,
    })).ok, true);

    const failedReceipt = await first.issue({
        id: 'barrier:failed',
        state: 'failed',
        branchId: 'branch-a',
        chatId: 'chat-a',
        targetIndex: 58,
        messageId: 'message-58',
        initialSwipeId: 0,
        generation: 1,
        finalFingerprint: 'fingerprint-58',
    });
    const forbidden = await first.acknowledge({
        clientId: 'taverndb',
        receiptId: failedReceipt.id,
        action: 'write',
        targetDigest: failedReceipt.targetDigest,
    });
    assert.equal(forbidden.ok, false);
    assert.ok(forbidden.issues.some(
        (entry) => entry.code === 'barrier.write_forbidden',
    ));
    const invalidAction = await first.acknowledge({
        clientId: 'taverndb',
        receiptId: failedReceipt.id,
        action: 'ignored',
        targetDigest: failedReceipt.targetDigest,
    });
    assert.equal(invalidAction.ok, false);
    assert.ok(invalidAction.issues.some(
        (entry) => entry.code === 'barrier.action_not_permitted',
    ));
    assert.equal((await first.acknowledge({
        clientId: 'taverndb',
        receiptId: failedReceipt.id,
        action: 'abandon',
        targetDigest: failedReceipt.targetDigest,
    })).ok, true);

    const settledReceipt = await first.issue({
        id: 'barrier:settled',
        state: 'settled',
        branchId: 'branch-b',
        chatId: 'chat-a',
        targetIndex: 64,
        messageId: 'message-64',
        finalSwipeId: 0,
        generation: 2,
        finalFingerprint: 'fingerprint-64',
    });
    assert.equal((await first.acknowledge({
        clientId: 'taverndb',
        receiptId: settledReceipt.id,
        action: 'read-final-and-write',
        targetDigest: settledReceipt.targetDigest,
    })).ok, true);

    const reopened = new DownstreamBarrierProtocol(adapter, { now: () => 20 });
    assert.equal((await reopened.clientStatus('taverndb')).ok, true);
    assert.equal(
        (await reopened.readReceipt(failedReceipt.id))
            .acknowledgements.taverndb.action,
        'abandon',
    );
});

test('continuity catch-up permanently skips failed and stale source floors with receipts', () => {
    const messages = Array.from({ length: 9 }, (_, index) => ({
        is_user: index % 2 === 1,
        is_system: false,
        mes: `synthetic-${index}`,
        ...([4, 6].includes(index) ? {
            swipe_id: 1,
            extra: {
                mvu_auto_doctor_source_id: `message-${index}`,
                mvu_auto_doctor_generation_id: `generation-${index}`,
                mvu_auto_doctor_branch_id: `current-${index}`,
            },
        } : {}),
    }));
    const plan = buildContinuitySourcePlan({
        messages,
        fromIndex: 2,
        toIndex: 8,
        barrierHistory: [
            { id: 'b2', targetIndex: 2, state: 'failed', updatedAt: 10 },
            {
                id: 'b4-old',
                targetIndex: 4,
                messageId: 'message-4',
                finalSwipeId: 0,
                generationId: 'old-generation-4',
                branchId: 'old-4',
                state: 'failed',
                updatedAt: 20,
            },
            {
                id: 'b4',
                targetIndex: 4,
                messageId: 'message-4',
                finalSwipeId: 1,
                generationId: 'generation-4',
                branchId: 'current-4',
                state: 'settled',
                updatedAt: 11,
            },
            {
                id: 'b6',
                targetIndex: 6,
                messageId: 'message-6',
                finalSwipeId: 1,
                generationId: 'generation-6',
                branchId: 'current-6',
                state: 'stale',
                updatedAt: 12,
            },
            { id: 'b8', targetIndex: 8, state: 'settled', updatedAt: 13 },
        ],
    });
    assert.deepEqual(plan.eligibleIndexes, [4, 8]);
    assert.deepEqual(plan.skippedIndexes, [2, 6]);
    assert.equal(plan.receipts[0].decision, 'permanently-skipped');
    assert.equal(plan.receipts.at(-1).decision, 'eligible');
});

test('diagnostic projection removes narrative derivatives, full prompts, raw payloads and full User-Agent', () => {
    const canary = 'PRIVATE-STORY-CANARY-7f9d';
    const diagnostic = createPrivacySafeDiagnosticProjection({
        userAgent: 'Mozilla/5.0 (Linux; Android 15; PrivateDevice) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile',
        plugin: { id: 'mvu_auto_doctor', version: '2.0.0-rc.8' },
        environment: {
            status: 'error',
            checks: [{ kind: 'error', message: canary }],
        },
        statuses: {
            social: { kind: 'error', text: canary },
        },
        socialAudit: {
            id: 'audit-canary',
            verdict: 'warning',
            summary: canary,
            findings: [{ reason: canary, evidence: canary }],
            decisions: [{ reason: canary, evidence: canary }],
            modelCall: { failureCode: 'social.invalid_structure_after_repair' },
        },
        prompt: {
            task: canary,
            messages: [{ role: 'user', content: canary }],
            totalChars: canary.length,
        },
        modelDiagnostics: [{
            failureKind: 'invalid-json',
            reason: canary,
            rawPayload: canary,
        }],
        barrierProtocol: {
            required: false,
            externalDatabaseDetected: true,
            registered: false,
            clientCount: 0,
            errorCode: '',
            mode: 'unmanaged',
            externalWriteConsistency: 'unknown',
        },
    });
    assert.deepEqual(diagnostic.environment.userAgent, {
        platform: 'Android',
        kernel: 'Chromium',
        kernelMajor: 140,
    });
    assert.equal(JSON.stringify(diagnostic).includes('PrivateDevice'), false);
    assert.equal(JSON.stringify(diagnostic).includes(canary), false);
    assert.deepEqual(diagnostic.environment.barrierProtocol, {
        required: false,
        externalDatabaseDetected: true,
        registered: false,
        clientCount: 0,
        errorCode: '',
        mode: 'unmanaged',
        externalWriteConsistency: 'unknown',
    });
    assert.deepEqual(diagnosticPrivacyCanaryFindings(diagnostic, [canary]), {
        credentialFindings: 0,
        absoluteUserPathFindings: 0,
        rawPayloadFindings: 0,
        privateContentFindings: 0,
    });
});

test('3.5MB 65-message 48-swipe legacy archive preserves companion and unknown fields', () => {
    let remainingSwipes = 48;
    const messages = Array.from({ length: 65 }, (_, index) => {
        const isUser = index % 2 === 0;
        const swipeCount = isUser ? 0 : (index === 1 ? 17 : 1);
        remainingSwipes -= swipeCount;
        const swipes = Array.from({ length: swipeCount }, (__, swipeIndex) => (
            `synthetic-swipe-${index}-${swipeIndex}`
        ));
        return {
            is_user: isUser,
            mes: '合成长局填充'.repeat(3_300),
            extra: {
                unknownAuthorField: { kept: true, index },
                TavernDB: { revision: index, fields: { kept: true } },
                rerollHelperV2: { sourceIdentity: `helper-${index}` },
                mvu_auto_doctor_source_id: `doctor-${index}`,
            },
            ...(isUser ? {} : {
                swipe_id: Math.max(0, swipeCount - 1),
                swipes,
                swipe_info: swipes.map((__, swipeIndex) => ({
                    extra: {
                        mvu_auto_doctor_source_id: swipeIndex === swipeCount - 1
                            ? `doctor-${index}`
                            : `legacy-swipe-${index}-${swipeIndex}`,
                        TavernDB: { kept: true },
                        rerollHelperV2: { kept: true },
                    },
                })),
            }),
        };
    });
    assert.equal(remainingSwipes, 0);
    const chat = {
        header: {
            unknownTopLevel: { kept: true },
            TavernDB: { schema: 'synthetic', kept: true },
            rerollHelperV2: { version: 2, kept: true },
        },
        messages,
    };
    const before = structuredClone(chat);
    const drill = prepareLegacyUpgradeDrill({ chat, entries: [] });
    assert.ok(drill.serializedBytes >= 3.5 * 1024 * 1024);
    assert.ok(drill.serializedBytes < 8 * 1024 * 1024);
    assert.equal(drill.status, 'ready');
    assert.deepEqual(chat, before);
    const rolledBack = rollbackLegacyUpgrade(drill);
    assert.equal(rolledBack.ok, true);
    assert.deepEqual(rolledBack.chat, before);
    assert.equal(
        rolledBack.chat.messages.reduce(
            (sum, message) => sum + (message.swipes?.length || 0),
            0,
        ),
        48,
    );
    for (const message of rolledBack.chat.messages.filter((entry) => !entry.is_user)) {
        const current = message.swipe_info[message.swipe_id];
        assert.equal(
            current.extra.mvu_auto_doctor_source_id,
            message.extra.mvu_auto_doctor_source_id,
        );
        assert.equal(current.extra.TavernDB.kept, true);
        assert.equal(current.extra.rerollHelperV2.kept, true);
    }
});
