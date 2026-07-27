# MVU Auto Doctor 2.0 阶段5交接

## 1. 身份

- 阶段：5，自然语言与 UI 双入口
- 交付日期：2026-07-27
- 仓库：`magilittle0-byte/mvu-auto-doctor`
- 本地分支：`codex/v2.0-phase5-natural-language-ui`
- 远端堆叠 base：`codex/v2.0-phase4-domain-transactions`
- 本地阶段4起点：`18abfc4005246a5d8b5c0f36851d0f9ab5e0d5f8`
- 远端阶段4起点：`715de8e13f15ab3498557064c395df6bce6ba768`
- 阶段4共同最终 tree：`8bfc0172346530a4f58a14c13a355803c16f3e9f`
- 阶段5实现提交：本地 `1804cc4aae28c89de4e8e3c4ed76d70e75be4a86`；
  远端 `00256dc60719624cc54a46873f0b3630b7933dc2`；共同 tree
  `fa7631e69f8949612ce9d3dca1efd0ae8ee4c83c`
- 阶段5交接/发布提交：本文件自身承载最终发布回填；准确最终本地/远端 HEAD 与
  tree 以分支和 Draft PR headRefOid 为准，避免在提交内容中伪造自引用 SHA
- Draft PR：[`#25`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/25)，
  base 为 `codex/v2.0-phase4-domain-transactions`
- 用户已有未跟踪修改：10 个 `dist/*.zip`，均保留，未暂存、删除、覆盖、改名或重置

## 2. 本阶段范围

- 授权目标：把自然语言意图和可见 UI 动作适配成同一个结构化
  `DomainCommand` candidate，再依次通过阶段3 Turn Boundary/裁定、
  `validateDirectorDomainCommand` 和 `planDirectorDomainTransaction`。
- 实际完成：新增无宿主纯适配 API、双源等价比较、确认摘要、白名单诊断视图、
  390×844 导演台、键盘焦点陷阱、受控披露、可选 V2 宿主桥和生产入口。
- 明确未做：阶段6数据库、看门狗、正文稳定下游屏障、持久 IdempotencyStore；
  阶段7发布候选；任何绕过阶段4/TransactionKernel的直接状态写入。
- 生产默认：宿主没有提供 `window.MvuAutoDoctorV2Host.captureSession()` 时只读并显示
  unresolved；没有可执行的 valid proposal 时确认和执行均不能绕过门禁。

## 3. 权威文件

开始前完整读取并以当前本地阶段4源码为准：

- 根：`AGENTS.md`、`README.md`、`CHANGELOG.md`、`manifest.json`、
  `package.json`、`TODO.md`
- 2.0 权威集：`docs/2.0/` 全部文件
- 交接：`PHASE_0_HANDOFF.md` 至 `PHASE_4_HANDOFF.md`
- 实现与声明：`v2/domain/`、`v2/transaction/`、`v2/director/`、
  `v2/domain-transaction/` 全部文件
- 回归：全部 `tests/v2-*.test.mjs`、生产浏览器运行时测试和最小 replay fixture

## 4. 产物与公开接口

| 产物 | 路径 | 公开 API / 用途 | 主要不变量 |
| --- | --- | --- | --- |
| 双源适配与规划 | `v2/surface/core.mjs` | `adaptNaturalLanguageIntent`、`adaptUiAction`、`planDualSurfaceDomainAction`、`compareDualSurfaceParity` | 两入口共享显式 action catalog；自然语言只允许精确登记语句或显式 actionId+semanticBasis；不猜槽位、数值或事实 |
| 白名单诊断 | `v2/surface/diagnostics.mjs` | `createDualSurfaceViewModel`、`diagnosticContainsSensitiveMaterial` | 显示裁定、事务、分支、证据、迁移和撤销；只显示安全摘要/哈希，不回显自然语言、完整提示词、密钥、证据正文或私人路径 |
| 可访问导演台 | `v2/surface/ui.mjs` | `installDualSurfaceUI`、`setControlledDisclosure` | 390×844、44px 控件、焦点陷阱、Esc 只关闭本层并回焦、确认摘要绑定目标 |
| 统一导出与类型 | `v2/surface/index.mjs`、`index.d.mts` | 阶段5全部公开常量、接口和函数 | `DUAL_SURFACE_VERSION = 2.0-phase5`；公开声明覆盖实现 |
| 生产桥 | `index.js`、`style.css` | `openDirectorSurface`、`previewNaturalLanguageAction`、`previewUiAction`、`getDirectorSurfaceView` | 可选 V2 host；执行只调用 `executePlannedDomainTransaction`；无 host 不写；收起悬浮球不扩大页面滚动宽度 |
| 阶段5测试 | `tests/v2-surface-core.test.mjs`、`tests/v2-surface-browser.test.mjs` | 双源等价、安全门、隐私、触控/键盘回归 | 物品、装备、技能、社会、任务的 command/幂等键/前置条件/proposal 精确一致 |

