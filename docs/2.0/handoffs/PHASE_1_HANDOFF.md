# MVU Auto Doctor 2.0 阶段1交接

## 1. 身份

- 阶段：1，V2领域核与协议验证器
- 交付日期：2026-07-26
- 仓库：`mvu-auto-doctor-v1.8-hotfix`
- 分支：`codex/v2.0-phase1-domain-core`
- PR：`https://github.com/magilittle0-byte/mvu-auto-doctor/pull/21`（draft）
- 基础提交 SHA：`f04b68176318286826e53c1548bd6672323bb1bb`
- 阶段1产物提交 SHA：`a1244f8b4cd55018d375ed605a6fa2793cc70040`
- 交接记录提交 SHA：`2862cd34b57d5cb17e6634de2991186aebe1fee5`；其后的提交只回填远端PR元数据
- 工作区是否仍有未提交修改：没有属于阶段1的未提交修改
- 未提交修改是否属于用户且已保留：是；10个历史 `dist/` 离线ZIP保持未跟踪、未修改、未暂存

## 2. 本阶段范围

- 授权目标：新增无宿主依赖的V2领域核，冻结七类记录的类型、归一化、验证与1.x只读迁移行为，并将四个高优先级回放转为真实领域行为测试。
- 明确非目标：不接宿主写入、`index.js` 主流程、外部模型、数据库、UI或生产迁移；不实现阶段2事务内核；不合并 `main`。
- 实际完成：公共V2记录与验证结果、ItemV2、EquipmentV2、SkillV2、Fact、Knowledge、SocialState、Quest、H0–H3结构化结果、七个1.x只读适配器、七个只读投影、迁移输入上限、类型声明、四个 `unit-active` fixture行为回放及权威文档澄清。
- 有意未做：没有把H0–H3接入主模型；没有执行物品扣量、资源结算、装备写入、关系持久化或任务迁移；没有声明四个回放的integration、real-replay或真实SillyTavern层完成。

## 3. 权威文件

以下文件均以基础提交 `f04b68176318286826e53c1548bd6672323bb1bb` 为起点完整读取，并按阶段1产物提交更新必要部分：

