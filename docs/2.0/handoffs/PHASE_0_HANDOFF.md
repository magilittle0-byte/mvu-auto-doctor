# MVU Auto Doctor 2.0 阶段0交接

## 1. 身份

- 阶段：0，产品规格、数据/事务协议与真实故障回放基线
- 交付日期：2026-07-26
- 仓库：`mvu-auto-doctor-v1.8-hotfix`
- 分支：`codex/v2.0-phase0-spec-replay-baseline`
- PR：以本文件所在分支的远端 draft PR 为准
- 基础提交 SHA：`7d761ba6af1ceb10ab3ea5947c0bb25ee1b72566`
- 阶段0产物提交 SHA：`f5d003e777a4f20dcc9d9d410455d9183d3abba6`
- 交接记录提交 SHA：本文件属于紧随上述产物提交的纯交接提交；用 `git log -1 -- docs/2.0/handoffs/PHASE_0_HANDOFF.md` 获取，避免把内容寻址提交的自身 SHA 写入自身
- 工作区是否仍有未提交修改：没有属于阶段0的未提交修改
- 未提交修改是否属于用户且已保留：是；10个历史 `dist/` 离线ZIP保持未跟踪且未暂存

## 2. 本阶段范围

- 授权目标：冻结2.0产品边界、V2数据/事务协议、脱敏真实故障回放基线、阶段1至7路线图和交接规则。
- 明确非目标：不接外部模型，不修改1.x生产运行时，不迁移真实用户数据，不改变 manifest/package 版本，不合并 main。
- 实际完成：4份权威规格、索引、交接模板、JSON Schema、17个最小 fixture、结构/隐私/引用测试、CHANGELOG阶段0说明。
- 有意未做：没有实现任何2.0行为；未来行为测试保持 `todo`，按 `automation.activateAt` 逐阶段接入。

## 3. 权威文件

