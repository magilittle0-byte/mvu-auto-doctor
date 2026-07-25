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
    'style.css',
];

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
        hash.update(fs.readFileSync(path.join(root, relativePath)));
        hash.update('\0');
    }
    return hash.digest('hex');
}

function reportHash() {
    return createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex');
}

function loadAndValidateReport() {
    if (!fs.existsSync(reportPath)) fail(`missing ${reportRelativePath}`);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (report.schemaVersion !== 1) fail('unsupported report schema');
    if (report.version !== manifest.version) fail('report version does not match manifest');
    if (report.result !== 'pass') fail('report result is not pass');
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
    if (!tests || tests.total < 1 || tests.passed !== tests.total || tests.failed !== 0) {
        fail('automated suite evidence is incomplete');
    }

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
    ) fail('real forum interaction evidence is incomplete');

    const mobile = report.checks?.mobile;
    if (
        !mobile
        || mobile.touchTargetWidth < 42
        || mobile.touchTargetHeight < 42
        || mobile.floatingPanelTop < 0
        || mobile.floatingPanelBottom > report.environment.viewport.height
        || mobile.forumPanelTop < 0
        || mobile.forumPanelBottom > report.environment.viewport.height
        || mobile.forumShellScrollWidth > mobile.forumShellClientWidth
    ) fail('mobile touch-target or overflow evidence failed');

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
    };
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    console.log(`Recorded real-environment QC receipt for ${receipt.commit.slice(0, 12)}.`);
}

function verifyReceipt() {
    loadAndValidateReport();
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
    console.log(`Real-environment QC gate passed for ${receipt.commit.slice(0, 12)}.`);
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
    } else {
        fail(`unknown command ${command}`);
    }
} catch (error) {
    console.error(String(error?.message || error));
    process.exitCode = 1;
}
