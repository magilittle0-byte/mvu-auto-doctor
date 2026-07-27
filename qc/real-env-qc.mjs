import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const reportRelativePath = `docs/qc-reports/v${manifest.version}.json`;
const reportPath = path.join(root, reportRelativePath);
const receiptPath = path.join(root, '.qc', 'real-env-pass.json');
function collectRuntimeFiles(relativeDirectory) {
    const files = [];
    const visit = (directory) => {
        for (const entry of fs.readdirSync(path.join(root, directory), {
            withFileTypes: true,
        })) {
            const relativePath = path.posix.join(
                directory.replaceAll('\\', '/'),
                entry.name,
            );
            if (entry.isDirectory()) visit(relativePath);
            else if (/\.(?:mjs|mts)$/u.test(entry.name)) files.push(relativePath);
        }
    };
    visit(relativeDirectory);
    return files;
}

const runtimeFiles = [
    'continuity-core.mjs',
    'core.mjs',
    'forum-core.mjs',
    'index.js',
    'manifest.json',
    'model-queue.mjs',
    'package-lock.json',
    'package.json',
    'protocol-core.mjs',
    'social-core.mjs',
    'style.css',
    ...collectRuntimeFiles('v2'),
].sort();

function fail(message) {
    throw new Error(`Real-environment QC gate failed: ${message}`);
}

function git(args, options = {}) {
    return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    }).trim();
}

function codeFingerprint() {
    const hash = createHash('sha256');
    for (const relativePath of runtimeFiles) {
        hash.update(relativePath);
        hash.update('\0');
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
            .replace(/\r\n?/gu, '\n');
        hash.update(source, 'utf8');
        hash.update('\0');
    }
    return hash.digest('hex');
}

function reportHash() {
    return createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex');
}

function validateBlockedReport(report) {
    const blocker = report.blocker;
    if (
        !blocker
        || blocker.code !== 'database.barrier_not_registered'
        || blocker.message !== '数据库未注册 barrier 协议'
        || blocker.externalDatabaseDetected !== true
        || blocker.registrationObserved !== false
        || blocker.releasePromotionBlocked !== true
    ) fail('blocked report does not prove the external database barrier failure');

    const targeted = report.checks?.longSessionHardening;
    if (
        !targeted
        || targeted.syntheticMessages !== 65
        || targeted.syntheticSwipes !== 48
        || targeted.syntheticBytes < 3.5 * 1024 * 1024
        || targeted.unknownFieldsPreserved !== true
        || targeted.tavernDbFieldsPreserved !== true
        || targeted.rerollHelperFieldsPreserved !== true
        || targeted.currentSwipeIdentityPreserved !== true
        || targeted.monthlyReceiptCases !== 1000
        || targeted.monthlyLedgerIdempotent !== true
        || targeted.structureRepairRetryVerified !== true
        || targeted.failedStaleContinuitySkipped !== true
        || targeted.fullIdentityBarrierHistoryVerified !== true
        || targeted.restartExactlyOnceVerified !== true
    ) fail('blocked report long-session evidence is incomplete');

    const real = report.checks?.realEnvironment;
    if (
        !real
        || real.deployedRuntime !== true
        || real.servedSourceMatchesFingerprint !== true
        || real.tavernHelperDetected !== true
        || real.databaseBarrierRegistered !== false
        || real.selfCheckKind !== 'error'
        || real.selfCheckCode !== 'database.barrier_not_registered'
        || real.selfCheckMessage !== '数据库未注册 barrier 协议'
        || real.externalDatabaseCompatibilityClaimed !== false
        || real.companionScriptsModified !== false
    ) fail('blocked report real-environment evidence is incomplete');

    const publication = report.publication;
    if (
        !publication
        || publication.scope !== 'independent-branch-only'
        || publication.mainAllowed !== false
        || publication.releaseCandidateAllowed !== false
        || publication.forcePushAllowed !== false
        || !Array.isArray(publication.allowedRemoteRefs)
        || publication.allowedRemoteRefs.length !== 1
        || publication.allowedRemoteRefs[0]
            !== 'refs/heads/codex/v2.0-rc1-real-long-session-hardening'
    ) fail('blocked report publication scope is not fail-closed');

    const privacy = report.privacy;
    if (
        !privacy
        || privacy.apiKeyIncluded !== false
        || privacy.privateChatIncluded !== false
        || privacy.userDataIncluded !== false
        || privacy.rawModelPayloadIncluded !== false
        || privacy.derivedNarrativeFindings !== 0
        || privacy.fullPromptFindings !== 0
        || privacy.privateCanaryFindings !== 0
        || privacy.fullUserAgentIncluded !== false
    ) fail('blocked report privacy declaration is incomplete');
}

