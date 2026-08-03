# MVU Auto Doctor 2.0 权威规格索引

状态：`2.0.0-rc.7-character-kaleidoscope / qc-in-progress / branch-review-only`

适用范围：2.0 产品、数据协议、事务协议、真实故障回放与阶段交接

最后更新：2026-08-03

本目录是 2.0 实施的权威入口。阶段0冻结产品边界、协议、不变量、回放基线与交接规则；阶段1至6依次实现领域、事务、导演、领域事务、双入口和持久运行时。阶段7新增 `v2/release/` 的1.x升级/回滚演练、性能/容量/隐私、安全/恢复硬化门。阶段8—9提供 Actor Shard 领域核和宿主接线；rc.4 新增持久 Actor Ledger，rc.5 加入稳定身份揭示/异变谱系、生命周期、实际观察回写、人物/势力/环境三通道和共享压力/注入预算；rc.6 增加独立偶发许可证与防刷，并移除全部本地计费估算和金额门；rc.7 把人物账本升至 v3，增加证据化人物 DNA、反脸谱语义路由和独立“人物万花筒”预设，并让严格/轻量独立 API 通道分别使用可调 1—8 并发池（默认2/4），而持久写入与旧轮次拦截仍保持串行安全门。当前 rc.7 已通过自动回归、Phase 6/7、真实 SillyTavern + TavernDB spv8.7.4 无菌宿主兼容测试与目标模型 GemAI `gemini-3.1-pro-preview` 合成真实模型测试；十场盲评中人物万花筒版9胜0负1平，四个普通首次出场场景3胜0负1平，强行温情修订追加三场全胜。真实 Gemini 还暴露并验证修复了人物分片30秒默认超时。发布门仍被当前 TauriTavern 单实例、无安全后台重复入口阻断；历史阶段10、rc.5、rc.6 与非目标模型试跑只作旁证，不冒充 rc.7 目标模型证据。事实以 [`../qc-reports/v2.0.0-rc.7.json`](../qc-reports/v2.0.0-rc.7.json) 为准。

## 权威文件

