# MVU Auto Doctor 2.0 阶段3交接

## 1. 身份

- 阶段：3，导演层、玩家边界、事实与知识
- 交付日期：2026-07-27
- 仓库：`magilittle0-byte/mvu-auto-doctor`
- 分支：`codex/v2.0-phase3-director-core`
- PR：Draft [`#23`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/23)，base 为 `codex/v2.0-phase2-transaction-core`
- 本地基础提交 SHA：`b65638566ec325eae52b1805073624e2f1f02f75`
- 远端堆叠基础提交 SHA：`145de9de6249c1c088639748f221490a96de1294`
- 阶段2共同基础 tree：`db5af3dde22912a8a5f0c273c31b76cb9f10d5a5`
- 阶段3实现提交 SHA：本地 `66872aa26630ff83e0c2ce8c3ee0b0d3a4413b13`；远端 `c3b54000094ef9d28e95edbb283c44d6e0854c13`；两者 tree 均为 `1c8cbd2eff6876991f58e2db8709757ca9af02f6`
- 阶段3交接提交 SHA：本地 `ed73ea20fd7d22d4b68ba7b8edd7149c84321a0b`；远端 `ee0fe2e7a4ff93d6d8fcc11f12892a2c79cb9d68`；两者 tree 均为 `e08f25917f760ce98fde627c8b504b1ad755d46d`
- 阶段3交接/发布提交 SHA：本文件自身承载交接与发布回填，准确最终 SHA 以分支最终 HEAD 为准，避免在提交内容中伪造自引用 SHA
- 工作区是否仍有未提交修改：阶段3跟踪文件提交后应只剩10个用户已有、未跟踪的 `dist/*.zip`
- 未提交修改是否属于用户且已保留：是；未暂存、未删除、未覆盖、未改名

## 2. 本阶段范围

- 授权目标：实现无宿主依赖的 Turn Boundary、H0–H3 Claim Adjudicator、Fact/Knowledge 状态机、风险召回与最终语义裁决分离、可解释裁定对象和主模型上下文合同。
- 明确非目标：UI、外部模型调用、数据库、生产宿主持久化、阶段4领域事务写入、1.x生产运行时接线、隐式分支合并。
- 实际完成：新增 `v2/director/`；激活玩家不移动、三类口胡和随机口令五个阶段3回放；继续回归阶段2错轮回复指纹；覆盖未选候选、NPC/环境叙事空间、玩家负约束、黑暗选择保真、H2显式检定/代价、H3显式新分支、随机口令和NPC怀疑证据门。
- 有意未做：没有修改 `index.js`、样式、manifest、数据库或现有1.x生产行为；没有执行阶段3命令；没有把阶段4—7用例变成默认失败。

## 3. 权威文件

以下文件均以本地阶段2最终提交 `b65638566ec325eae52b1805073624e2f1f02f75` 的 tree 为起点完整读取，并以当前阶段3提交中的规范修订为最终依据：