function loadAndValidateReport() {
    if (!fs.existsSync(reportPath)) fail(`missing ${reportRelativePath}`);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (![1, 2].includes(report.schemaVersion)) fail('unsupported report schema');
    if (report.version !== manifest.version) fail('report version does not match manifest');
    if (!['pass', 'blocked'].includes(report.result)) fail('unsupported report result');
    if (report.codeFingerprint !== codeFingerprint()) {
        fail('runtime fingerprint changed; repeat real QC and update the report');
    }
    if (report.environment?.url !== 'http://127.0.0.1:8011') {
        fail('report did not use the required real SillyTavern URL');
    }
    if (
        report.environment?.viewport?.width !== 390
        || report.environment?.viewport?.height !== 844
    ) fail('report did not use the required 390x844 mobile viewport');

    const tests = report.checks?.testSuite;
    if (
        !tests
        || tests.total < 140
        || tests.passed !== tests.total
        || tests.failed !== 0
        || tests.todo !== 0
    ) {
        fail('automated suite evidence is incomplete');
    }
    if (report.result === 'blocked') {
        validateBlockedReport(report);
        const testedAt = Date.parse(report.testedAt);
        if (!Number.isFinite(testedAt)) fail('invalid testedAt timestamp');
        return report;
    }

    const phase6 = report.checks?.phase6Barrier;
    if (
        !phase6
        || phase6.apiVersion !== 4
        || phase6.deployedRuntime !== true
        || phase6.persistentCapturedBeforeWork !== true
        || phase6.stateSequenceVerified !== true
        || phase6.exactWriteReadbackBeforeDownstream !== true
        || phase6.finalFingerprintVerified !== true
        || phase6.downstreamSettledOnly !== true
        || phase6.failedOrStaleDownstreamWrites !== 0
        || phase6.lateResultWrites !== 0
        || phase6.conservativeRecoveryVerified !== true
        || phase6.persistentIdempotencyVerified !== true
        || phase6.softCancelVerified !== true
        || phase6.hardTimeoutTerminalVerified !== true
        || phase6.databaseParameterized !== true
        || phase6.databaseFieldLimit !== 600
        || phase6.databaseLengthBoundaryVerified !== true
        || phase6.databaseRevisionConflictRejected !== true
        || phase6.replayCases !== 17
        || phase6.replayPassed !== 17
        || phase6.releaseGateTodo !== 0
        || phase6.releaseGateDefaultCiFailure !== true
    ) fail('phase 6 stable-barrier evidence is incomplete');

    const phase7 = report.checks?.phase7Release;
    if (
        !phase7
        || phase7.candidate !== '2.0.0-rc.1'
        || phase7.fixtureCases !== 17
        || phase7.fixturePasses !== 17
        || phase7.fixtureTodos !== 0
        || phase7.legacyReadable !== true
        || phase7.legacyRollbackVerified !== true
        || phase7.capacityFallbackVerified !== true
        || phase7.realLegacyMigrationVerified !== true
        || phase7.diagnosticRegistrationReceiptVerified !== true
        || phase7.diagnosticTargetIndexReceiptVerified !== true
        || phase7.sameMainModelAblation !== true
        || phase7.candidateGuardLogicUnchanged !== true
        || phase7.longSessionTurns < 24
        || phase7.realAndSimulationAgree !== true
        || phase7.releaseStatus !== 'ready-for-maintainer-review'
        || phase7.automaticMainMerge !== false
        || !/^[a-f0-9]{64}$/u.test(String(phase7.packageSha256 || ''))
        || phase7.packageAllowlistVerified !== true
        || phase7.deterministicPackageVerified !== true
    ) fail('phase 7 release-candidate evidence is incomplete');

    const deepSeek = report.checks?.deepSeek;
    if (
        !deepSeek
        || deepSeek.calls < 1
        || !Array.isArray(deepSeek.httpStatuses)
        || deepSeek.httpStatuses.length !== deepSeek.calls
        || deepSeek.httpStatuses.some((status) => status !== 200)
        || deepSeek.credentialPersisted !== false
        || deepSeek.proxyStopped !== true
    ) fail('real model or credential-cleanup evidence is incomplete');

    const forum = report.checks?.forum;
    if (
        !forum
        || forum.topicCount < 1
        || forum.openWithPointerOrTouch !== true
        || forum.expand !== true
        || forum.collapse !== true
        || forum.ariaStateSynchronized !== true
        || forum.singleWholeThreadControl !== true
        || forum.opBodyMatchesSource !== true
        || forum.opFinalTextVisible !== true
        || forum.opBodyClipped !== false
        || forum.repliesExpandedTogether !== true
        || forum.collapsedRepliesHidden !== true
        || forum.visibleReplyCount !== forum.totalReplyCount
        || forum.totalReplyCount < 1
    ) fail('real forum interaction evidence is incomplete');

    const scenarioPlan = report.checks?.scenarioPlan;
    if (
        !scenarioPlan
        || scenarioPlan.baselineCreated !== true
        || scenarioPlan.baselineImmutable !== true
        || scenarioPlan.baselineEvidenceCount < 1
        || scenarioPlan.baselineSourceRefVerified !== true
        || scenarioPlan.playerActionAmendmentApplied !== true
        || scenarioPlan.revisionAfterAmendment < 1
        || scenarioPlan.amendmentCauseType !== 'player_action'
        || scenarioPlan.sourceThreadCount < 1
        || scenarioPlan.triggerVerified !== true
        || scenarioPlan.mechanismVerified !== true
        || scenarioPlan.evidenceCount < 1
        || scenarioPlan.changedFieldCount < 1
        || scenarioPlan.exactBeforeAfterVerified !== true
        || scenarioPlan.preservedAchievementCount < 1
        || scenarioPlan.amendmentSourceRefVerified !== true
        || scenarioPlan.uiTraceVisible !== true
        || scenarioPlan.summaryTouchTargetHeight < 42
        || scenarioPlan.sameTurnWorldRewriteRejected !== true
        || scenarioPlan.matureWorldChainAccepted !== true
        || scenarioPlan.missingPreservesRejected !== true
        || scenarioPlan.apexRemovalAllowed !== true
        || scenarioPlan.terminalReopenRejected !== true
        || scenarioPlan.promptInjectionVerified !== true
    ) fail('versioned scenario-plan evidence is incomplete');

    const socialGuard = report.checks?.socialGuard;
    if (
        !socialGuard
        || socialGuard.sameMainModelAblation !== true
        || socialGuard.deepSeekExcludedAsMainProof !== true
        || socialGuard.contractLandedInFinalPrompt !== true
        || socialGuard.unselectedOptionsRemovedFromModelHistory !== true
        || socialGuard.storedChatUnchanged !== true
        || socialGuard.systemFormatInstructionsPreserved !== true
        || socialGuard.actualUserChoicePreserved !== true
        || socialGuard.ordinaryCareCases < 4
        || socialGuard.unsupportedMotiveAttributionReduced !== true
        || socialGuard.npcSuspicionStillAllowed !== true
        || socialGuard.relationshipRollbackVerified !== true
        || socialGuard.unrelatedMvuPreserved !== true
        || socialGuard.auditSourceTraceVisible !== true
        || socialGuard.explicitDarkCaseAllowed !== true
        || socialGuard.deepSeekToneDidNotRollbackValidDarkState !== true
        || socialGuard.reviewerDidNotRewriteNarrative !== true
        || socialGuard.noRiskTurnSkippedSemanticCall !== true
        || socialGuard.usageAndCostRecorded !== true
        || socialGuard.fixedHostileReplayPassed !== true
    ) fail('social-motive ablation evidence is incomplete');

    const mobile = report.checks?.mobile;
    if (
        !mobile
        || mobile.touchTargetWidth < 42
        || mobile.touchTargetHeight < 42
        || mobile.tuckedOrbTouchWidth < 42
        || mobile.tuckedOrbRightRealProbeHit !== true
        || mobile.tuckedOrbLeftAutomatedProbeHit !== true
        || mobile.tuckedOrbClipInset > 8
        || mobile.floatingPanelTop < 0
        || mobile.floatingPanelBottom > report.environment.viewport.height
        || mobile.forumPanelTop < 0
        || mobile.forumPanelBottom > report.environment.viewport.height
        || mobile.forumShellScrollWidth > mobile.forumShellClientWidth
    ) fail('mobile touch-target or overflow evidence failed');

    const companion = report.checks?.companionScripts;
    if (
        !companion
        || companion.databaseCoexistence !== true
        || companion.rerollHelperAnalyzed !== true
        || companion.rerollLifecycleCompatible !== true
        || companion.rerollEvent !== 'chat_id_changed'
        || companion.rerollStorageNamespaceIsolated !== true
        || companion.rerollControlNamespaceIsolated !== true
        || companion.otherScriptsPreserved !== true
        || companion.loadedExtensionScriptCount < 12
        || companion.runtimeConsoleErrorCount !== 0
        || !/^[a-f0-9]{64}$/u.test(String(companion.rerollSourceSha256 || ''))
    ) fail('companion-script coexistence evidence is incomplete');

    const privacy = report.privacy;
    if (
        !privacy
        || privacy.apiKeyIncluded !== false
        || privacy.privateChatIncluded !== false
        || privacy.userDataIncluded !== false
        || privacy.rawModelPayloadIncluded !== false
    ) fail('privacy declaration is incomplete');

    const testedAt = Date.parse(report.testedAt);
    if (!Number.isFinite(testedAt)) fail('invalid testedAt timestamp');
    return report;
}