1. [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md)：产品定位、设计原则、导演模式、口胡四级、模块和版本边界。
2. [`DATA_TRANSACTION_PROTOCOL.md`](DATA_TRANSACTION_PROTOCOL.md)：核心数据模型、事务状态机、分支隔离、稳定屏障和1.x兼容策略。
3. [`REAL_REPLAY_ACCEPTANCE_MATRIX.md`](REAL_REPLAY_ACCEPTANCE_MATRIX.md)：历史故障到机器回放用例的验收映射。
4. [`PHASE_ROADMAP.md`](PHASE_ROADMAP.md)：阶段1至阶段10的输入、输出、完成门和交接入口。
5. [`PHASE_HANDOFF_TEMPLATE.md`](PHASE_HANDOFF_TEMPLATE.md)：每阶段必须填写的无聊天记忆交接模板。
6. [`handoffs/PHASE_0_HANDOFF.md`](handoffs/PHASE_0_HANDOFF.md)：阶段0实际交接、测试证据与阶段1准确入口。
7. [`handoffs/PHASE_1_HANDOFF.md`](handoffs/PHASE_1_HANDOFF.md)：阶段1领域核公开 API、测试证据与阶段2准确入口。
8. [`handoffs/PHASE_2_HANDOFF.md`](handoffs/PHASE_2_HANDOFF.md)：阶段2事务/分支公开 API、测试证据与阶段3准确入口。
9. [`handoffs/PHASE_3_HANDOFF.md`](handoffs/PHASE_3_HANDOFF.md)：阶段3导演层公开 API、测试证据与阶段4准确入口。
10. [`handoffs/PHASE_4_HANDOFF.md`](handoffs/PHASE_4_HANDOFF.md)：阶段4领域事务公开 API、测试证据与阶段5准确入口。
11. [`handoffs/PHASE_5_HANDOFF.md`](handoffs/PHASE_5_HANDOFF.md)：阶段5双入口、导演台、移动端与真实环境证据，以及阶段6准确入口。
12. [`handoffs/PHASE_6_HANDOFF.md`](handoffs/PHASE_6_HANDOFF.md)：阶段6稳定屏障、下游、看门狗、数据库与真实回放证据，以及阶段7准确入口。
13. [`handoffs/PHASE_7_HANDOFF.md`](handoffs/PHASE_7_HANDOFF.md)：阶段7迁移、发布硬化、候选包、真实QC与维护者审阅入口。
14. [`handoffs/PHASE_8_HANDOFF.md`](handoffs/PHASE_8_HANDOFF.md)：Actor Shard领域核、确定性选择/汇合、隔离worker和提示词插槽。
15. [`handoffs/PHASE_9_HANDOFF.md`](handoffs/PHASE_9_HANDOFF.md)：Actor Shard宿主接线、自动化集成证据及阶段10真实QC入口。
16. [`handoffs/PHASE_10_HANDOFF.md`](handoffs/PHASE_10_HANDOFF.md)：阶段10真实QC、阻断证据、候选包与发布门结论。
17. [`PHASE_6_REAL_QC_TEMPLATE.json`](PHASE_6_REAL_QC_TEMPLATE.json)：不含密钥、原始载荷或私人正文的阶段6真实环境报告模板。
18. [`MIGRATION_ROLLBACK_GUIDE.md`](MIGRATION_ROLLBACK_GUIDE.md)：1.x惰性升级、可读回退和保守恢复步骤。
19. [`USER_GUIDE_2.0_RC.md`](USER_GUIDE_2.0_RC.md)：RC安装、日常使用、伴生脚本共存测试和回滚说明。
20. [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md)：2.0.0 RC自动门、真实门、隐私门与发布门。
21. [`2.1_OPEN_ITEMS.md`](2.1_OPEN_ITEMS.md)：明确推迟到2.1的未决范围。
22. [`replay-fixture.schema.json`](replay-fixture.schema.json)：阶段0回放语料的机器可读 JSON Schema。
23. [`../../fixtures/2.0/replay-cases.json`](../../fixtures/2.0/replay-cases.json)：脱敏、最小化的真实故障回放基线。

## 冲突处理

- 数据形态、状态机、写入顺序或迁移冲突，以 `DATA_TRANSACTION_PROTOCOL.md` 为准。
- 产品体验、导演职责、自然语言与 UI 的关系，以 `PRODUCT_SPEC.md` 为准。
- 可验收结果和历史事故覆盖，以 `REAL_REPLAY_ACCEPTANCE_MATRIX.md` 为准。
- 阶段范围与“何时可以进入下一阶段”，以 `PHASE_ROADMAP.md` 为准。
- 若规范与已发布的1.x运行时行为冲突，2.0实现必须通过兼容适配器迁移，不能直接覆盖旧数据。

## 阶段0—7验证

```powershell
node --test tests/v2-replay-fixtures.test.mjs
node --test tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs
node --test tests/v2-transaction-core.test.mjs tests/v2-transaction-replays.test.mjs
node --test tests/v2-director-core.test.mjs tests/v2-director-replays.test.mjs
node --test tests/v2-domain-transaction-core.test.mjs tests/v2-domain-transaction-replays.test.mjs
node --test tests/v2-surface-core.test.mjs tests/v2-surface-browser.test.mjs
node --test tests/v2-runtime-core.test.mjs tests/v2-runtime-replays.test.mjs
npm.cmd run qc:phase6:replay
npm.cmd run qc:phase7:replay
```

前六条命令保持阶段0—5全部不变量。第七条验证持久幂等/恢复、`captured → repairing → state-committing → settled`、failed/stale零下游、TaskLease硬超时、迟到结果零写入，以及数据库长度/参数化/修订冲突联合拒绝。阶段6报告保留历史证据；阶段7命令执行全部V2测试并生成17/17行为矩阵，真实环境失败会正式阻断候选。
