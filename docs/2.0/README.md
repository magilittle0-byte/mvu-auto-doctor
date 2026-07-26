# MVU Auto Doctor 2.0 权威规格索引

状态：`2.0-phase3`

适用范围：2.0 产品、数据协议、事务协议、真实故障回放与阶段交接

最后更新：2026-07-26

本目录是 2.0 实施的权威入口。阶段0冻结产品边界、协议、不变量、回放基线与交接规则；阶段1新增无宿主依赖的 `v2/domain/` 领域核；阶段2新增无宿主依赖的 `v2/transaction/` 消息身份、分支与事务内核；阶段3新增无宿主依赖的 `v2/director/` 玩家边界、H0–H3裁定、事实/知识状态机与主模型上下文合同。当前不宣称 UI、数据库、阶段4领域写入或真实 SillyTavern 行为已经实现。

## 权威文件

1. [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md)：产品定位、设计原则、导演模式、口胡四级、模块和版本边界。
2. [`DATA_TRANSACTION_PROTOCOL.md`](DATA_TRANSACTION_PROTOCOL.md)：核心数据模型、事务状态机、分支隔离、稳定屏障和1.x兼容策略。
3. [`REAL_REPLAY_ACCEPTANCE_MATRIX.md`](REAL_REPLAY_ACCEPTANCE_MATRIX.md)：历史故障到机器回放用例的验收映射。
4. [`PHASE_ROADMAP.md`](PHASE_ROADMAP.md)：阶段1至阶段7的输入、输出、完成门和交接入口。
5. [`PHASE_HANDOFF_TEMPLATE.md`](PHASE_HANDOFF_TEMPLATE.md)：每阶段必须填写的无聊天记忆交接模板。
6. [`handoffs/PHASE_0_HANDOFF.md`](handoffs/PHASE_0_HANDOFF.md)：阶段0实际交接、测试证据与阶段1准确入口。
7. [`handoffs/PHASE_1_HANDOFF.md`](handoffs/PHASE_1_HANDOFF.md)：阶段1领域核公开 API、测试证据与阶段2准确入口。
8. [`handoffs/PHASE_2_HANDOFF.md`](handoffs/PHASE_2_HANDOFF.md)：阶段2事务/分支公开 API、测试证据与阶段3准确入口。
9. [`replay-fixture.schema.json`](replay-fixture.schema.json)：阶段0回放语料的机器可读 JSON Schema。
10. [`../../fixtures/2.0/replay-cases.json`](../../fixtures/2.0/replay-cases.json)：脱敏、最小化的真实故障回放基线。

## 冲突处理

- 数据形态、状态机、写入顺序或迁移冲突，以 `DATA_TRANSACTION_PROTOCOL.md` 为准。
- 产品体验、导演职责、自然语言与 UI 的关系，以 `PRODUCT_SPEC.md` 为准。
- 可验收结果和历史事故覆盖，以 `REAL_REPLAY_ACCEPTANCE_MATRIX.md` 为准。
- 阶段范围与“何时可以进入下一阶段”，以 `PHASE_ROADMAP.md` 为准。
- 若规范与已发布的1.x运行时行为冲突，2.0实现必须通过兼容适配器迁移，不能直接覆盖旧数据。

## 阶段0—3验证

```powershell
node --test tests/v2-replay-fixtures.test.mjs
node --test tests/v2-domain-core.test.mjs tests/v2-domain-replays.test.mjs
node --test tests/v2-transaction-core.test.mjs tests/v2-transaction-replays.test.mjs
node --test tests/v2-director-core.test.mjs tests/v2-director-replays.test.mjs
```

第一条命令验证规格引用、schema、fixture结构、覆盖范围和隐私边界。第二条命令验证阶段1领域记录、1.x只读适配、未知字段保留，以及四个领域 `unit-active` 回放。第三条命令验证阶段2消息指纹、分支迁移、事务状态机、并发幂等、迟到结果和路径级保守回滚，以及两个事务 `unit-active` 回放。第四条命令验证阶段3 Turn Boundary、风险召回/语义裁决分离、H0–H3命令、Fact/Knowledge证据门、主模型上下文合同，以及五个导演层 `unit-active` 回放并保留错轮回复回归。宿主集成、模型、数据库、UI与真实环境行为仍按验收矩阵保持未激活，不会在默认 CI 中制造未来阶段的假失败。
