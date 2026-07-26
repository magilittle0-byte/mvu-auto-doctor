# MVU Auto Doctor 2.0 阶段2交接

## 1. 身份

- 阶段：2，消息身份、分支与事务内核
- 交付日期：2026-07-26
- 仓库：`magilittle0-byte/mvu-auto-doctor`
- 分支：`codex/v2.0-phase2-transaction-core`
- PR：Draft [`#22`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/22)，base 为 `codex/v2.0-phase1-domain-core`
- 基础提交 SHA：`6e37dcc1dbe1e0ac916b179651d14d02e26147ae`
- 阶段2实现提交 SHA：本地 `2ff0fbb43c87f2030869c4158fc3e014770e7263`；远端 `151fd99322f37cd70388e90a6692eca6847bf448`；两者 tree 均为 `6c5734b6495510e098080a80fb92eea343c8f259`
- 阶段2交接提交 SHA：本地 `9348f9334ee6190395cbcf101902c2dfb798608c`；远端 `f410a09b9fe80c855f23fe709fd369ca5e84c408`；两者 tree 均为 `7b622d6dbe5d9071476f24051d80997ca5b490b2`
- PR元数据回填提交 SHA：本文件自身承载该回填，准确 SHA 以分支最终 HEAD 为准，避免在提交内容中伪造自引用 SHA
- 工作区是否仍有未提交修改：只有10个用户已有、未跟踪的 `dist/*.zip`
- 未提交修改是否属于用户且已保留：是；未暂存、未删除、未覆盖、未改名

## 2. 本阶段范围

- 授权目标：实现无宿主依赖的 MessageFingerprint、Branch、BranchCheckpoint、Transaction、幂等键、事务状态机、单写入队列、精确回读、路径级回滚和最小宿主桥。
- 明确非目标：UI、主模型语义裁决、数据库、阶段4领域命令写入、1.x生产宿主接线、隐式分支合并。
- 实际完成：新增 `v2/transaction/`；激活 `RR-FINGERPRINT-PREVIOUS-REPLY` 与 `RR-REROLL-IDEMPOTENCY`；覆盖并发重复提交、prepare 后迟到、checkpoint 歧义迁移和保守路径回滚。
- 有意未做：没有修改 `index.js`、样式、manifest、数据库或现有1.x生产行为；没有把阶段3—7用例变成默认失败。

## 3. 权威文件

以下文件均以基础提交 `6e37dcc1dbe1e0ac916b179651d14d02e26147ae` 的版本完整读取，并以当前阶段2提交中的规范修订为最终依据：

