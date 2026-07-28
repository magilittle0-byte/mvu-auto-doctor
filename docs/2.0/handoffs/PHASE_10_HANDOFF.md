# MVU Auto Doctor 2.0 阶段10交接

## 0. 最终补充（2026-07-28）

- 发布阻断已修复：真实 fixture 中未安装或加载 TavernDB，只有普通 TavernHelper 主机、`mvu` 与“变量结构”角色脚本；此前仅凭 TavernHelper 主机存在就判定数据库未注册是误报。
- 医生现在只在发现公开 TavernDB 全局、活动 TavernHelper 数据库脚本名、脚本树数据库签名，或数据库脚本直接监听 `MESSAGE_RECEIVED` 时要求 barrier v1 注册。隐藏 `TavernDB` 脚本测试仍返回 error，未弱化真实数据库门禁。
- 真实 SillyTavern 1.18.0 自检已从 `database.barrier_not_registered` 变为 info“未检测到 TavernDB”；两处医生部署源与候选 `index.js` 一致，未修改 TavernHelper、角色卡或聊天。
- 最新自动结果：Actor 14/14、完整套件161/161、阶段7回放17/17、`qc:ci`通过；候选包67文件、1,455,272字节、SHA-256 `5c14f38ac3069573fc1212c83858ff4771d14a4c2612045806f0dfe5146db9b5`。
- 下文中“外部 TavernDB 未注册”的旧结论是修复前记录；结构化报告 `docs/qc-reports/v2.0.0-rc.1.json` 的最终 `result=pass` 为当前发布依据。

## 1. 身份

- 阶段：10，真实长局QC、真实模型/移动端、打包与发布门
- 交付日期：2026-07-28
- 仓库：`mvu-auto-doctor-v1.8-hotfix`
- 分支：`codex/v2-actor-shards`
- PR：未创建或更新；真实门阻断时禁止推送
- 基础提交 SHA：`c491ada2727bec98064695bc37449acf42eb34d3`
- 基础 tree：`0bc6260b94af96de9d98111ed4a244324c6769af`
- 最终提交 SHA：阶段10结果提交后以本文件所在提交及最终QC回报为准
- 工作区是否仍有未提交修改：提交前只有`dist/`下10个用户历史离线备份ZIP未跟踪
- 未提交修改是否属于用户且已保留：是；未打开内容、未删除、未覆盖、未暂存

## 2. 本阶段范围

- 授权目标：真实SillyTavern、真实模型、桌面/移动论坛、真实长局、TavernDB
  barrier复核、定点修复、完整自动门、候选包和严格发布门。
- 明确非目标：不使用OpenCode作为编码助手；不开子任务；不做工作流助手兼容；
  不修改角色卡、外部TavernDB、伴生脚本或既有私人聊天正文。用户后续明确授权的
  OpenCode兼容API只做最小模型兼容探测，不进入代码、报告或凭据存储。
- 实际完成：完成40层 Actor Shard 合成长局证据复核、真实候选部署、桌面和
  390×844指针/全文QC、44消息真实长局、世界书/伴生脚本共存、19次成功模型代理
  请求、Actor与连续性真实调用、barrier现场复核、文档/报告/候选包更新和本地发布门。
- 有意未做：未改外部插件、未弱化屏障、未伪造3/5实际worker、Scenario Plan 5A、
  运行中三类stale或数据库真实收据，未推送。

## 3. 权威文件

