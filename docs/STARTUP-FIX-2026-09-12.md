# 桌面启动脚本修复

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

用户报告双击 `D:\zora\start-zora-desktop.cmd` 无法打开程序。

## 已复现原因

正常终端环境下旧脚本能够启动；将子进程 PATH 限制为 Windows System32 后，同一旧脚本失败，输出：

```text
> zora-desktop@0.1.0 start
> electron .
'"node"' is not recognized as an internal or external command,
operable program or batch file.
```

脚本虽显式调用内置 npm，但 npm 调用的 Electron shim 仍通过 PATH 查找 `node`。因此旧脚本并未真正消除对系统 Node 环境的依赖。没有直接读取 Explorer 的环境快照，不能断言用户当时的进程环境与复现环境完全相同。

## 修复与验证

- 使用 `setlocal`，仅为启动进程把内置 Node 目录加入 PATH，不修改系统或用户环境变量。
- 清除该启动进程的 `ELECTRON_RUN_AS_NODE`，确保 Electron 以桌面程序运行。
- 失败时显示退出码并暂停，避免窗口一闪而过。
- 转发可选 Electron 参数，便于使用独立数据目录验证入口。
- 修复后在无系统 Node PATH 的条件下，从同一 `.cmd` 成功启动；系统窗口列表和可访问性文本均确认出现 Zora 欢迎页面。
- 本轮验证关闭自动 OM sidecar，仅复用现有本地服务，不提交聊天、生成或付费任务。
- 测试实例使用 `D:\zora\outputs\startup-path-check-profile` 独立数据目录。直接双击脚本不传参数时仍使用正常应用数据目录。

本轮只修改 `start-zora-desktop.cmd`。备份：`D:\zora\outputs\startup-fix-20260912-205840\start-zora-desktop.cmd`。

原 31 项桌面验收直接使用 Electron 可执行文件，未覆盖 `.cmd` 启动入口；此次补上的是启动脚本在缺少系统 Node 环境下的实际开窗验证。
