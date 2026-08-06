import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const doctorRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = path.dirname(doctorRoot);
const stRoot = path.join(workspaceRoot, 'real-sillytavern-qc', 'app');
const sourceSettingsPath = path.join(
    stRoot,
    'data',
    'default-user',
    'settings.json',
);
const sourceSecretsPath = path.join(
    stRoot,
    'data',
    'default-user',
    'secrets.json',
);
const legacyPublicDoctorRoot = path.join(
    stRoot,
    'public',
    'scripts',
    'extensions',
    'third-party',
    'mvu-auto-doctor',
);
const hostPort = 8011;
const proxyPort = 9328;
const candidateVersion = JSON.parse(
    fs.readFileSync(path.join(doctorRoot, 'manifest.json'), 'utf8'),
).version;
const bundledNodeModules = path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'node',
    'node_modules',
    '.pnpm',
);
const bundledPlaywright = fs.existsSync(bundledNodeModules)
    ? fs.readdirSync(bundledNodeModules)
        .filter((name) => /^playwright@/u.test(name))
        .map((name) => path.join(
            bundledNodeModules,
            name,
            'node_modules',
            'playwright',
            'index.mjs',
        ))
        .find((candidate) => fs.existsSync(candidate))
    : '';
const playwrightPath = [
    process.env.PLAYWRIGHT_PATH,
    path.join(doctorRoot, 'node_modules', 'playwright', 'index.mjs'),
    bundledPlaywright,
    path.join(
        process.env.USERPROFILE || '',
        '.cache',
        'codex-runtimes',
        'codex-primary-runtime',
        'dependencies',
        'node',
        'node_modules',
        'playwright',
        'index.mjs',
    ),
].filter(Boolean).find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error('Playwright is unavailable');
const { chromium } = await import(pathToFileURL(playwrightPath).href);

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function copyDoctorRuntime(targetRoot) {
    const rootFiles = [
        'actor-authority-core.d.mts',
        'actor-authority-core.mjs',
        'actor-ledger-core.d.mts',
        'actor-ledger-core.mjs',
        'actor-profile-v6-core.d.mts',
        'actor-profile-v6-core.mjs',
        'actor-shard-core.d.mts',
        'actor-shard-core.mjs',
        'CHANGELOG.md',
        'continuity-core.mjs',
        'core.mjs',
        'custom-instruction-core.d.mts',
        'custom-instruction-core.mjs',
        'forum-core.mjs',
        'index.js',
        'LICENSE',
        'manifest.json',
        'model-queue.mjs',
        'protocol-core.mjs',
        'README.md',
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
    ];
    fs.rmSync(targetRoot, { recursive: true, force: true });
    fs.mkdirSync(targetRoot, { recursive: true });
    for (const relativePath of rootFiles) {
        fs.copyFileSync(
            path.join(doctorRoot, relativePath),
            path.join(targetRoot, relativePath),
        );
    }
    fs.cpSync(path.join(doctorRoot, 'v2'), path.join(targetRoot, 'v2'), {
        recursive: true,
        filter: (source) => (
            fs.statSync(source).isDirectory()
            || /\.(?:mjs|mts)$/u.test(source)
        ),
    });
}

async function waitForHttp(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
        } catch {
            // The isolated process is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Local QC service did not become ready');
}

async function waitForExit(child, timeoutMs = 10_000) {
    if (!child || child.exitCode !== null) return true;
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        child.once('exit', () => {
            clearTimeout(timer);
            resolve(true);
        });
    });
}

async function stopChild(child) {
    if (!child || child.exitCode !== null) return true;
    child.kill();
    return waitForExit(child);
}

async function isPortClosed(port) {
    try {
        await fetch(`http://127.0.0.1:${port}/`, {
            signal: AbortSignal.timeout(1_000),
        });
        return false;
    } catch {
        return true;
    }
}

