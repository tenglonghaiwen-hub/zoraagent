# Zora 包内运行时

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

更新日期：2026-09-15。

## 当前组成

- Node.js 24.21.0：`runtime/node-v24.21.0-win-x64`，项目要求 Node.js 22 或更新版本。
- 开源 Codex 0.154.0：官方 `@openai/codex@0.154.0-win32-x64` 发布包。
- 路径、版本、下载来源、包 SHA-512 完整性及 Codex 可执行文件 SHA-256 记录在 [运行时清单](../runtime/runtime-manifest.json)。

Codex 入口：

```text
runtime/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe
```

平台包还提供代码执行宿主、Windows 沙箱辅助程序及 rg。应保持平台包结构完整，不能只分发一个 codex.exe。

## 来源与独立性

Zora 使用开源仓库 openai/codex 的官方编译发布产物作为基座，不调用 Codex 桌面产品安装目录中的程序。包内的 `vendor/codex-main` 是源码副本，不是当前运行入口；此次没有宣称该源码已经在本机编译成功。

加载器默认读取清单中的包内路径。`ZORA_CODEX_BIN` 只允许指向项目内；包外路径、指向包外的链接会被拒绝。不会搜索系统 PATH、全局 npm 或用户 Codex 安装目录。包内程序缺失时明确失败，不自动借用外部安装。

Codex 的状态目录是 `data/codex-home`，默认工作目录是 `workspace`。包内内核独立不代表模型离线运行，也不代表 Docker、媒体依赖或所有工具均无需宿主环境。

## 启动

- `start-zora-desktop.cmd`：启动桌面壳及后端。
- `start-zora.cmd`：通过包内 Node 启动后端，启用主 Agent。
- 主 Agent 凭据由后端加载；Windows 加密凭据绑定保存它的用户，不适合直接复制到另一台电脑使用。

## 修复与验证

旧 codex.exe 不完整，已用校验通过的发布包原位替换，未创建旧版本备份。启动清单不再指向不存在的源码编译产物。

2026-09-15 验证：

- 包内 `codex --version` 返回 `codex-cli 0.154.0`。
- 包内解析、交互、凭据相关 12 项测试通过。
- 清除外部查找路径后，真实包内 Codex 完成动态工具调用、连续对话与进程退出后的线程恢复。
- 恢复验证等待旧进程退出，避免 SQLite 状态仍占用时立即重启。
- 后端重启后实际运行路径已确认在包内。
- 使用本地模拟模型服务，未验证付费上游请求，也未宣称完成全新电脑的整包安装验收。

证据：[专项测试](../outputs/bundled-codex-tests.log)、[隔离内核验证](../outputs/bundled-codex-isolated.log)。

已安装的 Codex 下载 tgz 已按用户确认清理；包内运行时、清单及下载来源校验记录仍保留。