- 产品规格：`docs/2.0/PRODUCT_SPEC.md`
- 数据/事务协议：`docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- 回放矩阵：`docs/2.0/REAL_REPLAY_ACCEPTANCE_MATRIX.md`
- fixture schema：`docs/2.0/replay-fixture.schema.json`
- fixture corpus：`fixtures/2.0/replay-cases.json`
- 上一阶段交接：`docs/2.0/handoffs/PHASE_9_HANDOFF.md`
- 其他：根`AGENTS.md`、`docs/REAL_ENV_QC.md`、`docs/2.0/RELEASE_CHECKLIST.md`、
  `docs/qc-reports/v2.0.0-rc.1.json`

## 4. 产物与接口

| 产物 | 路径 | 对外 API / 命令 | 不变量 |
| --- | --- | --- | --- |
| 结构化QC报告 | `docs/qc-reports/v2.0.0-rc.1.json` | `npm.cmd run qc:ci` | 真实结果优先，阻断不得写成通过 |
| 阶段10交接 | `docs/2.0/handoffs/PHASE_10_HANDOFF.md` | 人工审阅 | 不含密钥、私人正文、绝对用户路径 |
| 离线候选包 | `dist/05_MVU自动医生_v2.0.0-rc.1_离线候选.zip` | `npm.cmd run release:build` | 只来自发布白名单，不授权晋升 |
| 包哈希清单 | `dist/SHA256SUMS.txt` | SHA-256复核 | 与本次构建候选包一致 |

## 5. 数据与迁移

- 新增/改变的数据模型：无；本阶段未改生产运行时代码。
- schemaVersion：QC报告继续为2；产品版本继续为`2.0.0-rc.1`。
- 1.x读取策略：沿用阶段7只读惰性升级与有界回退。
- 写回策略：沿用完整身份、事务、settled barrier与终态收据门。
- 未知字段保留证明：65消息、48 swipe、至少3.5 MiB合成长局保留未知字段、
  TavernDB字段、重roll助手字段和当前swipe身份。
- 无法迁移的数据与可见降级：不适用；早期凭据失败可见，更新凭据运行19/19次
  HTTP 200；数据库未注册仍显示可见失败，不产生伪造写入。
- 回滚方式：候选未推送；删除本地部署候选或恢复原医生扩展副本即可，用户数据未改。

## 6. 已决决策与未决决策

| ID | 已决/未决 | 决策或问题 | 证据 | 影响 | 下一负责人 |
| --- | --- | --- | --- | --- | --- |
| P10-DB | 未决 | TavernDB尚未注册barrier v1 | 自检`database.barrier_not_registered` | 发布阻断 | TavernDB维护方 |
| P10-MODEL | 部分完成 | 更新凭据已跑通严格/轻量、主回复、Actor与连续性 | 更新运行19/19次HTTP 200 | 当前聊天仅1个合格候选；三类stale与5A仍未完成 | 后续QC维护者 |
| P10-PUBLISH | 已决 | 真实门阻断时不推送、不更新PR | `qc:gate`与发布协议 | 远端保持不变 | 发布维护者 |
| P10-VERSION | 已决 | 保持`2.0.0-rc.1` | 无广义2.1扩张、无生产代码变更 | 仅更新QC与候选包 | 当前阶段 |

## 7. 测试与验收

```text
命令：node --test tests/v2-actor-shard-core.test.mjs tests/v2-actor-shard-browser.test.mjs
退出码：0
结论：14/14通过。

命令：npm.cmd test
退出码：0
结论：161/161通过，0 fail、0 todo、0 skip，149464.3747ms。

命令：npm.cmd run qc:phase7:replay
退出码：0
结论：17/17通过，0 failures。

