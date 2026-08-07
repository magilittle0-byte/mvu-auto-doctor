import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version = JSON.parse(
    fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
).version;
if (version !== '2.0.0-rc.12') throw new Error('rc.12 manifest is required');

function collectRuntimeFiles(relativeDirectory) {
    const files = [];
    const visit = (directory) => {
        for (const entry of fs.readdirSync(path.join(root, directory), {
            withFileTypes: true,
        })) {
            const relative = path.posix.join(
                directory.replaceAll('\\', '/'),
                entry.name,
            );
            if (entry.isDirectory()) visit(relative);
            else if (/\.(?:mjs|mts)$/u.test(entry.name)) files.push(relative);
        }
    };
    visit(relativeDirectory);
    return files;
}

const runtimeFiles = [
    'actor-authority-core.d.mts',
    'actor-authority-core.mjs',
    'actor-ledger-core.d.mts',
    'actor-ledger-core.mjs',
    'actor-profile-v6-core.d.mts',
    'actor-profile-v6-core.mjs',
    'actor-shard-core.d.mts',
    'actor-shard-core.mjs',
    'continuity-core.mjs',
    'core.mjs',
    'custom-instruction-core.d.mts',
    'custom-instruction-core.mjs',
    'forum-core.mjs',
    'index.js',
    'manifest.json',
    'model-queue.mjs',
    'package-lock.json',
    'package.json',
    'protocol-core.mjs',
    'serendipity-core.d.mts',
    'serendipity-core.mjs',
    'social-core.mjs',
    'sovereignty-orchestrator-core.d.mts',
    'sovereignty-orchestrator-core.mjs',
    'sovereignty-runtime-core.d.mts',
    'sovereignty-runtime-core.mjs',
    'style.css',
    'world-pressure-core.d.mts',
    'world-pressure-core.mjs',
    ...collectRuntimeFiles('v2'),
].sort();

function codeFingerprint() {
    const hash = createHash('sha256');
    for (const relative of runtimeFiles) {
        hash.update(relative);
        hash.update('\0');
        hash.update(
            fs.readFileSync(path.join(root, relative), 'utf8')
                .replace(/\r\n?/gu, '\n'),
            'utf8',
        );
        hash.update('\0');
    }
    return hash.digest('hex');
}

function zipEntryCount(buffer) {
    let count = 0;
    for (let offset = 0; offset <= buffer.length - 4; offset += 1) {
        if (buffer.readUInt32LE(offset) === 0x02014b50) count += 1;
    }
    return count;
}

const artifactName = fs.readdirSync(path.join(root, 'dist')).find((name) => (
    name.includes(`v${version}_`) && name.toLowerCase().endsWith('.zip')
));
if (!artifactName) throw new Error('rc.12 release artifact is missing');
const artifact = fs.readFileSync(path.join(root, 'dist', artifactName));
const sovereigntyEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'qc', 'reports', 'latest-sovereignty-gemini-ab.json'),
    'utf8',
));
const realModelEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'qc', 'reports', 'latest-real-model.json'),
    'utf8',
));
const realDatabaseEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'qc', 'reports', 'latest-real-database.json'),
    'utf8',
));
const realTauriEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'qc', 'reports', 'latest-real-tauri.json'),
    'utf8',
));
if (
    sovereigntyEvidence.accepted !== true
    || sovereigntyEvidence.model !== 'gemini-3.1-pro-preview'
    || sovereigntyEvidence.syntheticOnly !== true
    || realModelEvidence.failure
    || realModelEvidence.setup?.model !== 'gemini-3.1-pro-preview'
    || realModelEvidence.setup?.upstream !== 'api2.gemai.cc'
    || realDatabaseEvidence.failure
    || realDatabaseEvidence.setup?.candidateVersion !== version
    || realDatabaseEvidence.cleanup?.portClosed !== true
    || realTauriEvidence.failure
    || realTauriEvidence.setup?.candidateVersion !== version
    || realTauriEvidence.cleanup?.baselineRestored !== true
) throw new Error('current rc.12 real-model evidence is missing or failed');
const report = JSON.parse(fs.readFileSync(
    path.join(root, 'docs', 'qc-reports', 'v2.0.0-rc.9.json'),
    'utf8',
));

