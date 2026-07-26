# 2.0 真实故障回放验收矩阵

状态：`2.0-phase0`

机器语料：[`../../fixtures/2.0/replay-cases.json`](../../fixtures/2.0/replay-cases.json)

结构契约：[`replay-fixture.schema.json`](replay-fixture.schema.json)

本矩阵把历史事故转成可交接、可逐阶段激活的验收契约。公开仓库只保存为验证所需的最短改写文本；完整私有聊天、完整归档正文、凭据和用户绝对路径都不进入 fixture。

## 验收层

| 层 | 证明什么 | 何时可作为完成证据 |
|---|---|---|
| `unit` | 纯函数分类、校验、不变量和状态转换正确 | 对应领域核心在阶段1起实现后 |
| `integration` | 指纹、分支、事务、持久化或 UI 之间的次序正确 | 对应集成阶段完成后 |
| `real-replay` | 脱敏最小输入能重现故障并由新实现阻断 | 行为回放执行器在阶段6接入后 |
| `real-sillytavern` | 候选包在真实酒馆 DOM、事件和持久化链路中正确 | 改动触及运行时或阶段7发布门时 |
| `release` | 所有要求层均通过，且没有高风险例外 | 阶段7候选发布前 |

阶段0只验证 schema、覆盖、引用和隐私边界。所有 fixture 的 `automation.status` 固定为 `structural-only`；到达 `activateAt` 所指阶段且对应 API 已存在后，才能把未来行为断言转为默认执行测试。

## 故障到验收映射

