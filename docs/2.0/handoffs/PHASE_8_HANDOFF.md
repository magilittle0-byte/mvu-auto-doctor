# MVU Auto Doctor 2.0 阶段8交接

## 1. 候选身份与范围

- 阶段：8，Actor Shard / NPC分片与用户自定义提示词插槽
- 日期：2026-07-28
- 分支：`codex/v2-actor-shards`
- 基线提交：`3d85724cb44432516d903e632f7717249d68917d`
- 基线 tree：`a19a5a0bc4d7e3e7cebad6694af10c80ad8e5f35`
- 未做真实 SillyTavern QC，未推送远端，未修改 TavernDB、工作流助手或用户角色卡。
- `dist` 下10个用户历史ZIP保持未跟踪，未暂存、删除、覆盖或重建。
- 用户给定远端 `main` 为 `d659167ce3a861dbef3391800057ec7f0d54dbfd`；
  本轮未联网刷新，本地缓存 `origin/main` 为另一旧引用，因此不得据此判断远端漂移。

## 2. 交付内容

### Actor Shard 核心

- 新增 `actor-shard-core.mjs` 与 `actor-shard-core.d.mts`。
- settled正文与硬审计完成后，按线程阶段、紧迫度、关系、证据和角色是否在场
  确定性选择0—5名不在场NPC；默认功能关闭，启用时默认最多2名。
- 每名角色只获得稳定ID/姓名、有限认知、目标提示、来源线程、证据与因果链；
  worker使用现有fast通道、隔离并行lane、每调用超时与AbortSignal。
- worker只输出严格JSON白名单提案，没有MVU、世界书、论坛、正文、数据库、
  事实或任务写接口。额外字段、身份漂移、越界证据和非完整JSON均拒绝。
- 有界并发最多5；完成顺序不会改变输出。单worker失败/超时只降级，不阻断旧宏观
  连续性路径，也没有无限重试。

### 确定性汇合与隔离

- 只有时间、地点和共享来源/因果链全部兼容的两份提案形成共同候选；
  时间、地点、信息链冲突保持独立并记录稳定原因。
- 提案与汇合结果只作为宏观连续性模型候选输入；最终仍经过continuity policy、
  完整目标身份复核、元数据合并与既有settled-only写入路径。
- worker批次使用内存TaskLease记录进度、软取消、硬超时与迟到结果门禁。
  regenerate、swipe或切聊天使整批stale，提案和汇合输出清空，零写入。
- 未改变数据库barrier v1显式注册、终态收据与fail-closed行为。

### 用户提示词与成本

- 新增“世界连续性”和“NPC分片”两个自由提示词插槽，各最多6000字符。
- 内容不做题材/NSFW语义过滤，不内置破限文本，不进入默认包示例。
- 插槽只作为清楚标记的叙事/模拟指令；不能替代授权、证据、事务、危险确认、
  分支、MessageFingerprint、数据库屏障或硬字段校验。
- 脱敏诊断只导出`enabled/length/hash`，不包含全文。
- UI明确显示额外模型调用成本、每回合worker上限和失败降级；默认关闭、默认上限2。

## 3. 主要文件

- `actor-shard-core.mjs`
- `actor-shard-core.d.mts`
- `index.js`
- `v2/surface/diagnostics.mjs`
- `tests/actor-shard-core.test.mjs`
- `qc/build-release.mjs`
- `docs/2.0/PRODUCT_SPEC.md`
- `docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- `docs/2.0/USER_GUIDE_2.0_RC.md`
- `docs/2.0/2.1_OPEN_ITEMS.md`
- `README.md`
- `CHANGELOG.md`
- `docs/2.0/handoffs/PHASE_8_HANDOFF.md`

## 4. 自动化结果

核心定点验证：

```text
node --check index.js
node --check actor-shard-core.mjs
node --test tests/actor-shard-core.test.mjs
7 total / 7 pass / 0 fail
```

覆盖0/1/3/5筛选与上限、并行完成顺序、三类汇合冲突、worker失败/超时、
运行中重抽stale零输出、提示词正确注入/诊断不泄露/不能伪造事务授权，以及关闭路径
零额外调用。

完整套件最终结果：

```text
npm.cmd test
154 total / 154 pass / 0 fail / 0 skipped / 0 todo
duration 144751.8413 ms
```

## 5. 已知风险与阶段9精确入口

本阶段按明确范围不做真实QC，因此自动化通过不能证明真实SillyTavern中的fast并行
连接、取消传播、模型JSON遵从、移动UI和伴生脚本竞争完全正确。阶段9必须从
`docs/REAL_ENV_QC.md` 进入，在真实 `http://127.0.0.1:8011`、真实模型与真实长聊天中：

1. 先运行 `npm.cmd run qc:ci`，确认数据库未注册barrier时仍fail closed。
2. 用同一源码分别验证Actor Shard关闭、开启1/3/5 worker；记录额外调用数、峰值并发、
   超时降级、最终宏观连续性写入和脱敏诊断。
3. worker运行中分别执行regenerate、切swipe、切聊天，确认整批stale且旧分支的
   连续性、MVU、世界书、论坛、正文和数据库写入均为0。
4. 验证两个自定义提示词进入正确模型消息，但事务授权、危险确认、硬字段校验和
   导出诊断不含全文；测试题材/NSFW自由内容时只验证“不过滤”，不要保存私人文本。
5. 390×844与桌面视口验证设置说明、1—5上限、保存/清空和进度诊断。
6. TavernDB只有在外部脚本真实注册settled-only barrier并按终态收据工作后才能
   判通过；不得修改外部TavernDB来伪造成功。
7. 真实QC证据完成前不得运行`qc:record`/`qc:gate`放行，不得推送或晋升`main`。
