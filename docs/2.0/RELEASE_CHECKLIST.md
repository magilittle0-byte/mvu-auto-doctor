# MVU Auto Doctor 2.0.0 RC 发布清单

候选：`2.0.0-rc.1`

发布由维护者审阅 Draft PR 后决定；本清单不授权自动合并 `main`。

## 自动门

- [ ] 阶段0的17项 fixture 均为 `unit-active`，行为测试全部通过。
- [ ] `npm.cmd test`：0 fail、0 todo。
- [ ] `npm.cmd run qc:phase7:replay`：17/17 pass。
- [ ] 1.x升级后仍可读，超限/歧义/失败路径可回退，未知字段不丢失。
- [ ] 同分支幂等重复结算、弃用分支迟到写入、stale下游读取均为0。
- [ ] TaskLease硬超时进入可见终态，迟到结果写入为0。
- [ ] 数据库600/601边界、参数化和revision冲突联合门通过。
- [ ] 包内容只来自发布白名单，版本在 `index.js`、manifest、package与lock一致。
- [ ] 离线候选包 SHA-256 已写入 `dist/SHA256SUMS.txt`。
- [ ] 远端候选分支存在；SillyTavern 1.18.0 可从安装对话框指定候选分支，也可从
      已安装扩展的分支按钮切换到 `origin/codex/v2.0-phase7-release-candidate`。

## 真实环境门

- [ ] SillyTavern 1.18.0/`8172dcd`，候选源码指纹与打包源码一致。
- [ ] 390×844 指针/触控、整帖展开/收起、ARIA、无横向溢出通过。
- [ ] 同一主模型开/关消融通过；DeepSeek不作为主模型效果证明。
- [ ] 真实长局至少24轮，重载后聊天、论坛、barrier、幂等和恢复记录仍可读。
- [ ] 真实模型请求HTTP 200；代理仅记录字节数、模型、状态和耗时。
- [ ] 数据库本体、可视化前端、推进重roll助手、骰子前端及其他既有脚本保持启用；独立控件、事件和存储命名空间无冲突，控制台0错误。
- [ ] 模型凭据已清空，临时代理已停止。
- [ ] 模拟与真实结论一致；任何真实失败均使候选状态为 `blocked`。

## 隐私、安全与发布

- [ ] 增量密钥、Authorization、Cookie、私人正文、原始payload和绝对用户路径扫描0命中。
- [ ] `npm.cmd run qc:ci` 通过。
- [ ] 实现与报告提交后 `npm.cmd run qc:record` 和 `npm.cmd run qc:gate` 通过。
- [ ] 远端阶段7提交仅以远端阶段6最终HEAD为父，blob/tree逐对象核对。
- [ ] 用户在线安装/更新入口指向阶段7候选分支，不要求本地导入 ZIP，也不把 RC
      伪装为已进入 `main`。
- [ ] Draft PR base 为 `codex/v2.0-phase6-stable-barrier-replay`。
- [ ] 远端 CI 与真实环境 QC policy 均终态成功。
- [ ] 未推送或合并 `main`。
