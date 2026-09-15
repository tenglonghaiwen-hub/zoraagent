# 节点下拉菜单定位修复

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

用户反馈：菜单出现在控件左侧远处或上方，应从控件正下方展开。

原因：当前 Electron 中原生 select picker 的隐式锚点未计入画布祖先 transform；测试观测到控件屏幕坐标为 x=498、bottom=405，但原生菜单计算为 left=408、top=665。

修复：`canvas-dropdown-position.js` 在鼠标、键盘打开时读取控件 getBoundingClientRect，给浏览器顶层菜单提供视口坐标。固定左对齐、距控件底部 6px，关闭自动上下翻转；展开期间跟随位置变化，下方空间不足时限制菜单高度并滚动。JS/CSS 缓存版本更新为 studio135。

验证：`scripts/verify-dropdown-position.mjs` 检查画布平移及 75%、100%、125% 缩放下菜单在控件下方且左对齐，全部通过。证据：`outputs/dropdown-position-verified/results.json` 及同目录截图。`scripts/verify-canvas-dropdowns.mjs` 复核主题、键盘选择、记忆和滚轮隔离。app.js 与新增模块语法检查通过。没有修改后端和用户数据。