async function loadMemoryBrokerCredentials() {
    const rawUrl = String(process.env.MVUAD_QC_CREDENTIAL_BROKER_URL || '').trim();
    process.env.MVUAD_QC_CREDENTIAL_BROKER_URL = '';
    if (!rawUrl) return { opencode: '', deepseek: '', source: 'local-profile' };
    let brokerUrl = null;
    try {
        brokerUrl = new URL(rawUrl);
    } catch {
        throw new Error('Approved memory credential broker is unavailable');
    }
    if (
        brokerUrl.protocol !== 'http:'
        || brokerUrl.hostname !== '127.0.0.1'
        || !brokerUrl.port
        || !brokerUrl.pathname.startsWith('/credential/')
        || brokerUrl.username
        || brokerUrl.password
    ) {
        throw new Error('Approved memory credential broker is unavailable');
    }
    const response = await fetch(brokerUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
        throw new Error('Approved memory credential broker is unavailable');
    }
    const body = await response.json();
    return {
        opencode: String(body?.opencode || '').trim(),
        deepseek: String(body?.deepseek || '').trim(),
        source: 'authorized-project-history-memory',
    };
}

const brokerCredentials = await loadMemoryBrokerCredentials();
const sourceSettings = JSON.parse(fs.readFileSync(sourceSettingsPath, 'utf8'));
const sourceModel = sourceSettings.extension_settings?.mvu_auto_doctor || {};
const directModelConfig = {
    endpoint: brokerCredentials.deepseek
        ? `http://127.0.0.1:${proxyPort}/v1`
        : String(sourceModel.connectionEndpoint || '').trim(),
    apiKey: brokerCredentials.deepseek
        || String(sourceModel.connectionApiKey || '').trim(),
    model: brokerCredentials.deepseek
        ? 'deepseek-chat'
        : String(sourceModel.connectionModel || '').trim(),
    proxy: 'deepseek',
};
const sourceSecrets = JSON.parse(fs.readFileSync(sourceSecretsPath, 'utf8'));
const activeCustomSecret = Array.isArray(sourceSecrets.api_key_custom)
    ? sourceSecrets.api_key_custom.find((item) => (
        item?.active === true
        && String(item?.value || '').trim().length >= 32
    ))
    : null;
const customBase = String(sourceSettings.oai_settings?.custom_url || '').trim();
const requestedQcModel = String(process.env.MVUAD_QC_MODEL || '').trim();
process.env.MVUAD_QC_MODEL = '';
if (requestedQcModel && !/^gemini[-_]/iu.test(requestedQcModel)) {
    throw new Error('Current QC explicitly requires a real Gemini model id');
}
const customModel = requestedQcModel
    || String(sourceSettings.oai_settings?.custom_model || '').trim();
const brokerSupplied = (
    brokerCredentials.source === 'authorized-project-history-memory'
);
let customOrigin = null;
try {
    customOrigin = new URL(customBase).origin;
} catch {
    // Checked below without including the source value in an error.
}
const approvedCustom = (
    sourceSettings.oai_settings?.chat_completion_source === 'custom'
    && customOrigin === 'https://opencode.ai'
    && (
        brokerSupplied
            ? brokerCredentials.opencode
            : activeCustomSecret
    )
    && customModel
);
const modelConfig = approvedCustom
    ? {
        endpoint: `http://127.0.0.1:${proxyPort}/v1`,
        apiKey: brokerCredentials.opencode
            || String(activeCustomSecret.value || '').trim(),
        model: customModel,
        proxy: 'opencode',
    }
    : directModelConfig;
