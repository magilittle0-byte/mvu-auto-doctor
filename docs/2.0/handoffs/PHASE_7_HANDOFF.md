# MVU Auto Doctor 2.0 阶段7交接

## 1. 候选身份与发布拓扑

- 阶段：7，迁移、发布硬化与 `2.0.0-rc.1` 候选
- 交付日期：2026-07-27
- 本地分支：`codex/v2.0-phase7-release-candidate`
- 本地唯一父提交：阶段6最终本地 HEAD
  `621aa81766383342374f82858f309f39141c306c`
- 远端唯一父提交：阶段6最终远端 HEAD
  `6b97fbd4670a1028c22fe9e3b94c9eda61b5a587`
- 远端堆叠 base：`codex/v2.0-phase6-stable-barrier-replay`
- Draft PR：[#27](https://github.com/magilittle0-byte/mvu-auto-doctor/pull/27)
- 阶段7实现提交：
  - 本地：`374e317bc94809108dfc6a748f8984bbba903c51`
  - 远端：`c7c8926bab252b2b5d5186bd2e55e47cd6bc65b9`
  - 共同 tree：`c8ab0ab212831fa30e8c18fa773d76ab949ce6ff`
- 未推送或合并 `main`；候选只能由维护者审阅 Draft PR 后决定。
- 本交接不在自身内容中伪造自引用 commit/tree；最终值以分支和 Draft PR
  `headRefOid` 为准。
- 用户已有的10个未跟踪历史离线 ZIP 全部保留，未暂存、删除、覆盖、改名或重置。

## 2. 阶段7交付

### 迁移与回滚

- `v2/release/migration.mjs` 提供只读 `prepareLegacyUpgradeDrill()`：
  - 不重写1.x源聊天；
  - 保留未知作者字段；
  - 默认上限256条领域记录、8 MiB序列化输入；
  - 歧义、隔离或超限时进入 `fallback`，不生成部分权威 sidecar。
- `rollbackLegacyUpgrade()` 验证只读快照 SHA-256 后移除V2权威，
  恢复1.x可读视图；摘要不匹配时阻断覆盖。
- 256条容量演练：136502字节、20.599ms，旧聊天可读、摘要回滚通过。
- 用户授权的更新前最终真实记录只读演练：
  - 57条消息、44个swipe、29个唯一医生来源ID；
  - 迁移投影3321711字节，默认8 MiB有界窗口内为 `ready`；
  - 迁移156.712ms、摘要回滚148.232ms，恢复后仍为57条消息；
  - 私人正文、提示词、密钥、原始payload、文件名和绝对路径均未写入仓库。
- 该记录的1.9.0脱敏诊断还暴露出两个收据可读性缺口：注入已注册但在最终提示词
  事件前显示为false，以及目标型模型调用楼层均为-1。候选已分别改为即时记录注册
  状态、传递脱敏楼层索引；两项均由浏览器回归覆盖，不改变硬边界或正文。

### 发布硬化与候选门

- `v2/release/hardening.mjs` 联合检查性能、容量、长局、隐私、安全、
  故障恢复及伴生脚本共存。
- `v2/release/gate.mjs` 要求：
  - 17/17行为回放；
  - 真实SillyTavern与模拟验证同一源码指纹；
  - 1.x可读且回滚通过；
  - 同主模型开/关消融；
  - 确定性包SHA和内容白名单。
- 真实QC失败时结果固定为 `blocked`，且返回值中不存在发布授权。
- 通过时只到 `ready-for-maintainer-review`，`automaticMainMerge=false`。

### 打包、版本和用户文档

- 版本统一为 `2.0.0-rc.1`：
  - `index.js`
  - `manifest.json`
  - `package.json`
  - `package-lock.json`
- 确定性候选包：
  `dist/05_MVU自动医生_v2.0.0-rc.1_离线候选.zip`
- SHA-256：
  `5c9db5f360c33a8954c0532eb33abe9864a095db6d940ce2a0c48f606d981345`
- 连续构建两次字节级SHA一致；62个白名单文件、1343137字节。
- 新增：
  - `docs/2.0/MIGRATION_ROLLBACK_GUIDE.md`
  - `docs/2.0/USER_GUIDE_2.0_RC.md`
  - `docs/2.0/RELEASE_CHECKLIST.md`
  - `docs/2.0/2.1_OPEN_ITEMS.md`
  - `docs/qc-reports/v2.0.0-rc.1.json`

## 3. 自动化与发布判定

```text
npm.cmd test
142 total / 142 pass / 0 fail / 0 todo

npm.cmd run qc:phase7:replay
17 cases / 17 pass / 0 fail / 0 todo

npm.cmd audit --omit=dev --audit-level=high
0 vulnerabilities

npm.cmd run qc:ci
pass

git diff --check
pass
```

候选运行时源码指纹：

```text
4555a86839ae5a4a4c0d633acd615b16c63eae1daf3fa1dfba27968924c2fd01
```

发布门实算结果：

```text
hardening=pass
hardeningIssues=0
decision=accept
status=ready-for-maintainer-review
automaticMainMerge=false
```

## 4. 真实环境QC

- SillyTavern 1.18.0，commit `8172dcd`，真实候选运行时已部署。
- 390×844指针/触控：
  - 浮动面板完全在视口内；
  - 论坛面板为390×844；
  - 21个主题各有且仅有一个整帖控制；
  - 最小控制高42px；
  - 展开时正文完整、2条评论同时可见，ARIA同步；
  - 收起时评论容器隐藏；
  - 页面与论坛均无横向溢出。
- 真实长局为33条消息；重载后33条消息、21个主题、53条评论均持久。
- `deepseek-v4-flash`：
  - 成功请求1次；
  - HTTP 200；
  - 输入21851字节；
  - 7312ms；
  - 受限代理的首次599被候选门阻断且零论坛写入，联网内存代理重试后才提交。
- `gpt-5.4-mini`：
  - 阶段7使用合成、无私人内容样本执行开/关短A/B；
  - 3次请求均HTTP 200，其中一次低输出上限无最终正文后按显式上限有界重试；
  - 当前长局写入0；
  - 阶段6的2对语义消融继续有效，候选对主模型守卫的生产差异仅版本常量。
- 两个代理都只记录输入字节数、模型、状态和耗时；验收后凭据已清空，
  `credentialLoaded=false`，代理均已停止。

## 5. 数据库、推进重roll助手及其他脚本共存

用户提供的 `推进重roll助手V2` 源文件只用于只读兼容审计，未导入、修改或写入仓库：

- SHA-256：
  `ffc93ebefd15c695a011b528433476e779164df3c863766aab849fac58933e2f`
- 启用态脚本监听 `chat_id_changed`，在发送区使用独立
  `reroll-helper-btn`，存储使用独立 `Reroll_Global_Settings` 与
  `Reroll_Cache_` 前缀。
- 它会触发重生成并读取当前聊天；自动医生仍以捕获的
  message/swipe/generation/branch/fingerprint判陈旧，不能绕过阶段6 barrier。
- 自动医生使用独立 `mvuad-*` 控件和扩展命名空间，不覆盖该助手的按钮或存储键。
- 真实页刷新前后12个扩展脚本保持加载，数据库入口仍存在，控制台错误为0。
- 数据库600/601、参数化SQL、revision冲突、重roll分支幂等和迟到零写入继续由
  自动化覆盖；任何后续伴生脚本冲突现在会使硬化门失败。

## 6. 隐私、安全与恢复

- 报告不含密钥、私人聊天、完整提示词、原始模型payload或绝对用户路径。
- 真实模型凭据只经Windows DPAPI current-user broker注入内存代理。
- 依赖审计0漏洞。
- 包只含显式运行时/用户文档白名单，不含测试、日志、凭据、用户历史ZIP或QC代理。
- 1.x源聊天、未知字段和回滚快照不被生产迁移修改。
- stale/failed/late零写入、settled-only下游、精确写后回读、保守恢复、
  TaskLease软取消/硬超时和数据库门保持阶段6不变量。

## 7. 2.1未决项

`docs/2.0/2.1_OPEN_ITEMS.md` 记录后续候选：

- 迁移批次可视化与人工隔离审阅；
- 更大数据集的容量基准；
- 更多伴生脚本的显式契约适配器；
- 长期成本/配额可视化；
- 维护者决定的正式2.0.0发布与签名策略。

这些项目不改变 `2.0.0-rc.1` 的完成门，也不授权自动合并 `main`。

## 8. 远端发布证据

- 32/32个阶段7远端 blob SHA 与本地实现提交一致。
- 远端实现 tree 与本地实现 tree 一致：
  `c8ab0ab212831fa30e8c18fa773d76ab949ce6ff`。
- 远端实现提交的唯一父提交为
  `6b97fbd4670a1028c22fe9e3b94c9eda61b5a587`。
- Draft PR base SHA 由GitHub返回为同一个阶段6远端最终提交。
- 远端实现检查：
  - CI run #41：success
  - Real environment QC policy run #47：success
- 本交接由后续文档提交承载；最终远端 HEAD 和该文档提交的最新检查以
  Draft PR #27 为准，不在文件中伪造自身SHA。
