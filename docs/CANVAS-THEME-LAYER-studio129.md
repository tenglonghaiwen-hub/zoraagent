# studio129：画布 Agent 主题与节点遮挡修复

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

- 所有选中节点统一提升层级，修复文本节点编辑面板被后续图片节点覆盖的问题。
- 画布 Agent 整体采用日间/夜间调色：侧栏、标题栏、输入面板、模型/技能菜单、快捷按钮、素材标签、助手与错误消息同步切换。
- 隔离 Electron 验证通过：重叠处实际鼠标命中 textarea 并可键盘输入（日/夜）；侧栏、输入面板、模型菜单背景切换；刷新后夜间主题保持。无页面错误。
- 测试脚本：scripts/verify-node-layer.mjs、scripts/verify-rail-theme.mjs。截图：outputs/node-layer-verification、outputs/rail-theme-verification。
- 修改前备份：outputs/node-layer-*、outputs/rail-theme-*。两处缓存戳均为 studio129。
