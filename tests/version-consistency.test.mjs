import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const indexSource = readFileSync(join(root, 'index.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const rcUserGuide = readFileSync(join(root, 'docs', '2.0', 'USER_GUIDE_2.0_RC.md'), 'utf8');
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
assert.equal(
    existsSync(join(root, 'integrations', 'database-final-reply-bridge.js')),
    false,
    'rc.2 发行源码不得保留数据库最终正文桥',
);
assert.equal(
    existsSync(join(root, 'integrations', 'MVU医生-数据库最终正文桥.json')),
    false,
    'rc.2 发行源码不得保留数据库最终正文桥导入条目',
);
assert.ok(readme.includes(repositoryUrl), 'README 必须提供在线安装仓库地址');
assert.ok(readme.includes('点击这一行自己的“更新”'), 'README 必须提供从main直接在线更新步骤');
assert.ok(rcUserGuide.includes('不需要加载分支列表'), 'RC说明必须支持无法加载分支列表的在线更新');
assert.ok(rcUserGuide.includes('分支或标签：留空（默认 main）'), 'RC说明必须提供默认main全新安装步骤');
assert.ok(
    rcUserGuide.includes('codex/backup-main-pre-v2.0.0-rc.1-20260727'),
    'RC说明必须记录可审阅的更新前回退分支',
);
assert.equal(
    rcUserGuide.includes('测试 RC 时请使用候选分支里的离线 ZIP'),
    false,
    'RC说明不得把本地ZIP作为酒馆唯一安装路径',
);

console.log('version consistency test passed');