允许的阶段4原生命令保持为：

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

生产宿主最小约定：

```text
window.MvuAutoDoctorV2Host.captureSession()
window.MvuAutoDoctorV2Host.executePlannedDomainTransaction(plan)   // 可选
window.MvuAutoDoctorV2Host.rollbackDomainTransaction()             // 可选
```

## 5. 数据、迁移与回滚

- 新增模型：`SurfaceActionCatalogEntry`、`SurfaceCommandCandidate`、
  `DualSurfaceSession`、`DualSurfaceResolution`、`DualSurfaceViewModel`。
- 协议文档版本：`2.0.0-draft.5`；阶段1—4记录和事务 schema 不变。
- 未知字段：catalog extension 和 command payload 未知字段继续规范化往返；
  不允许未知命令类型借 extension 绕过阶段4白名单。
- 迁移：阶段4惰性迁移诊断仅投影到 UI；pending/unresolved/quarantined 始终可见，
  不因打开导演台而写回。
- 回滚：UI 只显示并调用宿主提供的保守 rollback；没有恢复记录时不可用；
  精确 compare-and-restore 语义仍由阶段2内核负责。

## 6. 已决策与未决策

| ID | 状态 | 决策或问题 | 影响 | 下一阶段 |
| --- | --- | --- | --- | --- |
| P5-ENTRY-01 | 已决 | 自然语言和 UI 共用显式 action catalog，并汇入同一个 candidate→Turn Boundary→领域验证→事务规划管线 | 任一表面都不能成为硬边界或绕过导演/指纹/分支/证据/配置/事务门 | 保持 |
| P5-NL-01 | 已决 | 自然语言只接受精确登记语句，或调用方显式 actionId 与非空 semanticBasis | 模糊、未知、缺槽位一律 unresolved，不用正则禁词充当最终裁决 | 保持 |
| P5-CONFIRM-01 | 已决 | 所有动作都要求目标绑定的确认摘要；更换命令或 MessageFingerprint 会改变 digest | 旧确认不能重放到新目标或新动作 | 阶段6持久化确认/幂等记录 |
| P5-PRIVACY-01 | 已决 | 诊断使用字段白名单、计数与 SHA-256 摘要 | 不暴露私人事实、证据正文、输入、完整提示词、密钥或本机路径 | 保持 |
| P5-HOST-01 | 已决 | V2 host 为可选桥；缺失时 UI 只读 unresolved | 当前 1.x 生产运行时不会被阶段5界面直接写状态 | 阶段6提供稳定宿主屏障 |
| P5-CONFIG-01 | 未决 | 战役配置的生产存储、版本选择与编辑/只读权限仍无统一宿主来源 | 缺配置动作保持 unresolved；UI 只显示缺口 | 阶段6固化宿主配置来源 |
| P2-OPEN-01 | 未决 | 持久 IdempotencyStore 与 recovery 容器尚未接生产宿主 | 无法证明跨重启耐久去重/恢复 | 阶段6 |

没有其他会改变阶段6实现方向但未记录的产品决策。

## 7. 测试与验收

