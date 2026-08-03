import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const indexSource = readFileSync(join(root, 'index.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const rcUserGuide = readFileSync(
    join(root, 'docs', '2.0', 'USER_GUIDE_2.0_RC.md'),
    'utf8',
);
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
    '发布源码不得保留数据库最终正文桥',
);
assert.equal(
    existsSync(join(root, 'integrations', 'MVU医生-数据库最终正文桥.json')),
    false,
    '发布源码不得保留数据库最终正文桥导入条目',
);
assert.ok(readme.includes(repositoryUrl), 'README 必须提供在线安装仓库地址');
assert.ok(
    readme.includes('经本轮明确授权晋升默认 `main`')
        && readme.includes('线上 `manifest.json` 已是 rc.8'),
    'README 必须准确记录 rc.8 已授权晋升默认 main',
);
assert.ok(
    readme.includes('离线候选包') && readme.includes('回滚演练'),
    'README 必须在 main 发布后继续保留离线安装与回滚路径',
);
assert.ok(
    rcUserGuide.includes('并已进入默认 `main`'),
    'RC 使用说明必须准确记录当前线上发布状态',
);
assert.ok(
    rcUserGuide.includes('分支或标签：留空（默认 main）'),
    'RC 使用说明必须提供默认 main 全新安装步骤',
);
assert.ok(
    rcUserGuide.includes('codex/backup-main-pre-v2.0.0-rc.1-20260727'),
    'RC 使用说明必须记录可审阅的历史回退分支',
);
assert.ok(
    rcUserGuide.includes('rc.8 离线包'),
    'RC 使用说明必须在 main 发布后继续提供离线安装路径',
);

console.log('version consistency test passed');
