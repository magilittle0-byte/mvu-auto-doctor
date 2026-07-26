# MVU Auto Doctor 2.0 阶段4交接

## 1. 身份

- 阶段：4，领域事务整合
- 交付日期：2026-07-27
- 仓库：`magilittle0-byte/mvu-auto-doctor`
- 分支：`codex/v2.0-phase4-domain-transactions`
- PR：Draft [`#24`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/24)，base 为 `codex/v2.0-phase3-director-core`
- 本地基础提交 SHA：`ca8d101121ad7761fb090f513ae674fc2cda7845`
- 远端堆叠基础提交 SHA：`019b57f10e5b57b29055c4bbe0d4f0f9aa07cab2`
- 阶段3共同基础 tree：`b7fa688857834599a0f6bd1269694551364127a4`
- 阶段4实现提交 SHA：本地 `e54ea3ffb4b1992ec7dc967f461b1455da4c9e3a`；远端 `e491fb092e1e2053639f4bf28ff1e681dd87caf9`；两者 tree 均为 `0eb62bc6bb8b027b75dad6c6de52f0f466b55cf6`
- 阶段4交接/发布提交 SHA：本文件自身承载交接与发布回填，准确最终 SHA 以分支最终 HEAD 和 Draft PR headRefOid 为准，避免在提交内容中伪造自引用 SHA
- 工作区是否仍有未提交修改：阶段4跟踪文件提交后应只剩10个用户已有、未跟踪的 `dist/*.zip`
- 未提交修改是否属于用户且已保留：是；未暂存、未删除、未覆盖、未改名

## 2. 本阶段范围

- 授权目标：把阶段3 valid命令、完整 MessageFingerprint、active Branch、显式战役槽位/资源/检定配置和阶段1领域前后值转换为可由阶段2 TransactionKernel原子执行的领域效果计划；覆盖物品、装备、技能、社会、任务、H2结算、1.x惰性迁移和可见诊断。
- 明确非目标：阶段5自然语言/UI双入口、数据库或阶段6看门狗、生产宿主持久化、主模型作为唯一硬边界、单一卡片路径、正则最终语义裁决、阶段5—7默认失败CI、合并main。
- 实际完成：新增 `v2/domain-transaction/` 纯适配与执行入口；实现物品数量+效果、装备穿脱/换槽/背包+加成、技能类型化多资源成本、社会自愿/强制轴与标签回退、任务取消/替代/资源单次结算、H2 cost/check 与 Fact确认复合事务、H3分支边界；新增5.4.1形状的脱敏惰性迁移诊断；五个历史领域fixture调用真实阶段4API。
- 有意未做：未修改 `index.js`、`style.css`、manifest、package版本、生产数据库或现有1.x写入路径；未接自然语言解析和UI；未创建生产持久 IdempotencyStore；未宣称本阶段新增真实 SillyTavern 宿主行为。

## 3. 权威文件

以下文件均以阶段3本地最终提交 `ca8d101121ad7761fb090f513ae674fc2cda7845` 的 tree 为起点完整读取，并以当前阶段4提交中的规范修订为最终依据：

