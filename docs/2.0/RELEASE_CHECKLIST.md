# MVU Auto Doctor 2.0.0 RC 发布清单

候选：`2.0.0-rc.1`

阶段10最终状态：`pass-release-candidate-and-main-fast-forward`。现场脚本枚举确认当前 fixture 只有普通 TavernHelper/MVU 脚本，没有 TavernDB；原先“只要 TavernHelper 存在就要求数据库注册”的阻断是误报。现在只有具体 TavernDB/数据库脚本证据才触发注册门，隐藏 TavernDB 脚本的自动回归仍保持 fail-closed。以下较早的 `blocked-external-database-barrier` 段落保留为修复前审计记录，已由本段和结构化报告取代。

发布已由维护者在2026-07-27明确授权；`main` 只允许从已通过全部门禁的候选提交
非强制快进，并须先保存可核对的更新前备份分支。

2026-07-28 发布实况：更新前 `main` 为
`d659167ce3a861dbef3391800057ec7f0d54dbfd`、tree 为
`a19a5a0bc4d7e3e7cebad6694af10c80ad8e5f35`，备份 ref
`codex/backup-main-pre-v2.0.0-rc.1-20260727` 已非强制快进到同一提交。
候选 tree `ddc4317c1d00241cba2f02bb5f43ae583b4e325e` 经逐 blob 核对后发布为
`dfb347400ae80b1b1b34e23b07b3faf1d087c8f8`；`main` 与
`codex/v2-actor-shards` 均指向该提交，未使用 force。PR #29 因同一提交已快进到
`main` 而由 GitHub 自动标记为 merged/closed：
<https://github.com/magilittle0-byte/mvu-auto-doctor/pull/29>。

当前发布后硬化状态：`blocked-external-database-barrier`。真实 TavernHelper/TavernDB
仍直接监听 `MESSAGE_RECEIVED`，没有注册 API v5 barrier v1。阶段10的更新凭据运行
已取得19/19次HTTP 200，并完成严格/轻量通道、主回复、Actor与连续性真实调用。
以下勾选项只是已取得的局部证据；Scenario Plan 5A、运行中三类stale和外部数据库
终态收据仍不完整，当前结果不允许推送任何分支，也不构成更新 `main` 或既有候选
分支的授权。

## 自动门

- [x] 阶段0的17项 fixture 均为 `unit-active`，行为测试全部通过。
- [x] `npm.cmd test`：161 pass、0 fail、0 todo、0 skip。
- [x] `npm.cmd run qc:phase7:replay`：17/17 pass。
- [x] 1.x升级后仍可读，超限/歧义/失败路径可回退，未知字段不丢失。
- [x] 同分支幂等重复结算、弃用分支迟到写入、stale下游读取均为0。
- [x] TaskLease硬超时进入可见终态，迟到结果写入为0。
- [x] 数据库600/601边界、参数化和revision冲突联合门通过。
- [x] 月费独立账本覆盖31/100/1000次、重复收据与重载。
- [x] 快速模型坏结构严格修复重试最多1次，并有明确失败码。
- [x] failed/stale连续性来源永久跳过且有收据；同楼旧分支不覆盖当前来源。
- [x] 65消息、48 swipe、至少3.5 MiB旧档保留未知/TavernDB/重roll助手/当前来源字段。
- [x] 包内容只来自发布白名单，版本在 `index.js`、manifest、package与lock一致。
- [x] 独立审阅包 SHA-256 已写入 `dist/SHA256SUMS.txt`；它不授权晋升。
- [x] 远端候选分支存在；默认分支 `main` 已指向相同候选 tree，已有安装可直接点击
      自动医生这一行的“更新”，全新安装可将分支或标签留空。

## 真实环境门

- [x] SillyTavern 1.18.0/`8172dcd`，两处候选部署的63个运行时文件与候选源码一致。
- [x] 390×844 指针/触控、整帖展开/收起、ARIA、无横向溢出通过。
- [ ] 同一主模型开/关消融通过；DeepSeek不作为主模型效果证明。
- [ ] 真实长局至少24轮，重载后聊天、论坛、barrier、幂等和恢复记录仍可读。
- [x] 更新凭据运行的19次真实模型请求全部HTTP 200；代理只记录字节数、模型、状态和耗时。
- [ ] 数据库本体、可视化前端、推进重roll助手、骰子前端及其他既有脚本保持启用；独立控件、事件和存储命名空间无冲突，控制台0错误。
- [x] 44消息真实长局和世界/事件/论坛计数保持；此项不替代上方尚缺barrier/幂等收据的完整长局门。
- [x] Actor关闭为0额外调用；1/3/5上限均现场保存并运行，所选聊天只有1个合格候选，实际每批1个worker。
- [x] 硬合同失败时Actor与连续性均零调用，随后合法重试恢复严格JSON与真实调用。
- [ ] 运行中的regenerate/swipe/chat switch分别形成真实整批stale且六类下游零写入。
- [ ] Scenario Plan 5A形成真实v0计划和至少一次有来源的真实修订。
- [x] 世界书与现有TavernHelper消息iframe和医生界面同时可见，页面控制台0错误；未修改任何伴生脚本。
- [x] 候选源码已部署到真实 SillyTavern 1.18.0，TavernHelper被识别为潜在数据库写入方。
- [x] 未注册时环境自检准确显示“数据库未注册 barrier 协议”并阻断。
- [ ] TavernDB以 `id=taverndb` 注册 barrier v1、只消费 settled、确认failed/stale abandon。
- [x] 模型凭据已清空，临时代理已停止，9328端口不再监听。
- [x] 模拟与真实不一致已使候选状态为 `blocked`；未伪造数据库兼容。

## 隐私、安全与发布

- [x] 隐私 canary 对密钥、私人正文、派生剧情、完整提示词、原始payload和完整UA均0命中。
- [x] `npm.cmd run qc:ci` 通过。
- [x] 实现与报告提交后 `npm.cmd run qc:record` 和 `npm.cmd run qc:gate` 通过。
- [ ] 远端阶段7提交仅以远端阶段6最终HEAD为父，blob/tree逐对象核对。
- [x] 用户在线安装/更新入口指向 `main` 上的 `2.0.0-rc.1`，不要求本地导入 ZIP
      或加载分支列表。
- [ ] Draft PR base 为 `codex/v2.0-phase6-stable-barrier-replay`。
- [ ] 远端 CI 与真实环境 QC policy 均终态成功。
- [x] 更新前 `main` 已固定在
      `codex/backup-main-pre-v2.0.0-rc.1-20260727`，且与旧 HEAD/tree 一致。
- [x] `main` 仅做非强制快进；若需回滚，以备份 tree 在当前 `main` 上创建向前回滚
      提交，保证只能在线更新的客户端仍可取得旧版。
- [x] blocked收据只允许 `refs/heads/codex/v2.0-rc1-real-long-session-hardening`；
      `main`、既有候选分支、其他ref与force push均禁止。