function verifyCiHistory() {
    const base = String(process.env.QC_BASE_SHA || '').trim();
    if (!base || /^0+$/u.test(base)) return;
    try {
        git(['cat-file', '-e', `${base}^{commit}`]);
    } catch {
        return;
    }
    const changed = git(['diff', '--name-only', base, 'HEAD'])
        .split(/\r?\n/u)
        .filter(Boolean);
    const runtimeChanged = changed.some((file) => runtimeFiles.includes(file));
    if (runtimeChanged && !changed.includes(reportRelativePath)) {
        fail(`runtime changed without updating ${reportRelativePath}`);
    }
}

function assertTrackedTreeClean() {
    const dirty = git(['status', '--porcelain', '--untracked-files=no']);
    if (dirty) fail('tracked working tree is dirty');
}

function recordReceipt() {
    const report = loadAndValidateReport();
    assertTrackedTreeClean();
    const receipt = {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        commit: git(['rev-parse', 'HEAD']),
        version: manifest.version,
        report: reportRelativePath,
        reportSha256: reportHash(),
        testedAt: report.testedAt,
        result: report.result,
        publicationScope: report.publication?.scope || 'release',
    };
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    console.log(`Recorded real-environment QC receipt for ${receipt.commit.slice(0, 12)}.`);
}

