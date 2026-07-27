import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DEFAULT_MIGRATION_LIMITS,
    evaluateReleaseCandidate,
    evaluateReleaseHardening,
    prepareLegacyUpgradeDrill,
    rollbackLegacyUpgrade,
} from '../v2/release/index.mjs';

function readyEvidence() {
    return {
        candidate: '2.0.0-rc.1',
        simulation: {
            status: 'pass',
            fixturePasses: 17,
            sourceFingerprint: 'source-a',
        },
        realEnvironment: {
            status: 'pass',
            sourceFingerprint: 'source-a',
            packageSha256: 'a'.repeat(64),
        },
        migration: {
            status: 'ready',
            legacyReadable: true,
            rollbackVerified: true,
        },
        ablation: {
            sameMainModel: true,
            disabledArmPassed: true,
            enabledArmPassed: true,
            privateMaterialRecorded: false,
        },
        hardening: {
            status: 'pass',
            issueCount: 0,
        },
        package: {
            sha256: 'a'.repeat(64),
            allowlistVerified: true,
        },
    };
}

test('1.x upgrade drill preserves the source chat and provides a verified rollback', () => {
    const chat = {
        id: 'chat-legacy',
        messages: [{ role: 'assistant', text: '合成旧聊天' }],
        extension: { unknownAuthorField: { kept: true } },
    };
    const before = structuredClone(chat);
    const drill = prepareLegacyUpgradeDrill({
        chat,
        entries: [{
            id: 'legacy-item',
            kind: 'item',
            source: {
                id: 'legacy-item',
                name: '合成药剂',
                quantity: 1,
                description: '仅用于测试',
                authorExtension: { kept: true },
            },
        }],
    });
    assert.deepEqual(chat, before);
    assert.equal(drill.legacyReadable, true);
    assert.equal(drill.rollbackAvailable, true);
    assert.ok(['ready', 'fallback'].includes(drill.status));
    const rolledBack = rollbackLegacyUpgrade(drill);
    assert.equal(rolledBack.ok, true);
    assert.equal(rolledBack.status, 'rolled-back');
    assert.deepEqual(rolledBack.chat, before);
    assert.equal(rolledBack.v2AuthorityRemoved, true);
});

test('oversized 1.x chat falls back to readable legacy state without partial migration', () => {
    const drill = prepareLegacyUpgradeDrill({
        chat: { id: 'chat-large', text: 'x'.repeat(128) },
        entries: [],
        limits: { maxChatBytes: 32 },
    });
    assert.equal(drill.ok, false);
    assert.equal(drill.status, 'fallback');
    assert.equal(drill.legacyReadable, true);
    assert.equal(drill.rollbackAvailable, true);
    assert.equal(drill.v2Sidecar, undefined);
});

test('real-shaped 57-message 1.x chat fits the bounded production migration window', () => {
    const chat = {
        header: {
            chat_metadata: {
                mvu_auto_doctor: {
                    version: 5,
                    unknownAuthorLedger: { kept: true },
                },
                variables: {
                    stat_data: {
                        角色: {
                            装备: {},
                            背包: {},
                            当前副本任务: {},
                        },
                    },
                },
            },
        },
        messages: Array.from({ length: 57 }, (_, index) => ({
            is_user: index % 2 === 0,
            mes: '合成脱敏正文'.repeat(4_800),
            extra: {
                mvu_auto_doctor_source_id: `synthetic-${index}`,
                unknownScriptField: { kept: true },
            },
            ...(index % 2 === 0
                ? {}
                : {
                    swipes: ['合成脱敏正文'],
                    swipe_info: [{ extra: {} }],
                }),
        })),
    };
    const before = structuredClone(chat);
    const drill = prepareLegacyUpgradeDrill({ chat, entries: [] });
    assert.equal(DEFAULT_MIGRATION_LIMITS.maxChatBytes, 8 * 1024 * 1024);
    assert.ok(drill.serializedBytes > 3 * 1024 * 1024);
    assert.equal(drill.ok, true);
    assert.equal(drill.status, 'ready');
    assert.equal(drill.v2Sidecar?.authority, 'v2-sidecar');
    assert.deepEqual(chat, before);
    const rolledBack = rollbackLegacyUpgrade(drill);
    assert.equal(rolledBack.ok, true);
    assert.deepEqual(rolledBack.chat, before);
});

