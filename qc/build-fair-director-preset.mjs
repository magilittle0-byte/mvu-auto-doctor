import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
    presetSha256,
    transformFairDirectorPreset,
} from '../fair-director-preset-core.mjs';

function usage() {
    throw new Error(
        'usage: node qc/build-fair-director-preset.mjs <source.json> <output.json> <audit.json>',
    );
}

const [sourcePath, outputPath, auditPath] = process.argv.slice(2);
if (!sourcePath || !outputPath || !auditPath) usage();
for (const target of [outputPath, auditPath]) {
    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
}
const sourceBytes = fs.readFileSync(sourcePath);
const sourceText = sourceBytes.toString('utf8');
const source = JSON.parse(sourceText);
const { preset, audit } = transformFairDirectorPreset(source);
const outputText = `${JSON.stringify(preset, null, 2)}\n`;
fs.writeFileSync(outputPath, outputText, 'utf8');
const sourceBytesAfter = fs.readFileSync(sourcePath);
if (!sourceBytes.equals(sourceBytesAfter)) {
    throw new Error('source preset changed during build');
}
const fullAudit = {
    ...audit,
    sourcePath: path.resolve(sourcePath),
    outputPath: path.resolve(outputPath),
    sourceBytes: sourceBytes.length,
    outputBytes: Buffer.byteLength(outputText),
    sourceSha256: presetSha256(sourceText),
    outputSha256: presetSha256(outputText),
    sourceUnchanged: true,
    createdAt: new Date().toISOString(),
};
fs.writeFileSync(auditPath, `${JSON.stringify(fullAudit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    outputPath: fullAudit.outputPath,
    auditPath: path.resolve(auditPath),
    sourceSha256: fullAudit.sourceSha256,
    outputSha256: fullAudit.outputSha256,
    promptCount: fullAudit.promptCount,
    orderCount: fullAudit.orderCount,
    enabledCount: fullAudit.enabledCount,
    modifiedPrompts: fullAudit.modifications.length,
}));