- 产品规格：`docs/2.0/PRODUCT_SPEC.md`
- 数据/事务协议：`docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- 回放矩阵：`docs/2.0/REAL_REPLAY_ACCEPTANCE_MATRIX.md`
- fixture schema：`docs/2.0/replay-fixture.schema.json`
- fixture corpus：`fixtures/2.0/replay-cases.json`
- 上一阶段交接：`docs/2.0/handoffs/PHASE_0_HANDOFF.md`、`docs/2.0/handoffs/PHASE_1_HANDOFF.md`
- 其他：`AGENTS.md`、`README.md`、`CHANGELOG.md`、`manifest.json`、`package.json`、`TODO.md`、`docs/2.0/README.md`、`docs/2.0/PHASE_ROADMAP.md`、`docs/2.0/PHASE_HANDOFF_TEMPLATE.md`、全部 `v2/domain/` 源码、`tests/v2-domain-*.test.mjs`、1.x消息稳定ID/精确读写/写前日志/撤销/checkpoint相关实现、`docs/REAL_ENV_QC.md`

## 4. 产物与接口

| 产物 | 路径 | 对外 API / 命令 | 不变量 |
| --- | --- | --- | --- |
| 统一入口和类型 | `v2/transaction/index.mjs`、`index.d.mts` | 导出本表全部阶段2 API 与宿主桥类型 | 无 SillyTavern 全局依赖；声明覆盖公开入口 |
| 规范哈希 | `canonical.mjs` | `canonicalSerialize`、`sha256Text`、`hashText`、`hashCanonical` | 纯函数、稳定 SHA-256；对象键序不改变摘要 |
| 消息身份 | `fingerprint.mjs` | `create/validate/compareMessageFingerprint`、`adaptHostMessageFingerprint` | 完整字段精确比较；身份层级冲突不降级猜测 |
| 分支 | `branch.mjs` | `create/validateBranch`、`transitionBranch`、`appendBranchTransaction` | continue 同分支；regenerate/swipe 新分支并退役旧分支；不隐式 merge |
| checkpoint迁移 | `checkpoint.mjs` | `create/validateBranchCheckpoint`、`migrateLegacyBranchCheckpoint` | 缺失身份必须由调用方提供显式证据；未知旧字段进入 `extensions.legacy` |
| 路径计划 | `paths.mjs` | JSON Pointer 捕获/校验/应用、`evaluatePathPreconditions`、`buildCompareAndRestoreRollback` | 禁止根/重复/重叠路径；数组结构不猜；回滚只恢复仍匹配写后值的路径 |
| 事务纯核 | `transaction.mjs` | `create/validate/prepare/transitionTransaction`、终态转换、幂等键 | proposed→prepared→终态；unresolved/rejected 不得 prepare；终态不可重开 |
| 单写队列 | `queue.mjs` | `SingleWriteQueue`、`createSingleWriteQueue` | 同一队列最多一个活跃写任务；失败不阻塞后续任务 |
| 事务内核/宿主桥 | `kernel.mjs` | `TransactionKernel`、`createTransactionKernel`、`TransactionHostBridge`、`IdempotencyStore` | 精确读写；写前恢复记录；写后回读；commit 前复核目标/活动分支；同分支同键最多提交一次 |
| 阶段2测试 | `tests/v2-transaction-core.test.mjs`、`tests/v2-transaction-replays.test.mjs` | `node --test ...` | 行为测试调用真实阶段2 API，不复制宿主私聊 |

最小 `TransactionHostBridge` 仅包含：

```text
captureCurrent()
readExact(target)
writeExact(target, state)
persistRecovery(record)
persistTransaction(transaction)
```

## 5. 数据与迁移

- 新增/改变的数据模型：MessageFingerprint、Branch、BranchCheckpoint、Transaction、PathMutation、路径前置条件和幂等存储记录。
- schemaVersion：Branch/BranchCheckpoint 为 `2.0`；Transaction `protocolVersion=2.0`。
- 1.x读取策略：仅从宿主快照或 legacy checkpoint 做纯函数投影；稳定消息身份优先级为显式值、持久医生ID、宿主原生ID、显式启用的 `send_date`。
- 写回策略：阶段2不接生产写回；宿主实现必须通过精确目标桥和单写队列，禁止 latest 回退。
- 未知字段保留证明：checkpoint迁移把未知旧字段放入 `extensions.legacy`；阶段1领域未知字段往返回归持续通过。
- 无法迁移的数据与可见降级：同层身份冲突、缺分支/指纹证据、未知前置条件、数组结构变更均 unresolved/rejected，不自动修复。
- 回滚方式：回读当前精确目标，仅恢复本事务触及且当前值仍等于事务写后值的路径；同路径外部变化、事务外路径和已被其他恢复者处理的路径全部保留。

## 6. 已决决策与未决决策

| ID | 已决/未决 | 决策或问题 | 证据 | 影响 | 下一负责人 |
| --- | --- | --- | --- | --- | --- |
| P2-ID-01 | 已决 | 身份采用四层明确优先级；同层冲突不得尝试低层候选 | 协议第10节、身份迁移测试 | 旧宿主可逐步提供更耐久ID | 阶段4/6宿主适配 |
| P2-BR-01 | 已决 | continue 保留共同父哈希；normal 指向旧头正文；reroll 使用共同父 checkpoint 建新分支 | 协议第10—11节、分支测试 | 迟到任务可稳定判 stale | 阶段3沿用 |
| P2-IDEM-01 | 已决 | 幂等键跨 reroll 描述同一语义操作，唯一提交作用域仍是 `(branchId,key)` | 协议第12节、重Roll回放 | checkpoint重算后新活动分支只结算一次 | 阶段4领域事务 |
| P2-RB-01 | 已决 | compare-and-restore 回滚优先保护外部合法并发值 | 协议第12/15节、路径回滚测试 | 回滚可能留下人工恢复记录而不是覆盖他人结果 | 阶段6运维 |
| P2-OPEN-01 | 未决 | 生产宿主的持久 IdempotencyStore 与 recovery record 最终落在哪个1.x兼容容器 | 阶段2仅定义无宿主接口 | 不影响阶段3纯导演层；阶段4/6接线前必须决定 | 阶段4提出、阶段6固化 |
| P2-OPEN-02 | 未决 | `merged` 的显式协议 | 产品与协议明确推迟到2.1 | 2.0禁止隐式 merge | 2.1负责人 |

核查范围内没有会阻塞阶段3 Turn Boundary、裁定、Fact/Knowledge纯函数实现的未决产品决策。

## 7. 测试与验收

```text
命令：node --test tests/v2-replay-fixtures.test.mjs tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs tests/v2-transaction-core.test.mjs tests/v2-transaction-replays.test.mjs
退出码：0
结论：阶段0—2联合回归通过；42 pass、0 fail、5 todo。

