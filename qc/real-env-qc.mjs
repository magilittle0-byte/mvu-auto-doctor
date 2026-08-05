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
    'actor-ledger-core.d.mts',
    'actor-ledger-core.mjs',
    'actor-shard-core.d.mts',
    'actor-shard-core.mjs',
    'continuity-core.mjs',
    'core.mjs',
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
    'style.css',
    'world-pressure-core.d.mts',
    'world-pressure-core.mjs',
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

function validateActorLedgerEvidence(report) {
    const actorLedger = report.checks?.actorLedger;
    const semanticRuntimeRequired = report.version === '2.0.0-rc.9';
    if (
        !actorLedger
        || actorLedger.version !== (semanticRuntimeRequired ? 5 : 4)
        || actorLedger.persistentAuditLedger !== true
        || actorLedger.continuousMigration !== true
        || actorLedger.privateThoughtsHidden !== true
        || actorLedger.acceptedContentObservationOnly !== true
        || actorLedger.boundedActorLimit !== 5
        || actorLedger.boundedExplorationSlots !== 2
        || actorLedger.lowAttentionTurnsTested < 80
        || actorLedger.starvationPrevented !== true
        || actorLedger.dueActionResolutionRequired !== true
        || actorLedger.playerSovereigntyProtected !== true
        || actorLedger.receiptStages?.join(',') !== (
            'plan,execution,world-settlement,injection,narrative-consumption'
        )
        || actorLedger.injectionBudgetPreserved !== true
        || actorLedger.realRuntimeApiVisible !== true
        || actorLedger.publicViewExcludesPrivateState !== true
        || actorLedger.realUiControlsVerified !== true
        || actorLedger.optionalFailureNonBlocking !== true
        || (
            semanticRuntimeRequired
            && (
                actorLedger.semanticProgressRequired !== true
                || actorLedger.clockOnlySuccessRejected !== true
                || actorLedger.failedWorkersSettled !== true
                || actorLedger.playerAndGroupsExcluded !== true
                || actorLedger.stateFactsPersisted !== true
                || actorLedger.semanticStarvationBounded !== true
            )
        )
    ) fail('Actor Ledger closed-loop evidence is incomplete');
}

function validateWorldPressureEvidence(report) {
    const pressure = report.checks?.worldPressure;
    if (
        !pressure
        || pressure.doctorOwnedOnly !== true
        || pressure.contentRewriteCount !== 0
        || pressure.channels?.join(',') !== 'actor,faction,environment'
        || pressure.sharedInjectionBudget !== true
        || pressure.phaseBudgetVerified !== true
        || pressure.aggregateBudgetVerified !== true
        || pressure.sameSceneBossCapVerified !== true
        || pressure.recoveryDebtVerified !== true
        || pressure.minimumPlayabilityVerified !== true
        || pressure.quietProgressAccepted !== true
        || pressure.externalThreatsObservedOnly !== true
        || pressure.dueFalseSettlementRejected !== true
        || pressure.receiptStages?.join(',') !== (
            'plan,execution,world-settlement,injection,narrative-consumption'
        )
        || pressure.branchAndGenerationIdentityVerified !== true
        || pressure.oldSwipeWrites !== 0
        || pressure.wrongBranchWrites !== 0
        || pressure.staleGenerationWrites !== 0
        || pressure.nonTechnicalControlsVerified !== true
    ) fail('world-pressure closed-loop evidence is incomplete');
}

function validateSerendipityEvidence(report) {
    const serendipity = report.checks?.serendipity;
    if (
        !serendipity
        || serendipity.independentEntropyVerified !== true
        || serendipity.cardDiceReads !== 0
        || serendipity.cardDiceWrites !== 0
        || serendipity.fullTargetIdentityVerified !== true
        || serendipity.oldSwipeWrites !== 0
        || serendipity.wrongBranchWrites !== 0
        || serendipity.staleGenerationWrites !== 0
        || serendipity.repeatOpportunityDraws !== 0
        || serendipity.explicitContradictionRejected !== true
        || serendipity.unexplainedPossibilityAllowed !== true
        || serendipity.favorablePressureCost !== 0
        || serendipity.favorableAutoPunishmentCount !== 0
        || serendipity.adversePressureCapVerified !== true
        || serendipity.majorAdverseResponseWindowVerified !== true
        || serendipity.unknownSourcePrematureRevealCount !== 0
        || serendipity.playerActionWrites !== 0
        || serendipity.contentRewriteCount !== 0
        || serendipity.disabledBehaviorUnchanged !== true
        || serendipity.longSessionThrottleVerified !== true
        || serendipity.nonTechnicalControlsVerified !== true
    ) fail('serendipity closed-loop evidence is incomplete');
}