- 产品规格：`docs/2.0/PRODUCT_SPEC.md`
- 数据/事务协议：`docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- 回放矩阵：`docs/2.0/REAL_REPLAY_ACCEPTANCE_MATRIX.md`
- 路线图：`docs/2.0/PHASE_ROADMAP.md`
- fixture schema：`docs/2.0/replay-fixture.schema.json`
- fixture corpus：`fixtures/2.0/replay-cases.json`
- 上一阶段交接：`docs/2.0/handoffs/PHASE_0_HANDOFF.md`
- 其他：`AGENTS.md`、`README.md`、`CHANGELOG.md`、`manifest.json`、`package.json`、`TODO.md`、`docs/2.0/README.md`、`docs/2.0/PHASE_HANDOFF_TEMPLATE.md`
- 1.x回归依据：现有 `core.mjs`、`continuity-core.mjs`、`protocol-core.mjs`、`social-core.mjs`、`index.js` 与 `tests/`

## 4. 产物与接口

统一公开入口为 `v2/domain/index.mjs`，配套声明为 `v2/domain/index.d.mts`。

| 产物 | 路径 | 对外 API / 命令 | 不变量 |
|---|---|---|---|
| 公共记录与验证协议 | `v2/domain/common.mjs` | `ValidationIssue`结果约定、`normalizeV2Base`、`validateV2Base`、Evidence/Resource/Effect/Migration辅助函数 | 纯函数；有限数字；硬字段不可被extensions遮蔽；`valid/unresolved/rejected`可诊断 |
| 机械领域记录 | `v2/domain/mechanics.mjs` | `normalize/validateItemV2`、`normalize/validateEquipmentV2`、`normalize/validateSkillV2` | 不从描述猜效果；不从路径猜槽位；不从显示文本直接结算资源 |
| 状态领域记录 | `v2/domain/state.mjs` | `normalize/validateFact`、`Knowledge`、`SocialState`、`Quest`；`adjudicateSocialTransition`、`validateQuestTransition`、`validateClaimAdjudication` | 真相与知识分离；强制/自愿轴分离；终态任务不可重开；H0–H3只输出结构化结果 |
| 1.x只读适配 | `v2/domain/adapters.mjs` | 七个 `adaptLegacy*`、七个 `project*ToLegacy`、`parseLegacySkillCost` | 未知旧字段进入 `extensions.legacy`；歧义不猜；输入不修改；越界/循环数据隔离 |
| 类型声明 | `v2/domain/index.d.mts` | V2记录、Validation/Migration、适配配置、投影和公开验证器类型 | 与阶段1公开入口同源；阶段2可直接复用领域结果 |
| 领域行为测试 | `tests/v2-domain-core.test.mjs` | `node --test tests/v2-domain-core.test.mjs` | 覆盖纯函数、开放扩展、七类往返、迁移上限和拒绝/未决语义 |
| 回放行为测试 | `tests/v2-domain-replays.test.mjs` | `node --test tests/v2-domain-replays.test.mjs` | 直接读取真实fixture并调用领域API，不复制私聊、不特判卡片路径 |
| 回放激活元数据 | `fixtures/2.0/replay-cases.json`、`docs/2.0/replay-fixture.schema.json` | `automation.status=unit-active` | 只有四个阶段1领域用例激活；后续集成/真实层仍未完成 |

## 5. 数据与迁移

- 新增/改变的数据模型：新增公共 `V2Record`、`ValidationIssue`、`MigrationState`、`EvidenceRef`、`EffectV2`、`ResourceRef`，以及 ItemV2、EquipmentV2、SkillV2、Fact、Knowledge、SocialState、Quest、ClaimAdjudication。
- schemaVersion：V2记录固定为 `2.0`；fixture corpus仍为 `2.0-phase0`语料版本，四个case的自动化层升级为 `unit-active`。
- 1.x读取策略：调用 `adaptLegacyItem/Equipment/Skill/Fact/Knowledge/SocialState/Quest` 做惰性、纯函数、只读映射；字段别名、槽位system、资源别名和结算策略由调用方显式提供。
- 写回策略：阶段1不写宿主或1.x状态；`project*ToLegacy` 只是返回新的只读兼容投影。阶段2/4必须经事务内核后才能写。
- 未知字段保留证明：`tests/v2-domain-core.test.mjs` 对全部七个适配器验证嵌套未知字段进入 `extensions.legacy`，投影后值相等，且原输入不变。
- 无法迁移的数据与可见降级：无法证明的类型、效果数值、槽位、资源单位/策略、事实证据、知识证据、关系轴或任务状态返回 `unresolved`；冲突、非法或越界输入返回 `rejected` 且迁移态为 `quarantined`。
- 迁移安全上限：默认深度32、对象1000、字段5000、单文本10000字符；调用方可收紧。循环引用在投影前拒绝。
- 回滚方式：阶段1没有生产写入或数据迁移；撤销阶段1提交即可移除领域核。不得删除用户的未跟踪历史ZIP。

## 6. 已决决策与未决决策

| ID | 已决/未决 | 决策或问题 | 证据 | 影响 | 下一负责人 |
|---|---|---|---|---|---|
| D1-01 | 已决 | 验证统一返回 `valid/unresolved/rejected`；未决值可诊断但不能自动结算 | `DATA_TRANSACTION_PROTOCOL.md` 与 `common.mjs` | 阶段2事务prepare必须拒绝unresolved/rejected领域效果 | 阶段2 |
| D1-02 | 已决 | 阶段1不提供内置装备槽位词表；`system/slot/layer`为开放合同 | U0-01、RR-EQUIPMENT-SLOTS | 避免硬编码单一卡片；槽位注册由宿主/战役适配器提供 | 阶段4 |
| D1-03 | 已决 | 技能显示成本只在“数值+单位”语法、唯一显式资源别名、timing和refundable全部明确时映射 | U0-02、RR-SKILL-TEXT-COST | 任何语义歧义保持unresolved，不产生ResourceDelta | 阶段4 |
| D1-04 | 已决 | 1.x未知字段保存在 `extensions.legacy`，原生V2未知根字段进入开放 `extensions` | D0-04与七类往返测试 | 升级/降级只读投影不丢作者扩展 | 全阶段 |
| D1-05 | 已决 | 强制轴与自愿轴分别存储和裁定；证据只授权对应轴 | RR-SOCIAL-COERCION-VOLUNTARY | 有证据的控制变化可保留，无证据好感/信任回滚 | 阶段4 |
| D1-06 | 已决 | 阶段1只建立H0–H3结构化结果，不实现分类器或主模型接入 | 路线图严格非目标 | 阶段3复用类型并实现证据化语义裁决 | 阶段3 |
| U1-01 | 未决 | 宿主缺少稳定逻辑消息ID时，MessageFingerprint各组成字段的优先级 | U0-04、阶段2范围 | 决定迟到结果与旧轮回复能否被精确拒绝 | 阶段2 |
| U1-02 | 未决 | 单写入队列、宿主写前日志与V2 Transaction状态机的最小桥接接口 | 阶段2路线图 | 决定prepare/commit/rollback与1.x兼容边界 | 阶段2 |
| U1-03 | 未决 | 战役槽位/资源注册表的生命周期、版本与分支归属 | D1-02/D1-03只冻结调用边界 | 不阻塞纯领域验证，阻塞阶段4真实惰性迁移 | 阶段4 |
| U1-04 | 未决 | H2默认检定/代价规则从战役配置注入的具体接口 | U0-03 | 不阻塞结果类型，阻塞导演层自动生成命令 | 阶段3 |

阶段1自身没有仍会改变本阶段领域核完成结论的未决项；上表未决项均明确延后到对应阶段。

## 7. 测试与验收

```text
命令：node --check v2/domain/common.mjs；mechanics.mjs；state.mjs；adapters.mjs
退出码：0
结论：四个领域运行时模块语法检查通过。

