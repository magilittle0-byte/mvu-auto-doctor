# MVU Auto Doctor 2.0 阶段6交接

## 1. 身份与发布拓扑

- 阶段：6，稳定屏障、下游和真实回放自动化
- 交付日期：2026-07-27
- 仓库：`magilittle0-byte/mvu-auto-doctor`
- 本地分支：`codex/v2.0-phase6-stable-barrier-replay`
- 远端堆叠 base：`codex/v2.0-phase5-natural-language-ui`
- 本地阶段5父提交：`61f721bb6de6d5ccb247af6c55f9148471f0de3a`
- 远端阶段5唯一父提交：`b96d7caa3440c452918600bfbca11a04a63f75c4`
- 阶段5共同最终 tree：`5cd4b1e19864bbcf98a18f9af22a9b1a812d5c08`
- 阶段6实现提交：
  - 本地：`179afbdf614db0fb081bba8621498dc531df1898`
  - 远端：`50f8da4e9f3bbb3578364776316d944f79d89c9c`
  - 共同 tree：`dbb3c86a87e46e2728f012b3f3aa15224badcf8b`
- Draft PR：[#26](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/26)
- 本交接文件由后续发布回填提交承载；最终 HEAD 以本地分支和 PR
  `headRefOid` 为准，避免在提交内容中伪造自引用 SHA。
- 未合并 `main`。
- 用户已有的 10 个未跟踪 `dist/*.zip` 全部保留，未暂存、删除、覆盖、改名或重置。

## 2. 已完成范围

阶段5确认的 `DomainTransactionPlan` 现在进入持久、可取消、可恢复的宿主执行屏障。
屏障在任何正文后处理或下游看到状态之前完成精确写入、回读和最终指纹核对。

完成的生产能力：

1. `captured → repairing → state-committing → settled` 持久状态机；
2. `failed` 与 `stale` 为终态，目标被放弃，不回退到旧正文或旧分支；
3. 持久 `IdempotencyStore`、recovery 记录和 compare-and-set 适配器；
4. 持久 `TaskLease`、进度、heartbeat、软取消、硬超时和看门狗；
5. 迟到结果、旧分支结果、错误最终指纹全部零写入；
6. 恢复只覆盖仍精确匹配写后值的路径；
7. 数据库 600 字段边界、参数化写入和 revision 冲突门；
8. 正文修复、状态提交、continuity 与 forum 的 settled-only 下游适配；
9. 阶段6回放矩阵和真实环境 QC 收据；
10. 阶段7发布候选 fixture 继续是结构性 TODO，不造成默认 CI 失败。

## 3. 生产 API 与文件

### `v2/runtime/`

- `storage.mjs`
  - `MemoryVersionedAdapter`
  - `PersistentRecordStore`
  - `PersistentIdempotencyStore`
  - `PersistentRecoveryStore`
- `lease.mjs`
  - `TaskLeaseManager`
  - queued/running/cancel-requested/completed/failed/timed-out/stale
  - heartbeat、进度、软取消、硬截止和迟到结果拒绝
- `barrier.mjs`
  - `NarrativeBarrierCoordinator`
  - 精确 fingerprint/active branch 重捕获
  - 修复先于状态提交，精确回读先于 settled 和 downstream
  - `AbortController` 与硬截止竞速
- `database.mjs`
  - 长度、SQL 参数化、revision 三门合并报告
  - 任一失败时零数据库提交
- `replay.mjs`
  - 阶段6真实回放自动化入口与矩阵报告
- `index.mjs` / `index.d.mts`
  - 阶段6公开导出与完整声明

### `index.js`

- 生产 namespace 从 7 升到 8，增加持久 `phase6Runtime`。
- metadata CAS 适配器使用 SillyTavern chat metadata 与耐久保存回调。
- API 从 v3 升到 v4：
  - `runAfterTargetSettled`
  - `executeBarrieredDomainTransaction`
- 阶段5表面执行在宿主未提供自有屏障时自动包装
  `executePlannedDomainTransaction`。
- 宿主执行函数收到持久 idempotency/recovery、保存回调和取消 `signal`。
- continuity/forum 只接受 `settled`；`failed`/`stale` 不降级、不回退、不写入。

## 4. 不变量

- 主模型不是唯一硬边界；本地 Turn Boundary、领域验证、事务计划和运行时屏障均独立生效。
- 所有状态写入仍通过阶段2/4事务内核或宿主事务函数，阶段6不提供绕过路径。
- `DomainTransactionPlan`、确认摘要、目标 fingerprint 和 active branch 不匹配即拒绝。
- 写后回读和最终指纹完成前，不向正文后处理、continuity、forum 或数据库发布状态。
- `failed`/`stale` 目标永不回退到上一条正文或旧分支。
- 硬超时之后到达的模型、修复、数据库或下游结果全部零写入。
- 恢复使用 compare-and-restore，只恢复仍匹配写后值的路径。
- 阶段7发布候选门没有被提前做成默认失败 CI。

## 5. 测试与真实验收

自动化：

```text
npm.cmd test
133 total / 132 pass / 0 fail / 1 todo

npm.cmd run qc:phase6:replay
17 cases / 16 pass / 0 fail / 1 phase-7 structural todo

npm.cmd run qc:ci
pass

git diff --check
pass
```

阶段6新增自动化覆盖：

- captured 持久化先于 repair；
- exact write/readback 先于 downstream；
- 最终 fingerprint 与 active branch 重核；
- stale/failed/late 结果零写入；
- 持久幂等与重启恢复；
- heartbeat、软取消、硬超时和看门狗终态；
- 600/601 长度边界；
- 参数化数据库写入；
- revision 8/9 冲突拒绝；
- conservative recovery；
- API v4 生产下游顺序。

真实环境：

- SillyTavern 1.18.0，commit `8172dcd`，`http://127.0.0.1:8011`；
- 生产部署的 `index.js` 暴露 API v4，`v2/runtime/index.mjs` 可加载；
- 390×844：
  - forum panel 为 0/390/0/844；
  - shell `clientWidth/scrollWidth = 390/390`；
  - 单一整串控制 42px；
  - 展开时 2/2 评论可见，收起时 0 可见；
  - `aria-expanded` 与可见状态同步；
- `deepseek-v4-flash` 真实请求 1 次，上游 HTTP 200，耗时 11764ms；
- 刷新后 8 个主题、17 条评论，整页重载后仍为 8/17；
- 代理只记录 `inputBytes/model/status/durationMs`；
- 验收后先清空 `/credential`，确认 `credentialLoaded=false`，再停止代理；
- 报告未包含密钥、原始 payload、私人聊天、完整提示词或用户目录。

证据：

- `docs/qc-reports/v1.9.0.json`
- `docs/qc-reports/v2.0-phase6-real.json`
- `docs/qc-reports/v2.0-phase6-replay.json`

## 6. 扫描与差异审计

- 暂存增量密钥扫描：0 命中。
- 暂存增量私人内容扫描：0 命中。
- `git diff --cached --check`：通过。
- `git diff --cached --name-only -- dist`：空。
- 远端实现提交以远端阶段5 HEAD 为唯一父提交。
- 24/24 个远端 blob SHA 与本地 Git blob SHA 一致。
- 远端实现 tree 与本地实现 tree 一致：
  `dbb3c86a87e46e2728f012b3f3aa15224badcf8b`。
- 本地分叉历史没有被当作远端堆叠父提交。

## 7. 阶段7准确入口

阶段7标题：**迁移、发布硬化与 2.0.0 候选**。

阶段7必须从阶段6最终本地 HEAD 建立新的独立 `codex/` 分支；远端堆叠分支必须以
PR #26 的最终远端 HEAD 为唯一父提交，并以
`codex/v2.0-phase6-stable-barrier-replay` 为 Draft PR base。

阶段7范围按 `PHASE_ROADMAP.md`：

- 1.x 升级/降级演练；
- 性能、容量、隐私、安全和故障恢复；
- 打包、版本、CHANGELOG 与用户文档；
- 同主模型开/关消融和真实长局；
- 生成 2.0.0 RC、迁移/回滚指南、完整 QC 收据、SHA256、可审阅 PR
  和 2.1 未决项清单；
- 不自动合并 `main`。

完成门：

- 阶段0全部 fixture 已有自动行为层且通过；
- 全套既有测试与真实 QC 通过；
- 密钥/私人内容扫描为 0；
- 1.x 聊天升级后可读，失败可回退；
- 分支/事务/下游/看门狗达到 `PRODUCT_SPEC.md` 成功标准；
- 由维护者审阅 Draft PR 后决定是否合并，任务本身不直接推 `main`。

## 8. 已知发布约束

- 本机 HTTPS Git/`gh` 凭据仍不可用。
- 阶段6远端使用 GitHub Git 对象接口发布，远端父提交、blob 和 tree 均逐对象核对。
- 阶段7若 HTTPS 恢复，应先安全获取远端阶段6对象并核对 tree；否则继续使用同一
  Git 对象流程，只叠加阶段7差异。
- 任何模拟与真实环境结论不一致都必须阻断阶段7发布候选门，但阶段6默认 CI
  仍只保留结构性 Phase 7 TODO。
