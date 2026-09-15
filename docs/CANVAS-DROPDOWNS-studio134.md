# 画布下拉框统一（studio134）

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

本轮统一节点模型、比例、分辨率、生成模式、时长、数量、并发、输出素材选择，以及画布 Agent 模型/技能菜单和添加节点菜单。

- 控件高 34px，圆角 9px，12px 字号；菜单圆角 12px，统一内边距、选中背景、箭头、边框和阴影。
- 深浅主题使用同一组画布菜单变量。Agent 模型菜单宽 240px，减少模型名称不必要的换行。
- 节点 select 使用 Electron 当前 Chromium 支持的 `appearance: base-select`。保留原生键盘及 change 事件，弹出菜单处于浏览器顶层，避免被节点编辑器的 overflow 裁切。
- 原有选项值、选择记忆和请求逻辑未改；JS/CSS 缓存戳均为 studio134。

验证：`scripts/verify-canvas-dropdowns.mjs` 通过日夜菜单配色一致、34px 高度、键盘选择、刷新保持及滚轮不缩放画布检查，结果见 `outputs/canvas-dropdowns-verified/results.json`。已检查宽屏和 1100×760 窗口截图。

桌面完整回归 31 项通过，无页面脚本异常：`outputs/canvas-dropdowns-full-regression/desktop-results.json`。首次筛选回归跳过了进入画布的前置步骤，导致收起按钮测试超时；完整执行后通过。CSS 检测器仅提示旧样式中的字体、边框及动效规则，未改动本轮范围外的界面。

备份：`outputs/canvas-dropdowns-20260912-232814`，附 hashes.json。没有修改后端或用户数据。重新打开软件或刷新页面加载新样式。
