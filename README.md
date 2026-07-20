# MVU 自动医生（通用）

这是一个独立的 SillyTavern / TauriTavern 扩展。它不会修改角色卡，也不会修改 Story Oracle 文件。

## 安装

在 TauriTavern 的扩展安装页面选择“从 Git 仓库安装”，粘贴：

```text
https://github.com/magilittle0-byte/mvu-auto-doctor
```

安装后刷新一次页面。后续版本可直接使用扩展管理里的“更新”功能，不需要重新下载压缩包。

每次收到新的 AI 回复后，扩展会：

1. 动态读取当前角色卡暴露的 MVU/Zod Schema。
2. 动态读取当前启用世界书中的 `[mvu_update]` 规则。
3. 对比上一 AI 楼层状态、当前 `stat_data`、本轮正文和原更新区块。
4. 让模型只生成针对当前状态的纠错/补漏补丁。
5. 在内存副本上校验路径、操作、MVU 解析和 Zod 结果。
6. 全部通过后才原子写入，并在写入后回读验证。
7. 刷新消息与 `<StatusPlaceHolderImpl/>`，让正文状态栏立即重建。

模型连接顺序：

- 默认优先使用 Story Oracle 已配置的连接（稳定 Hook API v1）。
- Story Oracle 未安装、未配置或调用失败时，自动使用酒馆当前主连接的 `generateRaw`。

为避免两个自动程序同时写变量，扩展默认会关闭 Story Oracle 的 `AUTO` 诊断开关；Story Oracle 的手动诊断不受影响。

扩展设置里提供：

- 自动开关
- 模型连接优先级
- 双写保护
- 回复后等待时间
- 手动检查最新回复
- 撤销本次启动后的上一次自动修复

插件不包含任何角色卡专属字段、路径或枚举。角色卡更新或切换到其他 MVU 卡时，会重新读取新卡的规则和 Schema。
