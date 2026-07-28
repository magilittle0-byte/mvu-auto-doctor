# MVU Auto Doctor 2.0 阶段9交接

## 1. 身份

- 阶段：9，Actor Shard原医生宿主接线与自动化集成
- 交付日期：2026-07-28
- 仓库：`magilittle0-byte/mvu-auto-doctor`
- 分支：`codex/v2-actor-shards`
- PR：未创建/未更新；阶段9不推送
- 基础提交 SHA：`1b88b6b0f1eae487e8dcb5817c8271b39165133d`
- 基础 tree：`7632bd0d4d5d8e010ba8c3101e832825930f9636`
- 阶段9实现提交 SHA：`b9f4f645b2f82c79b52d2be47f3dbb15905bff4a`
- 阶段9实现 tree：`59a442b76de8f07e77532e571a8eb454b94ca674`
- 工作区是否仍有未提交修改：提交后仅允许保留 `dist` 下10个用户历史ZIP为未跟踪
- 未提交修改是否属于用户且已保留：是；10个ZIP不删除、不覆盖、不暂存

## 2. 本阶段范围

- 授权目标：把阶段8 Actor Shard接入原医生的宏观连续性、持久settled屏障、
  完整目标身份、既有事务/下游门和设置/诊断UI，并以自动化证明接线成立。
- 明确非目标：工作流助手兼容；真实SillyTavern/真实模型；桌面与390×844视觉QC；
  外部TavernDB脚本修改；打包、推送、PR与发布；广义2.1扩张。
- 实际完成：
  - 默认关闭时不调用worker，保持旧连续性路径；
  - 启用时只在目标持久屏障为`settled`后选择不在场NPC，并以独立fast lane并发；
  - worker提案仅作为宏观连续性模型候选，不能直接写MVU、世界书、论坛、正文或数据库；
  - 最终目标再次经过message/swipe/generation/branch/fingerprint与TaskLease核验；
  - 设置页完成模式、1—5上限、两个提示词插槽保存/清空与脱敏诊断；
  - 补齐有限认知和证据子集校验，伪造知识/证据与额外授权字段拒绝；
  - 发布QC指纹纳入`actor-shard-core.mjs`与类型声明。
- 有意未做：工作流助手适配按用户明确要求取消；阶段10真实QC和发布未提前执行。

## 3. 权威文件

- 产品规格：`docs/2.0/PRODUCT_SPEC.md`
- 数据/事务协议：`docs/2.0/DATA_TRANSACTION_PROTOCOL.md`
- 真实QC：`docs/REAL_ENV_QC.md`
- 上一阶段交接：`docs/2.0/handoffs/PHASE_8_HANDOFF.md`
- 其他：根`AGENTS.md`、`docs/2.0/PHASE_ROADMAP.md`

## 4. 产物与接口

| 产物 | 路径 | 对外 API / 命令 | 不变量 |
| --- | --- | --- | --- |
| Actor Shard宿主接线 | `index.js` | `MvuAutoDoctorAPI.runContinuity()`及自动回复生命周期 | 只在settled后启动；完整目标stale时整批清空 |
| 领域核边界修复 | `actor-shard-core.mjs` | `parseActorShardProposal()` | knowledge/evidence/source/causal均不得越出分配上下文 |
| 宿主浏览器回归 | `tests/browser-runtime.test.mjs` | `npm.cmd test` | 默认关闭零调用；2 lane并发；提案进入连续性；诊断无全文 |
| 合成长局回归 | `tests/actor-shard-long-session.test.mjs` | `node --test tests/actor-shard-long-session.test.mjs` | 40层、0/1/3/5、乱序/失败/超时、三类stale零写入 |
| 发布指纹闭环 | `qc/real-env-qc.mjs` | `npm.cmd run qc:fingerprint` | 打包Actor Shard核心必须进入真实QC指纹 |

## 5. 数据与迁移

