import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const doctorRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = path.dirname(doctorRoot);
const stRoot = path.join(workspaceRoot, 'real-sillytavern-qc', 'app');
const sourceTavernHelperRoot = path.join(
    stRoot,
    'data',
    'default-user',
    'extensions',
    'TavernHelper',
);
const legacyPublicDoctorRoot = path.join(
    stRoot,
    'public',
    'scripts',
    'extensions',
    'third-party',
    'mvu-auto-doctor',
);
const authorLoaderPath = [
    path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        '酒馆助手脚本-数据库本体 (1).json',
    ),
    path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        '酒馆助手脚本-数据库本体.json',
    ),
].find((candidate) => fs.existsSync(candidate));
const targetDatabaseVersion = 'spv8.7.4';
const port = 8011;
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

function visitStrings(value, callback) {
    if (typeof value === 'string') {
        callback(value);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((entry) => visitStrings(entry, callback));
        return;
    }
    if (!value || typeof value !== 'object') return;
    Object.values(value).forEach((entry) => visitStrings(entry, callback));
}

function cleanAuthorScript() {
    if (!authorLoaderPath) throw new Error('Author loader is unavailable');
    const imported = JSON.parse(fs.readFileSync(authorLoaderPath, 'utf8'));
    const candidates = [];
    visitStrings(imported, (value) => {
        if (/gcore\.jsdelivr\.net\/gh\/AlbusKen\/shujuku/iu.test(value)) {
            candidates.push(value);
        }
    });
    if (candidates.length !== 1) {
        throw new Error('Expected exactly one author loader entry');
    }
    const source = candidates[0].replace(/spv\d+(?:\.\d+)*/iu, targetDatabaseVersion);
    if (
        !source.includes(`@${targetDatabaseVersion}/index.js`)
        || /patchDatabaseSource|PATCH_OPTIONS|MvuAutoDoctorAPI/iu.test(source)
    ) {
        throw new Error('Author loader normalization failed');
    }
    return {
        source,
        record: {
            type: imported.type,
            enabled: imported.enabled === true,
            name: imported.name,
            id: imported.id,
            content: source,
        },
    };
}

function createSterileSettings(authorScript) {
    return {
        extension_settings: {
            disabledExtensions: [],
            tavern_helper: {
                script: {
                    enabled: {
                        global: true,
                        characters: [],
                        presets: [],
                    },
                    popuped: {
                        characters: [],
                        presets: [],
                    },
                    scripts: [authorScript],
                },
            },
        },
    };
}

function copyDoctorRuntime(targetRoot) {
    const rootFiles = [
        'actor-shard-core.d.mts',
        'actor-shard-core.mjs',
        'CHANGELOG.md',
        'continuity-core.mjs',
        'core.mjs',
        'forum-core.mjs',
        'index.js',
        'LICENSE',
        'manifest.json',
        'model-queue.mjs',
        'protocol-core.mjs',
        'README.md',
        'social-core.mjs',
        'style.css',
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

async function waitForHost(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.status === 200) return response.status;
        } catch {
            // The isolated server is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Isolated SillyTavern did not become ready');
}

async function waitForExit(child, timeoutMs = 10_000) {
    if (child.exitCode !== null) return true;
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        child.once('exit', () => {
            clearTimeout(timer);
            resolve(true);
        });
    });
}

function classifyRuntimeError(value) {
    const text = String(value || '');
    const owner = /mvu-auto-doctor/iu.test(text)
        ? 'doctor'
        : /AlbusKen\/shujuku|AutoCardUpdater|TavernDB|SP_DATABASE/iu.test(text)
            ? 'database'
            : /TavernHelper/iu.test(text)
                ? 'tavern-helper'
                : 'host-or-other';
    return {
        owner,
        class: /Failed to fetch dynamically imported module|Importing a module script failed/iu.test(text)
            ? 'module-fetch-failed'
            : /CORS|cross-origin/iu.test(text)
                ? 'cors'
                : /ERR_(?:CONNECTION|NAME|NETWORK|TIMED_OUT)|Failed to load resource/iu.test(text)
                    ? 'network-or-resource'
                    : /SyntaxError|Unexpected token|Cannot use import/iu.test(text)
                        ? 'script-syntax'
                        : /TypeError|ReferenceError/iu.test(text)
                            ? 'script-runtime'
                            : 'other',
        digest: sha256(text.replace(/https?:\/\/[^\s)]+/giu, '[url]')),
    };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mvuad-spv874-qc-'));
