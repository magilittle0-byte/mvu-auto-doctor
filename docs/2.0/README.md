# MVU Auto Doctor 2.0 权威规格索引

状态：`2.0-phase6`

适用范围：2.0 产品、数据协议、事务协议、真实故障回放与阶段交接

最后更新：2026-07-27

本目录是 2.0 实施的权威入口。阶段0冻结产品边界、协议、不变量、回放基线与交接规则；阶段1新增无宿主依赖的 `v2/domain/` 领域核；阶段2新增无宿主依赖的 `v2/transaction/` 消息身份、分支与事务内核；阶段3新增无宿主依赖的 `v2/director/` 玩家边界、H0–H3裁定、事实/知识状态机与主模型上下文合同；阶段4新增无宿主依赖的 `v2/domain-transaction/`；阶段5新增 `v2/surface/` 双源适配入口和生产导演台；阶段6新增 `v2/runtime/` 持久正文屏障、幂等/恢复存储、TaskLease/看门狗、settled-only 下游和数据库安全门，并把 API 升级为兼容 v4。当前不宣称阶段7迁移、发布硬化或2.0.0候选已经实现。

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
12. `handoffs/PHASE_6_HANDOFF.md`：阶段6稳定屏障、下游、看门狗、数据库与真实回放证据，以及阶段7准确入口（阶段6完成后生成）。
13. [`PHASE_6_REAL_QC_TEMPLATE.json`](PHASE_6_REAL_QC_TEMPLATE.json)：不含密钥、原始载荷或私人正文的阶段6真实环境报告模板。
14. [`replay-fixture.schema.json`](replay-fixture.schema.json)：阶段0回放语料的机器可读 JSON Schema。
15. [`../../fixtures/2.0/replay-cases.json`](../../fixtures/2.0/replay-cases.json)：脱敏、最小化的真实故障回放基线。

## 冲突处理

- 数据形态、状态机、写入顺序或迁移冲突，以 `DATA_TRANSACTION_PROTOCOL.md` 为准。
- 产品体验、导演职责、自然语言与 UI 的关系，以 `PRODUCT_SPEC.md` 为准。
- 可验收结果和历史事故覆盖，以 `REAL_REPLAY_ACCEPTANCE_MATRIX.md` 为准。
- 阶段范围与“何时可以进入下一阶段”，以 `PHASE_ROADMAP.md` 为准。
- 若规范与已发布的1.x运行时行为冲突，2.0实现必须通过兼容适配器迁移，不能直接覆盖旧数据。

## 阶段0—6验证

```powershell
node --test tests/v2-replay-fixtures.test.mjs
node --test tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs
node --test tests/v2-transaction-core.test.mjs tests/v2-transaction-replays.test.mjs
node --test tests/v2-director-core.test.mjs tests/v2-director-replays.test.mjs
node --test tests/v2-domain-transaction-core.test.mjs tests/v2-domain-transaction-replays.test.mjs
node --test tests/v2-surface-core.test.mjs tests/v2-surface-browser.test.mjs
node --test tests/v2-runtime-core.test.mjs tests/v2-runtime-replays.test.mjs
npm.cmd run qc:phase6:replay
```

前六条命令保持阶段0—5全部不变量。第七条验证持久幂等/恢复、`captured → repairing → state-committing → settled`、failed/stale零下游、TaskLease硬超时、迟到结果零写入，以及数据库长度/参数化/修订冲突联合拒绝。最后一条自动执行全部V2测试并生成17例矩阵报告。阶段7真实发布候选门仍为 `structural-only`，不会在默认 CI 中制造未来阶段的假失败。