命令：npm.cmd test
退出码：0
结论：完整回归通过；80 total、75 pass、0 fail、5 todo；浏览器运行时套件通过。

命令：$env:QC_BASE_SHA='6e37dcc1dbe1e0ac916b179651d14d02e26147ae'; npm.cmd run qc:ci
退出码：0
结论：v1.9.0跟踪QC报告及运行时代码指纹通过。

命令：node --check v2/transaction/*.mjs（逐文件）
退出码：0
结论：全部阶段2运行时模块语法通过。
```

- 新增结构测试：公开入口、哈希确定性、身份层级、分支/checkpoint验证、状态转换、JSON Pointer前置条件。
- 新增行为测试：队列串行、并发同键去重、prepare后迟到、旧分支零写入、精确回读失败和保守路径回滚。
- 既有相关回归：阶段1 22个领域测试持续通过；fixture schema、覆盖和隐私测试持续通过。
- 浏览器测试：完整 `npm.cmd test` 中 `tests/browser-runtime.test.mjs` 通过；本阶段未修改浏览器/UI代码。
- 真实 SillyTavern QC：本阶段未改 `qc/real-env-qc.mjs` 列出的任何生产运行时文件；没有冒充新增真实环境结论。`qc:ci` 已验证既有 v1.9.0真实QC报告与当前运行时指纹一致。
- fixture 覆盖：17/17结构覆盖；阶段1四例和阶段2两例共6例 `unit-active`。
- 未激活的 todo/pending 行为及激活条件：阶段3导演/Fact/Knowledge、阶段4领域事务集成、阶段5自然语言/UI、阶段6数据库/看门狗/真实回放、阶段7真实SillyTavern发布门，共5个阶段占位；只在对应阶段实际 API 存在后激活。

## 8. 隐私与安全检查

- 增量密钥扫描命令与结果：仅扫描 `git diff --cached --unified=0` 新增行；OpenAI key、Bearer、credential assignment、Authorization、Cookie、凭据URL均0命中。
- 私人正文扫描命令与结果：fixture schema测试通过；17/17均为 `privacy.synthetic=true`，最大单轮文本39字符；没有完整私人正文。
- fixture 最大文本长度：39字符，低于600字符上限。
- 是否包含绝对用户目录：增量扫描0命中。
- 是否读取但未修改私有归档：否；没有打开或复制仓库外私有归档，以当前本地源码和公开最小证据为准。
- 其他敏感数据处理：未读取、修改或输出 API 密钥；10个历史离线 ZIP 完全排除在暂存和差异之外。

## 9. 差异审计

- `git status --short --branch`：实现提交后仅10个 `dist/*.zip` 未跟踪；阶段2跟踪文件干净。
- `git diff --stat 6e37dcc1...2ff0fbb4`：20个文件，3765 insertions、24 deletions。
- 预期文件：`v2/transaction/` 10个运行时/声明入口，2个阶段2测试，fixture/schema/回放状态，以及2.0协议、矩阵、路线图、索引和CHANGELOG。
- 无关文件：10个用户已有历史 `dist/*.zip`。
- 无关文件如何被保留/排除：所有 `git add` 使用明确路径；`git diff --cached --name-only -- dist` 为0；未执行删除、reset或checkout覆盖。

## 10. 已知风险

| 风险 | 触发条件 | 影响 | 当前缓解 | 下一阶段动作 |
| --- | --- | --- | --- | --- |
| 内存幂等存储不跨重启 | 宿主只使用默认 `InMemoryIdempotencyStore` | 重启后不能证明旧提交 | 接口允许注入持久store；恢复记录写在实际写入前 | 阶段4/6实现持久适配 |
| 宿主身份证据不足 | 旧消息没有持久ID且未显式允许 `send_date` | 事务保持 unresolved/stale | 不降级到 latest，不猜身份 | 宿主接线时迁移耐久ID |
| 数组增删需要集合级适配 | 写入计划尝试直接插入/删除数组元素 | prepare rejected | 阶段2只允许替换现有数组元素或显式写整个集合路径 | 阶段4领域适配生成稳定集合计划 |
| 人工恢复记录尚无UI | 写后验证和路径回滚都失败 | 状态为 `manual-recovery` | 恢复记录包含指纹、路径前后值与错误，不自动覆盖 | 阶段6提供诊断/运维入口 |

## 11. 运行与故障恢复

- 可观察状态：Transaction持久记录包含 `proposed/prepared/committed/aborted/rolled_back/stale`、terminalReason、touchedRefs、before/after hash；人工恢复返回 `manual-recovery`。
- 软取消：阶段2没有长任务租约；尚未commit的 prepared 事务可 `abort`。TaskLease取消属于阶段6。
- 硬超时/看门狗：不适用；阶段2只有无宿主同步状态机和队列，不拥有模型长任务。阶段6按路线图实现。
- 迟到结果处理：prepare和commit都复核完整指纹与active branch；任何变化都进入 stale，零写入。
- 写前恢复记录：`persistRecovery` 必须在 `writeExact` 前成功，记录目标、分支、触及路径和写前/写后值。
- 写后回读：`readExact(target)` 后逐路径比较写后值；不得读取 latest。
- 手动恢复步骤：读取持久恢复记录；确认聊天、消息、swipe、generation和branch仍能无歧义定位；精确回读；仅对仍等于记录中写后值的路径应用写前值；保留其他路径；再次精确回读并持久化恢复结果。任一身份或路径证据歧义时停止自动恢复。

## 12. 下一阶段准确入口

```text
阶段3必须从 codex/v2.0-phase2-transaction-core 远端最终HEAD开始（至少包含阶段2实现提交 2ff0fbb43c87f2030869c4158fc3e014770e7263），先完整读取 AGENTS.md、README.md、CHANGELOG.md、manifest.json、package.json、TODO.md、docs/2.0/ 全部权威文件与 PHASE_2_HANDOFF.md，再读取 v2/domain/、v2/transaction/ 和全部 v2阶段测试。允许新增 v2/director/、tests/v2-director-*.test.mjs，并按需更新 docs/2.0、fixture状态和CHANGELOG；不得接UI、数据库、阶段4领域写入或修改1.x生产运行时。第一个API应是无宿主 Turn Boundary 与可解释 DirectorDecision：明确区分玩家已选动作、负约束、NPC/环境扩展和未选候选；随后让 H0-H3 Claim Adjudicator 输出低摩擦接纳、检定/代价命令或H3显式分支命令，并以阶段1 Fact/Knowledge valid/unresolved/rejected 和阶段2 MessageFingerprint/Branch证据为输入。首先激活 RR-AGENCY-NO-MOVE、三类口胡和 RR-FACT-RANDOM-CODE，同时保留 RR-FINGERPRINT-PREVIOUS-REPLY。必须保持未知字段往返、显式槽位/资源配置、同分支幂等、旧分支/迟到零写入、路径级保守回滚和无宿主纯函数；无证据不得升级 confirmed/verified，明确黑暗选择不得被洗白，不得以正则禁词作为最终语义裁决。完成门是阶段3回放与既有回归、完整 npm.cmd test、qc:ci/record/gate、增量隐私扫描、交接、提交/推送、以本阶段分支为base的堆叠Draft PR和远端CI终态；不合并main。完成后按用户授权创建阶段4独立任务并继续逐阶段接力。
```

## 13. 发布状态

- 本地提交：实现 `2ff0fbb43c87f2030869c4158fc3e014770e7263`；交接 `9348f9334ee6190395cbcf101902c2dfb798608c`；本文件回填提交以最终 `git log` 为准
- 远端分支：`codex/v2.0-phase2-transaction-core`；实现/交接树已通过 GitHub Git 对象接口发布并逐个 SHA 校验
- PR状态：Draft [`#22`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/22)
- 基础分支：`codex/v2.0-phase1-domain-core`
- 是否合并 main：否
- 外部阻塞：无；本机 HTTPS Git 传输通道在发布时不可达，已使用 GitHub Git 对象接口发布完全相同的两层文件树，远端比较为 ahead 2 / behind 0
