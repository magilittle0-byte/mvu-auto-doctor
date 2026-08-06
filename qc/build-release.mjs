import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidate = '2.0.0-rc.11';
const artifactName = `05_MVU自动医生_v${candidate}_离线候选.zip`;
const artifactPath = path.join(root, 'dist', artifactName);
const sumsPath = path.join(root, 'dist', 'SHA256SUMS.txt');

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
    'docs/CHARACTER_DIVERSITY_V2.md',
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
    'docs/2.0/MIGRATION_ROLLBACK_GUIDE.md',
    'docs/2.0/ACTOR_SOVEREIGNTY_ENGINE.md',
    'docs/2.0/USER_GUIDE_2.0_RC.md',
    'docs/2.0/RELEASE_CHECKLIST.md',
    'docs/2.0/2.1_OPEN_ITEMS.md',
];

function collectRuntimeFiles(directory) {
    const collected = [];
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
        const relative = path.posix.join(directory, entry.name);
        if (entry.isDirectory()) collected.push(...collectRuntimeFiles(relative));
        else if (/\.(?:mjs|mts)$/u.test(entry.name)) collected.push(relative);
    }
    return collected;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
    const buffer = Buffer.allocUnsafe(2);
    buffer.writeUInt16LE(value);
    return buffer;
}

function uint32(value) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(value);
    return buffer;
}

function createStoredZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const dosTime = 0;
    const dosDate = ((2026 - 1980) << 9) | (7 << 5) | 27;
    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const data = entry.data;
        const checksum = crc32(data);
        const local = Buffer.concat([
            uint32(0x04034b50),
            uint16(20),
            uint16(0x0800),
            uint16(0),
            uint16(dosTime),
            uint16(dosDate),
            uint32(checksum),
            uint32(data.length),
            uint32(data.length),
            uint16(name.length),
            uint16(0),
            name,
            data,
        ]);
        const central = Buffer.concat([
            uint32(0x02014b50),
            uint16(20),
            uint16(20),
            uint16(0x0800),
            uint16(0),
            uint16(dosTime),
            uint16(dosDate),
            uint32(checksum),
            uint32(data.length),
            uint32(data.length),
            uint16(name.length),
            uint16(0),
            uint16(0),
            uint16(0),
            uint16(0),
            uint32(0),
            uint32(offset),
            name,
        ]);
        localParts.push(local);
        centralParts.push(central);
        offset += local.length;
    }
    const central = Buffer.concat(centralParts);
    const end = Buffer.concat([
        uint32(0x06054b50),
        uint16(0),
        uint16(0),
        uint16(entries.length),
        uint16(entries.length),
        uint32(central.length),
        uint32(offset),
        uint16(0),
    ]);
    return Buffer.concat([...localParts, central, end]);
}

const files = [...rootFiles, ...collectRuntimeFiles('v2')].sort();
for (const relative of files) {
    const absolute = path.join(root, relative);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
        throw new Error(`Release source missing: ${relative}`);
    }
}
const entries = files.map((relative) => ({
    name: `mvu-auto-doctor/${relative}`,
    data: readFileSync(path.join(root, relative)),
}));
const archive = createStoredZip(entries);
mkdirSync(path.dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, archive);
const sha256 = createHash('sha256').update(archive).digest('hex');
const previous = existsSync(sumsPath)
    ? readFileSync(sumsPath, 'utf8').split(/\r?\n/u).filter(Boolean)
    : [];
const next = previous
    .filter((line) => !line.endsWith(`  ${artifactName}`))
    .concat(`${sha256}  ${artifactName}`);
writeFileSync(sumsPath, `${next.join('\n')}\n`, 'utf8');
process.stdout.write(
    `${artifactName}\nSHA256 ${sha256}\nFiles ${files.length}\nBytes ${archive.length}\n`,
);