- 新增/改变的数据模型：无持久业务模型新增；Actor Shard租约和批次结果仍只在内存。
- schemaVersion：设置`actorShardSettingsVersion=1`；聊天namespace不升版。
- 1.x读取策略：不改变；功能默认关闭，旧设置首次升级强制保持关闭和默认上限2。
- 写回策略：worker无写回接口；仅原宏观连续性在既有校验后写入。
- 未知字段保留证明：40层fixture中的论坛、世界书、TavernDB、重抽助手和骰子字段
  前后深比较完全相等。
- 无法迁移的数据与可见降级：worker失败/超时单项降级；整批stale清空；旧宏观路径继续。
- 回滚方式：关闭Actor Shard即回到旧路径；本阶段没有新增需迁移的持久记录。

## 6. 已决决策与未决决策

| ID | 状态 | 决策或问题 | 证据 | 影响 | 下一负责人 |
| --- | --- | --- | --- | --- | --- |
| P9-D1 | 已决 | 不做工作流助手兼容 | 用户2026-07-28明确说明不用该插件 | 不增加外部适配代码或QC项 | 无 |
| P9-D2 | 已决 | 提示词保持自由文本但不产生事实/授权 | canary与白名单/子集测试 | 保留用户指令自由且不越过硬边界 | 阶段10复核真实payload |
| P9-D3 | 已决 | Actor核心进入发布指纹 | `qc/real-env-qc.mjs` runtimeFiles | 阶段10任何核心变化都会使旧QC报告失效 | 阶段10 |
| P9-U1 | 未决 | 外部TavernDB是否已注册barrier v1 | 本阶段按边界未做真实复核 | 决定阶段10能否发布 | 阶段10 |

## 7. 测试与验收

```text
命令：node --check actor-shard-core.mjs
退出码：0
结论：语法通过

命令：node --check index.js
退出码：0
结论：宿主入口语法通过

命令：node --test tests/actor-shard-core.test.mjs tests/actor-shard-long-session.test.mjs
退出码：0
结论：14/14通过，0失败

命令：node --test tests/browser-runtime.test.mjs
退出码：0
结论：浏览器运行时接线、竞态和连续性回归通过，约148秒

命令：npm.cmd test
退出码：0
结论：161/161通过，0失败、0跳过、0 todo，147942.2852ms
```

- 新增结构测试：knowledgeBasis/evidence子集、额外字段和伪造事实拒绝。
- 新增行为测试：40层多NPC、多个swipe/branch、0/1/3/5、并发乱序、失败/超时。
- 既有相关回归：完整事务、屏障、连续性、论坛、社会审计和版本一致性均通过。
- 浏览器测试：证明两个worker只在持久`settled`后启动，峰值并发2，提案进入连续性；
  默认关闭零额外调用；UI保存/清空与诊断隐私通过。
- 真实 SillyTavern QC：未执行；阶段边界要求留给独立阶段10。仅只读打开8011后关闭，
  未向扩展目录、聊天、角色卡或设置写入。
- fixture 覆盖：既有17项阶段0语料仍全部由自动行为测试覆盖。
- 未激活的todo/pending：无自动测试todo；真实环境门待阶段10。

## 8. 隐私与安全检查

- 增量密钥扫描：对暂存差异扫描长`sk-`、Bearer、AWS key和私钥头，0命中。
- 私人正文扫描：绝对用户路径0命中；测试只含合成公开canary，无私人正文。
- fixture 最大文本长度：每层合成正文大于5000字符；总层数40，不含私人数据。
- 是否包含绝对用户目录：生产/测试/文档增量不得包含；交接仅记录仓库相对路径。
- 是否读取但未修改私有归档：是；`dist`下10个历史ZIP只核对状态。
- 其他敏感数据处理：无API密钥、cookies、浏览器profile、原始模型payload或私人聊天。

## 9. 差异审计