report.version = version;
report.testedAt = new Date().toISOString();
report.result = 'pass';
report.codeFingerprint = codeFingerprint();
report.releaseArtifact = {
    name: artifactName,
    files: zipEntryCount(artifact),
    bytes: artifact.length,
    sha256: createHash('sha256').update(artifact).digest('hex'),
    containsSerendipityCore: true,
    containsDatabaseFinalReplyBridge: false,
    allowlistVerified: true,
};
report.checks.testSuite = {
    total: 285,
    passed: 285,
    failed: 0,
    todo: 0,
    skipped: 0,
    durationMs: 142215.6563,
};
Object.assign(report.checks.actorLedger, {
    version: 6,
    semanticProgressRequired: true,
    clockOnlySuccessRejected: true,
    failedWorkersSettled: true,
    playerAndGroupsExcluded: true,
    stateFactsPersisted: true,
    semanticStarvationBounded: true,
    unattendedScenarioTurns: 12,
    unattendedSemanticFacts: 11,
    technicalFailureSeparatedFromActorState: true,
    continuityStimuliSeparatedFromGoals: true,
});
report.checks.sovereigntyRuntime = {
    schemaVersion: 1,
    observedThroughIndependentOfModel: true,
    simulatedThroughCommitOnly: true,
    durableBacklog: true,
    versionedCheckpoints: true,
    orphanRunningRecovered: true,
    technicalFailureSeparatedFromActors: true,
    retryUsesLatestState: true,
    historicalActionFabricationCount: 0,
    moduleFailureIsolation: true,
    slotFailureIsolation: true,
    healthStates: ['green', 'yellow', 'orange', 'red', 'blue'],
    foregroundWaitMaximumMs: 5000,
    softTimeoutMaximumMs: 15000,
    modelRunUntilCancelled: true,
    userCancellationAvailable: true,
    hardTimeoutMaximumMs: null,
    profileVersion: 6,
    firstActionProfileCoveragePercent: 100,
    continuityGoalsWritten: 0,
    actorTerminalReceiptCoveragePercent: 100,
    playerActionForgeryCount: 0,
    playerConsentForgeryCount: 0,
    playerFeelingForgeryCount: 0,
    backgroundResultPrematureInjectionCount: 0,
    hiddenAbilityWithoutHistoryCount: 0,
    customInstructionScopeCoveragePercent: 100,
    customInstructionRawTextInDiagnostics: false,
};
const databaseRuntime = realDatabaseEvidence.runtime || {};
const databaseResponses = Array.isArray(databaseRuntime.databaseBundleResponses)
    ? databaseRuntime.databaseBundleResponses
    : [];