let endpoint = null;
try {
    endpoint = new URL(modelConfig.endpoint);
} catch {
    // Checked below without including the source value in an error.
}
if (
    !endpoint
    || endpoint.hostname !== '127.0.0.1'
    || Number(endpoint.port) !== proxyPort
    || !modelConfig.apiKey
    || !modelConfig.model
) {
    throw new Error('Approved memory-only QC model profile is unavailable');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mvuad-real-model-qc-'));
const resolvedTemp = path.resolve(tempRoot);
const legacyPublicBackupRoot = path.join(tempRoot, 'legacy-public-doctor-backup');
const legacyPublicExisted = fs.existsSync(legacyPublicDoctorRoot);
let legacyPublicRestored = false;
if (
    path.dirname(resolvedTemp) !== path.resolve(os.tmpdir())
    || !path.basename(resolvedTemp).startsWith('mvuad-real-model-qc-')
) {
    throw new Error('Unsafe temporary QC root');
}

let browser = null;
let server = null;
let proxy = null;
let proxyPreexisting = false;
let runFailed = false;
let legacyPublicTemporarilyReplaced = false;
const runtimeErrors = [];
const report = {
    schemaVersion: 1,
    host: {
        version: '1.18.0',
        port: hostPort,
        headless: true,
        sterileDataRoot: true,
    },
    setup: {
        privateSettingsCopied: false,
        privateChatsCopied: false,
        privateCharactersCopied: false,
        credentialWrittenToDisk: false,
        credentialInjectedIntoBrowserMemory: true,
        databaseRuntimeLoaded: false,
        syntheticFixture: true,
        originalUserDataModified: false,
        model: modelConfig.model,
        credentialSource: brokerCredentials.source,
        candidateVersion,
        candidateIndexSha256: sha256(
            fs.readFileSync(path.join(doctorRoot, 'index.js')),
        ),
        legacyPublicRuntimeTemporarilyReplaced: true,
    },
    runtime: {},
    cleanup: {},
};

try {
    const tempUserRoot = path.join(tempRoot, 'default-user');
    fs.mkdirSync(tempUserRoot, { recursive: true });
    fs.writeFileSync(
        path.join(tempUserRoot, 'settings.json'),
        `${JSON.stringify({
            extension_settings: {
                disabledExtensions: [],
                mvu_auto_doctor: {},
            },
        }, null, 2)}\n`,
    );
    copyDoctorRuntime(path.join(
        tempUserRoot,
        'extensions',
        'mvu-auto-doctor',
    ));
    if (legacyPublicExisted) {
        fs.cpSync(legacyPublicDoctorRoot, legacyPublicBackupRoot, {
            recursive: true,
        });
    }
    copyDoctorRuntime(legacyPublicDoctorRoot);
    legacyPublicTemporarilyReplaced = true;

    try {
        const existingHealth = await (
            await fetch(`http://127.0.0.1:${proxyPort}/health`, {
                signal: AbortSignal.timeout(1_000),
            })
        ).json();
        proxyPreexisting = (
            existingHealth.ok === true
            && existingHealth.credentialLoaded === true
            && existingHealth.requestCredentialAccepted === true
        );
    } catch {
        proxyPreexisting = false;
    }
    if (!proxyPreexisting) {
        const proxyScript = modelConfig.proxy === 'opencode'
            ? 'opencode-memory-proxy.mjs'
            : 'deepseek-memory-proxy.mjs';
        proxy = spawn(process.execPath, [
            path.join(doctorRoot, 'qc', proxyScript),
        ], {
            cwd: doctorRoot,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                DS_TEST_KEY: '',
                DS_TEST_PORT: String(proxyPort),
                OPENCODE_QC_PORT: String(proxyPort),
                OPENCODE_QC_UPSTREAM: String(
                    process.env.OPENCODE_QC_UPSTREAM || '',
                ),
            },
        });
        for (const stream of [proxy.stdout, proxy.stderr]) {
            stream.on('data', (chunk) => {
                const text = String(chunk);
                if (/EADDRINUSE|fatal|uncaught/iu.test(text)) {
                    runtimeErrors.push({
                        owner: 'proxy',
                        digest: sha256(text),
                    });
                }
            });
        }
    }
    const proxyHealthBefore = await (
        await waitForHttp(`http://127.0.0.1:${proxyPort}/health`)
    ).json();
    if (
        proxyHealthBefore.ok !== true
        || proxyHealthBefore.credentialLoaded !== proxyPreexisting
        || proxyHealthBefore.requestCredentialAccepted !== true
    ) {
        throw new Error('Memory-only model proxy health check failed');
    }
    try {
        const occupied = await fetch(`http://127.0.0.1:${hostPort}/`, {
            signal: AbortSignal.timeout(1_000),
        });
        if (occupied) throw new Error('isolated QC host port is already occupied');
    } catch (error) {
        if (/already occupied/u.test(String(error?.message || error))) throw error;
    }

    server = spawn(process.execPath, [
        'server.js',
        '--port', String(hostPort),
        '--dataRoot', tempRoot,
        '--browserLaunchEnabled=false',
        '--listen=false',
    ], {
        cwd: stRoot,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [server.stdout, server.stderr]) {
        stream.on('data', (chunk) => {
            const text = String(chunk);
            if (/EADDRINUSE|fatal|uncaught/iu.test(text)) {
                runtimeErrors.push({
                    owner: 'host',
                    digest: sha256(text),
                });
            }
        });
    }
    const hostResponse = await waitForHttp(`http://127.0.0.1:${hostPort}/`);
    if (
        server.exitCode !== null
        || runtimeErrors.some((entry) => entry.owner === 'host')
    ) {
        throw new Error('isolated SillyTavern server did not own the QC port');
    }

    const systemBrowser = [
        process.env.MVUAD_BROWSER_EXECUTABLE_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
    browser = await chromium.launch({
        headless: true,
        ...(systemBrowser ? { executablePath: systemBrowser } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        runtimeErrors.push({
            owner: /mvu-auto-doctor/iu.test(text) ? 'doctor' : 'host',
            digest: sha256(text.replace(/https?:\/\/[^\s)]+/giu, '[url]')),
        });
    });
    page.on('pageerror', (error) => {
        const text = String(error?.stack || error?.message || error);
        runtimeErrors.push({
            owner: /mvu-auto-doctor/iu.test(text) ? 'doctor' : 'host',
            digest: sha256(text.replace(/https?:\/\/[^\s)]+/giu, '[url]')),
        });
    });
    await page.goto(`http://127.0.0.1:${hostPort}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
    });
    await page.waitForFunction(() => !!window.MvuAutoDoctorAPI, null, {
        timeout: 60_000,
    });

    const modelResult = await page.evaluate(async (config) => {
        const baseContext = window.SillyTavern?.getContext?.() || {};
        const extensionSettings = baseContext.extensionSettings || {};
        const settings = extensionSettings.mvu_auto_doctor || {};
        Object.assign(settings, {
            enabled: true,
            socialNarrativeGuardEnabled: true,
            socialAuditMode: 'balanced',
            socialAuditSettingsVersion: 3,
            fastModelProvider: 'direct',
            strictModelProvider: 'direct',
            fastApiJsonMode: true,
            connectionEndpoint: config.endpoint,
            connectionApiKey: config.apiKey,
            connectionModel: config.model,
            connectionViaBackend: false,
            connectionRawUrl: false,
            connectionPresets: [],
            strictConnectionPreset: '__current__',
            fastConnectionPreset: '__current__',
            modelRoutingSettingsVersion: 2,
            modelTimeoutMs: 120000,
        });
        extensionSettings.mvu_auto_doctor = settings;

        const beforeData = {
            stat_data: {
                characters: {
                    Subject: {
                        trust: 5,
                        relationship: 'ally',
                    },
                },
            },
            display_data: {},
        };
        const afterData = {
            stat_data: {
                characters: {
                    Subject: {
                        trust: 40,
                        relationship: 'fanatic',
                    },
                },
            },
            display_data: {},
        };
        let latestData = structuredClone(afterData);
        let replaceCalls = 0;
        const messages = [
            {
                is_user: false,
                is_system: false,
                mes: 'Synthetic opening.',
                swipe_id: 0,
                extra: {},
            },
            {
                is_user: true,
                is_system: false,
                mes: 'I offer a meal and ask whether the subject wants to join.',
                swipe_id: 0,
                extra: {},
            },
            {
                is_user: false,
                is_system: false,
                mes: '<content>The subject becomes fanatically loyal immediately. '
                    + 'At midnight, the public North Harbor tide gauge shows that '
                    + 'the old bridge will close within one turn. The public notice '
                    + 'is posted at North Harbor; the investigator remains offscreen.</content>\n'
                    + '<UpdateVariable><Analysis>synthetic relationship jump</Analysis>'
                    + '<JSONPatch>[]</JSONPatch></UpdateVariable>',
                swipe_id: 0,
                extra: {},
            },
        ];
        const syntheticContext = {
            ...baseContext,
            chat: messages,
            chatId: 'mvuad-synthetic-real-model',
            chatMetadata: {},
            extensionSettings,
            characterId: 0,
            groupId: null,
            characters: [{
                data: {
                    extensions: {
                        tavern_helper: {
                            scripts: [{
                                name: 'synthetic-schema',
                                enabled: true,
                                content: 'registerMvuSchema(z.object({characters:z.record(z.any())}))',
                            }],
                        },
                    },
                    character_book: {
                        entries: [{
                            comment: '[mvu_update] synthetic rule',
                            constant: true,
                            disable: false,
                            order: 1,
                            content: 'Relationship changes require explicit narrative evidence.',
                        }, {
                            comment: 'synthetic oversized public worldbook',
                            constant: true,
                            disable: false,
                            order: 2,
                            content: 'Synthetic public North Harbor logistics bulletin. '
                                .repeat(2500),
                        }],
                    },
                },
            }],
            substituteParams: (text) => text,
            saveSettingsDebounced() {},
            saveMetadataDebounced() {},
            updateChatMetadata(patch) {
                Object.assign(this.chatMetadata, patch);
            },
            async saveChat() {},
            updateMessageBlock() {},
            setExtensionPrompt() {},
        };
        window.SillyTavern = {
            ...(window.SillyTavern || {}),
            getContext: () => syntheticContext,
        };
        window.Mvu = {
            isDuringExtraAnalysis: () => false,
            getMvuData: (options = {}) => {
                const key = String(options.message_id);
                if (key === '0') return structuredClone(beforeData);
                return structuredClone(latestData);
            },
            async replaceMvuData(data) {
                replaceCalls += 1;
                latestData = structuredClone(data);
            },
        };
        window.TavernHelper = {
            waitGlobalInitialized: async () => window.Mvu,
        };

        const callsBefore = window.MvuAutoDoctorAPI.getModelCallStats();
        const audit = await window.MvuAutoDoctorAPI.auditSocialRelations();
        const latestAudit = window.MvuAutoDoctorAPI.getSocialAudits().at(0) || {};
        Object.assign(settings, {
            continuityMode: 'on',
            builtInContinuityEnabled: true,
            continuityAutonomy: 'living',
            continuityMaxThreads: 12,
            continuityMaxVisible: 2,
            actorShardMode: 'on',
            actorShardMaxWorkers: 1,
            actorLedgerMaxActorsPerTurn: 1,
            actorLedgerExplorationSlots: 0,
            actorLedgerCollisionIntensity: 2,
        });
        syntheticContext.chatMetadata.mvu_auto_doctor = {
            continuity: {
                version: 5,
                chatId: syntheticContext.chatId,
                turn: 3,
                threads: [{
                    id: 'QC-ACTOR-ADA',
                    title: 'Ada checks North Harbor freight records',
                    kind: 'parallel',
                    eventType: 'progress',
                    level: 2,
                    origin: 'setting_independent',
                    relation: 'independent',
                    stage: 'advancing',
                    stageProgress: 3,
                    summary: 'Ada is checking public freight records in North Harbor.',
                    nextBeat: 'Ada will compare the midnight arrival list.',
                    trigger: 'The midnight shift begins.',
                    seedBasis: 'Synthetic QC setting: North Harbor freight rules.',
                    actors: ['Ada'],
                    locations: ['North Harbor'],
                    knowledge: 'observed',
                    urgency: 3,
                    causedBy: ['QC-HARBOR-PUBLIC-NOTICE'],
                    sourceRefs: [{
                        messageId: 'assistant-2',
                        hash: 'qc-harbor-public-notice',
                    }],
                }],
                world: {
                    factions: [{
                        id: 'FAC-QC-HARBOR',
                        name: 'North Harbor Freight Union',
                        condition: 'strained',
                        goal: 'Reroute freight before the old bridge closes.',
                        summary: 'Public rerouting costs are rising.',
                        scope: 'North Harbor',
                        knowledge: 'observed',
                        basis: 'Synthetic public dispatch notice.',
                        updatedTurn: 1,
                    }],
                    environment: {
                        economy: 'strained',
                        summary: 'The rising tide is reducing short-haul capacity.',
                        basis: 'Synthetic public tide gauge.',
                        updatedTurn: 2,
                        incidents: [{
                            id: 'INC-QC-TIDE',
                            title: 'North Harbor rising tide',
                            status: 'active',
                            summary: 'The old bridge reaches closure level within one turn.',
                            scope: 'North Harbor',
                            remainingTurns: 1,
                            knowledge: 'observed',
                            basis: 'Synthetic public tide gauge.',
                            updatedTurn: 3,
                        }],
                    },
                },
            },
        };
        const continuityResult = await window.MvuAutoDoctorAPI.runContinuity();
        const callsAfter = window.MvuAutoDoctorAPI.getModelCallStats();
        const actorReceipts = window.MvuAutoDoctorAPI.getActorActionReceipts();
        const worldLaneReceipts = window.MvuAutoDoctorAPI.getWorldLaneReceipts();
        const finalDiagnostic = window.MvuAutoDoctorAPI.getDiagnosticProjection();
        const actorShardDiagnostic = finalDiagnostic.actorShards || {};
        const actorLedgerView = window.MvuAutoDoctorAPI.getActorLedgerView();
        const modelDiagnostics = window.MvuAutoDoctorAPI.getModelDiagnostics()
            .slice(0, 12)
            .map((entry) => ({
                phase: entry.phase,
                task: entry.task,
                status: entry.status,
                durationMs: entry.durationMs,
                queueWaitMs: entry.queueWaitMs,
                httpStatus: entry.httpStatus,
                failureKind: entry.failureKind,
                reason: entry.reason,
                routeSlotIndex: entry.routeSlotIndex,
            }));
        settings.connectionApiKey = '';
        config.apiKey = '';
        return {
            doctorVersion:
                window.MvuAutoDoctorAPI.getDiagnosticProjection().plugin.version,
            status: audit?.status || '',
            correctionStatus: audit?.correction?.status || '',
            modelCallDelta:
                Number(callsAfter.total || 0) - Number(callsBefore.total || 0),
            attemptCount: Number(latestAudit?.modelCall?.attempts || 0),
            modelAttempted: latestAudit?.modelCall?.attempted === true,
            modelCompleted: latestAudit?.modelCall?.completed === true,
            fallbackUsed: latestAudit?.modelCall?.fallback === true,
            localStructureRepairAttempted:
                latestAudit?.modelCall?.localStructureRepairAttempted === true,
            structureRepairAttempted:
                latestAudit?.modelCall?.structureRepairAttempted === true,
            replaceCalls,
            relationshipAfterFailure: {
                trust: latestData.stat_data.characters.Subject.trust,
                relationship: latestData.stat_data.characters.Subject.relationship,
            },
            failureZeroWrite: (
                replaceCalls === 0
                && latestData.stat_data.characters.Subject.trust === 40
                && latestData.stat_data.characters.Subject.relationship === 'fanatic'
            ),
            continuityStatus: continuityResult?.status || '',
            continuityClockOnly: continuityResult?.clockOnly === true,
            actorWorldSettled: actorReceipts.some(
                (receipt) => receipt.stage === 'world_settled',
            ),
            actorSemanticSettled: actorReceipts.some(
                (receipt) => (
                    receipt.stage === 'world_settled'
                    && receipt.semanticProgress === true
                ),
            ),
            actorReceiptCount: actorReceipts.length,
            actorLedgerPublicCount: actorLedgerView.actors.length,
            actorSemanticProgressCount: Number(
                actorLedgerView.semanticProgressCount || 0,
            ),
            actorStateFactCount: actorLedgerView.actors.reduce(
                (total, actor) => total + (
                    Array.isArray(actor.stateFacts) ? actor.stateFacts.length : 0
                ),
                0,
            ),
            actorConsecutiveFailureCount: Number(
                actorLedgerView.consecutiveFailureCount || 0,
            ),
            actorShardDiagnostic: {
                status: actorShardDiagnostic.status || '',
                selected: Number(actorShardDiagnostic.selected || 0),
                completed: Number(actorShardDiagnostic.completed || 0),
                succeeded: Number(actorShardDiagnostic.succeeded || 0),
                failed: Number(actorShardDiagnostic.failed || 0),
                semanticActions: Number(actorShardDiagnostic.semanticActions || 0),
                heldActions: Number(actorShardDiagnostic.heldActions || 0),
                failureCodes: Array.isArray(actorShardDiagnostic.failureCodes)
                    ? actorShardDiagnostic.failureCodes.slice(0, 8)
                    : [],
                acceptedActions: Number(actorShardDiagnostic.acceptedActions || 0),
                rejectedActions: Number(actorShardDiagnostic.rejectedActions || 0),
                rejectionReasons: Array.isArray(actorShardDiagnostic.rejectionReasons)
                    ? actorShardDiagnostic.rejectionReasons.slice(0, 8)
                    : [],
            },
            modelDiagnostics,
            worldLaneTypes: [...new Set(
                worldLaneReceipts.map((receipt) => receipt.laneType),
            )].sort(),
            worldLaneReceiptCount: worldLaneReceipts.length,
            worldLaneIndependentOfActors: worldLaneReceipts.length > 0
                && worldLaneReceipts.every(
                    (receipt) => receipt.independentOfActors === true,
                ),
            promptInfo: window.MvuAutoDoctorAPI.getLastPromptInfo(),
        };
    }, modelConfig);
    modelConfig.apiKey = '';

    const metricsResponse = await fetch(
        `http://127.0.0.1:${proxyPort}/metrics`,
    );
    const metrics = await metricsResponse.json();
    const credentialDelete = await fetch(
        `http://127.0.0.1:${proxyPort}/credential`,
        { method: 'DELETE' },
    );
    const proxyHealthAfter = await (
        await fetch(`http://127.0.0.1:${proxyPort}/health`)
    ).json();
    if (modelResult.doctorVersion !== candidateVersion) {
        throw new Error('served doctor version does not match the candidate');
    }
    report.runtime = {
        hostHttpStatus: hostResponse.status,
        credentialPreloadedInMemoryProxy: proxyPreexisting,
        ...modelResult,
        proxyMetrics: metrics.map((metric) => ({
            status: metric.status,
            inputBytes: metric.inputBytes,
            model: metric.model,
            stream: metric.stream,
            durationMs: metric.durationMs,
        })),
        credentialDeleteStatus: credentialDelete.status,
        credentialLoadedAfterDelete: proxyHealthAfter.credentialLoaded,
        doctorErrorCount:
            runtimeErrors.filter((entry) => entry.owner === 'doctor').length,
        processErrorCount:
            runtimeErrors.filter((entry) => ['host', 'proxy'].includes(entry.owner)).length,
        errorDigests: [...new Set(runtimeErrors.map((entry) => entry.digest))],
    };
    if (
        modelResult.modelCallDelta !== 3
        || modelResult.attemptCount !== 1
        || modelResult.modelAttempted !== true
        || modelResult.modelCompleted !== true
        || modelResult.fallbackUsed === true
        || modelResult.continuityStatus !== 'applied'
        || modelResult.continuityClockOnly === true
        || modelResult.actorWorldSettled !== true
        || modelResult.actorSemanticSettled !== true
        || modelResult.actorSemanticProgressCount < 1
        || modelResult.actorStateFactCount < 1
        || modelResult.actorConsecutiveFailureCount !== 0
        || modelResult.actorShardDiagnostic.semanticActions < 1
        || modelResult.actorShardDiagnostic.heldActions !== 0
        || modelResult.worldLaneIndependentOfActors !== true
        || Number(modelResult.promptInfo?.totalChars || 0) > 40_000
        || !modelResult.worldLaneTypes.includes('environment')
        || !modelResult.worldLaneTypes.includes('faction')
        || metrics.length !== 3
        || metrics.some((metric) => metric.status !== 200)
        || credentialDelete.status !== 200
        || proxyHealthAfter.credentialLoaded !== false
    ) {
        throw new Error('Real model acceptance criteria failed');
    }
} catch (error) {
    runFailed = true;
    const safeMessage = String(error?.message || error)
        .replace(/Bearer\s+\S+/giu, 'Bearer [redacted]')
        .replace(/https?:\/\/[^\s)]+/giu, '[url]');
    report.failure = {
        code: /profile is unavailable/u.test(safeMessage)
            ? 'approved_model_profile_unavailable'
            : /already occupied|did not own the QC port/u.test(safeMessage)
                ? 'isolated_qc_port_not_owned'
            : /doctor version does not match/u.test(safeMessage)
                ? 'candidate_version_mismatch'
            : /acceptance criteria failed/u.test(safeMessage)
                ? 'real_model_acceptance_failed'
                : /service did not become ready/u.test(safeMessage)
                    ? 'local_service_not_ready'
                    : 'real_model_probe_failed',
        digest: sha256(safeMessage),
    };
} finally {
    modelConfig.apiKey = '';
    brokerCredentials.opencode = '';
    brokerCredentials.deepseek = '';
    if (browser) await browser.close().catch(() => undefined);
    const serverStopped = await stopChild(server);
    const proxyStopped = proxyPreexisting ? false : await stopChild(proxy);
    const hostPortClosed = await isPortClosed(hostPort);
    const proxyPortClosed = proxyPreexisting
        ? false
        : await isPortClosed(proxyPort);
    if (legacyPublicTemporarilyReplaced) {
        fs.rmSync(legacyPublicDoctorRoot, { recursive: true, force: true });
        if (legacyPublicExisted) {
            fs.cpSync(legacyPublicBackupRoot, legacyPublicDoctorRoot, {
                recursive: true,
            });
        }
    }
    legacyPublicRestored = !legacyPublicTemporarilyReplaced || (legacyPublicExisted
        ? (
            fs.existsSync(path.join(legacyPublicDoctorRoot, 'index.js'))
            && sha256(fs.readFileSync(path.join(legacyPublicDoctorRoot, 'index.js')))
                === sha256(fs.readFileSync(path.join(legacyPublicBackupRoot, 'index.js')))
        )
        : !fs.existsSync(legacyPublicDoctorRoot));
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
    report.cleanup = {
        browserClosed: browser !== null,
        serverStopped,
        proxyStopped,
        externalProxyCleanupRequired: proxyPreexisting,
        hostPortClosed,
        proxyPortClosed,
        temporaryDataRemoved: !fs.existsSync(resolvedTemp),
        legacyPublicRuntimeRestored: legacyPublicRestored,
        credentialClearedFromNodeMemory: modelConfig.apiKey === '',
        originalUserDataModified: false,
    };
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
const reportPath = path.resolve(doctorRoot, 'qc/reports/latest-real-model.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (runFailed) process.exitCode = 1;