function verifyReceipt() {
    const report = loadAndValidateReport();
    assertTrackedTreeClean();
    if (!fs.existsSync(receiptPath)) fail('missing local receipt; run npm run qc:record');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    if (receipt.schemaVersion !== 1) fail('unsupported receipt schema');
    if (receipt.commit !== git(['rev-parse', 'HEAD'])) fail('receipt is not bound to HEAD');
    if (receipt.version !== manifest.version) fail('receipt version does not match manifest');
    if (receipt.report !== reportRelativePath) fail('receipt points to the wrong report');
    if (receipt.reportSha256 !== reportHash()) fail('report changed after receipt creation');
    const age = Date.now() - Date.parse(receipt.recordedAt);
    if (!Number.isFinite(age) || age < 0 || age > 7 * 24 * 60 * 60 * 1000) {
        fail('receipt is invalid or older than seven days');
    }
    if (receipt.result !== report.result) fail('receipt result does not match report');
    if (
        receipt.publicationScope
        !== (report.publication?.scope || 'release')
    ) fail('receipt publication scope does not match report');
    if (report.result === 'blocked') {
        const branchRef = `refs/heads/${git(['branch', '--show-current'])}`;
        if (!report.publication.allowedRemoteRefs.includes(branchRef)) {
            fail('blocked evidence receipt is valid only on its independent branch');
        }
        console.log(
            `Branch-only blocked-evidence gate passed for ${receipt.commit.slice(0, 12)}; release promotion remains forbidden.`,
        );
    } else {
        console.log(`Real-environment QC gate passed for ${receipt.commit.slice(0, 12)}.`);
    }
    return report;
}

function verifyPrePush() {
    const report = verifyReceipt();
    if (report.result !== 'blocked') return;
    const updates = fs.readFileSync(0, 'utf8')
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => line.trim().split(/\s+/u));
    if (!updates.length) fail('pre-push did not provide any ref updates');
    for (const [, , remoteRef] of updates) {
        if (!report.publication.allowedRemoteRefs.includes(remoteRef)) {
            fail(`blocked evidence cannot update ${remoteRef}`);
        }
    }
}

const command = process.argv[2] || 'verify';

try {
    if (command === 'fingerprint') {
        console.log(codeFingerprint());
    } else if (command === 'ci') {
        loadAndValidateReport();
        verifyCiHistory();
        console.log(`Tracked QC report passed for v${manifest.version}.`);
    } else if (command === 'install') {
        git(['config', 'core.hooksPath', '.githooks']);
        console.log('Installed tracked pre-push QC hook.');
    } else if (command === 'record') {
        recordReceipt();
    } else if (command === 'verify') {
        verifyReceipt();
    } else if (command === 'pre-push') {
        verifyPrePush();
    } else {
        fail(`unknown command ${command}`);
    }
} catch (error) {
    console.error(String(error?.message || error));
    process.exitCode = 1;
}