| Fixture | 历史故障 | 最小输入 | 预期结果 | 验收层 | 证据来源 | 未来自动化 |
|---|---|---|---|---|---|---|
| `RR-AGENCY-NO-MOVE` | 玩家明确“不移动/不补心理”仍被代行动 | 负面约束 + 候选补写后退、语气、心理 | 拒绝候选；位置不变；不新增玩家行动与心理 | unit / real-replay / real-sillytavern | 真实QC 5.2，2026-07-25，第13–14行的最小改写 | 阶段3：`replay.agency.no_move` |
| `RR-BULLSHIT-REASONABLE` | 合理即兴若一律审批会破坏叙事流 | 普通旅店借热水，无矛盾、无重大优势 | 作为当前分支局部事实低摩擦接纳 | unit / real-replay | 产品规格H1契约 | 阶段3：`replay.adjudication.reasonable` |
| `RR-BULLSHIT-ADVANTAGE` | 能带来通行优势的口胡被无成本确认 | 自称认识守卫队长并要求放行 | 标为优势口胡；检定或付出成本前保持候选 | unit / integration / real-replay | 产品规格H2契约 | 阶段3：`replay.adjudication.advantage` |
| `RR-BULLSHIT-REWRITE` | 即兴声明覆盖已确认世界事实 | 桥已坍塌，却声称从未坍塌且已过河 | 非显式改写模式下拒绝；原事实与位置不变 | unit / integration / real-replay | 产品规格H3契约 | 阶段3：`replay.adjudication.rewrite` |
| `RR-FACT-RANDOM-CODE` | 随机暗号被连续确认成秘密协议 | 随口短语 + 候选声称“内部联络暗号” | 不得确认世界事实或已验证知识，也不得授予自己人身份 | unit / integration / real-replay / real-sillytavern | 真实QC 5.2，2026-07-25，第19–34行的跨轮模式 | 阶段3：`replay.fact.random_code` |
| `RR-FINGERPRINT-PREVIOUS-REPLY` | “赤沙八十三”收到上一轮“银杉五十九”回复 | 上一轮、当前轮及旧回复指纹 | 判为过期结果，不显示、不提交 | unit / integration / real-replay / real-sillytavern | 真实QC 5.2，2026-07-25，第25–28行 | 阶段2：`replay.fingerprint.previous_reply` |
| `RR-SOCIAL-ORDINARY-KINDNESS` | 止痛药、保护、请酒被升级为饲养/狂热并持久化自强化 | 普通善意 + 候选好感127/信任138/极端标签 | 回滚无证据的自愿轴与标签 | unit / integration / real-replay | Gemini 80回合与Opus 140回合对照的结构性结论 | 阶段4：`replay.social.ordinary_kindness` |
| `RR-SOCIAL-COERCION-VOLUNTARY` | 强制服从与自愿好感混写 | 只有威胁证据，却同时大增好感、信任与强制轴 | 允许有证据的强制轴；回滚自愿好感与信任 | unit / integration / real-replay | 私有5.4.1审计的关系结构最小等价样本 | 阶段4：`replay.social.coercion_voluntary` |
| `RR-EQUIPMENT-SLOTS` | 防弹背心占腿、风衣占手、胸挂占饰品 | 三件装备的 `allowedSlots` 与 `equippedAt` 冲突 | 整笔装备事务拒绝；状态不变并返回槽位错误 | unit / integration / real-replay | 私有5.4.1最终存档的最小字段摘录 | 阶段4：`replay.equipment.slots` |
| `RR-ITEM-CONSUMABLE-EFFECT` | 强效治疗药剂只有描述，没有恢复数值 | 消耗品有数量和描述，但 `effects` 为空 | 不猜数值、不扣数量、不改生命；要求迁移或补全 | unit / integration / real-replay | 私有5.4.1最终存档的物品结构 | 阶段4：`replay.item.consumable_effect` |
| `RR-SKILL-TEXT-COST` | 技能消耗混用“20MP”“15 耐力”等文本 | `costText` 存在、类型化 `costs` 为空 | 不从显示文本直接扣资源；返回未解析成本 | unit / integration / real-replay | 私有5.4.1最终存档的技能结构 | 阶段4：`replay.skill.text_cost` |
| `RR-REROLL-IDEMPOTENCY` | 重Roll重复发资源，旧任务仍活跃 | 旧分支已结算，新分支使用同一幂等键 | 资源只提交一次；旧分支退役；旧任务取消或取代 | unit / integration / real-replay / real-sillytavern | 既有重Roll污染事故 | 阶段2：`replay.reroll.idempotency` |
| `RR-REPAIR-DB-BARRIER` | 正文修复未稳定，数据库任务先读取/写入 | 修复仍处于写回验证，数据库同步请求启动 | 下游保持阻塞；正文事务提交先于数据库启动 | unit / integration / real-replay | 既有正文修复与数据库抢跑事故 | 阶段6：`replay.repair.database_barrier` |
| `RR-TASK-WATCHDOG` | 模型任务运行一小时以上无人检查 | 65分钟运行、55分钟无心跳和进度 | 租约超时、生成诊断、不允许未验证写入 | unit / integration / real-replay | 既有长任务无人看守事故 | 阶段6：`replay.task.watchdog` |
| `RR-DATABASE-LENGTH-SQL-CONCURRENCY` | 600字符限制、SQL拼接和并发写入共同失守 | 601字符、非参数化、修订号冲突 | 拒绝提交并同时报告长度与并发冲突 | unit / integration / real-replay | 既有数据库事故族 | 阶段6：`replay.database.safety` |
| `RR-UI-ANDROID-EXPAND` | Android窄屏论坛“展开全文”无效 | 360px触控视口点击展开 | 受控状态和 `aria-expanded` 同步，全文可见 | integration / real-replay / real-sillytavern | 既有论坛Android展开事故 | 阶段5：`replay.ui.android_expand` |
| `RR-RELEASE-REAL-QC-OVERRIDES-SIMULATION` | 模拟验收通过但真实酒馆失败仍被视为可发布 | 模拟通过、真实酒馆消息错配失败 | 发布门阻断；真实环境证据优先 | real-sillytavern / release | 既有模拟与真实酒馆验收不一致事故 | 阶段7：`replay.release.real_qc_wins` |

## 激活规则

1. 阶段实现者先在 [`PHASE_ROADMAP.md`](PHASE_ROADMAP.md) 对应阶段的输出中提供被测 API 和最小适配器。
2. 将 fixture 的结构输入映射到实际 API，不改变原用例的 `id`、历史意图或预期不变量。
3. 先增加独立行为回放命令；在真实故障由旧实现复现、新实现阻断且结果稳定后，才并入默认 `npm test`。
4. 涉及 DOM、重Roll、写回、数据库、模型队列或发布的用例，单元通过不等于完成；矩阵要求的 `real-sillytavern` 层不可由模拟替代。
5. 若真实环境结果与模拟冲突，以真实环境为准并阻断发布；不得删除用例来恢复绿色。

## 证据与隐私规则

- `private-archive` 和 `real-qc` 引用只是定位标签，不是公开数据依赖；CI 不读取仓库外私有目录。
- fixture 中的 `privacy.synthetic=true` 表示文本经过最小化改写，不是完整原文。
- 每个 turn 上限为600字符；禁止加入密钥、Cookie、完整角色卡、完整聊天、外部站点凭据或用户绝对路径。
- 需要补充证据时，优先增加新的最小等价 case，不能把整份 `.jsonl` 复制进公开仓库。
