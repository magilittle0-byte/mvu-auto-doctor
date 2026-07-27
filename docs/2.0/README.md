# MVU Auto Doctor 2.0 权威规格索引

状态：`2.0-phase7-rc`

适用范围：2.0 产品、数据协议、事务协议、真实故障回放与阶段交接

最后更新：2026-07-27

本目录是 2.0 实施的权威入口。阶段0冻结产品边界、协议、不变量、回放基线与交接规则；阶段1至6依次实现领域、事务、导演、领域事务、双入口和持久运行时。阶段7新增 `v2/release/` 的1.x升级/回滚演练、性能/容量/隐私/安全/恢复硬化门，以及真实QC优先于模拟的发布候选门。当前候选为 `2.0.0-rc.1`，只能由维护者审阅堆叠 Draft PR 后决定是否合并。

## 权威文件

1. [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md)：产品定位、设计原则、导演模式、口胡四级、模块和版本边界。
2. [`DATA_TRANSACTION_PROTOCOL.md`](DATA_TRANSACTION_PROTOCOL.md)：核心数据模型、事务状态机、分支隔离、稳定屏障和1.x兼容策略。
3. [`REAL_REPLAY_ACCEPTANCE_MATRIX.md`](REAL_REPLAY_ACCEPTANCE_MATRIX.md)：历史故障到机器回放用例的验收映射。
4. [`PHASE_ROADMAP.md`](PHASE_ROADMAP.md)：阶段1至阶段7的输入、输出、完成门和交接入口。
5. [`PHASE_HANDOFF_TEMPLATE.md`](PHASE_HANDOFF_TEMPLATE.md)：每阶段必须填写的无聊天记忆交接模板。
6. [`handoffs/PHASE_0_HANDOFF.md`](handoffs/PHASE_0_HANDOFF.md)：阶段0实际交接、测试证据与阶段1准确入口。
7. [`handoffs/PHASE_1_HANDOFF.md`](handoffs/PHASE_1_HANDOFF.md)：阶段1领域核公开 API、测试证据与阶段2准确入口。
8. [`handoffs/PHASE_2_HANDOFF.md`](handoffs/PHASE_2_HANDOFF.md)：阶段2事务/分支公开 API、测试证据与阶段3准确入口。
9. [`handoffs/PHASE_3_HANDOFF.md`](handoffs/PHASE_3_HANDOFF.md)：阶段3导演层公开 API、测试证据与阶段4准确入口。
10. [`handoffs/PHASE_4_HANDOFF.md`](handoffs/PHASE_4_HANDOFF.md)：阶段4领域事务公开 API、测试证据与阶段5准确入口。
11. [`handoffs/PHASE_5_HANDOFF.md`](handoffs/PHASE_5_HANDOFF.md)：阶段5双入口、导演台、移动端与真实环境证据，以及阶段6准确入口。
12. [`handoffs/PHASE_6_HANDOFF.md`](handoffs/PHASE_6_HANDOFF.md)：阶段6稳定屏障、下游、看门狗、数据库与真实回放证据，以及阶段7准确入口。
13. [`handoffs/PHASE_7_HANDOFF.md`](handoffs/PHASE_7_HANDOFF.md)：阶段7迁移、发布硬化、候选包、真实QC与维护者审阅入口。
14. [`PHASE_6_REAL_QC_TEMPLATE.json`](PHASE_6_REAL_QC_TEMPLATE.json)：不含密钥、原始载荷或私人正文的阶段6真实环境报告模板。
15. [`MIGRATION_ROLLBACK_GUIDE.md`](MIGRATION_ROLLBACK_GUIDE.md)：1.x惰性升级、可读回退和保守恢复步骤。
16. [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md)：2.0.0 RC自动门、真实门、隐私门与发布门。
17. [`2.1_OPEN_ITEMS.md`](2.1_OPEN_ITEMS.md)：明确推迟到2.1的未决范围。
18. [`replay-fixture.schema.json`](replay-fixture.schema.json)：阶段0回放语料的机器可读 JSON Schema。
19. [`../../fixtures/2.0/replay-cases.json`](../../fixtures/2.0/replay-cases.json)：脱敏、最小化的真实故障回放基线。

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