- 产品规格：`docs/2.0/PRODUCT_SPEC.md`
- 数据/事务协议：`docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- 回放矩阵：`docs/2.0/REAL_REPLAY_ACCEPTANCE_MATRIX.md`
- fixture schema：`docs/2.0/replay-fixture.schema.json`
- fixture corpus：`fixtures/2.0/replay-cases.json`
- 上一阶段交接：`docs/2.0/handoffs/PHASE_0_HANDOFF.md`、`PHASE_1_HANDOFF.md`、`PHASE_2_HANDOFF.md`、`PHASE_3_HANDOFF.md`
- 其他：`AGENTS.md`、`README.md`、`CHANGELOG.md`、`manifest.json`、`package.json`、`TODO.md`、`docs/2.0/README.md`、`docs/2.0/PHASE_ROADMAP.md`、`docs/2.0/PHASE_HANDOFF_TEMPLATE.md`、全部 `v2/domain/`、`v2/transaction/`、`v2/director/` 源码/声明和全部 `tests/v2-*.test.mjs`

## 4. 产物与接口

| 产物 | 路径 | 对外 API / 命令 | 不变量 |
| --- | --- | --- | --- |
| 统一入口和类型 | `v2/domain-transaction/index.mjs`、`index.d.mts` | 导出本表全部阶段4 API、配置/命令/计划/迁移类型 | 无 SillyTavern 全局依赖；声明覆盖公开入口 |
| 命令与战役配置门 | `config.mjs` | `validateDirectorDomainCommand`、`normalize/validateCampaignDomainConfig`、`DOMAIN_COMMAND_VERSION`、`resourceKey`、`slotKey` | 阶段3命令必须来自真实 valid结果；原生命令必须引用同一指纹 Turn Boundary 的明确授权；槽位/资源/检定/记录路径只能显式注册 |
| 领域事务规划 | `planner.mjs` | `planDirectorDomainTransaction` | 无宿主纯函数；每个写入含精确 JSON Pointer 和前置条件；歧义返回 unresolved/rejected；稳定幂等键跨reroll保持语义一致、提交作用域仍按branch隔离 |
| TransactionKernel桥接 | `runtime.mjs` | `preparePlannedDomainTransaction`、`executePlannedDomainTransaction` | 只有 valid 且含 Transaction 的计划可 prepare；失败/no-op/H3分支请求不能提交；阶段2精确写入、回读、迟到、回滚和幂等规则保持 |
| 1.x惰性迁移诊断 | `migration.mjs` | `inspectLegacyDomainRecord`、`diagnoseLegacyDomainProjection`、`createLazyLegacyDomainProjection` | 只读调用阶段1适配器；访问前 pending；mapped 才可事务化；unresolved/quarantined 始终可见且不可写 |
| 阶段4核心测试 | `tests/v2-domain-transaction-core.test.mjs` | `node --test tests/v2-domain-transaction-core.test.mjs` | 覆盖原子性、精确前置条件、穿卸/换槽、任务终态/替代/单次结算、H2/H3、跨分支幂等和惰性迁移 |
| 阶段4fixture回放 | `tests/v2-domain-transaction-replays.test.mjs` | 五个 `replay.*` 测试 | 药剂/技能不猜数值、错误槽位零事务、普通善意全回退、强制轴不污染自愿轴 |

阶段4原生领域命令：

```text
item-use
equipment-equip
equipment-unequip
equipment-transfer
skill-use
social-transition
quest-transition
quest-supersede
```

阶段3命令继续经同一入口复核：

```text
fact-candidate
fact-confirm
check
cost
new-branch
```

## 5. 数据与迁移

- 新增/改变的数据模型：`CampaignDomainConfig`、`ValidatedDirectorDomainCommand`、`DomainPlanningState`、`DomainTransactionPlan`、`LegacyDomainDiagnostic`；没有改变阶段1记录或阶段2 Transaction的线协议。
- schemaVersion：阶段1记录和阶段2事务继续为 `2.0`；阶段4原生命令版本为 `2.0-phase4`；数据/事务协议文档提升为 `2.0.0-draft.4`。
- 1.x读取策略：`createLazyLegacyDomainProjection` 首次访问单条旧记录时才调用阶段1适配器；`diagnoseAll` 可对显式上限内的脱敏投影做只读批量诊断。
- 写回策略：mapped迁移结果仍只是只读 V2投影；阶段4不批量覆盖旧数据。后续入口必须把明确前后值交给计划器，再由阶段2 TransactionKernel写精确目标。
- 未知字段保留证明：5.4.1形状迁移测试验证未知嵌套字段进入 `extensions.legacy` 且输入对象不被修改；阶段1全部未知字段往返回归继续通过。
- 无法迁移的数据与可见降级：缺药剂效果/消耗、技能类型化成本、装备允许槽位、关系轴映射或冲突任务状态分别显示 unresolved/quarantined；`diagnostics()` 同时保留尚未访问的 pending 条目。
- 回滚方式：计划器本身无副作用；执行复用阶段2写前 recovery record、精确目标回读和 compare-and-restore，仅恢复仍等于本事务写后值的路径。

## 6. 已决决策与未决决策

| ID | 已决/未决 | 决策或问题 | 证据 | 影响 | 下一负责人 |
| --- | --- | --- | --- | --- | --- |
| P4-ENTRY-01 | 已决 | 唯一纯入口为“validated Director command → domain effect plan → Transaction proposal”；原生命令也必须先通过阶段3 Turn Boundary授权 | 路线图阶段4、阶段3交接、入口/伪造测试 | UI或自然语言不能绕开指纹、分支、授权和领域门 | 阶段5接入 |
| P4-CONFIG-01 | 已决 | 战役槽位、资源、检定ID、记录路径和扩展效果路径由调用方显式注入并带版本，不提供卡片专属默认值 | U0-03/U1-04、药剂/技能/装备回放 | 缺配置保持 unresolved，不猜数值或路径 | 阶段5提供可见配置来源 |
| P4-IDEM-01 | 已决 | 幂等键描述逻辑父输入、主体和效果，跨reroll可稳定；唯一提交仍按 `(branchId, idempotencyKey)` | 阶段2协议与阶段4跨分支测试 | 新分支隔离、同分支重复最多提交一次 | 阶段5保持 |
| P4-QUEST-01 | 已决 | 任务终态/替代/资源变化同事务提交；候选不得伪造结算历史；替代路径必须 absent；终态不可复开 | Quest协议、取消/替代测试 | 防止双奖励、复活旧任务和半替代 | 阶段5保持 |
| P4-H2-01 | 已决 | H2 cost或成功check与Fact确认同事务；失败check零写入并保持 candidate；H3不伪装领域事务 | 阶段3H2/H3合同、阶段4复合事务测试 | 不会先确认事实后扣款失败 | 阶段5保持 |
| P4-MIGRATION-01 | 已决 | 1.x只惰性只读投影；只有 mapped 可进入事务；unresolved/quarantined 可见 | 协议16节、5.4.1形状测试 | 升级不会丢未知字段或用猜测完成迁移 | 阶段5展示 |
| P4-OPEN-01 | 未决 | 生产战役配置的宿主存储位置、版本选择和UI编辑/只读策略 | 阶段4只冻结注入合同 | 不阻塞纯计划器；阶段5没有来源时命令保持 unresolved | 阶段5 |
| P4-OPEN-02 | 未决 | `difficultySchema` 和自定义 effect adapter 的生产注册、版本与可见错误展示 | 阶段4只校验显式checkId和精确effect路径 | 不阻塞内核；不得在阶段5猜检定难度或效果值 | 阶段5提出，阶段6固化 |
| P2-OPEN-01 | 未决 | 生产持久 IdempotencyStore 与 recovery record 的1.x兼容容器 | 阶段2交接、阶段4复用内核 | 无宿主测试可证明语义；跨重启耐久去重仍需宿主容器 | 阶段6 |

没有会改变阶段4无宿主纯适配完成结论的其他未决产品决策。

## 7. 测试与验收

```text
命令：node --test tests/v2-domain-transaction-core.test.mjs tests/v2-domain-transaction-replays.test.mjs
退出码：0
结论：阶段4核心与真实fixture规划回放全部通过；20 pass、0 fail、0 todo。

