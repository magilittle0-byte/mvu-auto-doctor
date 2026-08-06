import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const doctorRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = path.dirname(doctorRoot);
const sandboxRoot = path.join(workspaceRoot, 'real-tauritavern-qc');
const executablePath = path.join(sandboxRoot, 'host', 'tauritavern.exe');
const extensionRoot = path.join(
    sandboxRoot,
    'host',
    'data',
    'extensions',
    'third-party',
    'mvu-auto-doctor',
);
const launcherPath = path.join(doctorRoot, 'qc', 'tauri-hidden-launch.ps1');
const cdpPort = 9331;
const candidateVersion = JSON.parse(
    fs.readFileSync(path.join(doctorRoot, 'manifest.json'), 'utf8'),
).version;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mvuad-tauri-qc-'));
const baselineRoot = path.join(tempRoot, 'baseline-extension');
const runtimeFiles = [
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

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function directoryDigest(root) {
    const files = [];
    const visit = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(absolute);
            else files.push(absolute);
        }
    };
    visit(root);
    const hash = createHash('sha256');
    for (const absolute of files.sort()) {
        hash.update(path.relative(root, absolute).replaceAll('\\', '/'));
        hash.update('\0');
        hash.update(fs.readFileSync(absolute));
        hash.update('\0');
    }
    return hash.digest('hex');
}

function assertSafePaths() {
    const resolvedSandbox = path.resolve(sandboxRoot);
    const resolvedWorkspace = path.resolve(workspaceRoot);
    const resolvedTemp = path.resolve(tempRoot);
    if (
        !resolvedSandbox.startsWith(`${resolvedWorkspace}${path.sep}`)
        || path.dirname(resolvedTemp) !== path.resolve(os.tmpdir())
        || !path.basename(resolvedTemp).startsWith('mvuad-tauri-qc-')
        || !fs.existsSync(executablePath)
        || !fs.existsSync(extensionRoot)
    ) {
        throw new Error('Unsafe or incomplete Tauri QC sandbox');
    }
}

function deployCandidate() {
    fs.rmSync(extensionRoot, { recursive: true, force: true });
    fs.mkdirSync(extensionRoot, { recursive: true });
    for (const relative of runtimeFiles) {
        fs.copyFileSync(
            path.join(doctorRoot, relative),
            path.join(extensionRoot, relative),
        );
    }
    fs.cpSync(path.join(doctorRoot, 'v2'), path.join(extensionRoot, 'v2'), {
        recursive: true,
        filter: (source) => (
            fs.statSync(source).isDirectory()
            || /\.(?:mjs|mts)$/u.test(source)
        ),
    });
}

async function waitForJson(url, timeoutMs = 90_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(1_500),
            });
            if (response.ok) return response.json();
        } catch {
            // The suspended-and-hidden host is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Tauri WebView2 CDP did not become ready');
}

async function waitForPortClosed(port, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            await fetch(`http://127.0.0.1:${port}/json/version`, {
                signal: AbortSignal.timeout(500),
            });
        } catch {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
}

async function terminateProcessTree(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return true;
    return new Promise((resolve) => {
        const child = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
        });
        child.once('exit', () => resolve(true));
        child.once('error', () => resolve(false));
    });
}

async function loadPlaywright() {
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
    const bundled = fs.existsSync(bundledNodeModules)
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
    const candidate = [
        path.join(doctorRoot, 'node_modules', 'playwright', 'index.mjs'),
        bundled,
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
    ].filter(Boolean).find((item) => fs.existsSync(item));
    if (!candidate) throw new Error('Playwright is unavailable');
    return import(pathToFileURL(candidate).href);
}

assertSafePaths();
const baselineVersion = JSON.parse(
    fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'),
).version;
const baselineDigest = directoryDigest(extensionRoot);
fs.cpSync(extensionRoot, baselineRoot, { recursive: true });

let watcher = null;
let targetPid = 0;
let browser = null;
let restored = false;
let failed = false;
const doctorErrors = [];
const responseStatuses = new Map();
const report = {
    schemaVersion: 1,
    setup: {
        sandboxRoot,
        baselineVersion,
        baselineDigest,
        candidateVersion,
        suspendedLaunch: true,
        startupWindowHidden: true,
        hiddenWatchdogBeforeResume: true,
        portableRuntime: true,
        isolatedAppData: true,
        cdpLoopbackOnly: true,
    },
    runtime: {},
    cleanup: {},
};