命令：node --test tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs tests/v2-replay-fixtures.test.mjs
退出码：0
结论：32项；26通过，6项未来阶段todo，0失败。

命令：node --test tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs tests/v2-replay-fixtures.test.mjs tests/protocol-core.test.mjs tests/social-core.test.mjs
退出码：0
结论：56项；50通过，6项未来阶段todo，0失败。

命令：npm.cmd test
退出码：0
结论：65项；59通过，6项未来阶段todo，0失败；browser-runtime约129秒。

命令：npm.cmd run qc:ci
退出码：0
结论：Tracked QC report passed for v1.9.0。

命令：npm.cmd run qc:record
退出码：0
结论：为交接提交 2862cd34b57d 记录QC receipt。

命令：npm.cmd run qc:gate
退出码：0
结论：Real-environment QC gate passed for 2862cd34b57d。

命令：git diff --cached --check
退出码：0
结论：提交前无空白或补丁格式错误。
```

- 新增结构测试：V2基础记录、ValidationIssue/MigrationState语义、开放扩展、硬字段冲突、有限数字、迁移输入上限。
- 新增行为测试：七类记录验证与1.x往返；物品效果、技能成本、装备槽位、社会强制/自愿四个真实fixture领域行为。
- 既有相关回归：protocol、social及完整默认套件通过。
- 浏览器测试：完整 `npm test` 中通过。
- 真实 SillyTavern QC：未执行；阶段1没有修改打包运行时、宿主桥、DOM、数据库或生产写入，属于无宿主纯领域模块。真实层不能由模拟冒充，按路线图留到后续阶段。
- fixture 覆盖：17/17历史故障族仍由schema/覆盖/引用/隐私测试验证；4/17为阶段1 `unit-active`，13/17保持 `structural-only`。
- 未激活的todo/pending行为及激活条件：测试文件保留6个阶段级todo；阶段2激活指纹/重Roll，阶段3激活玩家边界/裁定/Fact/Knowledge，阶段4为四个领域用例补事务integration与real-replay，阶段5–7按路线图继续。

## 8. 隐私与安全检查

- 增量密钥扫描命令与结果：对 `git diff --cached --unified=0` 以常见OpenAI、GitHub、Google、Slack、Bearer和账号URL模式扫描，命中均为0。
- 私人正文扫描命令与结果：阶段1差异文件名中 `.jsonl`、`.zip`、`.sqlite`、`.db` 为0；未加入完整聊天、数据库或归档。fixture仍为阶段0脱敏最小等价样本。
- fixture 最大文本长度：输入树最大字符串39字符；schema单字段上限600字符。
- 是否包含绝对用户目录：否；增量扫描命中0。
- 是否读取但未修改私有归档：没有从私有归档覆盖生产代码；10个本地历史ZIP未读取、未修改、未暂存、未删除。
- 其他敏感数据处理：没有读取、修改或输出API密钥；没有外部模型/API调用；领域模块没有宿主、网络、DOM、存储或数据库依赖。

## 9. 差异审计

- `git status --short --branch`：产物提交后仅有10个既存、未跟踪的 `dist/` 历史ZIP。
- `git diff --stat f04b68176318286826e53c1548bd6672323bb1bb...a1244f8b4cd55018d375ed605a6fa2793cc70040`：16个文件，4032行新增，30行删除。
- 预期文件：`v2/domain/`、两个新增领域测试、阶段0 fixture测试、四个权威/索引文档、schema、fixture和CHANGELOG。
- 生产运行时差异：`index.js`、`manifest.json`、`package.json` 均无差异。
- 无关文件：10个 `dist/` 离线ZIP。
- 无关文件如何被保留/排除：未执行reset或覆盖性checkout；每次只按显式路径 `git add`；暂存文件中二进制和 `dist/` 均为0。

## 10. 已知风险

| 风险 | 触发条件 | 影响 | 当前缓解 | 下一阶段动作 |
|---|---|---|---|---|
| 四个回放目前只有领域unit层 | 把unit通过误当成事务/真实环境完成 | 仍可能发生部分写入或宿主竞态 | fixture和矩阵明确标注unit-active | 阶段2/4补事务与真实回放 |
| 槽位系统没有内置词表 | 宿主未提供战役槽位合同 | 合法旧装备保持unresolved | 不猜槽位并保留旧字段 | 阶段4实现版本化注册适配 |
| 技能成本解析故意严格 | 旧文本包含复合成本、自然语言或未知单位 | 无法自动迁移 | 返回可见unresolved，不扣资源 | 阶段4提供显式资源注册与人工确认路径 |
| 1.x对象可包含非常大的开放字段 | 未限制输入会造成复制成本或循环结构 | 性能/内存风险 | 适配前执行可配置上限与循环检测 | 阶段7按真实数据做容量演练 |
| 领域API尚未进入事务prepare | 调用方绕过状态检查直接使用value | unresolved值可能被误写 | 结果显式携带ok/status/issues | 阶段2事务入口只接受valid结果 |

## 11. 运行与故障恢复

- 可观察状态：每次归一化/验证/迁移返回确定性的 `status`、`issues` 和迁移态；无后台任务。
- 软取消：不适用；阶段1函数同步、纯计算且不启动任务。
- 硬超时/看门狗：不适用；阶段1无宿主任务。TaskLease与看门狗属于阶段6。
- 迟到结果处理：不适用；阶段1不接模型或消息。阶段2必须用MessageFingerprint拒绝迟到结果。
- 写前恢复记录：不适用；阶段1没有写入。阶段2接入1.x写前日志。
- 写后回读：不适用；阶段1没有写入。阶段2完成门要求精确目标回读。
- 手动恢复步骤：如需撤销，只撤销阶段1提交；不执行生产数据迁移，不删除10个用户历史ZIP。对单条旧记录，可继续使用1.x只读源并查看适配器issues。

## 12. 下一阶段准确入口

```text
从阶段1产物提交 a1244f8b4cd55018d375ed605a6fa2793cc70040 与 PHASE_1_HANDOFF.md 所在交接提交开始“阶段2：消息身份、分支与事务内核”。