const resolvedTemp = path.resolve(tempRoot);
const legacyPublicBackupRoot = path.join(tempRoot, 'legacy-public-doctor-backup');
const legacyPublicExisted = fs.existsSync(legacyPublicDoctorRoot);
let legacyPublicRestored = false;
if (
    path.dirname(resolvedTemp) !== path.resolve(os.tmpdir())
    || !path.basename(resolvedTemp).startsWith('mvuad-spv874-qc-')
) {
    throw new Error('Unsafe temporary QC root');
}

let browser = null;
let server = null;
let runFailed = false;
const runtimeErrors = [];
const databaseRequests = [];
const databaseResponses = [];
const report = {
    schemaVersion: 1,
    targetDatabaseVersion,
    host: {
        version: '1.18.0',
        port,
        headless: true,
        sterileDataRoot: true,
    },
    setup: {},
    runtime: {},
    cleanup: {},
};

try {
    try {
        const occupied = await fetch(`http://127.0.0.1:${port}/`, {
            signal: AbortSignal.timeout(1_000),
        });
        if (occupied) throw new Error('isolated QC port is already occupied');
    } catch (error) {
        if (/already occupied/u.test(String(error?.message || error))) throw error;
    }
    const tempUserRoot = path.join(tempRoot, 'default-user');
    fs.mkdirSync(tempUserRoot, { recursive: true });
    const settingsPath = path.join(tempUserRoot, 'settings.json');
    const authorScript = cleanAuthorScript();
    if (!fs.existsSync(sourceTavernHelperRoot)) {
        throw new Error('TavernHelper runtime is unavailable');
    }
    fs.writeFileSync(
        settingsPath,
        `${JSON.stringify(
            createSterileSettings(authorScript.record),
            null,
            2,
        )}\n`,
    );
    fs.cpSync(
        sourceTavernHelperRoot,
        path.join(tempUserRoot, 'extensions', 'TavernHelper'),
        { recursive: true },
    );
    copyDoctorRuntime(path.join(tempUserRoot, 'extensions', 'mvu-auto-doctor'));
    if (legacyPublicExisted) {
        fs.cpSync(legacyPublicDoctorRoot, legacyPublicBackupRoot, {
            recursive: true,
        });
    }
    copyDoctorRuntime(legacyPublicDoctorRoot);
    report.setup = {
        authorImportSha256: sha256(fs.readFileSync(authorLoaderPath)),
        cleanAuthorLoaderSha256: sha256(authorScript.source),
        cleanAuthorLoaderChars: authorScript.source.length,
        privateSettingsCopied: false,
        privateChatsCopied: false,
        privateCharactersCopied: false,
        credentialsCopied: false,
        originalUserDataModified: false,
        legacyPublicRuntimeTemporarilyReplaced: true,
        legacyPublicOriginalIndexSha256: legacyPublicExisted
            ? sha256(fs.readFileSync(path.join(legacyPublicBackupRoot, 'index.js')))
            : '',
        doctorSourceInstalledInSterileRoot: true,
        candidateVersion,
        candidateIndexSha256: sha256(
            fs.readFileSync(path.join(doctorRoot, 'index.js')),
        ),
        tavernHelperRuntimeInstalledInSterileRoot: true,
        independentBridgeInstalledInSterileRoot: false,
    };

    server = spawn(process.execPath, [
        'server.js',
        '--port', String(port),
        '--dataRoot', tempRoot,
        '--browserLaunchEnabled=false',
        '--listen=false',
    ], {
        cwd: stRoot,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let serverFailure = '';
    for (const stream of [server.stdout, server.stderr]) {
        stream.on('data', (chunk) => {
            const text = String(chunk);
            if (/uncaught|fatal|EADDRINUSE/iu.test(text)) {
                serverFailure = sha256(text);
            }
        });
    }
    const hostStatus = await waitForHost(`http://127.0.0.1:${port}/`);
    if (serverFailure || server.exitCode !== null) {
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
        runtimeErrors.push(classifyRuntimeError(message.text()));
    });
    page.on('pageerror', (error) => {
        runtimeErrors.push(classifyRuntimeError(error?.stack || error?.message || error));
    });
    page.on('request', (request) => {
        if (!request.url().includes(`AlbusKen/shujuku@${targetDatabaseVersion}`)) return;
        databaseRequests.push(sha256(request.url()));
    });
    page.on('response', (response) => {
        if (!response.url().includes(`AlbusKen/shujuku@${targetDatabaseVersion}`)) return;
        const headers = response.headers();
        databaseResponses.push({
            status: response.status(),
            sha256: sha256(response.url()),
            version: headers['x-jsd-version'] || '',
            contentLength: Number(headers['content-length'] || 0),
        });
    });
    await page.goto(`http://127.0.0.1:${port}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
    });
    await page.waitForFunction(() => !!window.MvuAutoDoctorAPI, null, {
        timeout: 60_000,
    });
    const bootState = await page.evaluate(() => {
        const context = window.SillyTavern?.getContext?.();
        return {
            contextReady: !!context,
            chatLoaded: !!context?.chatId,
            characterSelected: Number.isInteger(context?.characterId)
                && context.characterId >= 0,
            tavernHelperReady: !!window.TavernHelper,
            activeHelperScriptFrames: document.querySelectorAll(
                'iframe[id^="TH-script--"]',
            ).length,
        };
    });
    if (!bootState.chatLoaded) {
        await (async () => {
            const firstCharacter = page.locator(
                '#rm_print_characters_block .character_select, .character_select[chid]',
            ).first();
            if (!await firstCharacter.count()) return;
            await firstCharacter.click();
            await page.waitForFunction(() => (
                !!window.SillyTavern?.getContext?.()?.chatId
            ), null, { timeout: 30_000 });
        })().catch(() => undefined);
    }
    const preDatabase = await page.evaluate(async () => {
        const api = window.MvuAutoDoctorAPI;
        const environment = await api.inspectEnvironment();
        const diagnostic = api.getDiagnosticProjection();
        return {
            doctorVersion: diagnostic.plugin.version,
            environmentStatus: environment.status,
            legacyPatchCheck: environment.checks.find(
                (check) => check.label === '数据库遗留兼容层',
            ) || null,
            databaseCheck: environment.checks.find(
                (check) => check.label === 'TavernDB 可选协作',
            ) || null,
        };
    });
    if (preDatabase.doctorVersion !== candidateVersion) {
        throw new Error('served doctor version does not match the candidate');
    }
    await page.locator('#mvuad-floating-orb').waitFor({
        state: 'visible',
        timeout: 30_000,
    });
    await page.locator('#mvuad-floating-orb').click();
    const inspectPanel = () => {
        const panel = document.querySelector('#mvuad-floating-panel');
        const rect = panel?.getBoundingClientRect();
        const tabs = [...document.querySelectorAll(
            '#mvuad-floating-panel .mvuad-floating-tabs button',
        )].map((element) => ({
            page: element.getAttribute('data-page') || '',
            text: element.textContent?.trim() || '',
        }));
        const narrativeRewriteControlCount = [...document.querySelectorAll(
            '#mvuad-floating-panel button, #extensions_settings button',
        )].filter((element) => (
            /(?:重写|纠错|修正).{0,4}正文|正文.{0,4}(?:重写|纠错|修正)/u.test(
                element.textContent || '',
            )
        )).length;
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            panelLeft: rect?.left ?? -1,
            panelRight: rect?.right ?? -1,
            panelTop: rect?.top ?? -1,
            panelBottom: rect?.bottom ?? -1,
            panelWithinViewport: Boolean(
                rect
                && rect.left >= 0
                && rect.top >= 0
                && rect.right <= window.innerWidth
                && rect.bottom <= window.innerHeight
            ),
            horizontalOverflow:
                document.documentElement.scrollWidth > document.documentElement.clientWidth,
            tabs,
            narrativeRewriteControlCount,
        };
    };
    const mobileUi = await page.evaluate(inspectPanel);
    await page.setViewportSize({ width: 1280, height: 720 });
    const desktopUi = await page.evaluate(inspectPanel);
    await page.setViewportSize({ width: 390, height: 844 });
    const uiProbe = {
        result: (
            mobileUi.panelWithinViewport
            && desktopUi.panelWithinViewport
            && mobileUi.horizontalOverflow === false
            && desktopUi.horizontalOverflow === false
            && mobileUi.narrativeRewriteControlCount === 0
            && desktopUi.narrativeRewriteControlCount === 0
        ) ? 'pass' : 'fail',
        mobile: mobileUi,
        desktop: desktopUi,
        forumTabIndependent: mobileUi.tabs.some((tab) => (
            tab.page === 'forum' || /论坛/u.test(tab.text)
        )),
        worldEngineTabVisible: mobileUi.tabs.some((tab) => (
            tab.page === 'world' || /世界/u.test(tab.text)
        )),
    };
    if (uiProbe.result !== 'pass') {
        throw new Error('candidate floating UI probe failed');
    }
    report.runtime = {
        hostHttpStatus: hostStatus,
        serverFailureDigest: serverFailure,
        bootState,
        ...preDatabase,
        uiProbe,
        databaseBundleRequestCount: databaseRequests.length,
        databaseBundleResponses: databaseResponses,
    };
    try {
        await page.waitForFunction(() => (
            !!window.AutoCardUpdaterAPI
            || !!window.TavernDBAPI
            || !!window.SP_DATABASE
        ), null, {
            timeout: 120_000,
        });
        report.runtime.databaseApiReady = true;
    } catch {
        report.runtime.databaseApiReady = false;
        throw new Error('database public API did not become ready');
    }
    const runtime = await page.evaluate(async () => {
        const api = window.MvuAutoDoctorAPI;
        const environment = await api.inspectEnvironment();
        const databaseApi = window.AutoCardUpdaterAPI
            || window.TavernDBAPI
            || window.SP_DATABASE;
        const diagnostic = api.getDiagnosticProjection();
        const before = api.getModelCallStats();
        let databaseUpdate = {
            status: 'not-run',
            resultType: '',
            truthy: false,
        };
        try {
            const result = await databaseApi.triggerUpdate();
            databaseUpdate = {
                status: 'returned',
                resultType: typeof result,
                truthy: !!result,
            };
        } catch {
            databaseUpdate = {
                status: 'threw',
                resultType: '',
                truthy: false,
            };
        }
        let social = { status: 'not-run' };
        try {
            social = await api.auditSocialRelations();
        } catch {
            social = { status: 'threw' };
        }
        const after = api.getModelCallStats();
        return {
            doctorVersion: diagnostic.plugin.version,
            environmentStatus: environment.status,
            legacyPatchCheck: environment.checks.find(
                (check) => check.label === '数据库遗留兼容层',
            ) || null,
            databaseCheck: environment.checks.find(
                (check) => check.label === 'TavernDB 可选协作',
            ) || null,
            databaseApiMethodCount: Object.keys(databaseApi || {}).filter(
                (key) => typeof databaseApi[key] === 'function',
            ).length,
            databaseUpdate,
            independentBridgeInstalled: false,
            independentBridgeAbsent: !window.MvuAutoDoctorDatabaseBridge,
            databaseUiSurfaceCount: [...document.querySelectorAll(
                '[id], [class]',
            )].filter((element) => (
                /(?:^|[\s_-])acu(?:$|[\s_-])|auto.?card.?updater|sp.?database/iu.test(
                    `${element.id || ''} ${element.className || ''}`,
                )
            )).length,
            socialStatus: social?.status || '',
            socialModelCallDelta: Number(after.total || 0) - Number(before.total || 0),
            socialAttemptCount: Number(social?.audit?.modelCall?.attempts || 0),
            socialLocalRepairAttempted:
                social?.audit?.modelCall?.localStructureRepairAttempted === true,
        };
    });
    const responseCountBeforeReload = databaseResponses.length;
    await page.reload({
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
    });
    await page.waitForFunction(() => !!window.MvuAutoDoctorAPI, null, {
        timeout: 60_000,
    });
    await page.waitForFunction(() => (
        !!window.AutoCardUpdaterAPI
        || !!window.TavernDBAPI
        || !!window.SP_DATABASE
    ), null, {
        timeout: 120_000,
    });
    const reload = await page.evaluate(async () => {
        const doctorApi = window.MvuAutoDoctorAPI;
        const databaseApi = window.AutoCardUpdaterAPI
            || window.TavernDBAPI
            || window.SP_DATABASE;
        const environment = await doctorApi.inspectEnvironment();
        return {
            doctorVersion: doctorApi.getDiagnosticProjection().plugin.version,
            databaseApiMethodCount: Object.keys(databaseApi || {}).filter(
                (key) => typeof databaseApi[key] === 'function',
            ).length,
            environmentStatus: environment.status,
            legacyPatchDetected: environment.checks.some(
                (check) => check.label === '数据库遗留兼容层',
            ),
            databaseUiSurfaceCount: [...document.querySelectorAll(
                '[id], [class]',
            )].filter((element) => (
                /(?:^|[\s_-])acu(?:$|[\s_-])|auto.?card.?updater|sp.?database/iu.test(
                    `${element.id || ''} ${element.className || ''}`,
                )
            )).length,
            independentBridgeAbsent: !window.MvuAutoDoctorDatabaseBridge,
        };
    });
    if (reload.doctorVersion !== candidateVersion) {
        throw new Error('reloaded doctor version does not match the candidate');
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const errorCounts = Object.fromEntries(
        ['doctor', 'database', 'tavern-helper', 'host-or-other'].map((owner) => [
            owner,
            runtimeErrors.filter((entry) => entry.owner === owner).length,
        ]),
    );
    report.runtime = {
        ...report.runtime,
        hostHttpStatus: hostStatus,
        serverFailureDigest: serverFailure,
        bootState,
        ...runtime,
        reload: {
            ...reload,
            databaseResponseDelta:
                databaseResponses.length - responseCountBeforeReload,
        },
        databaseBundleRequestCount: databaseRequests.length,
        databaseBundleResponses: databaseResponses,
        errorCounts,
        errorClasses: Object.fromEntries(
            [...new Set(runtimeErrors.map((entry) => entry.class))].map((kind) => [
                kind,
                runtimeErrors.filter((entry) => entry.class === kind).length,
            ]),
        ),
        errorDigests: [...new Set(runtimeErrors.map((entry) => entry.digest))],
    };
} catch (error) {
    runFailed = true;
    const message = String(error?.message || error);
    const hasNetworkFailure = (
        databaseRequests.length > 0
        && databaseResponses.length === 0
        && runtimeErrors.some((entry) => entry.class === 'network-or-resource')
    );
    const code = hasNetworkFailure
        ? 'database_bundle_network_unavailable'
        : /already occupied|did not own the QC port/u.test(message)
            ? 'isolated_qc_port_not_owned'
            : /doctor version does not match/u.test(message)
                ? 'candidate_version_mismatch'
        : /database public API did not become ready/u.test(message)
            ? 'database_api_not_ready_timeout'
        : /did not become ready/u.test(message)
            ? 'host_not_ready'
            : /Author loader is unavailable/u.test(message)
                ? 'author_loader_fixture_missing'
                : /TavernHelper runtime is unavailable/u.test(message)
                    ? 'tavern_helper_runtime_missing'
                : 'real_compat_probe_failed';
    report.failure = {
        code,
        digest: sha256(message),
        databaseBundleResponses: databaseResponses,
        databaseBundleRequestCount: databaseRequests.length,
        errorCounts: Object.fromEntries(
            ['doctor', 'database', 'tavern-helper', 'host-or-other'].map((owner) => [
                owner,
                runtimeErrors.filter((entry) => entry.owner === owner).length,
            ]),
        ),
        errorDigests: [...new Set(runtimeErrors.map((entry) => entry.digest))],
        errorClasses: Object.fromEntries(
            [...new Set(runtimeErrors.map((entry) => entry.class))].map((kind) => [
                kind,
                runtimeErrors.filter((entry) => entry.class === kind).length,
            ]),
        ),
    };
} finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server && server.exitCode === null) {
        server.kill();
        await waitForExit(server);
    }
    let portClosed = false;
    try {
        await fetch(`http://127.0.0.1:${port}/`, {
            signal: AbortSignal.timeout(1_000),
        });
    } catch {
        portClosed = true;
    }
    fs.rmSync(legacyPublicDoctorRoot, { recursive: true, force: true });
    if (legacyPublicExisted) {
        fs.cpSync(legacyPublicBackupRoot, legacyPublicDoctorRoot, {
            recursive: true,
        });
    }
    legacyPublicRestored = legacyPublicExisted
        ? (
            fs.existsSync(path.join(legacyPublicDoctorRoot, 'index.js'))
            && sha256(fs.readFileSync(path.join(legacyPublicDoctorRoot, 'index.js')))
                === sha256(fs.readFileSync(path.join(legacyPublicBackupRoot, 'index.js')))
        )
        : !fs.existsSync(legacyPublicDoctorRoot);
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
    report.cleanup = {
        browserClosed: browser !== null,
        serverStopped: !server || server.exitCode !== null || server.killed,
        portClosed,
        temporaryDataRemoved: !fs.existsSync(resolvedTemp),
        legacyPublicRuntimeRestored: legacyPublicRestored,
        originalUserDataModified: false,
    };
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (runFailed) process.exitCode = 1;