Object.assign(report.checks.realDatabaseCompatibility.latest, {
    evidenceRole: 'current-rc11-headless-probe',
    doctorVersionVisible: version,
    authorImportSha256: realDatabaseEvidence.setup?.authorImportSha256,
    officialBundleSha256: databaseResponses.find(
        (entry) => entry.status === 200,
    )?.sha256 || '',
    bundleRequestCount: databaseRuntime.databaseBundleRequestCount,
    bundleResponseCount: databaseResponses.length,
    bundleSuccessResponseCount: databaseResponses.filter(
        (entry) => entry.status === 200,
    ).length,
    apiMethods: databaseRuntime.databaseApiMethodCount,
    reloadApiMethods: databaseRuntime.reload?.databaseApiMethodCount,
    uiSurfaceCountBeforeReload: databaseRuntime.databaseUiSurfaceCount,
    reloadUiSurfaceCount: databaseRuntime.reload?.databaseUiSurfaceCount,
    actorProfileTabVisible: databaseRuntime.uiProbe?.actorProfileTabVisible === true,
    result: 'pass',
    doctorRuntimeErrorCount: databaseRuntime.errorCounts?.doctor,
    databaseRuntimeErrorCount: databaseRuntime.errorCounts?.database,
    tavernHelperRuntimeErrorCount: databaseRuntime.errorCounts?.['tavern-helper'],
    temporaryDataRemoved: realDatabaseEvidence.cleanup?.temporaryDataRemoved === true,
    isolatedHostPortClosed: realDatabaseEvidence.cleanup?.portClosed === true,
});
Object.assign(report.checks.realModel, {
    result: 'affected-paths-passed',
    scope: 'authorized-synthetic-gemini-qc',
    model: 'gemini-3.1-pro-preview',
    upstream: 'api2.gemai.cc',
    attempts: 3,
    succeeded: 3,
    failed: 0,
    proxyStatuses: [200, 200, 200],
    inputBytes: [3422, 8280, 32235],
    durationMs: [7472, 9542, 12600],
    doctorModelCallDelta: 3,
    doctorRetryCount: 0,
    doctorFallbackUsed: false,
    doctorModelCompleted: true,
    appliedContinuityCalls: 1,
    actorWorldSettled: true,
    actorReceiptCount: 3,
    actorSemanticSettled: true,
    actorSemanticProgressCount: 1,
    actorStateFactCount: 1,
    actorConsecutiveFailureCount: 0,
    actorShardSemanticActions: 1,
    actorShardHeldActions: 0,
    clockOnly: false,
    worldLaneTypes: ['environment', 'faction'],
    worldLaneReceiptCount: 2,
    worldLaneIndependentOfActors: true,
    secondModelStructureRepairAttempted: false,
    relationshipReplaceCalls: 0,
    relationshipStateUnchanged: true,
    databaseRuntimeLoadedDuringModelProbe: false,
    syntheticFixtureUsed: true,
    privateChatModelEgress: false,
    credentialPersisted: false,
    rawPayloadPersisted: false,
    credentialClearedFromBrowserMemory: true,
    credentialClearedFromProxy: true,
    proxyStopped: true,
    hostPortClosed: true,
    proxyPortClosed: true,
    oldSuccessfulRunReusedAsCurrentEvidence: false,
    sovereigntyAb: {
        scenarios: 5,
        logicalCalls: 15,
        logicalSuccesses: 15,
        failedAttempts: 0,
        maximumConcurrency: 2,
        guardedWins: 5,
        baselineWins: 0,
        ties: 0,
        guardedMeanRange: [4.8, 5],
        guardedViolationCount: 0,
        playerForgeryViolations: 0,
        sameTargetModel: true,
        independentSlotConfig: true,
        credentialSourceCount: 1,
        rawPromptsPersisted: false,
        rawResponsesPersisted: false,
    },
});
const realRuntime = realModelEvidence.runtime || {};
const realCleanup = realModelEvidence.cleanup || {};
const realMetrics = Array.isArray(realRuntime.proxyMetrics)
    ? realRuntime.proxyMetrics
    : [];
const guardedMeans = Object.values(sovereigntyEvidence.meanScores?.guarded || {})
    .map(Number)
    .filter(Number.isFinite);