- 产品规格：`docs/2.0/PRODUCT_SPEC.md`
- 数据/事务协议：`docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- 回放矩阵：`docs/2.0/REAL_REPLAY_ACCEPTANCE_MATRIX.md`
- fixture schema：`docs/2.0/replay-fixture.schema.json`
- fixture corpus：`fixtures/2.0/replay-cases.json`
- 上一阶段交接：`docs/2.0/handoffs/PHASE_0_HANDOFF.md`、`PHASE_1_HANDOFF.md`、`PHASE_2_HANDOFF.md`
- 其他：`AGENTS.md`、`README.md`、`CHANGELOG.md`、`manifest.json`、`package.json`、`TODO.md`、`docs/2.0/README.md`、`docs/2.0/PHASE_ROADMAP.md`、`docs/2.0/PHASE_HANDOFF_TEMPLATE.md`、全部 `v2/domain/`、`v2/transaction/` 源码/声明和全部 `tests/v2-*.test.mjs`

## 4. 产物与接口

| 产物 | 路径 | 对外 API / 命令 | 不变量 |
| --- | --- | --- | --- |
| 统一入口和类型 | `v2/director/index.mjs`、`index.d.mts` | 导出本表全部阶段3 API、输入/结果/命令类型 | 无 SillyTavern 全局依赖；声明覆盖公开入口 |
| 风险召回 | `recall.mjs` | `recallDirectorRisks`、`normalizeRiskRecall` | 正则只返回 `requiresSemanticReview` 候选；`finalDecision` 永远为 `null` |
| Turn Boundary | `boundary.mjs` | `create/normalize/validateTurnBoundary`、`adjudicateTurnBoundary` | 绑定完整 MessageFingerprint 与 active Branch；负约束、未选候选和受保护玩家状态优先；畸形语义输入不得 accept |
| H0–H3裁定 | `adjudicator.mjs` | `classifyClaimImpact`、`adjudicateClaim`、`validateDirectorClaimInput` | 分类只消费调用方提供的有界结构语义；无 semantic basis 不生成 confirmed；H2保持 candidate；H3默认保留当前分支 |
| 事实/知识状态机 | `ledger.mjs` | `createFactCandidate`、`transitionFact`、`createKnowledgeState`、`transitionKnowledge`、`adjudicateUnverifiedCode` | 用户/模型/NPC/论坛/随机口令默认最多 candidate；Fact 与 Knowledge 分离；confirmed/verified 需要独立证据门 |
| 主模型上下文 | `context.mjs` | `buildMainModelContext`、`validateMainModelContext`、`MAIN_MODEL_CONTEXT_VERSION` | 仅投影当前分支、指定知情视角和已验证命令；召回不能伪装最终裁决；候选/怀疑在提示中保持不确定 |
| 阶段3测试 | `tests/v2-director-core.test.mjs`、`tests/v2-director-replays.test.mjs` | `node --test ...` | 行为测试调用真实阶段3 API；不复制完整私聊；保留阶段2指纹回归 |

阶段3命令只描述意图，不执行写入：

```text
fact-candidate
fact-confirm
check
cost
new-branch
```

阶段4必须把允许执行的命令适配为阶段2 Transaction effects，并再次复核 exact target、active branch、领域结果状态和幂等键。

## 5. 数据与迁移

- 新增/改变的数据模型：TurnBoundary、NarrativeContribution、RiskRecall、DirectorClaimInput/Result、Fact/Knowledge显式转换命令、MainModelContext。
- schemaVersion：TurnBoundary/Fact/Knowledge沿用 `2.0`；主模型上下文和阶段3命令版本为 `2.0-phase3`。
- 1.x读取策略：阶段3不读取生产宿主；调用方先通过阶段1/2纯函数适配得到可验证领域记录、消息指纹和分支，再交给导演层。
- 写回策略：阶段3零写回；任何 `fact-confirm/check/cost/new-branch` 只是命令合同，阶段4/宿主必须经过 TransactionKernel。
- 未知字段保留证明：TurnBoundary沿用 `normalizeV2Base`，未知根字段进入开放 `extensions`；阶段1七类记录未知字段往返回归持续通过。
- 无法迁移的数据与可见降级：缺语义依据、非法贡献、缺H2策略、缺H3 checkpoint、消息指纹或分支不匹配均返回 `unresolved/rejected/stale`，不猜规则、意图、事实或分支。
- 回滚方式：阶段3无副作用，无需自身回滚；阶段4执行命令时必须使用阶段2写前记录、精确回读和 compare-and-restore 路径回滚。

## 6. 已决决策与未决决策

| ID | 已决/未决 | 决策或问题 | 证据 | 影响 | 下一负责人 |
| --- | --- | --- | --- | --- | --- |
| P3-BOUNDARY-01 | 已决 | 玩家正授权、负约束、未选候选、受保护状态和黑暗选择构成同一轮边界；NPC/环境只在显式叙事空间内自主 | 产品规格4.2/7.1、RR-AGENCY-NO-MOVE | 主模型便利不能越过玩家边界 | 阶段5接入 |
| P3-SEM-01 | 已决 | 文本/正则只做风险召回，最终裁决必须有结构化 semanticBasis/contributions | 产品规格4.7、三类口胡测试 | 无语义输入时保持未决 | 阶段5模型接入 |
| P3-H2-01 | 已决 | H2规则由战役配置显式注入 `check` 或类型化 `cost`；阶段3不提供通用默认值 | U0-03/U1-04、H2测试 | 缺规则时 candidate + pending，不猜资源或难度 | 阶段4/5配置适配 |
| P3-H3-01 | 已决 | H3默认拒绝；只有显式改写且 checkpoint 唯一时才发 `new-branch`，原分支保留 | 产品规格H3、改写回放 | 普通事务不得覆盖历史 | 阶段4分支命令适配 |
| P3-FACT-01 | 已决 | 随机口令、模型提案、NPC怀疑和论坛传闻不能仅凭消息证据 confirmed/verified | 协议6/7节、随机口令测试 | 自己人/通行身份不会连锁生成 | 阶段4持久适配 |
| P3-OPEN-01 | 未决 | 生产战役配置中的 H2 检定ID、难度和资源注册表最终存储位置与版本归属 | 阶段3只冻结注入合同 | 不阻塞纯导演层；阻塞生产命令生成 | 阶段4提出，阶段5接UI |
| P2-OPEN-01 | 未决 | 生产持久 IdempotencyStore 与 recovery record 的1.x兼容容器 | 阶段2交接 | 阶段4真实领域事务需要耐久去重/恢复 | 阶段4提出，阶段6固化 |

除上表已明确交给阶段4/5的配置与持久化接口外，没有会改变阶段3纯函数完成结论的未决产品决策。

## 7. 测试与验收

```text
命令：node --test tests/v2-director-core.test.mjs tests/v2-director-replays.test.mjs
退出码：0
结论：阶段3核心与回放共19 pass、0 fail、0 todo。