```text
命令：node --test tests/browser-runtime.test.mjs tests/v2-surface-browser.test.mjs tests/v2-surface-core.test.mjs
退出码：0
结论：7/7 通过；完整生产浏览器运行时、双入口与390×844界面均通过。

命令：npm.cmd test
退出码：0
结论：124 total，122 pass，0 fail，2 todo；阶段0—5无回归。

命令：git diff --check
退出码：0
结论：无空白错误。

命令：npm.cmd run qc:fingerprint
退出码：0
结论：当前运行时代码指纹为 3f5416205b9d32ff6c3ec882c1cde421a7a1f85014d73b943184f357c352098e。

命令：npm.cmd run qc:ci
退出码：0
结论：阶段5运行时指纹、完整自动化、真实模型、论坛和移动端证据均与报告一致。

命令：npm.cmd run qc:record
退出码：0
结论：为实现提交 1804cc4aae28 记录真实环境 QC 回执。

命令：npm.cmd run qc:gate
退出码：0
结论：实现提交 1804cc4aae28 的真实环境 QC gate 通过。
```

- 核心等价：物品、装备、技能、社会和任务从两入口得到完全相同的规范化命令、
  command digest、确认 digest、裁定、稳定幂等键、精确前置条件、write plan 和
  Transaction proposal。
- 拒绝路径：模糊语句、缺 semanticBasis、缺配置、负玩家约束、陈旧指纹、错误确认、
  未知命令类型均为 unresolved/rejected 且零 transaction。
- 真实浏览器：真实 SillyTavern 1.18.0/`8172dcd`、390×844 和桌面视口；
  导演台 footer/执行键在视口内、最小控件 44px、无横向溢出、焦点回归、Esc 不冒泡。
- 真实论坛：凭据获批后的全新刷新生成第 1 页、4 个主题、8 条评论；完整面板
  390×844，shell 390/390；评论展开/收起、ARIA、正文末尾和零尺寸隐藏回复均通过，
  整页重载后 4 个主题和 8 条评论仍存在。
- 真实模型：2026-07-27 通过本地临时内存代理调用 `deepseek-v4-flash` 1 次，上游
  HTTP 200、耗时 13110ms。凭据由用户拥有的 Windows DPAPI current-user 密文源
  临时注入；代理自身不持久化凭据。验收后先清空 `/credential` 再停止进程，
  9328 监听已关闭；报告、日志、提交和交接均不含密钥或原始模型 payload。

fixture 状态：阶段5 `RR-UI-ANDROID-EXPAND` 已从 future 提升为 `unit-active`；
阶段6、7各自 TODO 保持非默认失败。

## 8. 隐私与安全

- 增量密钥扫描：对 3424 条暂存新增行扫描 Bearer、常见云/API key、token、
  client secret、password 赋值形态；活密钥形态 0 命中。
- 私人内容扫描：同一批新增行的绝对用户目录 0 命中。宽松的 `.jsonl`、
  `.sqlite/.db`、Cookie、private chat/archive 词法规则命中 5 行：本交接的扫描说明
  2 行、`tests/v2-surface-core.test.mjs` 的合成隐私攻击样本 3 行；均不含私人正文、
  绝对路径或真实归档。
- 真实浏览器读取只用于计数、几何、状态和可访问属性；本文件不复制私人聊天、
  原始模型 payload、完整提示词或用户目录。
- 真实模型代理 `/metrics` 只记录字节数、模型、状态与耗时；成功验收后凭据已清空，
  代理已停止。用户的可复用凭据只保存在仓库外的 Windows DPAPI current-user 密文中。
- 10 个历史离线 ZIP 保持未跟踪且排除在所有暂存/提交之外。

## 9. 差异审计

- 预期范围：`v2/surface/`、两份阶段5测试、`index.js`、`style.css`、
  browser/replay 回归、2.0 权威文档、README/CHANGELOG、fixture 和本交接。
- 特别修正：收起的右/左悬浮球改为位于视口内并用 `clip-path` 只显示把手；
  收起态伪元素不再用负 inset 扩大滚动范围。
- 无关文件：仅 10 个用户已有 `dist/*.zip`；明确路径暂存前必须再次确认
  `git diff --cached --name-only -- dist` 为空。

## 10. 已知风险

