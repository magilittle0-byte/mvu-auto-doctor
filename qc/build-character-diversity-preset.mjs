import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
    presetSha256,
    transformCharacterDiversityPreset,
} from '../fair-director-preset-core.mjs';

const [sourcePath, outputPath, auditPath] = process.argv.slice(2);
if (!sourcePath || !outputPath || !auditPath) {
    throw new Error(
        'usage: node qc/build-character-diversity-preset.mjs <source.json> <output.json> <audit.json>',
    );
}
for (const target of [outputPath, auditPath]) {
    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
}
const sourceBytes = fs.readFileSync(sourcePath);
const sourceText = sourceBytes.toString('utf8');
const source = JSON.parse(sourceText);
const { preset, audit } = transformCharacterDiversityPreset(source);
const outputText = `${JSON.stringify(preset, null, 2)}\n`;
fs.writeFileSync(outputPath, outputText, 'utf8');
if (!sourceBytes.equals(fs.readFileSync(sourcePath))) {
    throw new Error('source preset changed during build');
}
const fullAudit = {
    ...audit,
    sourceFile: path.basename(sourcePath),
    outputFile: path.basename(outputPath),
    sourceBytes: sourceBytes.length,
    outputBytes: Buffer.byteLength(outputText),
    sourceSha256: presetSha256(sourceText),
    outputSha256: presetSha256(outputText),
    sourceUnchanged: true,
    createdAt: new Date().toISOString(),
};
fs.writeFileSync(auditPath, `${JSON.stringify(fullAudit, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
    outputFile: fullAudit.outputFile,
    auditFile: path.basename(auditPath),
    sourceSha256: fullAudit.sourceSha256,
    outputSha256: fullAudit.outputSha256,
    promptCount: fullAudit.promptCount,
    enabledCount: fullAudit.enabledCount,
    storyRegexCount: fullAudit.storyRegexIds.length,
})}\n`);
