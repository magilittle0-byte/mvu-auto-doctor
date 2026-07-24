# 待办改进清单（交给 AI 助手继续实现）

> 本清单来自 2026-07 的三份深度审查（工程架构 / 参考项目对比 / 前端体验）。
> v1.7.2 已完成：通知级别、操作时间线、悬浮球 kind 聚合修复、零改动修正版拦截、
> 成稿纪律提示、package.json / LICENSE / CI / 版本一致性测试。
> 以下为尚未实现的项目，按优先级排列。每项可独立完成，完成后请更新 CHANGELOG 并升版本号。

## 高优先级（性价比最高）

### 1. 环境自检卡（U10）
在设置页顶部加一张「环境自检」折叠卡，程序化检测并显示为 ✅/⚠/❌ 列表：
- SillyTavern context 可用；
- MVU 完整 API（getMvuData/parseMessage/replaceMvuData）可用；
- 故事神谕 AUTO 是否已关闭（已有 `disableStoryOracleAutoIfNeeded` 检测逻辑可复用）；
- MVU「额外 AI 解析」是否开启（`Mvu.isDuringExtraAnalysis` 存在即提示确认关闭）；
- 连续性注入接口（setExtensionPrompt/registerInjection/extensionPrompts）可用。
提供「重新检测」按钮；全绿时折叠成一行"环境正常"。
这能消灭 README 三条红线全靠用户自觉的问题。

### 2. 设置页全折叠（U1）
设置页目前是无尽长卷。改为：顶部状态总览常开 + 各功能区
（变量诊断 / 硬合同 / 活世界 / 论坛 / 进阶低频项）全部用已有的
`.mvuad-settings-fold` 组件折叠。默认只展开状态区。

### 3. 长任务进度与软取消（N3/U9）
- 变量诊断状态行升级为阶段指示："等待 MVU 稳定 → 构建上下文 → 模型分析(第x/3次) → 本地校验 → 写入回读"，附已耗时秒数；
- 所有"正在…"状态旁加「忽略本次结果」软取消按钮（内部调用 `invalidateOperations('用户取消')`，已有 epoch 机制保证安全）；
- 完全体：给 callModel 加 AbortController（若宿主 API 支持 signal）。

## 中优先级

### 4. 浅色主题适配（U6）
状态色 `#f1c75b/#78d69c/#ff8e8e` 在白底对比度不足；悬浮球写死深蓝夜空渐变。
改为语义 token：
```css
--mvuad-ok: color-mix(in srgb, #2e9e5b 70%, var(--SmartThemeBodyColor));
--mvuad-warn: color-mix(in srgb, #b07d1a 70%, var(--SmartThemeBodyColor));
--mvuad-err: color-mix(in srgb, #d04545 70%, var(--SmartThemeBodyColor));
```
悬浮球改为 accent 色 + 主题背景生成的渐变。

### 5. 字号下限（U7）
多处 0.68–0.82em 嵌套缩小到约 10px。规范：正文类 ≥0.84em、徽章/meta ≥0.74em、
嵌套元素不再二次缩小；或给面板根加 `font-size: max(0.9em, 13px)` 兜底。

### 6. 危险操作确认升级（U11）
「清空世界账本」「清空内置帖子」目前用原生 `window.confirm`：
- 加 `.mvuad-danger` 红色描边样式并与常用按钮拉开距离；
- 改用酒馆主题化弹窗（`context.callGenericPopup`，注意做能力检测回退到 confirm）；
- 确认文案写明数量与不可逆性（"账本包含 N 条未结事件，清空后无法恢复"）。

### 7. 表单一致性（U13）
- 「附加提示词」textarea 改为失焦自动保存 + "已保存"轻提示；
- 数字框静默钳制时给一次行内提示（如"已限制为 4096–…"）；
- max_tokens 提供 8192/16384/32768 快捷 chip。

## 低优先级 / 结构性（建议大版本时做）

### 8. index.js 模块化拆分（工程报告建议 1）
6300+ 行拆为 ui-settings.mjs / ui-floating.mjs / ui-forum.mjs / pipeline.mjs / model-client.mjs，
index.js 只保留装配。拆分时同步做 CSS 去重（U17：设置页与悬浮面板两套
`.mvuad-thread-*` 约 200 行重复，改为组件类自足）。

### 9. 事件卡片信息分组（U4）
summary 徽章从 6 枚减到 2 枚（阶段+紧迫度）；展开正文 15+ 字段分为
「当前 / 因果 / 传播」三组二级折叠，默认只开「当前」；空值字段默认隐藏。

### 10. 账本单一化（U3）
设置页嵌入的完整事件账本移除，只留「打开世界面板」入口按钮；账本单一存在于悬浮面板。

### 11. 论坛小改进（U5）
相对时间（"刷新于第 N 页"）、刷新后新帖标记、刷新中骨架占位、评论者首字头像圆片。

### 12. 悬浮球/面板操控（U12）
长按球 1 秒弹出「归位重置」；面板支持上下两档停靠或标题栏拖动；
面板补 `aria-modal` 与焦点管理（打开时 focus 进面板、关闭归还焦点）。

### 13. 触控与 a11y（U15/U16）
手机断点内可点元素统一 `min-height: 42px`；tucked 态悬浮球加透明扩展命中区；
事件进度条加 `role="progressbar"` + `aria-valuenow`；分类条加键盘左右键支持。

## 实现约束（务必遵守）
- 所有改动保持向后兼容：老设置用 settingsVersion 迁移，不破坏已有聊天数据；
- 不改变核心安全语义：目标校验（targetIsCurrent）、写前恢复记录、写后回读校验、撤销守卫一律保留；
- 每次改动后运行 `npm test`（20 个测试须全部通过），必要时补新测试；
- manifest.json / index.js / package.json 三处版本号同步升级（有测试强制检查）；
- 更新 CHANGELOG.md。