| 风险 | 触发条件 | 当前缓解 | 阶段6动作 |
| --- | --- | --- | --- |
| 生产 V2 host 尚未由稳定屏障提供 | `captureSession` 不存在 | UI 明确只读 unresolved，执行键禁用 | 接稳定下游屏障与持久宿主 |
| 配置来源不统一 | action 缺槽位/资源/check/effect binding | 绝不猜测；问题、证据和迁移缺口可见 | 版本化配置容器 |
| 进程重启后的幂等与恢复 | 仅内存 kernel | 阶段2接口和保守回滚语义保持 | 数据库/看门狗/恢复自动化 |
| 外部模型凭据泄漏 | 调试输出、报告或仓库误收录凭据 | DPAPI current-user 密文源；只向临时内存代理注入；结束时清空并停止 | 保持相同代理边界和增量密钥扫描 |

## 11. 运行与故障恢复

- 可观测：视图公开 decision、issues、command/confirmation 摘要、事务路径数、
  branch/fingerprint 摘要、证据计数、迁移状态和 rollback 能力。
- 软取消：阶段5自身不拥有后台模型任务；关闭导演台只移除 UI，不提交计划。
- 硬超时/看门狗：不适用，属于阶段6。
- 迟到结果：提交前由阶段2/4重新捕获当前指纹和 active branch；不匹配零写入。
- 写前恢复与写后回读：仍由 `executePlannedDomainTransaction`/TransactionKernel 负责。
- 手动恢复：只有宿主报告可恢复记录时 UI 才开放撤销；恢复仍只覆盖匹配写后值的路径。

## 12. 阶段6准确入口

仅在本文件第7节的真实模型/QC门完成、阶段5本地/远端最终 HEAD 与 tree 核对一致、
堆叠 Draft PR 和远端 CI 均终态成功后，才可把以下指令交给新的独立 Codex 任务：

```text
负责“MVU Auto Doctor 2.0 阶段6：稳定屏障、下游和真实回放自动化”。
从阶段5最终本地 HEAD 建立独立本地分支；远端堆叠分支必须以阶段5远端最终 HEAD
为唯一父提交，并以 codex/v2.0-phase5-natural-language-ui 为 Draft PR base，
不得合并 main。开始前完整读取 AGENTS.md、根权威文件、docs/2.0/ 全部权威文件、
阶段0—5交接、v2/domain/、v2/transaction/、v2/director/、
v2/domain-transaction/、v2/surface/ 全部源码/声明和全部 v2 测试。

严格按 PHASE_ROADMAP.md 实现正文稳定屏障、下游适配、生产持久 IdempotencyStore/
recovery、数据库和看门狗、迟到/旧分支零写入以及真实回放自动化。第一个 API 应把
阶段5已确认的 DomainTransactionPlan 放入持久、可取消、可恢复的宿主执行屏障，
在任何正文/下游观察到状态前完成精确写入与回读；失败只保守恢复仍匹配写后值的路径。
保持阶段1—5全部不变量，禁止主模型成为唯一硬边界、禁止直接写状态、禁止把阶段7
发布候选门做成默认失败 CI、禁止合并 main。

完成门：阶段0—6回归、完整 npm.cmd test、真实 SillyTavern/真实模型/390×844、
qc:ci，提交后 qc:record/qc:gate，增量密钥/私人内容扫描、差异审计、
PHASE_6_HANDOFF.md、独立远端堆叠 Draft PR 和远端 CI 终态成功。完成后按同样方式
自动创建阶段7独立任务并交接，不在同一任务中实施阶段7。
```

## 13. 发布状态

- 本地提交：实现 `1804cc4aae28c89de4e8e3c4ed76d70e75be4a86`；
  本文件发布回填提交以最终 `git log` 为准
- 远端分支：`codex/v2.0-phase5-natural-language-ui`；实现提交
  `00256dc60719624cc54a46873f0b3630b7933dc2` 以远端阶段4 HEAD
  `715de8e13f15ab3498557064c395df6bce6ba768` 为唯一父提交；20/20 changed blob
  与根 tree `fa7631e69f8949612ce9d3dca1efd0ae8ee4c83c` 均和本地实现提交一致
- Draft PR：[`#25`](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/25)，
  head 为阶段5分支，base 为 `codex/v2.0-phase4-domain-transactions`
- 是否合并 main：否
- 外部阻塞：无；本机 `gh` 凭据无效，按授权使用 GitHub Git 对象接口发布，
  未把本地分叉提交当成远端堆叠父提交
- 阶段6任务：未创建；只有阶段5真正完成后才允许自动接力