function validateRc6PassReport(report) {
    const semanticRuntimeRequired = report.version === '2.0.0-rc.9';
    const billing = report.checks?.billingRemoval;
    if (
        !billing
        || billing.currencyEstimates !== 0
        || billing.priceTables !== 0
        || billing.monthlyAmountLedgersUsed !== 0
        || billing.costWarnings !== 0
        || billing.costStopGates !== 0
        || billing.characterTokenEstimates !== 0
        || billing.providerUsageOnly !== true
    ) fail('rc6 billing-removal evidence is incomplete');

    const longSession = report.checks?.longSessionHardening;
    if (
        !longSession
        || longSession.syntheticMessages !== 65
        || longSession.syntheticSwipes !== 48
        || longSession.syntheticBytes < 3.5 * 1024 * 1024
        || longSession.unknownFieldsPreserved !== true
        || longSession.tavernDbFieldsPreserved !== true
        || longSession.rerollHelperFieldsPreserved !== true
        || longSession.currentSwipeIdentityPreserved !== true
        || longSession.localStructureRepairVerified !== true
        || longSession.modelStructureRepairRetryRemoved !== true
        || longSession.failedStaleContinuitySkipped !== true
        || longSession.fullIdentityBarrierHistoryVerified !== true
        || longSession.restartExactlyOnceVerified !== true
    ) fail('rc6 long-session evidence is incomplete');

    const latestDatabase = report.checks?.realDatabaseCompatibility?.latest;
    if (
        !latestDatabase
        || latestDatabase.version !== 'spv8.7.4'
        || latestDatabase.production !== true
        || latestDatabase.cleanAuthorLoader !== true
        || latestDatabase.apiVisible !== true
        || latestDatabase.apiMethods < 100
        || latestDatabase.publicUpdateReturnedTruthyObject !== true
        || latestDatabase.independentBridgeAbsent !== true
        || latestDatabase.reloadIndependentBridgeAbsent !== true
        || latestDatabase.reloadApiMethods !== latestDatabase.apiMethods
        || latestDatabase.result !== 'pass'
        || latestDatabase.doctorRuntimeErrorCount !== 0
        || latestDatabase.databaseRuntimeErrorCount !== 0
        || latestDatabase.tavernHelperRuntimeErrorCount !== 0
        || latestDatabase.sterileDataRoot !== true
        || latestDatabase.credentialsCopied !== false
        || latestDatabase.originalUserDataModified !== false
        || latestDatabase.temporaryDataRemoved !== true
        || latestDatabase.isolatedHostPortClosed !== true
        || latestDatabase.doctorVersionVisible !== manifest.version
    ) fail('rc6 real database evidence is incomplete');

    const model = report.checks?.realModel;
    if (
        !model
        || model.result !== 'affected-paths-passed'
        || model.attempts !== 3
        || model.succeeded !== 3
        || model.failed !== 0
        || model.proxyStatuses?.join(',') !== '200,200,200'
        || model.inputBytes?.length !== 3
        || model.inputBytes.some((bytes) => bytes < 1)
        || model.doctorModelCallDelta !== 3
        || model.doctorRetryCount !== 0
        || model.doctorFallbackUsed !== false
        || model.doctorModelCompleted !== true
        || model.appliedContinuityCalls < 1
        || model.actorWorldSettled !== true
        || (
            semanticRuntimeRequired
            && (
                model.actorSemanticSettled !== true
                || model.actorSemanticProgressCount < 1
                || model.actorStateFactCount < 1
                || model.actorConsecutiveFailureCount !== 0
                || model.clockOnly !== false
            )
        )
        || model.actorReceiptCount < 1
        || model.worldLaneTypes?.join(',') !== 'environment,faction'
        || model.worldLaneReceiptCount < 2
        || model.worldLaneIndependentOfActors !== true
        || model.secondModelStructureRepairAttempted !== false
        || model.relationshipReplaceCalls !== 0
        || model.relationshipStateUnchanged !== true
        || model.databaseRuntimeLoadedDuringModelProbe !== false
        || model.syntheticFixtureUsed !== true
        || model.privateChatModelEgress !== false
        || model.credentialPersisted !== false
        || model.rawPayloadPersisted !== false
        || model.credentialClearedFromBrowserMemory !== true
        || model.credentialClearedFromProxy !== true
        || model.proxyStopped !== true
        || model.hostPortClosed !== true
        || model.proxyPortClosed !== true
    ) fail('rc6 affected real-model evidence is incomplete');

    const tauri = report.checks?.tauriTavern;
    if (
        !tauri
        || tauri.result !== 'pass'
        || tauri.releaseHostVersion !== '2.1.1'
        || tauri.foregroundAutomationUsed !== false
        || tauri.headlessOrHiddenOnly !== true
        || tauri.portableDataRoot !== true
        || tauri.isolatedAppData !== true
        || tauri.cdpLoopbackOnly !== true
        || tauri.cdpConnected !== true
        || tauri.manifestHttpStatus !== 200
        || tauri.manifestVersion !== manifest.version
        || tauri.doctorScriptLoaded !== true
        || tauri.doctorStyleLoaded !== true
        || tauri.doctorApiReady !== true
        || tauri.doctorApiMethodCount < 40
        || tauri.reloadVerified !== true
        || tauri.initVersionAfterReload !== manifest.version
        || tauri.settingsMounted !== true
        || tauri.floatingOrbMounted !== true
        || tauri.desktop?.panelVisible !== true
        || tauri.desktop?.panelWithinViewport !== true
        || tauri.desktop?.horizontalOverflow !== false
        || tauri.mobile?.panelVisible !== true
        || tauri.mobile?.panelWithinViewport !== true
        || tauri.mobile?.horizontalOverflow !== false
        || tauri.mobile?.minimumVisibleControlHeight < 42
        || tauri.consoleErrorCount !== 0
        || tauri.doctorRuntimeErrorCount !== 0
        || tauri.databaseRuntimeErrorCount !== 0
        || tauri.tavernHelperRuntimeErrorCount !== 0
        || tauri.missingCompanionScope !== 'sterile-portable-sandbox'
        || tauri.fullMvuCompatibilityCoveredByRealSillyTavern !== true
        || tauri.originalReleaseHostModified !== false
        || tauri.sandboxDoctorVersionAfterProbe !== '1.8.10'
        || tauri.sandboxBaselineRestored !== true
        || tauri.temporaryDataRemoved !== true
        || tauri.sandboxProcessStopped !== true
        || tauri.cdpPortClosed !== true
        || tauri.userRunningTauriTavernTouched !== false
        || (
            semanticRuntimeRequired
            && (
                tauri.suspendedLaunch !== true
                || tauri.hiddenWatchdogBeforeResume !== true
                || tauri.startupWindowHidden !== true
            )
        )
    ) fail('rc6 real TauriTavern evidence is incomplete');

    const artifact = report.releaseArtifact;
    if (
        !artifact
        || artifact.files !== 73
        || artifact.bytes < 1
        || !/^[a-f0-9]{64}$/u.test(String(artifact.sha256 || ''))
        || artifact.containsSerendipityCore !== true
        || artifact.containsDatabaseFinalReplyBridge !== false
        || artifact.allowlistVerified !== true
    ) fail('release artifact evidence is incomplete');

    const publication = report.publication;
    if (
        !publication
        || publication.scope !== 'release-candidate'
        || publication.mainAllowed !== true
        || publication.releaseCandidateAllowed !== true
        || publication.forcePushAllowed !== false
        || !publication.allowedRemoteRefs?.includes('refs/heads/main')
        || !publication.allowedRemoteRefs?.includes(
            'refs/heads/codex/serendipity-engine-no-billing',
        )
        || publication.tagAllowed !== false
        || publication.githubReleaseAllowed !== false
    ) fail('rc6 publication scope is incomplete');

    const privacy = report.privacy;
    if (
        !privacy
        || privacy.apiKeyIncluded !== false
        || privacy.privateChatIncluded !== false
        || privacy.userDataIncluded !== false
        || privacy.rawModelPayloadIncluded !== false
        || privacy.privateChatModelEgress !== false
        || privacy.credentialDeletedFromProxy !== true
        || privacy.localAbsolutePathIncluded !== false
    ) fail('rc6 privacy declaration is incomplete');

    if (report.blocker !== undefined) fail('passing rc6 report still contains a blocker');
    if (report.checks?.regressionMatrix?.items?.some(
        (item) => item.disposition !== 'fixed',
    )) fail('rc6 regression matrix still contains an unresolved item');
}