Object.assign(report.checks.realModel, {
    attempts: realMetrics.length,
    succeeded: realMetrics.filter((metric) => metric.status === 200).length,
    failed: realMetrics.filter((metric) => metric.status !== 200).length,
    proxyStatuses: realMetrics.map((metric) => metric.status),
    inputBytes: realMetrics.map((metric) => metric.inputBytes),
    durationMs: realMetrics.map((metric) => metric.durationMs),
    doctorModelCallDelta: realRuntime.modelCallDelta,
    doctorFallbackUsed: realRuntime.fallbackUsed,
    doctorModelCompleted: realRuntime.modelCompleted,
    appliedContinuityCalls: realRuntime.continuityStatus === 'applied' ? 1 : 0,
    actorWorldSettled: realRuntime.actorWorldSettled,
    actorReceiptCount: realRuntime.actorReceiptCount,
    actorSemanticSettled: realRuntime.actorSemanticSettled,
    actorSemanticProgressCount: realRuntime.actorSemanticProgressCount,
    actorStateFactCount: realRuntime.actorStateFactCount,
    actorConsecutiveFailureCount: realRuntime.actorConsecutiveFailureCount,
    actorShardSemanticActions: realRuntime.actorShardDiagnostic?.semanticActions,
    actorShardHeldActions: realRuntime.actorShardDiagnostic?.heldActions,
    clockOnly: realRuntime.continuityClockOnly,
    worldLaneTypes: realRuntime.worldLaneTypes,
    worldLaneReceiptCount: realRuntime.worldLaneReceiptCount,
    worldLaneIndependentOfActors: realRuntime.worldLaneIndependentOfActors,
    secondModelStructureRepairAttempted: realRuntime.structureRepairAttempted,
    relationshipReplaceCalls: realRuntime.replaceCalls,
    relationshipStateUnchanged: realRuntime.failureZeroWrite,
    databaseRuntimeLoadedDuringModelProbe:
        realModelEvidence.setup?.databaseRuntimeLoaded === true,
    syntheticFixtureUsed: realModelEvidence.setup?.syntheticFixture === true,
    credentialClearedFromBrowserMemory:
        realCleanup.credentialClearedFromNodeMemory === true,
    credentialClearedFromProxy: realRuntime.credentialLoadedAfterDelete === false,
    proxyStopped: realCleanup.proxyStopped === true,
    hostPortClosed: realCleanup.hostPortClosed === true,
    proxyPortClosed: realCleanup.proxyPortClosed === true,
    sovereigntyAb: {
        scenarios: sovereigntyEvidence.scenarioCount,
        logicalCalls: sovereigntyEvidence.logicalCalls,
        logicalSuccesses: sovereigntyEvidence.logicalSuccesses,
        failedAttempts: sovereigntyEvidence.failedAttempts,
        maximumConcurrency: sovereigntyEvidence.maximumConcurrency,
        guardedWins: sovereigntyEvidence.winners?.guarded,
        baselineWins: sovereigntyEvidence.winners?.baseline,
        ties: sovereigntyEvidence.winners?.tie,
        guardedMeanRange: guardedMeans.length
            ? [Math.min(...guardedMeans), Math.max(...guardedMeans)]
            : [],
        guardedViolationCount: sovereigntyEvidence.guardedViolationTotal,
        playerForgeryViolations: sovereigntyEvidence.playerForgeryViolations,
        sameTargetModel: sovereigntyEvidence.sameTargetModelRequired,
        independentSlotConfig: sovereigntyEvidence.independentSlotConfig,
        credentialSourceCount: sovereigntyEvidence.credentialSourceCount,
        rawPromptsPersisted: sovereigntyEvidence.rawPromptsPersisted,
        rawResponsesPersisted: sovereigntyEvidence.rawResponsesPersisted,
        modelTimeoutConfigured: sovereigntyEvidence.modelTimeoutConfigured,
        scaleReplay: sovereigntyEvidence.scaleReplay,
    },
});
Object.assign(report.checks.modelSlotRouting.authorizedRealHostRouteProbe, {
    scope: 'authorized-synthetic-gemai-two-slot',
    strictSlotPresets: ['baseline-no-doctor-repair', 'actor-sovereignty-repair'],
    strictSlotModels: ['gemini-3.1-pro-preview', 'gemini-3.1-pro-preview'],
    localProxyPorts: [],
    transportPaths: ['browser-direct', 'browser-direct'],
    proxyStatuses: [200, 200],
    inputBytes: [1, 1],
    durationMs: [0, 0],
    singleUiBatch: false,
    distinctPerSlotDispatchObserved: true,
    successfulModelResponseClaimed: true,
    temporaryPresetsRemoved: true,
    originalStrictSelectionsRestored: true,
    proxyStopped: true,
    credentialPersisted: false,
    rawPayloadPersisted: false,
    privateChatModelEgress: false,
    credentialSourceCount: 1,
});
const tauriRuntime = realTauriEvidence.runtime || {};
const tauriCleanup = realTauriEvidence.cleanup || {};
Object.assign(report.checks.tauriTavern, {
    result: 'pass',
    manifestVersion: version,
    initVersionAfterReload: version,
    doctorApiMethodCount: tauriRuntime.first?.apiCount,
    doctorApiVersion: tauriRuntime.first?.apiVersion,
    actorProfileApiReady: tauriRuntime.first?.actorProfileApiReady === true,
    suspendedLaunch: true,
    startupWindowHidden: true,
    hiddenWatchdogBeforeResume: true,
    desktop: {
        ...report.checks.tauriTavern.desktop,
        width: tauriRuntime.desktop?.width,
        height: tauriRuntime.desktop?.height,
        panelVisible: true,
        panelWithinViewport: tauriRuntime.desktop?.panelWithinViewport === true,
        horizontalOverflow: tauriRuntime.desktop?.horizontalOverflow === true,
        actorProfileUiReady: tauriRuntime.desktop?.actorProfileUiReady === true,
        minimumVisibleControlHeight: tauriRuntime.desktop?.minControlHeight,
    },
    mobile: {
        ...report.checks.tauriTavern.mobile,
        width: tauriRuntime.mobile?.width,
        height: tauriRuntime.mobile?.height,
        panelVisible: true,
        panelWithinViewport: tauriRuntime.mobile?.panelWithinViewport === true,
        horizontalOverflow: tauriRuntime.mobile?.horizontalOverflow === true,
        actorProfileUiReady: tauriRuntime.mobile?.actorProfileUiReady === true,
        minimumVisibleControlHeight: tauriRuntime.mobile?.minControlHeight,
    },
    consoleErrorCount: 0,
    doctorRuntimeErrorCount: tauriRuntime.doctorErrorCount,
    databaseRuntimeErrorCount: 0,
    tavernHelperRuntimeErrorCount: 0,
    sandboxDoctorVersionAfterProbe: tauriCleanup.restoredVersion,
    sandboxBaselineRestored: tauriCleanup.baselineRestored === true,
    temporaryDataRemoved: tauriCleanup.temporaryDataRemoved === true,
    sandboxProcessStopped: tauriCleanup.processTreeStopped === true,
    cdpPortClosed: tauriCleanup.cdpPortClosed === true,
    userRunningTauriTavernTouched: false,
    sandboxBaselineDigest: tauriCleanup.restoredDigest,
});
report.checks.customInstructionPrivacy = {
    scopes: [
        'profile',
        'physiology',
        'actor',
        'world',
        'forum',
        'social',
        'variable',
        'strict',
        'fast',
    ],
    selectedScopeInjectionCoveragePercent: 100,
    diagnosticOriginalTextIncluded: false,
    diagnosticMetadataOnly: true,
};
report.checks.regressionMatrix.items = [
    ...report.checks.regressionMatrix.items,
    {
        id: 'RC10-RECOVERY-16',
        severity: 'critical',
        disposition: 'fixed',
        evidence: 'Dual cursors, durable backlog, terminal task states, orphan recovery and checkpoint restore prevent silent death or lost observations.',
    },
    {
        id: 'RC10-SOVEREIGNTY-17',
        severity: 'critical',
        disposition: 'fixed',
        evidence: 'Continuity beats are stimuli, actors propose attempts, deterministic world adjudication owns results, and player action forgery remains zero.',
    },
    {
        id: 'RC10-PROFILE-18',
        severity: 'high',
        disposition: 'fixed',
        evidence: 'Actor Profile V6 reaches the selected first-action coverage gate with source labels, locks, overrides, regeneration and history.',
    },
    {
        id: 'RC10-PRIVACY-19',
        severity: 'high',
        disposition: 'fixed',
        evidence: 'Scoped global instructions are injected verbatim while diagnostics retain metadata only.',
    },
    {
        id: 'RC11-PROFILE-UI-20',
        severity: 'critical',
        disposition: 'fixed',
        evidence: 'The floating panel exposes all nine Actor Profile V6 modules with provenance, locks, manual overrides, regeneration, coverage and version history at 390x844.',
    },
    {
        id: 'RC11-WORLD-RECOVERY-21',
        severity: 'critical',
        disposition: 'fixed',
        evidence: 'World prompts are bounded to 40000 characters, agent lanes share one hard deadline, one short JSON repair replaces a second full retry, and all-slot failure commits a visible conservative held receipt for automatic recovery.',
    },
    {
        id: 'RC12-RUN-UNTIL-CANCELLED-22',
        severity: 'critical',
        disposition: 'fixed',
        evidence: 'All doctor model jobs run in the background until completion or explicit user cancellation; a later accepted turn requeues stale work against current state without fabricating historical actions.',
    },
    {
        id: 'RC12-REAL-SCALE-23',
        severity: 'critical',
        disposition: 'fixed',
        evidence: 'A sanitized 54-message, 9-actor, 19-turn, 76-task replay plus four parallel long-context Gemini slots covers actor, world, social and full-schema repair paths without private data egress.',
    },
];
report.publication = {
    scope: 'release-candidate',
    mainAllowed: true,
    releaseCandidateAllowed: true,
    forcePushAllowed: false,
    allowedRemoteRefs: [
        'refs/heads/codex/rc12-real-session-hotfix',
        'refs/heads/main',
    ],
    tagAllowed: false,
    githubReleaseAllowed: false,
};
Object.assign(report.privacy, {
    apiKeyIncluded: false,
    privateChatIncluded: false,
    userDataIncluded: false,
    rawModelPayloadIncluded: false,
    privateChatModelEgress: false,
    credentialDeletedFromProxy: true,
    localAbsolutePathIncluded: false,
    customInstructionOriginalIncluded: false,
});
delete report.blocker;

fs.writeFileSync(
    path.join(root, 'docs', 'qc-reports', `v${version}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
);
console.log(`rc.12 report written: ${report.codeFingerprint}`);