开始前完整读取 AGENTS.md、README.md、CHANGELOG.md、manifest.json、package.json、TODO.md、docs/2.0/ 全部权威文件、PHASE_0_HANDOFF.md、PHASE_1_HANDOFF.md、v2/domain/ 全部源码与 tests/v2-domain-*.test.mjs，并检查现有1.x targetIsCurrent、写前日志、写后回读、撤销、continuity与分支checkpoint实现。先检查git状态，继续保留10个既存未跟踪dist ZIP。

允许新增/修改 v2/transaction/、必要的宿主桥接接口、对应 tests/、fixtures/2.0/自动化元数据、必要的 docs/2.0/协议澄清和 PHASE_2_HANDOFF.md；只有在最小桥接测试要求时才修改现有1.x模块。不得接UI、主模型语义裁决、数据库或阶段4领域写入。

第一个实现API是纯函数 MessageFingerprint、Branch、Transaction 与幂等键，再实现 prepare/commit/abort/rollback/stale 状态机和单写入队列接口。首先让 RR-FINGERPRINT-PREVIOUS-REPLY 与 RR-REROLL-IDEMPOTENCY 调用真实API：同分支同幂等键最多提交一次，旧分支和迟到结果不能写当前分支，路径级回滚保留外部并发合法变化。

必须保持 v2/domain/ 的 valid/unresolved/rejected、未知字段往返、显式槽位/资源配置和无宿主纯函数行为；完整 npm test 不得回归。完成前运行相关新增测试、npm.cmd test、npm.cmd run qc:ci，提交后运行 npm.cmd run qc:record 与 npm.cmd run qc:gate，做增量密钥/私人内容扫描和差异审计并填写阶段2交接。

禁止硬编码“无限回廊”变量路径，禁止用显示文本直接结算资源，禁止用禁词正则代替语义裁决，禁止接外部模型或输出API密钥，禁止复制完整私聊/私有归档，禁止修改、暂存或删除10个历史dist ZIP，禁止把未来阶段行为做成默认失败CI，禁止合并main。
```

## 13. 发布状态

- 本地提交：阶段1产物 `a1244f8b4cd55018d375ed605a6fa2793cc70040`；交接记录 `2862cd34b57d5cb17e6634de2991186aebe1fee5`
- 远端分支：`codex/v2.0-phase1-domain-core`
- PR状态（draft/ready）：draft，`https://github.com/magilittle0-byte/mvu-auto-doctor/pull/21`
- 基础分支：`codex/v2.0-phase0-spec-replay-baseline`
- 是否合并 main：否；只创建可审阅Draft PR
- 外部阻塞：无；本地 `gh` 凭据无效，但已连接GitHub应用已成功创建Draft PR