- 产品规格：`docs/2.0/PRODUCT_SPEC.md`
- 数据/事务协议：`docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- 回放矩阵：`docs/2.0/REAL_REPLAY_ACCEPTANCE_MATRIX.md`
- 路线图：`docs/2.0/PHASE_ROADMAP.md`
- fixture schema：`docs/2.0/replay-fixture.schema.json`
- fixture corpus：`fixtures/2.0/replay-cases.json`
- 阶段交接模板：`docs/2.0/PHASE_HANDOFF_TEMPLATE.md`
- 上一阶段交接：无，阶段0是2.0首个阶段
- 1.x实现依据：当前提交祖先中的 `core.mjs`、`continuity-core.mjs`、`protocol-core.mjs`、`social-core.mjs`、`forum-core.mjs`、`model-queue.mjs`、`index.js` 及现有测试

## 4. 产物与接口

| 产物 | 路径 | 对外 API / 命令 | 不变量 |
|---|---|---|---|
| 权威规格入口 | `docs/2.0/README.md` | 人工与任务入口 | 冲突优先级明确，不以1.x偶然形态覆盖2.0协议 |
| 产品规格 | `docs/2.0/PRODUCT_SPEC.md` | 文档契约 | 叙事优先；重大行动权、资源/事务、分支、结构、知识为硬边界 |
| 数据/事务协议 | `docs/2.0/DATA_TRANSACTION_PROTOCOL.md` | 阶段1实现契约 | 硬字段 + 开放扩展；指纹、分支、幂等、写回验证 |
| 回放矩阵 | `docs/2.0/REAL_REPLAY_ACCEPTANCE_MATRIX.md` | `RR-*` / `replay.*` 映射 | 真实环境证据高于模拟 |
| 回放语料 | `fixtures/2.0/replay-cases.json` | 17个 `operation.kind` 输入 | 脱敏最小文本；阶段0仅结构验证 |
| 结构测试 | `tests/v2-replay-fixtures.test.mjs` | `node --test tests/v2-replay-fixtures.test.mjs` | schema、覆盖、引用、隐私必须同时通过 |

## 5. 数据与迁移

- 新增/改变的数据模型：仅文档协议，包含 ItemV2、EquipmentV2、SkillV2、Fact、Knowledge、SocialState、Quest、MessageFingerprint、Branch、Transaction、TaskLease。
- schemaVersion：fixture 为 `2.0-phase0`；V2记录协议为 `2.0`。
- 1.x读取策略：阶段1实现纯函数只读/惰性适配；无法证明的数值、槽位、单位或证据标为 `unresolved`。
- 写回策略：阶段0无写回；未来只允许单一V2权威源，通过1.x只读投影兼容旧UI。
- 未知字段保留证明：协议要求进入 `extensions.legacy`；实际往返证明属于阶段1完成门。
- 无法迁移的数据与可见降级：保持1.x只读可见并显示迁移缺口，禁止猜值。
- 回滚方式：阶段0没有生产数据或运行时变更；Git撤销本阶段文档/测试提交即可。

## 6. 已决决策与未决决策

| ID | 已决/未决 | 决策或问题 | 证据 | 影响 | 下一负责人 |
|---|---|---|---|---|---|
| D0-01 | 已决 | 2.0是共创式跑团运行层，不是表单审批器 | `PRODUCT_SPEC.md` | 所有模块默认叙事优先 | 全阶段 |
| D0-02 | 已决 | H0–H3按影响裁定，关键词正则不能作最终语义裁决 | 产品规格与真实暗号事故 | 阶段3须返回可解释结构对象 | 阶段3 |
| D0-03 | 已决 | 私有证据只转成最小等价 fixture，不作为CI文件依赖 | 回放矩阵与隐私测试 | 公开仓库不含完整聊天 | 全阶段 |
| D0-04 | 已决 | 1.x未知字段保留，歧义数据不猜值 | 数据/事务协议 | 阶段1适配器必须可逆、可诊断 | 阶段1 |
| U0-01 | 未决 | 通用装备槽位ID的最小内置词表与战役扩展注册方式 | 旧数据只有路径，且不能硬编码单一卡片 | 决定 EquipmentV2 validator API | 阶段1 |
| U0-02 | 未决 | 1.x技能成本文本的可配置单位别名表 | “20MP”“15 耐力”只能在唯一映射时转换 | 决定 SkillV2迁移诊断 | 阶段1 |
| U0-03 | 未决 | H2默认检定/代价策略如何从战役规则提供 | 产品规格只冻结结果类型，不冻结单一规则制 | 不阻塞领域类型，阻塞导演接入 | 阶段3 |
| U0-04 | 未决 | 宿主缺少稳定逻辑消息ID时的指纹适配优先级 | 当前1.x已有复合目标检查，但V2需统一封装 | 决定 MessageFingerprint宿主桥 | 阶段2 |

## 7. 测试与验收

```text
命令：node --test tests/v2-replay-fixtures.test.mjs
退出码：0
结论：10项；4项结构/覆盖/隐私/引用通过，6项未来行为为todo。

命令：node --test tests/v2-replay-fixtures.test.mjs tests/protocol-core.test.mjs tests/continuity-core.test.mjs tests/social-core.test.mjs tests/model-queue.test.mjs tests/forum-core.test.mjs
退出码：0
结论：39项；33通过，6项todo，0失败。

命令：npm.cmd test
退出码：0（Node汇总：43项，37通过，6项todo，0失败）
结论：完整单元与浏览器运行时回归通过；browser-runtime约129秒。

命令：npm.cmd run qc:ci
退出码：0
结论：Tracked QC report passed for v1.9.0。