- `git status --short --branch`：提交后应仅显示10个未跟踪历史ZIP。
- `git diff --stat 1b88b6b...b9f4f645`：9个文件，788行新增、14行删除。
- 预期文件：Actor核心、QC指纹、Actor核心/长局/浏览器测试、CHANGELOG、阶段索引/
  路线图和本交接。
- 无关文件：无。
- 无关文件如何被保留/排除：10个历史ZIP不进入任何`git add`路径；未运行打包命令。

## 10. 已知风险

| 风险 | 触发条件 | 影响 | 当前缓解 | 下一阶段动作 |
| --- | --- | --- | --- | --- |
| 真实fast通道行为未证 | 真实模型并行、JSON或取消与模拟不同 | worker降级或连续性不可用 | 默认关闭、严格解析、失败降级 | 阶段10真实模型QC |
| 外部TavernDB未注册 | 仍监听`MESSAGE_RECEIVED`且无v1注册 | 发布门必须阻断 | fail-closed保持不变 | 阶段10现场复核，不改外部脚本 |
| 移动布局未现场复核 | SillyTavern变换根与模拟不同 | 控件可能溢出/难触控 | 自动浏览器回归保留 | 阶段10桌面与390×844实测 |

## 11. 运行与故障恢复

- 可观察状态：`latestActorShardDiagnostics`导出status、selected、completed、succeeded、failed。
- 软取消：上游AbortSignal传给每个worker；regenerate/swipe/chat switch使批次stale。
- 硬超时/看门狗：每worker有超时；内存TaskLease含软/硬截止与进度心跳。
- 迟到结果处理：完整目标身份或租约不接受时结果清空，不进入宏观模型。
- 写前恢复记录：Actor Shard无写；原宏观连续性仍沿用既有checkpoint/barrier记录。
- 写后回读：Actor Shard无写；最终写回仍由原连续性/事务路径负责。
- 手动恢复步骤：关闭Actor Shard后重新运行世界连续性；旧宏观路径不依赖worker结果。

## 12. 下一阶段准确入口

```text
下一阶段10从提交b9f4f645b2f82c79b52d2be47f3dbb15905bff4a开始。先完整读取根AGENTS.md、
docs/REAL_ENV_QC.md、docs/2.0/handoffs/PHASE_9_HANDOFF.md、
docs/2.0/RELEASE_CHECKLIST.md和当前docs/qc-reports/v2.0.0-rc.1.json。
先核对branch/HEAD/tree和dist下10个未跟踪历史ZIP，不得删除、覆盖或暂存它们。
复跑并扩展约40层合成长局后，只做验收暴露的定点修复；随后把精确候选源码部署到真实
SillyTavern 1.18.0/8172dcd，在真实模型下验证Actor Shard关闭及1/3/5 worker、
regenerate/swipe/chat switch整批stale、两个提示词正确消息位置与诊断隐私，并完成
桌面及390×844论坛pointer/全文、Scenario Plan 5A、worldbook与伴生脚本共存QC。
现场复核TavernDB是否以id=taverndb注册barrier v1、settledOnly=true、
terminalReceipts=true并正确确认settled/failed/stale收据；未注册必须准确记录blocked，
不得修改外部TavernDB、不得弱化fail-closed、不得晋升main。
完成后运行完整npm.cmd test与npm.cmd run qc:ci，更新结构化报告、版本/CHANGELOG/
用户文档，构建发布包并提交；提交后运行qc:record与qc:gate。只有gate允许才fetch核对
远端commit/tree并非强推当前独立分支、创建或更新Draft PR。绝不伪造真实通过。
```

## 13. 发布状态

- 本地提交：`b9f4f645b2f82c79b52d2be47f3dbb15905bff4a`
- 远端分支：未推送
- PR状态：未创建/未更新
- 基础分支：`codex/v2-actor-shards`
- 是否合并 main：否
- 外部阻塞：阶段10必须重新核对TavernDB；本阶段没有发布授权