test('hardening gate enforces capacity, privacy, security and recovery budgets', () => {
    const result = evaluateReleaseHardening({
        performance: {
            migrationDurationMs: 80,
            serializedBytes: 4096,
            recordCount: 64,
            longSessionTurns: 32,
        },
        privacy: {
            credentialFindings: 0,
            privateContentFindings: 0,
            rawPayloadFindings: 0,
            absoluteUserPathFindings: 0,
            derivedNarrativeFindings: 0,
            fullPromptFindings: 0,
            privateCanaryFindings: 0,
        },
        security: {
            parameterizedDatabase: true,
            dependencyAuditPassed: true,
            packageAllowlistVerified: true,
        },
        recovery: {
            legacyRollbackVerified: true,
            restartRecoveryVerified: true,
            lateWritesZero: true,
            staleDownstreamWritesZero: true,
            watchdogTerminalVerified: true,
        },
        compatibility: {
            databaseCoexistence: true,
            databaseBarrierRegistered: true,
            databaseSettledAfterBarrier: true,
            databaseFailedStaleWritesZero: true,
            databaseTerminalReceiptsVerified: true,
            rerollLifecycleCompatible: true,
            companionControlsIsolated: true,
            otherScriptsPreserved: true,
            runtimeConsoleErrorsZero: true,
        },
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'pass');
    assert.equal(result.limits.serializedBytes, 8 * 1024 * 1024);
});

test('hardening gate blocks a companion-script lifecycle collision', () => {
    const result = evaluateReleaseHardening({
        performance: {
            migrationDurationMs: 80,
            serializedBytes: 4096,
            recordCount: 64,
            longSessionTurns: 32,
        },
        privacy: {
            credentialFindings: 0,
            privateContentFindings: 0,
            rawPayloadFindings: 0,
            absoluteUserPathFindings: 0,
            derivedNarrativeFindings: 0,
            fullPromptFindings: 0,
            privateCanaryFindings: 0,
        },
        security: {
            parameterizedDatabase: true,
            dependencyAuditPassed: true,
            packageAllowlistVerified: true,
        },
        recovery: {
            legacyRollbackVerified: true,
            restartRecoveryVerified: true,
            lateWritesZero: true,
            staleDownstreamWritesZero: true,
            watchdogTerminalVerified: true,
        },
        compatibility: {
            databaseCoexistence: true,
            databaseBarrierRegistered: true,
            databaseSettledAfterBarrier: true,
            databaseFailedStaleWritesZero: true,
            databaseTerminalReceiptsVerified: true,
            rerollLifecycleCompatible: false,
            companionControlsIsolated: true,
            otherScriptsPreserved: true,
            runtimeConsoleErrorsZero: true,
        },
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(
        (entry) => entry.code === 'hardening.compatibility.rerollLifecycleCompatible',
    ));
});

test('release candidate is reviewable only when every release-hardening receipt agrees', () => {
    const result = evaluateReleaseCandidate(readyEvidence());
    assert.equal(result.ok, true);
    assert.equal(result.release.status, 'ready-for-maintainer-review');
    assert.equal(result.release.publish.allowed, true);
    assert.equal(result.release.publish.automaticMainMerge, false);
});

test('real QC failure overrides a passing simulation and exposes no publish authorization', () => {
    const evidence = readyEvidence();
    evidence.realEnvironment.status = 'fail';
    const result = evaluateReleaseCandidate(evidence);
    assert.equal(result.ok, false);
    assert.equal(result.decision, 'reject');
    assert.equal(result.release.status, 'blocked');
    assert.equal(result.release.real_qc_failure, true);
    assert.equal(Object.hasOwn(result.release, 'publish'), false);
});

test('candidate fingerprint and package mismatch block release', () => {
    const evidence = readyEvidence();
    evidence.realEnvironment.sourceFingerprint = 'source-b';
    evidence.realEnvironment.packageSha256 = 'b'.repeat(64);
    const result = evaluateReleaseCandidate(evidence);
    assert.equal(result.ok, false);
    assert.ok(result.release.issues.some(
        (entry) => entry.code === 'release.candidate_mismatch',
    ));
    assert.ok(result.release.issues.some(
        (entry) => entry.code === 'release.package_failure',
    ));
});
