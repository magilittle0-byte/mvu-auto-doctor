import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const indexSource = readFileSync(join(root, 'index.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const rcUserGuide = readFileSync(join(root, 'docs', '2.0', 'USER_GUIDE_2.0_RC.md'), 'utf8');
const rcBranch = 'codex/v2.0-phase7-release-candidate';
const repositoryUrl = 'https://github.com/magilittle0-byte/mvu-auto-doctor';

const match = indexSource.match(/const VERSION = '([^']+)';/u);
assert.ok(match, 'index.js 必须声明 const VERSION');
assert.equal(
    match[1],
    manifest.version,
    `index.js 的 VERSION（${match[1]}）必须与 manifest.json 的 version（${manifest.version}）一致`,
);
assert.equal(
    packageJson.version,
    manifest.version,
    `package.json 的 version（${packageJson.version}）必须与 manifest.json 的 version（${manifest.version}）一致`,
);
assert.ok(readme.includes(repositoryUrl), 'README 必须提供在线安装仓库地址');
assert.ok(readme.includes(rcBranch), 'README 必须提供2.0 RC在线安装分支');
assert.ok(rcUserGuide.includes(`origin/${rcBranch}`), 'RC说明必须提供现有安装的远端分支切换项');
assert.ok(rcUserGuide.includes(`分支或标签：${rcBranch}`), 'RC说明必须提供全新在线安装分支');
assert.equal(
    rcUserGuide.includes('测试 RC 时请使用候选分支里的离线 ZIP'),
    false,
    'RC说明不得把本地ZIP作为酒馆唯一安装路径',
);

console.log('version consistency test passed');