function validateBlockedReport(report) {
    const blocker = report.blocker;
    if (
        !blocker
        || blocker.code === 'database.barrier_not_registered'
        || typeof blocker.code !== 'string'
        || !blocker.code
        || typeof blocker.message !== 'string'
        || !blocker.message
        || blocker.releasePromotionBlocked !== true
        || !Array.isArray(blocker.reasons)
        || blocker.reasons.length < 1
    ) fail('blocked report does not identify truthful release blockers');

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
        || targeted.structureRepairRetryVerified !== false
        || targeted.localStructureRepairVerified !== true
        || targeted.modelStructureRepairRetryRemoved !== true
        || targeted.sanitizedLatestRunModelCalls !== 17
        || targeted.sanitizedLatestRunProjectedCalls !== 14
        || targeted.failedStaleContinuitySkipped !== true
        || targeted.fullIdentityBarrierHistoryVerified !== true
        || targeted.restartExactlyOnceVerified !== true
    ) fail('blocked report long-session evidence is incomplete');

    const realLong = report.checks?.realLongSession;
    if (
        !realLong
        || realLong.turns !== 24
        || realLong.messages !== 49
        || realLong.settledTargets !== 24
        || realLong.distinctTargetIdentities !== 24
        || realLong.failedTargets !== 0
        || realLong.staleTargets !== 0
        || realLong.modelCalls !== 24
        || realLong.modelCallsSucceeded !== 24
        || realLong.swipeInfoAligned !== true
        || realLong.reloadStructureRecovered !== true
        || realLong.reloadSettledRecords !== 24
        || realLong.databaseApiVisible !== true
        || realLong.databaseRefreshStable !== true
        || !/^[a-f0-9]{64}$/u.test(String(realLong.structureSha256 || ''))
        || !/^[a-f0-9]{64}$/u.test(String(realLong.databaseSha256 || ''))
    ) fail('blocked report real 24-turn evidence is incomplete');

    const database = report.checks?.realDatabaseCompatibility;
    if (
        !database
        || database.current?.version !== 'spv8.4'
        || database.current?.production !== false
        || database.current?.evidenceRole !== 'historical-baseline'
        || database.current?.apiName !== 'AutoCardUpdaterAPI'
        || database.current?.apiMethods < 100
        || database.current?.crudRoundTrip !== true
        || database.current?.refreshVerified !== true
        || database.current?.callbacksVerified !== true
        || database.current?.uiVerified !== true
        || database.current?.chatSwitchRecovered !== true
        || database.current?.reloadRecovered !== true
        || database.current?.cleanupVerified !== true
        || database.legacy?.version !== 'spv5.5.6'
        || database.legacy?.production !== false
        || database.legacy?.apiMethods < 80
        || database.legacy?.crudRoundTrip !== true
        || database.legacy?.reloadRecovered !== true
        || database.latest?.version !== 'spv8.7.4'
        || database.latest?.production !== true
        || database.latest?.cleanAuthorLoader !== true
        || database.latest?.legacySourceRewriteExcludedFromSterileRoot !== true
        || database.latest?.legacySourceRewriteDetectedByDoctor !== true
        || !/^[a-f0-9]{64}$/u.test(database.latest?.authorImportSha256 || '')
        || !/^[a-f0-9]{64}$/u.test(database.latest?.officialBundleSha256 || '')
        || database.latest?.bundleRequestCount < 2
        || database.latest?.bundleResponseCount !== database.latest?.bundleRequestCount
        || database.latest?.bundleSuccessResponseCount < 2
        || database.latest?.responseVersion !== 'spv8.7.4'
        || database.latest?.apiVisible !== true
        || database.latest?.apiMethods < 100
        || database.latest?.publicUpdateReturnedTruthyObject !== true
        || database.latest?.independentBridgeInstalled !== false
        || database.latest?.independentBridgeAbsent !== true
        || database.latest?.reloadIndependentBridgeAbsent !== true
        || database.latest?.uiSurfaceCountBeforeReload < 1
        || database.latest?.reloadApiMethods !== database.latest?.apiMethods
        || database.latest?.reloadUiSurfaceCount < 1
        || database.latest?.result !== 'pass'
        || database.latest?.doctorRuntimeErrorCount !== 0
        || database.latest?.databaseRuntimeErrorCount !== 0
        || database.latest?.sterileDataRoot !== true
        || database.latest?.privateSettingsCopied !== false
        || database.latest?.privateChatsCopied !== false
        || database.latest?.privateCharactersCopied !== false
        || database.latest?.credentialsCopied !== false
        || database.latest?.originalUserDataModified !== false
        || database.latest?.temporaryDataRemoved !== true
        || database.latest?.isolatedHostPortClosed !== true
        || database.tableNamesHardcoded !== false
        || database.columnNamesHardcoded !== false
        || database.doctorDatabaseApiCalls !== 0
        || database.doctorRequiresDatabaseProtocol !== false
        || database.externalMode !== 'unmanaged'
        || database.externalConsistency !== 'unknown'
    ) fail('blocked report real TavernDB matrix is incomplete');

    const eventStorm = report.checks?.eventStormDeduplication;
    if (
        !eventStorm
        || eventStorm.sameTargetDeliveries !== 5
        || eventStorm.maximumCallsPerTask !== 1
        || eventStorm.settledRecords !== 1
        || eventStorm.wrongTargetWrites !== 0
        || eventStorm.databaseApiVisible !== true
    ) fail('blocked report event-storm deduplication evidence is incomplete');

    const actor = report.checks?.actorShard;
    if (
        !actor
        || actor.realWorkerCounts?.join(',') !== '1,3,5'
        || actor.selected?.join(',') !== '1,3,5'
        || actor.succeeded?.join(',') !== '1,3,5'
        || actor.failed?.some((count) => count !== 0)
        || actor.staleRegenerateWrites !== 0
        || actor.staleSwipeWrites !== 0
        || actor.staleChatSwitchWrites !== 0
        || actor.strictWhitelistExampleVerified !== true
    ) fail('blocked report Actor Shard evidence is incomplete');

    const universal = report.checks?.universalCompatibility;
    if (
        !universal
        || universal.coreUsesDynamicJsonPointers !== true
        || universal.unknownSchemaReadOnlyAuditPassed !== true
        || universal.unknownSchemaReshaped !== false
        || universal.databaseTablesInspectedByDoctor !== false
        || universal.frontendFunctionsInvokedByDoctor !== false
        || universal.legacyDialectAdaptersConservative !== true
        || universal.currentCardIsFixtureOnly !== true
    ) fail('blocked report universal-compatibility evidence is incomplete');

    const regressions = report.checks?.regressionMatrix;
    if (
        !regressions
        || regressions.evidenceSource !== 'sanitized-real-records'
        || !Array.isArray(regressions.items)
        || regressions.items.length < 8
        || regressions.items.some((item) => (
            typeof item.id !== 'string'
            || !item.id
            || !['critical', 'high', 'medium', 'environment'].includes(item.severity)
            || !['fixed', 'blocked', 'unknown-nonmanaged'].includes(item.disposition)
            || typeof item.evidence !== 'string'
            || !item.evidence
        ))
    ) fail('blocked report regression matrix is incomplete');

    const corePathsPassed = blocker.code === 'release_evidence_incomplete';
    const real = report.checks?.realEnvironment;
    if (
        !real
        || real.deployedRuntime !== true
        || real.servedSourceMatchesFingerprint !== true
        || real.separateHeadlessProfile !== true
        || real.originalChatModified !== false
        || real.originalCardModified !== false
        || real.companionScriptsModified !== false
        || real.externalDatabaseProtocolOptional !== true
        || real.tavernDbRegistrationRequired !== false
        || !['not-detected', 'unmanaged', 'cooperative'].includes(
            real.externalDatabaseMode,
        )
        || real.unmanagedProbeMode !== 'unmanaged'
        || real.externalDatabaseWriteConsistency !== 'unknown'
        || real.doctorManagedWritesSettledOnly !== true
        || real.failedStaleLateDoctorWrites !== 0
        || real.mobile?.width !== 390
        || real.mobile?.height !== 844
        || real.mobile?.minimumVisibleControlHeight < 42
        || real.mobile?.horizontalOverflow !== false
        || real.desktop?.width !== 1280
        || real.desktop?.height !== 720
        || real.desktop?.horizontalOverflow !== false
        || real.hostConsoleErrorCount < 1
        || (
            corePathsPassed
                ? (
                    real.runtimeMvuApiAvailable !== true
                    || real.environmentStatus !== 'ok'
                    || real.realStrictMvuWritebackVerified !== true
                    || real.realRegenerateStaleVerified !== true
                    || real.realSwipeStaleVerified !== true
                    || real.realChatSwitchStaleVerified !== true
                    || real.doctorConsoleErrorCount !== 0
                )
                : (
                    real.runtimeMvuApiAvailable !== false
                    || real.environmentStatus !== 'error'
                )
        )
    ) fail('blocked report real-environment evidence is incomplete');

    const latestDatabaseBundleBlocked = blocker.code
        === 'database_latest_bundle_unavailable';
    const realModelCredentialRejected = blocker.code
        === 'real_model_test_credential_rejected';
    const tauriBackgroundEntryUnavailable = blocker.code
        === 'tauritavern_background_entry_unavailable';
    const fullRc8RealRuntimeRecheckRequired = blocker.code
        === 'full_rc8_real_runtime_recheck_required';
    const model = report.checks?.realModel;
    if (
        !model
        || (
            !fullRc8RealRuntimeRecheckRequired
            && (
                !Array.isArray(model.proxyStatuses)
                || model.proxyStatuses.length !== model.attempts
                || model.proxyStopped !== true
                || model.credentialPersisted !== false
                || model.rawPayloadPersisted !== false
            )
        )
        || (
            latestDatabaseBundleBlocked
                ? (
                    model.result !== 'not-run-latest-database-bundle-blocked'
                    || model.attempts !== 0
                    || model.succeeded !== 0
                    || model.failed !== 0
                    || model.blockedBeforeCredentialUse !== true
                    || model.historicalBaselineNotCurrentEvidence !== true
                    || model.oldSuccessfulRunReusedAsCurrentEvidence !== false
                )
                : realModelCredentialRejected
                    ? (
                        model.result !== 'blocked'
                        || model.attempts < 1
                        || model.succeeded !== 0
                        || model.failed !== model.attempts
                        || model.proxyStatuses.some((status) => status !== 401)
                        || model.inputBytes?.length !== model.attempts
                        || model.inputBytes.some((bytes) => bytes < 1)
                        || model.externalCredentialRejected !== true
                        || model.doctorModelCallDelta !== model.attempts
                        || model.doctorRetryCount !== 0
                        || model.doctorFallbackUsed !== true
                        || model.doctorModelCompleted !== false
                        || model.socialFailureZeroWrite !== true
                        || model.stateWriterCalls !== 0
                        || model.databaseRuntimeLoadedDuringModelProbe !== false
                        || model.syntheticFixtureUsed !== true
                        || model.privateChatModelEgress !== false
                        || model.credentialClearedFromBrowserMemory !== true
                        || model.credentialClearedFromProxy !== true
                        || model.hostPortClosed !== true
                        || model.proxyPortClosed !== true
                    )
                : tauriBackgroundEntryUnavailable
                ? (
                    model.result !== 'pass'
                    || model.attempts !== 3
                    || model.succeeded !== 3
                    || model.failed !== 0
                    || model.proxyStatuses.some((status) => status !== 200)
                    || model.inputBytes?.length !== model.attempts
                    || model.inputBytes.some((bytes) => bytes < 1)
                    || model.externalCredentialRejected !== false
                    || model.doctorModelCallDelta !== model.attempts
                    || model.doctorRetryCount !== 0
                    || model.doctorFallbackUsed !== false
                    || model.doctorModelCompleted !== true
                    || model.socialFailureZeroWrite !== true
                    || model.stateWriterCalls !== 0
                    || model.actorSettlementSucceeded !== true
                    || model.actorReceipts < 1
                    || model.worldSettlementSucceeded !== true
                    || model.worldReceipts < 1
                    || model.databaseRuntimeLoadedDuringModelProbe !== false
                    || model.syntheticFixtureUsed !== true
                    || model.privateChatModelEgress !== false
                    || model.credentialClearedFromBrowserMemory !== true
                    || model.credentialClearedFromProxy !== true
                    || model.hostPortClosed !== true
                    || model.proxyPortClosed !== true
                    || model.oldSuccessfulRunReusedAsCurrentEvidence !== false
                )
                : fullRc8RealRuntimeRecheckRequired
                ? (
                    model.result !== 'pass'
                    || model.scope !== 'authorized-synthetic-gemini-qc'
                    || model.model !== 'gemini-3.1-pro-preview'
                    || model.upstream !== 'api2.gemai.cc'
                    || model.characterAb?.v2Wins !== 3
                    || model.characterAb?.v1Wins !== 0
                    || model.characterAb?.ties !== 1
                    || model.characterAb?.logicalCalls !== 12
                    || model.characterAb?.successfulHttpResponses !== 12
                    || model.doctorProbe?.attempts !== 3
                    || model.doctorProbe?.succeeded !== 3
                    || model.doctorProbe?.failed !== 0
                    || model.doctorProbe?.actorWorldSettled !== true
                    || model.doctorProbe?.doctorErrorCount !== 0
                    || model.proxyStopped !== true
                    || model.credentialPersisted !== false
                    || model.rawPayloadPersisted !== false
                    || model.privateChatModelEgress !== false
                    || report.checks?.modelSlotRouting
                        ?.authorizedRealHostRouteProbe?.scope
                        !== 'authorized-synthetic-gemai-two-slot'
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .proxyStatuses?.length !== 2
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .proxyStatuses.some((status) => status !== 200)
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .inputBytes?.length !== 2
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .inputBytes.some((bytes) => bytes < 1)
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .distinctPerSlotDispatchObserved !== true
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .successfulModelResponseClaimed !== true
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .temporaryPresetsRemoved !== true
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .originalStrictSelectionsRestored !== true
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .proxyStopped !== true
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .credentialPersisted !== false
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .rawPayloadPersisted !== false
                    || report.checks.modelSlotRouting.authorizedRealHostRouteProbe
                        .privateChatModelEgress !== false
                )
                : corePathsPassed
                ? (
                    model.result !== 'core-paths-passed-release-still-blocked'
                    || model.attempts < 6
                    || model.succeeded !== model.attempts
                    || model.failed !== 0
                    || model.evidenceEligibleAttempts < 6
                    || model.supportingDiagnosticAttempts < 2
                    || model.proxyStatuses.some((status) => status !== 200)
                    || !Array.isArray(model.inputBytes)
                    || model.inputBytes.length !== model.attempts
                    || model.inputBytes.some((bytes) => bytes < 1)
                    || model.appliedStrictRepairCalls < 1
                    || model.appliedContinuityCalls < 1
                    || model.appliedForumCalls < 1
                    || model.staleRegenerateCalls < 1
                    || model.staleSwipeCalls < 1
                    || model.staleChatSwitchCalls < 1
                    || model.staleTargetWrites !== 0
                    || model.oldSuccessfulRunReusedAsCurrentEvidence !== false
                )
                : (
                    model.result !== 'blocked'
                    || model.succeeded !== 0
                    || model.failed !== model.attempts
                )
        )
    ) fail('blocked report real-model evidence is incomplete');

    if (tauriBackgroundEntryUnavailable) {
        const tauri = report.checks?.tauriTavern;
        if (
            !tauri
            || tauri.result !== 'blocked-active-single-instance-no-safe-background-entry'
            || tauri.releaseHostVersion !== '2.1.1'
            || tauri.foregroundAutomationUsed !== false
            || tauri.releasePilotAvailable !== false
            || tauri.singleInstanceCollisionObserved !== true
            || tauri.hiddenDuplicateCdpAvailable !== false
            || tauri.temporarySandboxHostCopyRemoved !== true
            || tauri.temporaryIdentifierIsolationAcceptedAsEvidence !== false
            || tauri.originalSandboxHostModified !== false
            || tauri.sandboxDoctorVersionAfterProbe !== '1.8.10'
            || tauri.sandboxBaselineRestored !== true
            || tauri.userRunningTauriTavernTouched !== false
        ) fail('blocked report TauriTavern background-entry evidence is incomplete');
    }

    const card = report.checks?.cardCompatibility;
    if (
        !card
        || card.sourceFormat !== 'png-v3'
        || card.originalModified !== false
        || card.worldbookEntries !== 77
        || card.tavernHelperScripts !== 3
        || card.regexScripts !== 8
        || card.standardAndLegacyContainersSupported !== true
        || card.cardSideChangesRequired !== false
    ) fail('blocked report card-compatibility evidence is incomplete');

    const publication = report.publication;
    if (
        !publication
        || publication.scope !== 'independent-branch-only'
        || publication.mainAllowed !== false
        || publication.releaseCandidateAllowed !== false
        || publication.forcePushAllowed !== false
        || !Array.isArray(publication.allowedRemoteRefs)
        || publication.allowedRemoteRefs.length !== 1
        || !/^refs\/heads\/codex\/[A-Za-z0-9._/-]+$/u.test(
            publication.allowedRemoteRefs[0],
        )
    ) fail('blocked report publication scope is not fail-closed');

    const privacy = report.privacy;
    if (
        !privacy
        || privacy.apiKeyIncluded !== false
        || privacy.privateChatIncluded !== false
        || privacy.userDataIncluded !== false
        || privacy.rawModelPayloadIncluded !== false
        || (
            fullRc8RealRuntimeRecheckRequired
                ? privacy.derivedNarrativeFindings !== 4
                : privacy.derivedNarrativeFindings !== 0
        )
        || privacy.fullPromptFindings !== 0
        || privacy.privateCanaryFindings !== 0
        || privacy.fullUserAgentIncluded !== false
        || privacy.privateChatModelEgress !== false
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
    validateActorLedgerEvidence(report);
    validateWorldPressureEvidence(report);
    validateSerendipityEvidence(report);
    if (report.result === 'blocked') {
        validateBlockedReport(report);
        const testedAt = Date.parse(report.testedAt);
        if (!Number.isFinite(testedAt)) fail('invalid testedAt timestamp');
        return report;
    }
    if (['2.0.0-rc.6', '2.0.0-rc.7', '2.0.0-rc.8', '2.0.0-rc.9'].includes(report.version)) {
        validateRc6PassReport(report);
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
        || phase7.candidate !== manifest.version
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

    const latestDatabase = report.checks?.realDatabaseCompatibility?.latest;
    if (
        !latestDatabase
        || latestDatabase.version !== 'spv8.7.4'
        || latestDatabase.production !== true
        || latestDatabase.cleanAuthorLoader !== true
        || latestDatabase.legacySourceRewriteExcludedFromSterileRoot !== true
        || latestDatabase.legacySourceRewriteDetectedByDoctor !== true
        || !/^[a-f0-9]{64}$/u.test(latestDatabase.authorImportSha256 || '')
        || !/^[a-f0-9]{64}$/u.test(latestDatabase.officialBundleSha256 || '')
        || latestDatabase.bundleRequestCount < 2
        || latestDatabase.bundleResponseCount !== latestDatabase.bundleRequestCount
        || latestDatabase.bundleSuccessResponseCount < 2
        || latestDatabase.responseVersion !== 'spv8.7.4'
        || latestDatabase.apiVisible !== true
        || latestDatabase.apiMethods < 100
        || latestDatabase.publicUpdateReturnedTruthyObject !== true
        || latestDatabase.independentBridgeInstalled !== false
        || latestDatabase.independentBridgeAbsent !== true
        || latestDatabase.reloadIndependentBridgeAbsent !== true
        || latestDatabase.uiSurfaceCountBeforeReload < 1
        || latestDatabase.reloadApiMethods !== latestDatabase.apiMethods
        || latestDatabase.reloadUiSurfaceCount < 1
        || latestDatabase.result !== 'pass'
        || latestDatabase.doctorRuntimeErrorCount !== 0
        || latestDatabase.databaseRuntimeErrorCount !== 0
        || latestDatabase.sterileDataRoot !== true
        || latestDatabase.privateSettingsCopied !== false
        || latestDatabase.privateChatsCopied !== false
        || latestDatabase.privateCharactersCopied !== false
        || latestDatabase.credentialsCopied !== false
        || latestDatabase.originalUserDataModified !== false
        || latestDatabase.temporaryDataRemoved !== true
        || latestDatabase.isolatedHostPortClosed !== true
    ) fail('latest real database update evidence is incomplete');

    const affectedModel = report.checks?.realModel;
    if (
        !affectedModel
        || affectedModel.result !== 'affected-paths-passed'
        || affectedModel.attempts !== 3
        || affectedModel.succeeded !== 3
        || affectedModel.failed !== 0
        || affectedModel.proxyStatuses?.join(',') !== '200,200,200'
        || (
            affectedModel.inputBytes?.length === 3
                ? affectedModel.inputBytes.some((bytes) => bytes < 1)
                : (
                    affectedModel.inputPayloadNonEmpty?.length !== 3
                    || affectedModel.inputPayloadNonEmpty.some(
                        (present) => present !== true,
                    )
                )
        )
        || affectedModel.doctorModelCallDelta !== 3
        || affectedModel.doctorRetryCount !== 0
        || affectedModel.doctorModelCompleted !== true
        || affectedModel.doctorFallbackUsed !== false
        || affectedModel.appliedContinuityCalls < 1
        || affectedModel.actorWorldSettled !== true
        || affectedModel.actorReceiptCount < 1
        || affectedModel.worldLaneTypes?.join(',') !== 'environment,faction'
        || affectedModel.worldLaneReceiptCount < 2
        || affectedModel.worldLaneIndependentOfActors !== true
        || affectedModel.secondModelStructureRepairAttempted !== false
        || affectedModel.databaseRuntimeLoadedDuringModelProbe !== false
        || affectedModel.syntheticFixtureUsed !== true
        || affectedModel.privateChatModelEgress !== false
        || affectedModel.credentialPersisted !== false
        || affectedModel.rawPayloadPersisted !== false
        || affectedModel.credentialClearedFromBrowserMemory !== true
        || affectedModel.credentialClearedFromProxy !== true
        || affectedModel.hostPortClosed !== true
        || affectedModel.proxyPortClosed !== true
    ) fail('affected real-model path evidence is incomplete');

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
        || socialGuard.providerUsageOnly !== true
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
        || companion.doctorRuntimeConsoleErrorCount !== 0
        || companion.databaseRuntimeConsoleErrorCount !== 0
        || companion.companionRuntimeConsoleErrorCount !== 0
        || companion.thirdPartyErrorAttributionReliable !== true
        || companion.thirdPartyErrorOwner !== 'JS-Slash-Runner'
        || companion.thirdPartyAttributedErrorCount < 1
        || companion.hostConsoleCleanClaimed !== false
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
