# 输入框遮罩修复（studio118）

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

- 将磨砂背景与 backdrop-filter 从允许浮层溢出的输入框容器移至独立伪元素，以圆角 clip-path 限制绘制范围，保持菜单可展开。
- 保留降低透明度及不支持 backdrop-filter 的回退样式。两处资源缓存戳升级为 studio118。
- 原文件备份：outputs/composer-mask-20260912-210922。
- 隔离 Electron 验证：展开、收起截图已生成，类型菜单可见；遮罩裁剪值 inset(0px round 24px)，外容器 backdrop-filter 为 none；无页面错误或外部请求。app.js 语法检查通过。
- 验证证据：outputs/composer-mask-20260912-210922/verification。未操作用户正在使用的窗口，需重新打开程序加载新样式。

## studio119：聊天裁剪边界修正

用户反馈 studio118 未解决实际问题。带聊天记录复现发现 conversation-log 底边为 643px，输入框顶边为 659px，相差 16px；此前验证未覆盖聊天滚动状态。

将活动聊天工作区 gap 改为 0，展开输入框仅保留内阴影，消除外扩深色阴影。更新两处缓存戳为 studio119。

隔离 Electron 中短消息和 40 行长消息验证：聊天底边与输入框顶边均为 675px，边界差小于 1px 断言通过；类型菜单可见，无页面错误、无外部请求，app.js 语法检查通过。截图与日志位于 outputs/chat-boundary-after 和 outputs/chat-boundary-long。未刷新用户窗口。
