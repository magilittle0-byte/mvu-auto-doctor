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
    'rc.3 发行源码不得保留数据库最终正文桥',
);
assert.equal(
    existsSync(join(root, 'integrations', 'MVU医生-数据库最终正文桥.json')),
    false,
    'rc.3 发行源码不得保留数据库最终正文桥导入条目',
);
assert.ok(readme.includes(repositoryUrl), 'README 必须提供在线安装仓库地址');
assert.ok(
    readme.includes('默认 `main` 仍是上一版')
        && readme.includes('rc.7 离线候选包'),
    'README 必须准确区分独立候选分支和尚未晋升的main',
);
assert.ok(
    readme.includes('只有线上 `manifest.json` 已是 rc.7 时'),
    'README 必须把默认main在线更新写成晋升后的条件步骤',
);
assert.ok(
    rcUserGuide.includes('只有获得单独发布授权并重新通过发布门后'),
    'RC说明不得把候选分支误写成已经晋升main',
);
assert.ok(rcUserGuide.includes('分支或标签：留空（默认 main）'), 'RC说明必须提供默认main全新安装步骤');
assert.ok(
    rcUserGuide.includes('codex/backup-main-pre-v2.0.0-rc.1-20260727'),
    'RC说明必须记录可审阅的更新前回退分支',
);
assert.match(
    rcUserGuide,
    /候选阶段请\s+使用本仓库生成的 rc\.7 离线包/u,
    'RC说明必须提供未晋升候选的诚实安装路径',
);

console.log('version consistency test passed');