try {
    deployCandidate();
    const isolatedAppData = path.join(tempRoot, 'appdata');
    const isolatedLocalAppData = path.join(tempRoot, 'localappdata');
    const isolatedWebView = path.join(tempRoot, 'webview2');
    for (const directory of [
        isolatedAppData,
        isolatedLocalAppData,
        isolatedWebView,
    ]) fs.mkdirSync(directory, { recursive: true });

    watcher = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        launcherPath,
        '-ExecutablePath',
        executablePath,
    ], {
        cwd: path.dirname(executablePath),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            TAURITAVERN_RUNTIME_MODE: 'portable',
            APPDATA: isolatedAppData,
            LOCALAPPDATA: isolatedLocalAppData,
            WEBVIEW2_USER_DATA_FOLDER: isolatedWebView,
            WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
                `--remote-debugging-address=127.0.0.1 --remote-debugging-port=${cdpPort}`,
        },
    });
    const marker = await new Promise((resolve, reject) => {
        let buffered = '';
        const timer = setTimeout(
            () => reject(new Error('Hidden Tauri launcher did not become ready')),
            30_000,
        );
        watcher.stdout.on('data', (chunk) => {
            buffered += String(chunk);
            const matched = buffered.match(/MVUAD_HIDDEN_WATCHDOG_READY=(\d+)/u);
            if (!matched) return;
            clearTimeout(timer);
            resolve(matched[1]);
        });
        watcher.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        watcher.once('exit', (code) => {
            if (targetPid) return;
            clearTimeout(timer);
            reject(new Error(`Hidden Tauri launcher exited early (${code})`));
        });
    });
    targetPid = Number(marker);
    await waitForJson(`http://127.0.0.1:${cdpPort}/json/version`);

    const { chromium } = await loadPlaywright();
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    const context = browser.contexts()[0];
    if (!context) throw new Error('Tauri WebView2 context is unavailable');
    let page = context.pages()[0];
    const deadline = Date.now() + 60_000;
    while (!page && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        page = context.pages()[0];
    }
    if (!page) throw new Error('Tauri WebView2 page is unavailable');
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const value = message.text();
        if (/mvu-auto-doctor|MvuAutoDoctor/iu.test(value)) {
            doctorErrors.push(sha256(value.replace(/https?:\/\/[^\s)]+/giu, '[url]')));
        }
    });
    page.on('pageerror', (error) => {
        const value = String(error?.stack || error?.message || error);
        if (/mvu-auto-doctor|MvuAutoDoctor/iu.test(value)) {
            doctorErrors.push(sha256(value.replace(/https?:\/\/[^\s)]+/giu, '[url]')));
        }
    });
    page.on('response', (response) => {
        if (!/mvu-auto-doctor/iu.test(response.url())) return;
        const file = response.url().split('/').at(-1)?.split('?')[0] || '';
        if (['index.js', 'style.css', 'manifest.json'].includes(file)) {
            responseStatuses.set(file, response.status());
        }
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => !!window.MvuAutoDoctorAPI, null, {
        timeout: 60_000,
    });

    async function layout(viewport) {
        await page.setViewportSize(viewport);
        return page.evaluate(() => {
            const orb = document.querySelector('#mvuad-floating-orb');
            orb?.click();
            const panel = document.querySelector('#mvuad-floating-panel');
            const box = panel?.getBoundingClientRect();
            const controls = [...(panel?.querySelectorAll(
                'button:not([hidden]), input:not([hidden]), select:not([hidden])',
            ) || [])].map((item) => item.getBoundingClientRect())
                .filter((item) => item.width > 0 && item.height > 0);
            return {
                width: innerWidth,
                height: innerHeight,
                panelWithinViewport: !!box
                    && box.left >= 0
                    && box.right <= innerWidth
                    && box.top >= 0
                    && box.bottom <= innerHeight,
                horizontalOverflow: document.documentElement.scrollWidth > innerWidth
                    || (!!panel && panel.scrollWidth > panel.clientWidth),
                minControlHeight: controls.length
                    ? Math.min(...controls.map((item) => item.height))
                    : 0,
            };
        });
    }

    const desktop = await layout({ width: 1280, height: 720 });
    const mobile = await layout({ width: 390, height: 844 });
    const first = await page.evaluate(() => ({
        version: window.MvuAutoDoctorAPI
            ?.getDiagnosticProjection?.().plugin?.version || '',
        apiCount: Object.keys(window.MvuAutoDoctorAPI || {}).length,
    }));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => !!window.MvuAutoDoctorAPI, null, {
        timeout: 60_000,
    });
    const reload = await page.evaluate(() => ({
        version: window.MvuAutoDoctorAPI
            ?.getDiagnosticProjection?.().plugin?.version || '',
        apiCount: Object.keys(window.MvuAutoDoctorAPI || {}).length,
    }));
    report.runtime = {
        targetPid,
        first,
        reload,
        desktop,
        mobile,
        responseStatuses: Object.fromEntries(responseStatuses),
        doctorErrorCount: doctorErrors.length,
        doctorErrorDigests: [...new Set(doctorErrors)],
    };
    if (
        first.version !== candidateVersion
        || reload.version !== candidateVersion
        || first.apiCount < 20
        || reload.apiCount !== first.apiCount
        || !desktop.panelWithinViewport
        || desktop.horizontalOverflow
        || !mobile.panelWithinViewport
        || mobile.horizontalOverflow
        || mobile.minControlHeight < 40
        || doctorErrors.length > 0
        || ['index.js', 'style.css'].some(
            (file) => responseStatuses.get(file) !== 200,
        )
    ) {
        throw new Error('Silent Tauri acceptance criteria failed');
    }
} catch (error) {
    failed = true;
    report.failure = {
        message: String(error?.message || error)
            .replace(/https?:\/\/[^\s)]+/giu, '[url]'),
    };
} finally {
    if (browser) await browser.close().catch(() => undefined);
    const processTreeStopped = await terminateProcessTree(targetPid);
    if (watcher && watcher.exitCode === null) watcher.kill();
    const cdpPortClosed = await waitForPortClosed(cdpPort);
    fs.rmSync(extensionRoot, { recursive: true, force: true });
    fs.cpSync(baselineRoot, extensionRoot, { recursive: true });
    const restoredVersion = JSON.parse(
        fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'),
    ).version;
    const restoredDigest = directoryDigest(extensionRoot);
    restored = (
        restoredVersion === baselineVersion
        && restoredDigest === baselineDigest
    );
    fs.rmSync(tempRoot, { recursive: true, force: true });
    report.cleanup = {
        browserClosed: true,
        processTreeStopped,
        cdpPortClosed,
        temporaryDataRemoved: !fs.existsSync(tempRoot),
        baselineRestored: restored,
        restoredVersion,
        restoredDigest,
    };
}

console.log(JSON.stringify(report, null, 2));
if (failed || !restored) process.exitCode = 1;