命令：git diff --cached --check
退出码：0
结论：无空白或补丁格式问题。
```

- 新增结构测试：`tests/v2-replay-fixtures.test.mjs`
- 新增行为测试：未激活；6个阶段级 `test.todo`
- 既有相关回归：通过
- 浏览器测试：完整 `npm test` 中通过
- 真实 SillyTavern QC：未执行；阶段0未修改打包运行时，按 `AGENTS.md` 的纯文档豁免处理
- fixture 覆盖：17/17要求故障族
- 未激活行为及条件：见每个 fixture 的 `automation.activateAt` 与回放矩阵“激活规则”

## 8. 隐私与安全检查

- 增量密钥扫描结果：OpenAI/Google/GitHub/Slack样式密钥、Bearer凭据、含账号URL均为0。
- 私人正文扫描结果：暂存区没有 `.jsonl`、`.zip`、`.sqlite` 或 `.db`；fixture均为 `minimal-derived`。
- fixture 最大文本长度：39字符；schema上限600字符。
- 是否包含绝对用户目录：否。
- 是否读取但未修改私有归档：是。
- 外部模型/API调用：无。

## 9. 差异审计

- `git status --short --branch`：阶段0提交后仅有10个既存、未跟踪的 `dist/` 历史ZIP。
- 阶段0产物提交：10个文件、3094行新增；仅 `CHANGELOG.md`、`docs/2.0/`、`fixtures/2.0/`、`tests/v2-replay-fixtures.test.mjs`。
- 预期文件：上述权威规格、schema、fixture、结构测试和更新日志。
- 无关文件：10个 `dist/` 离线ZIP。
- 保留/排除方式：从未执行 reset/checkout；只用显式路径 `git add`，ZIP没有暂存、修改或删除。

## 10. 已知风险

| 风险 | 触发条件 | 影响 | 当前缓解 | 下一阶段动作 |
|---|---|---|---|---|
| 文档协议尚无运行时实现 | 把阶段0误当成2.0功能完成 | 形成虚假安全感 | README、schema和测试都标记 `structural-only` | 阶段1从纯领域核开始 |
| fixture过度最小化 | 实现只对短样本特判 | 真实长局仍失败 | 禁止正则作语义核心，阶段6升级真实回放 | 每阶段增加等价变体而不复制私聊 |
| 槽位/成本别名尚未冻结 | 阶段1过拟合单一卡片 | 失去通用性 | 协议允许战役配置与unresolved | 先设计注册接口再写适配 |
| 当前分支基于既有开发分支 | 直接以main作PR基础会混入祖先差异 | 审阅噪声 | 使用堆叠PR基础分支 | 合并上游后再rebase/retarget，由维护者决定 |

## 11. 运行与故障恢复

- 可观察状态：阶段0只有测试输出和fixture元数据，没有后台任务。
- 软取消：不适用；没有生产任务。
- 硬超时/看门狗：仅协议和 `RR-TASK-WATCHDOG` fixture，阶段6实现。
- 迟到结果处理：仅协议和指纹fixture，阶段2实现。
- 写前恢复记录：阶段0无生产写入；阶段2复用并升级1.x写前日志。
- 写后回读：阶段0无生产写入；阶段2完成门要求精确指纹回读。
- 手动恢复步骤：若需撤销阶段0，只撤销阶段0提交；不得删除私有证据或用户的未跟踪ZIP。

## 12. 下一阶段准确入口

```text
从阶段0产物提交 f5d003e777a4f20dcc9d9d410455d9183d3abba6 与其交接提交所在分支头开始“阶段1：V2领域核与协议验证器”。

开始前完整读取仓库 AGENTS.md、README.md、CHANGELOG.md、manifest.json、package.json、TODO.md、docs/2.0/ 全部权威文件、本交接、现有 core/continuity/protocol/social 模块和 tests/ 结构；先检查git状态并保留10个既存未跟踪dist ZIP。

只新增/修改 v2/domain/、对应 tests/、必要的 docs/2.0/ 协议澄清和阶段1交接；不得接宿主写入、主模型、数据库或UI，不得改写1.x生产状态。

第一个实现入口是无宿主依赖的 V2记录公共类型、ValidationIssue/MigrationState、开放 extensions 保留和1.x纯函数适配器。优先让 RR-ITEM-CONSUMABLE-EFFECT、RR-SKILL-TEXT-COST、RR-EQUIPMENT-SLOTS、RR-SOCIAL-COERCION-VOLUNTARY 成为真实行为测试：歧义字段返回 unresolved/reject，未知旧字段往返不丢失。

必须保持1.x测试全绿、不硬编码“无限回廊”路径、不从显示文本直接结算资源、不用正则禁词作语义裁决、不读取或提交完整私聊、不调用外部模型。完成门、命令和阶段2所需API按 PHASE_ROADMAP.md 与 PHASE_HANDOFF_TEMPLATE.md 执行。
```

## 13. 发布状态

- 本地提交：阶段0产物提交已完成；交接提交紧随其后
- 远端分支：`codex/v2.0-phase0-spec-replay-baseline`
- PR状态：draft
- 基础分支：`codex/v1.8.14-versioned-scenario-plan`，以堆叠差异隔离阶段0
- 是否合并 main：否；只创建可审阅PR
- 外部阻塞：本地 `gh` 凭据无效；优先使用已连接GitHub应用创建PR