命令：node --test tests/v2-replay-fixtures.test.mjs tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs tests/v2-transaction-core.test.mjs tests/v2-transaction-replays.test.mjs tests/v2-director-core.test.mjs tests/v2-director-replays.test.mjs
退出码：0
结论：阶段0—3联合回归通过；65 total、61 pass、0 fail、4 todo。

命令：npm.cmd test
退出码：0
结论：完整回归通过；98 total、94 pass、0 fail、4 todo；浏览器运行时套件通过。

命令：npm.cmd run qc:ci
退出码：0
结论：v1.9.0跟踪真实环境QC报告及生产运行时代码指纹通过。

命令：npm.cmd run qc:record
退出码：0
结论：先后为实现提交 66872aa26630 和交接提交 ed73ea20fd7d 记录真实环境QC回执。

命令：npm.cmd run qc:gate
退出码：0
结论：实现提交 66872aa26630 和交接提交 ed73ea20fd7d 的真实环境QC gate均通过。

命令：node --check（逐个 v2/director/*.mjs）与 git diff --check
退出码：0
结论：阶段3运行时模块语法和差异空白检查通过。
```

- 新增结构测试：公开入口、TurnBoundary验证、畸形语义输入、H0–H3结果/命令、Fact/Knowledge转换、上下文合同。
- 新增行为测试：玩家负约束、未选候选、黑暗选择保真、缺语义依据零确认、H2检定/代价、H3 checkpoint、随机口令消息证据拒绝、NPC怀疑与分视角知识。
- 既有相关回归：阶段1领域 valid/unresolved/rejected、未知字段往返和阶段2 MessageFingerprint/Branch/Transaction/幂等/迟到/回滚全部持续通过。
- 浏览器测试：完整 `npm.cmd test` 中 `tests/browser-runtime.test.mjs` 通过；本阶段未修改浏览器/UI代码。
- 真实 SillyTavern QC：本阶段未改生产运行时文件，不冒充新增真实宿主结论；`qc:ci/record/gate` 复核既有 v1.9.0脱敏报告与当前生产代码指纹。
- fixture 覆盖：17/17结构覆盖、11/17为阶段1—3 `unit-active`；阶段3五例调用真实导演API。
- 未激活的 todo/pending 行为及激活条件：仅保留阶段4领域事务、阶段5自然语言/UI、阶段6修复屏障/数据库/看门狗、阶段7真实SillyTavern发布门四个阶段级 TODO。

## 8. 隐私与安全检查

- 增量密钥扫描命令与结果：只扫描实现提交 `git diff --cached --unified=0` 新增行；OpenAI、GitHub、Google、Slack、Bearer和凭据赋值模式无真实命中。宽松 `authorization` 词法规则命中5行，逐行确认均为结构字段/测试ID，不含凭据值。
- 私人正文扫描命令与结果：绝对用户目录、`.jsonl/.zip/.sqlite/.db` 新增行0命中；fixture schema隐私测试通过。
- fixture 最大文本长度：39字符；17/17均为 `privacy.synthetic=true`。
- 是否包含绝对用户目录：否；阶段3跟踪差异0命中。
- 是否读取但未修改私有归档：否；没有打开或复制仓库外私有归档，以当前源码和公开最小fixture为准。
- 其他敏感数据处理：未读取、修改或输出 API 密钥；10个用户已有未跟踪历史离线 ZIP 全部排除在暂存和提交之外。

## 9. 差异审计

- `git status --short --branch`：实现提交后只有10个 `dist/*.zip` 未跟踪；阶段3跟踪文件干净。
- 实现提交 `git diff --stat b6563856...66872aa2`：17个文件，3651 insertions、23 deletions。
- 预期文件：`v2/director/` 7个运行时/声明入口，2个阶段3测试，fixture/schema/激活元数据，以及2.0协议、矩阵、路线图、索引和CHANGELOG。
- 无关文件：10个用户已有历史 `dist/*.zip`。
- 无关文件如何被保留/排除：所有 `git add` 使用明确路径；`git diff --cached --name-only -- dist` 为0；未执行删除、reset或checkout覆盖。

## 10. 已知风险

| 风险 | 触发条件 | 影响 | 当前缓解 | 下一阶段动作 |
| --- | --- | --- | --- | --- |
| 结构语义由调用方提供 | 阶段5模型适配把召回候选直接当最终裁决 | 误判玩家意图或事实 | API要求 semanticBasis/contributions，缺失即 unresolved | 阶段5实现有界语义适配与回放 |
| H2策略尚无生产注册表 | 战役未配置检定或资源 | H2保持 pending，无法执行 | 明确不猜难度/资源，命令合同已类型化 | 阶段4定义注册表生命周期 |
| 阶段3命令尚未事务化 | 调用方绕过 TransactionKernel 直接写状态 | 可能部分写入或跨分支污染 | 本阶段零写回；上下文标记命令版本/branch/target | 阶段4建立唯一命令适配入口 |
| 召回词表只追求召回率 | 非中文或不同表达未命中 | 不触发廉价预筛 | 最终API不依赖命中；可直接提交结构语义 | 阶段5按真实回放扩充召回器 |

## 11. 运行与故障恢复

- 可观察状态：每个边界/口胡/账本结果都包含 `status/decision/issues/explanation`；命令含版本、claim/fact、branch和目标指纹。
- 软取消：不适用；阶段3均为短时纯函数，不拥有宿主任务或租约。
- 硬超时/看门狗：不适用；阶段3不调用外部模型、不执行数据库或长任务。阶段6按路线图实现。
- 迟到结果处理：TurnBoundary和ClaimAdjudicator可复核完整 MessageFingerprint 与 active Branch；不匹配返回 stale/rejected，零命令执行。
- 写前恢复记录：不适用；阶段3无写入。阶段4必须复用阶段2 `persistRecovery`。
- 写后回读：不适用；阶段3无写入。阶段4必须复用阶段2 `readExact(target)`。
- 手动恢复步骤：阶段3没有可恢复副作用；若调用方收到非valid、stale或reject结果，丢弃命令并保留当前分支/状态。若后续阶段已执行命令，按阶段2交接的精确回读和 compare-and-restore 流程恢复。

## 12. 下一阶段准确入口

```text
从 codex/v2.0-phase3-director-core 的本地/远端最终HEAD开始“阶段4：领域事务整合”；远端PR必须以 codex/v2.0-phase3-director-core 为base堆叠，不合并main。开始前完整读取 AGENTS.md、README.md、CHANGELOG.md、manifest.json、package.json、TODO.md、docs/2.0/ 全部权威文件和阶段0—3交接，再读取 v2/domain/、v2/transaction/、v2/director/ 全部源码/声明及全部 v2阶段测试；检查分支、HEAD、tree、工作区和10个未跟踪dist ZIP，全部ZIP继续保留且不得暂存、删除、reset或checkout覆盖。

严格按 PHASE_ROADMAP.md 阶段4实现物品使用、装备穿卸、技能成本、社会关系、任务终态、复合事务与前置条件、1.x真实状态惰性迁移和未决/隔离数据可见诊断。允许新增独立的阶段4无宿主整合目录、对应 tests/v2-*-integration.test.mjs，并按需更新 docs/2.0、fixture激活状态和CHANGELOG；除非最小宿主兼容测试确有必要，不修改1.x生产运行时，不接UI、自然语言入口、数据库或阶段5—7行为。

第一个API应是“Director command → validated domain effect plan → Transaction proposal”的纯适配入口：只消费阶段3 valid命令、完整MessageFingerprint、active Branch、显式战役槽位/资源/检定配置和阶段1领域前后值；为每个effect生成精确路径、前置条件、领域ValidationResult和稳定幂等键，再交给阶段2 TransactionKernel。优先让 RR-ITEM-CONSUMABLE-EFFECT、RR-SKILL-TEXT-COST、RR-EQUIPMENT-SLOTS、RR-SOCIAL-ORDINARY-KINDNESS、RR-SOCIAL-COERCION-VOLUNTARY、任务取消/替代与资源单次结算调用真实阶段4API；任一失败必须零部分写入，H2代价只有事务成功后才能确认candidate Fact。

必须保持阶段1 valid/unresolved/rejected、未知字段往返、显式槽位/资源配置、事实/知识证据门和终态任务不可重开；保持阶段2完整指纹、continue/regenerate/swipe分支边界、同分支同幂等键最多一次、旧分支/迟到零写入、精确目标回读和只恢复仍匹配写后值路径的保守回滚；保持阶段3玩家负约束、未选候选、黑暗选择保真、召回/裁决分离、H2 candidate和H3显式新分支边界。歧义必须 unresolved/reject，不猜槽位、数值、资源、事实、知识、消息身份、分支或事务证据。

完成门：阶段4 fixture/复合事务/惰性迁移测试、阶段0—3全部回归和完整 npm.cmd test 通过；按AGENTS.md运行 qc:ci，提交后 qc:record/qc:gate；完成增量密钥/私人内容扫描、差异审计和 PHASE_4_HANDOFF.md；提交并发布独立远端分支，以阶段3分支为base创建Draft PR，跟进远端CI到终态并修复本阶段失败，不合并main。阶段4真正完成后，按用户授权自动创建阶段5独立任务并继续逐阶段接力。
```

## 13. 发布状态

- 本地提交：实现 `66872aa26630ff83e0c2ce8c3ee0b0d3a4413b13`；交接 `ed73ea20fd7d22d4b68ba7b8edd7149c84321a0b`；本文件回填提交以最终 `git log` 为准
- 远端分支：`codex/v2.0-phase3-director-core`；实现/交接树已通过 GitHub Git 对象接口发布并逐 blob/tree SHA 校验
- PR状态：Draft [`#23`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/23)
- 基础分支：`codex/v2.0-phase2-transaction-core`
- 是否合并 main：否
- 外部阻塞：无；本机 HTTPS Git 传输在沙箱外仍超时，已在远端阶段2 HEAD `145de9de6249c1c088639748f221490a96de1294` 上通过 GitHub Git 对象接口只叠加阶段3差异；发布元数据回填后分支应为 ahead 3 / behind 0，所有 changed blob 与各层 tree 均和本地Git对象一致