命令：node --test tests/v2-replay-fixtures.test.mjs tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs tests/v2-transaction-core.test.mjs tests/v2-transaction-replays.test.mjs tests/v2-director-core.test.mjs tests/v2-director-replays.test.mjs tests/v2-domain-transaction-core.test.mjs tests/v2-domain-transaction-replays.test.mjs
退出码：0
结论：阶段0—4联合回归通过；85 total、82 pass、0 fail、3 todo。

命令：npm.cmd test
退出码：0
结论：完整回归通过；118 total、115 pass、0 fail、3 todo；浏览器运行时套件通过。

命令：npm.cmd run qc:ci
退出码：0
结论：v1.9.0跟踪真实环境QC报告与当前生产运行时代码指纹通过。

命令：npm.cmd run qc:record
退出码：0
结论：为实现提交 e54ea3ffb4b1 记录真实环境QC回执。

命令：npm.cmd run qc:gate
退出码：0
结论：实现提交 e54ea3ffb4b1 的真实环境QC gate通过。

命令：node --check（逐个 v2/domain-transaction/*.mjs 和两个阶段4测试）与 git diff --check
退出码：0
结论：阶段4运行时/测试语法与差异空白检查通过。
```

- 新增结构测试：公开入口、战役配置、Director/Turn Boundary来源、跨指纹授权重放拒绝、精确路径/前置条件、稳定幂等键、惰性迁移状态与公开声明。
- 新增行为测试：药剂数量+效果原子提交、技能多资源零部分扣除、装备穿/脱/换槽与加成、普通善意/强制关系、任务取消/替代/资源单次结算、伪造结算历史拒绝、H2 cost/check、H3分支边界。
- 既有相关回归：阶段1 valid/unresolved/rejected与未知字段；阶段2完整指纹、分支、幂等、迟到、回读和路径级回滚；阶段3玩家负约束、未选候选、黑暗选择、召回/裁决分离、Fact/Knowledge证据门全部持续通过。
- 浏览器测试：完整 `npm.cmd test` 中 `tests/browser-runtime.test.mjs` 通过；本阶段未修改浏览器/UI代码。
- 真实 SillyTavern QC：本阶段未改生产运行时文件，不冒充新增真实宿主结论；`qc:ci/record/gate` 只复核既有 v1.9.0脱敏报告和当前生产代码指纹。
- fixture 覆盖：17/17结构覆盖、12/17为阶段1—4 `unit-active`；药剂、技能、装备、普通善意、强制/自愿关系五例调用真实阶段4 API。
- 未激活的 todo/pending 行为及激活条件：只保留阶段5自然语言/UI、阶段6修复屏障/数据库/看门狗、阶段7真实SillyTavern发布门三个阶段级 TODO。

## 8. 隐私与安全检查

- 增量密钥扫描命令与结果：对 `git diff --cached --unified=0` 的4628条新增行扫描 OpenAI、GitHub、Google、Slack、Bearer、API key、token、client secret和password赋值形态，0命中。
- 私人正文扫描命令与结果：对同一新增行扫描绝对用户目录、`.jsonl/.zip/.sqlite/.db`、Cookie和私有归档引用；绝对路径0命中，凭据/Cookie/归档引用0命中。宽松扩展名规则命中本节自身的扫描模式1行；`.zip`词法命中4行，均为本交接对10个未跟踪历史ZIP的保留/排除记录，`git diff --cached --name-only -- dist` 为0。
- fixture 最大文本长度：39字符；17/17均为 `privacy.synthetic=true`。
- 是否包含绝对用户目录：否；阶段4跟踪内容不得包含本机用户绝对路径。
- 是否读取但未修改私有归档：否；没有打开、复制或覆盖仓库外私有归档，以当前源码和已签入脱敏最小fixture为准。
- 其他敏感数据处理：未读取、修改或输出 API 密钥；10个用户已有未跟踪历史离线 ZIP 全部排除在暂存和提交之外。

## 9. 差异审计

- `git status --short --branch`：提交后应只有10个 `dist/*.zip` 未跟踪；所有阶段4跟踪文件干净。
- `git diff --stat ca8d1011...e54ea3f`：16个文件、4628 insertions、25 deletions。
- 预期文件：`v2/domain-transaction/` 6个运行时/声明入口，2个阶段4测试，fixture激活元数据、阶段4交接，以及2.0协议、矩阵、路线图、索引和CHANGELOG。
- 无关文件：10个用户已有历史 `dist/*.zip`。
- 无关文件如何被保留/排除：所有 `git add` 使用明确路径；提交前必须确认 `git diff --cached --name-only -- dist` 为0；未执行删除、reset或checkout覆盖。

## 10. 已知风险

| 风险 | 触发条件 | 影响 | 当前缓解 | 下一阶段动作 |
| --- | --- | --- | --- | --- |
| 战役配置尚无生产来源 | 阶段5自然语言/UI没有显式槽位、资源、检定或记录注册表 | 计划保持 unresolved，不能执行 | 配置验证器拒绝缺失/重复/不一致路径 | 阶段5提供同一可见配置投影 |
| 自定义效果只有通用精确路径桥 | 卡片定义非资源机械效果但未提供effect before/after | 效果保持 unresolved | 不猜效果值；要求显式 `effectBindings/effectValues` | 阶段5定义适配器选择与错误UI |
| 耐久幂等/恢复仍依赖宿主容器 | 重启后宿主没有持久 IdempotencyStore/recovery | 无法证明跨重启去重和恢复 | 阶段2接口与无宿主实现保持；阶段4不绕开内核 | 阶段6接生产持久容器 |
| 惰性迁移尚未接生产1.x读取 | 阶段5只展示V2原生记录 | 旧聊天无法通过新入口执行 | 只读诊断API保留原字段并明确canTransact | 阶段5在双入口前展示迁移缺口 |
| 本阶段没有新增真实宿主行为证据 | 后续把纯模块测试误当成真实SillyTavern通过 | 发布风险被低估 | 交接明确QC边界，阶段5—7矩阵仍未激活 | 阶段5做UI浏览器回归，阶段7做真实门 |

## 11. 运行与故障恢复

- 可观察状态：命令、战役配置、每个领域结果、资源结果和迁移条目均含 `status/issues/diagnostics`；计划含 `decision/idempotencyKey/writePlan/preconditions/effects`。
- 软取消：不适用；阶段4规划是短时纯函数，TransactionKernel提交是阶段2有界单写队列，不拥有模型长任务。阶段6实现TaskLease软取消。
- 硬超时/看门狗：不适用；阶段4不调用外部模型、数据库或长任务。阶段6按路线图实现。
- 迟到结果处理：命令入口复核完整指纹和active Branch；prepare/commit再次由阶段2捕获当前指纹与分支，不匹配进入 stale，零写入。
- 写前恢复记录：`executePlannedDomainTransaction` 复用阶段2 kernel；正式写入前持久 `beforeState/beforeHash/touchedRefs/writePlan`。
- 写后回读：复用 `readExact(target)`，逐路径核对写后值与afterHash。
- 手动恢复步骤：若计划不是 valid/propose，丢弃事务并保留当前状态；若prepare/commit返回 stale/aborted，保留现状态；若写后回读失败，使用阶段2 recovery record只恢复仍等于本事务写后值的路径，保留外部并发变化并审阅 `persistRecovery` 记录。

## 12. 下一阶段准确入口

```text
从 codex/v2.0-phase4-domain-transactions 的本地/远端最终HEAD开始“阶段5：自然语言与UI双入口”；远端PR必须以 codex/v2.0-phase4-domain-transactions 为base堆叠，不合并main。阶段4本地起点为 ca8d101121ad7761fb090f513ae674fc2cda7845，远端堆叠起点为 019b57f10e5b57b29055c4bbe0d4f0f9aa07cab2，共同阶段3 tree 为 b7fa688857834599a0f6bd1269694551364127a4；阶段4最终本地/远端HEAD、tree、Draft PR以本交接发布状态、阶段4任务最终输出与PR headRefOid三者核对。

开始前完整读取 AGENTS.md、README.md、CHANGELOG.md、manifest.json、package.json、TODO.md、docs/2.0/ 全部权威文件和阶段0—4交接，再读取 v2/domain/、v2/transaction/、v2/director/、v2/domain-transaction/ 全部源码/声明及全部v2阶段测试；检查分支、HEAD、tree、工作区和10个未跟踪dist ZIP，全部ZIP继续保留且不得暂存、删除、reset或checkout覆盖。

严格按 PHASE_ROADMAP.md 阶段5实现自然语言命令与UI控制到同一阶段4 DomainCommand/validated plan/Transaction proposal的双入口、裁定/事务/分支/证据/迁移缺口/撤销的可审计视图、390×844触控与键盘可访问性，以及不暴露私人事实、完整提示词或密钥的诊断。允许新增独立阶段5无宿主意图适配目录、必要的生产UI/最小宿主桥、对应核心与浏览器测试，并按需更新docs/fixture/CHANGELOG；不接阶段6数据库/看门狗，不实现阶段7发布候选。

第一个API应是“Natural-language intent 或 UI action → 同一个结构化 DomainCommand candidate → 阶段3 Turn Boundary/裁定验证 → validateDirectorDomainCommand → planDirectorDomainTransaction”的双源等价纯适配入口。自然语言解析器不能成为唯一硬边界；UI不得绕开导演/指纹/分支/证据/配置/事务门。首先证明同一物品、装备、技能、社会、任务动作从两入口产生规范化后完全等价的命令、幂等键、前置条件和Transaction proposal，再接阶段5可见界面与移动端回归。缺槽位、数值、资源、事实、知识、消息身份、分支、检定、授权或事务证据必须unresolved/reject并在UI可见，不得猜测。

必须保持阶段1 valid/unresolved/rejected与未知字段往返；阶段2完整MessageFingerprint、continue/regenerate/swipe边界、同分支同键最多一次、旧分支/迟到零写入、精确回读和保守回滚；阶段3玩家负约束、未选候选、黑暗选择保真、召回/裁决分离、H2 candidate与H3显式分支；阶段4精确路径/前置条件、显式配置、原子领域事务、普通善意/强制分离、任务终态不可重开、资源单次结算和惰性迁移诊断。

完成门：阶段5双入口等价、可见诊断、无危险确认绕过和390×844/键盘浏览器回归；阶段0—4全部回归与完整 npm.cmd test 无回归；按AGENTS.md运行 qc:ci，提交后 qc:record/qc:gate；完成增量密钥/私人内容扫描、差异审计和 PHASE_5_HANDOFF.md；提交并发布独立远端分支，以阶段4分支为base创建Draft PR，跟进远端CI到终态并修复本阶段失败，不合并main。完成后按用户授权创建阶段6独立任务并继续接力。

禁止把主模型作为唯一硬边界，禁止硬编码单一卡片路径，禁止以正则禁词作最终语义裁决，禁止复制完整私聊/私有归档/凭据，禁止绕开阶段4与TransactionKernel直接写状态，禁止把阶段6—7行为变成默认失败CI，禁止自动合并main。
```

## 13. 发布状态

- 本地提交：实现 `e54ea3ffb4b1992ec7dc967f461b1455da4c9e3a`；本文件发布回填提交以最终 `git log` 为准
- 远端分支：`codex/v2.0-phase4-domain-transactions`；实现提交 `e491fb092e1e2053639f4bf28ff1e681dd87caf9` 以远端阶段3 HEAD `019b57f10e5b57b29055c4bbe0d4f0f9aa07cab2` 为唯一父提交；16/16 changed blob与9/9相关层tree SHA均和本地Git对象一致，根tree为 `0eb62bc6bb8b027b75dad6c6de52f0f466b55cf6`
- PR状态：Draft [`#24`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/24)，head为阶段4分支，base为阶段3分支
- 基础分支：`codex/v2.0-phase3-director-core`
- 是否合并 main：否
- 外部阻塞：无；本机 `gh` 凭据无效，沙箱内 HTTPS Git立即拒绝连接，沙箱外 fetch 最终被连接重置。已使用GitHub Git对象接口在远端阶段3 HEAD上只叠加阶段4差异；实现发布比较为 ahead 1 / behind 0，未把本地分叉提交当远端父提交。
