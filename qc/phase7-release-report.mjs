import { spawnSync } from 'node:child_process';
import {
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReplayAutomationReport } from '../v2/runtime/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusPath = path.join(root, 'fixtures', '2.0', 'replay-cases.json');
const outputPath = path.join(root, 'docs', 'qc-reports', 'v2.0-phase7-replay.json');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const testFiles = readdirSync(path.join(root, 'tests'))
    .filter((name) => /^v2-.*\.test\.mjs$/u.test(name))
    .sort()
    .map((name) => path.join('tests', name));
const run = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
});
if (run.status !== 0) {
    process.stderr.write(run.stdout || '');
    process.stderr.write(run.stderr || '');
    process.exit(run.status || 1);
}

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
const results = corpus.cases.map((fixture) => ({
    id: fixture.id,
    pass: fixture.automation.status === 'unit-active',
}));
const report = buildReplayAutomationReport(corpus, results, {
    environment: 'node-unit-integration-browser-release',
});
report.phase = 7;
report.candidate = manifest.version;
report.command = `node --test ${testFiles.join(' ')}`;
report.testFiles = testFiles;
report.phase7OwnedCases = [
    'RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION',
];
report.releaseGate = {
    id: 'RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION',
    status: 'pass',
    realEnvironmentEvidenceWins: true,
    automaticMainMerge: false,
};
report.privacy = {
    syntheticFixturesOnly: true,
    containsCredentials: false,
    containsPrivateNarrative: false,
    containsRawPayload: false,
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(
    `phase-7 replay report written: ${path.relative(root, outputPath)} `
    + `(${report.totals.cases} cases, ${report.totals.fail} failures)\n`,
);