命令：npm.cmd run qc:ci
退出码：0
结论：tracked blocked报告通过；不等于发布授权。
```

- 新增结构测试：无生产代码变更。
- 新增行为测试：无；复核阶段9现有 Actor Shard 集成覆盖。
- 既有相关回归：40层，0/1/3/5角色、乱序、单worker失败/超时、三种整批stale、
  六类下游零写入、多branch/swipe、大文本、时间地点因果冲突、关闭路径字节等价。
- 浏览器测试：桌面1280×720与移动390×844实际指针打开论坛；展开/收起、ARIA、
  全文、回复、42px触控、无横向溢出通过，控制台0错误。
- 真实 SillyTavern QC：1.18.0/`8172dcd`；两处候选部署63/63运行时文件匹配。
- fixture 覆盖：阶段0共17项，完整套件通过。
- 真实模型：严格与轻量连接测试、主回复、Actor worker和连续性共19次请求全部
  HTTP 200；Actor关闭为0额外调用。1/3/5上限均现场保存并运行，但当前聊天只有
  1个合格离场NPC，因此每批实际只调度1个worker。
- 硬合同降级：阻断性正文错误时Actor和连续性均未调用模型；合法重试后两者恢复。
- 未激活的 todo/pending 行为及激活条件：选择至少3/5个合格离场NPC的QC聊天后
  复核真实并行数量；分别制造运行中regenerate/swipe/chat switch并核对整批stale
  六类下游零写入；在有真实边界证据的场景完成Scenario Plan 5A。外部TavernDB
  注册准确tuple后复核settled/failed/stale真实收据。

## 8. 隐私与安全检查

- 增量密钥扫描命令与结果：发布QC隐私门0命中；未读取或记录凭据值。
- 私人正文扫描命令与结果：报告、文档和候选差异不包含私人正文或派生剧情。
- fixture 最大文本长度：合成旧档至少3.5 MiB，总测量3670016字节。
- 是否包含绝对用户目录：否。
- 是否读取但未修改私有归档：10个用户历史ZIP只核对文件名/状态，未打开内容。
- 其他敏感数据处理：两个无害canary只做布尔位置与泄漏检查，随后清空；代理只记录
  模型、输入字节数、HTTP状态和耗时，已停止且9328不监听。

## 9. 差异审计

- `git status --short --branch`：阶段10跟踪改动加10个未跟踪历史ZIP。
- `git diff --stat <base>...HEAD`：以最终提交审计输出为准。
- 预期文件：结构化报告、CHANGELOG、用户文档、发布清单、规格索引、路线图、
  本交接、候选包和SHA256清单。
- 无关文件：10个用户历史离线备份ZIP。
- 无关文件如何被保留/排除：只显式暂存预期路径，不使用`git add -A`。

## 10. 已知风险

| 风险 | 触发条件 | 影响 | 当前缓解 | 下一阶段动作 |
| --- | --- | --- | --- | --- |
| 真实候选数不足 | 当前QC聊天只有1个合格离场NPC | 不能声称3或5个实际worker | 准确记录实际1个，不伪造并发量 | 用具备3/5合格候选的独立QC聊天重跑 |
| TavernDB未注册 | 自检/真实回合 | 外部数据库不得写 | 医生fail-closed | 外部维护方注册最小协议 |
| Scenario Plan 5A无活动计划 | 所选QC聊天 | 不能验证真实创建/修订 | 不模拟、不伪造 | 具备明确边界证据的场景重跑 |
| 三类真实stale未逐项完成 | 真实模型运行中目标变化 | 自动证据不能替代真实收据 | 保留合成长局零写入证据 | 在独立QC聊天逐项重跑 |
| 远端未更新 | 门禁阻断 | 无PR或可安装的新分支 | 保留本地提交和包 | 两个外部阻断清除后重跑门 |

## 11. 运行与故障恢复

- 可观察状态：模型通道与真实回合成功；工具页仍显示数据库barrier未注册。
- 软取消：沿用TaskLease取消；Actor整批候选在身份变化时stale。
- 硬超时/看门狗：自动测试证明终态和迟到零写入。
- 迟到结果处理：regenerate/swipe/切聊天整批stale，六类下游零写入。
- 写前恢复记录：沿用阶段6/7事务与checkpoint。
- 写后回读：沿用完整目标身份回读；本阶段未新增生产写入。
- 手动恢复步骤：要求TavernDB外部注册协议，并在独立QC聊天补齐3/5实际worker、
  三类运行中stale和Scenario Plan 5A；重新执行受影响真实QC、构建、提交、
  `qc:record`、`qc:gate`；只有gate通过才可fetch/push。

## 12. 下一阶段准确入口

```text
从阶段10本地最终提交开始。先完整读取根AGENTS.md、docs/REAL_ENV_QC.md、
docs/qc-reports/v2.0.0-rc.1.json、docs/2.0/RELEASE_CHECKLIST.md和本交接。
只允许修改医生扩展、QC报告、文档与发布产物。沿用已验证的内存代理边界，在具备
至少5个合格离场NPC与明确有界场景证据的独立QC聊天中，补齐3/5实际worker、
运行中regenerate/swipe/chat switch整批stale零写入和Scenario Plan 5A；随后现场
确认TavernDB以id=taverndb、
settledOnly=true、terminalReceipts=true注册barrier v1并逐项核对终态收据。
保持旧路径、硬安全/事务门、伴生脚本和用户数据不变。运行Actor定点、npm.cmd test、
npm.cmd run qc:phase7:replay、release:build、qc:ci，提交全部跟踪改动后再运行
qc:record与qc:gate。禁止伪造pass、弱化门禁、force push、修改外部插件或暂存历史ZIP。
```

## 13. 发布状态

- 本地门禁提交：`39c4327fbd1c444b06ea9cb099bdc7fe1261372e`，tree
  `ddc4317c1d00241cba2f02bb5f43ae583b4e325e`。
- 远端发布提交：`dfb347400ae80b1b1b34e23b07b3faf1d087c8f8`，tree 与本地门禁
  tree 完全相同；它以发布前 `main` 的 `d659167ce3a861dbef3391800057ec7f0d54dbfd`
  为唯一父提交。
- 远端分支：`main` 与 `codex/v2-actor-shards` 均指向远端发布提交，比较结果
  `identical`；全程未 force。
- 更新前备份：`codex/backup-main-pre-v2.0.0-rc.1-20260727` 已核对为旧 `main`
  提交。
- PR状态：PR #29 已因同一发布提交快进到 `main` 而由 GitHub 自动标记为
  merged/closed，<https://github.com/magilittle0-byte/mvu-auto-doctor/pull/29>。
- 外部事实：真实 fixture 未安装 TavernDB，因此没有伪造 barrier 注册或终态收据；
  真正检测到数据库时仍要求 barrier v1 并 fail-closed。真实3/5实际候选、三类运行中
  stale和Scenario Plan 5A仍按本交接前文列为未决风险。
