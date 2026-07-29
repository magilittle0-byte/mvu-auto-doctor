# MVU Auto Doctor 2.0.0 RC 发布清单

候选：`2.0.0-rc.1`

当前状态：`pass-ready-for-main-fast-forward`。2026-07-29 用户真实记录推翻了
旧阶段10 pass；本次结论来自重新完成的当前源码真实门，不复用旧发布结论。
本分支已修复确定性正文结构、重复更新块、失败事件风暴、卡脚本容器、swipe元数据
和手机布局，并把 TavernDB 改为可选协作。无合作协议时是非托管/一致性未知，不再
构成错误或发布阻断。

当前真实 SillyTavern 已确认 MVU API 完整；spv8.4 production、spv5.5.6 legacy、
24轮陌生 Schema 长局、事件风暴、Actor 1/3/5与三类飞行中 stale 均已取得现场证据。
桌面与390×844触控/视觉复验通过。同主模型A/B、Scenario真实修订，以及表格/骰子/
重roll/缝合怪共存矩阵均已完成。宿主仍有 JS-Slash-Runner 自身资源错误；医生、
数据库和伴生前端为0错误，报告明确不宣称全宿主控制台干净。

## 自动门

- [x] 阶段0的17项 fixture 均为 `unit-active`，行为测试全部通过。
- [x] `npm.cmd test`：169 pass、0 fail、0 todo、0 skip。
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

- [x] SillyTavern 1.18.0/`8172dcd`，两处候选部署的65个运行时文件与候选源码一致。
- [x] 390×844 指针/触控、整帖展开/收起、ARIA、无横向溢出通过。
- [x] 同一主模型 `gpt-5.4-mini` 开/关2组配对消融通过；4次HTTP 200，DeepSeek
      未作为主模型效果证明。
- [x] 陌生英文 Schema 真实长局24轮：49消息、24个不同目标、24/24 settled、
      24/24真实模型成功；聊天结构与24条 barrier 收据重载后恢复。临时 Schema
      移除后的 MVU 值不宣称持久恢复，论坛仍以先前独立真实闭环为证。
- [x] 当前源码真实模型闭环：严格变量1次、连续性1次、论坛1次均HTTP 200并成功应用；
      论坛生成4帖12评论，原始请求/响应未持久化。
- [x] 数据库本体 spv8.4 production 与 spv5.5.6 legacy 兼容矩阵通过：公开 API、
      结构发现式 CRUD/refresh/callback/UI、切聊/保存/重载/清理均成功；医生不读取表格，
      不要求数据库注册协议，继续显示 `unmanaged/unknown/info`。
- [x] 作者原版 `spv8.7.4` 与独立最终正文桥真实共存：API 116方法；未修正文事件
      同步请求0，修正文事件公开更新1/1成功且只尝试1次，重载后桥和数据库均恢复。
      桥不改写作者源码、不读取表名/列名，数据库忙碌重试有界。
- [x] 表格可视化模板、推进重roll助手、骰子前端、数据库内缝合怪剧情预设及缝合怪
      专属正则同时启用通过；医生不调用第三方CRUD，不重复挂载、不制造模型风暴，
      49条聊天哈希不变，命名空间无冲突。
- [x] Actor 1/3/5现场分别1/1、3/3、5/5成功，失败0；严格示例与候选白名单冲突的
      根因已修并新增回归。
- [x] 运行中的regenerate/swipe/chat switch分别形成真实stale；模型请求均到达HTTP 200，
      原目标正文保持不变，regenerate/chat-switch计数保持2，swipe0计数保持2。
- [x] Scenario Plan 形成真实不可覆盖v0与1次 `player_action` 来源修订；trigger、
      mechanism、4项精确before/after、5项保留成果、来源引用与UI trace均通过。
- [x] 世界书、TavernHelper、MVU和医生界面可同时加载；医生自检为ok。宿主仍有
      JS-Slash-Runner 404/MIME第三方资源错误；可靠归属为该第三方，医生/数据库/
      伴生前端错误均0，`hostConsoleCleanClaimed=false`。
- [x] 候选源码已部署到真实 SillyTavern 1.18.0；未修改伴生脚本。
- [x] 无 TavernDB 合作协议时环境自检显示 info；扩展正常可用，外部一致性为 unknown。
- [x] 医生托管写入只消费 settled；failed/stale/late 对错误消息、分支和 swipe 零写入。
- [x] TavernDB 注册仅为可选协作，不修改或要求第三方采用医生 API。
- [x] 模型凭据已DELETE并确认 `credentialLoaded=false`；精确代理PID已停止，9328不再监听。
- [x] 模拟与真实已一致；候选状态只在全部当前真实门完成后改为 `pass`。

## 隐私、安全与发布

- [x] 隐私 canary 对密钥、私人正文、派生剧情、完整提示词、原始payload和完整UA均0命中。
- [x] 授权真实 QC 可把作者公开卡及其正常入模上下文发送给所选模型；这不等于允许
      把原始 prompt/response 复制进仓库、报告、归档或委派任务。
- [x] 私人聊天原件只在明确授权时直接用于模型测试；其他情况使用独立副本或合成夹具。
      API 密钥、cookie、浏览器状态和私人 canary 始终不得落盘或成为模型输入。
- [x] 单个数据边界不清只阻断该用例；必须切换到公开/合成夹具继续完成真实模型、
      写回、生命周期和手机 QC，不能以“隐私”为由跳过整套验证。
- [x] `npm.cmd run qc:ci` 通过。
- [x] 实现与报告提交后 `npm.cmd run qc:record` 与 `npm.cmd run qc:gate` 均通过；
      最终 pass 收据必须绑定本次已验证提交，提交变化后不得复用旧 blocked 收据。
- [ ] 推送前重新 fetch 并验证远端 `main` 没有意外提交，且只能安全非强制快进或集成。
- [ ] 推送后验证远端 `main` HEAD、manifest/version及在线扩展源包含本次修复。
- [ ] Draft PR base 为 `codex/v2.0-phase6-stable-barrier-replay`。
- [ ] 远端 CI 与真实环境 QC policy 均终态成功。
- [x] 更新前 `main` 已固定在
      `codex/backup-main-pre-v2.0.0-rc.1-20260727`，且与旧 HEAD/tree 一致。
- [x] `main` 仅做非强制快进；若需回滚，以备份 tree 在当前 `main` 上创建向前回滚
      提交，保证只能在线更新的客户端仍可取得旧版。
- [x] 用户已明确条件授权：全部收尾门成功后可非强制推送到 `main`；force push、
      发布标签和Release仍禁止。
