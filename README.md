# 造境 Zora

Zora 是面向本地创作与多阶段任务的 Windows 桌面客户端。它以**包内开源 Codex 0.154.0 的 app-server** 为 Agent 执行内核，将对话、素材、文件、图像与视频生成、OpenMontage 工具和部分桌面操作连接到同一工作流程。

Zora 自行启动包内 Codex 进程，不依赖电脑其他目录的 Codex 安装或桌面会话服务。模型推理仍依赖所配置的上游 API。

当前是可运行的开发版本，不是完整复刻 Codex 桌面产品，也不是已完成生产部署、登录认证与支付结算的商业服务。

## Agent 如何运行

```text
用户指令 + 本轮明确 @ 的素材
  → Zora 对话服务：组织上下文、素材与工具定义
  → Codex app-server：创建或恢复线程，运行 Agent loop
      → 模型分析、选择工具
      → Codex 原生文件与终端工具 / Zora 动态工具
      → 必要时在对话中请求回答或审批
      → 工具结果返回 Codex，继续执行
  → 对话回复、执行记录、生成任务与素材结果
```

- 当前默认后端是 `app-server`，通过标准输入/输出上的 JSON-RPC 与实际 Codex 可执行文件通信。
- 模型传输采用 Responses API；“Responses API”是模型接口，“app-server”是管理线程、工具调用与执行循环的运行时，两者不是同一层。
- Codex 使用项目独立的 `data/codex-home`，保存线程映射；不会直接复用用户 Codex 桌面应用的聊天历史。
- 代码保留旧版 `responses` 和 `cli` 后端。当前 app-server 失败时不会自动退回旧循环并重放任务。
- 原生 Codex 工具与 Zora 动态工具并存。工具是否可用取决于当前注册、宿主环境和审批结果，不能仅凭模型回复判断执行成功。

核心实现：[Codex 内核桥](packages/agent/codex-kernel.mjs)、[Agent 入口](apps/server/codex-agent.mjs)、[对话服务](apps/server/chat-service.mjs)。

## 当前能力与边界

最新维护汇总见 [当前实现状态](docs/CURRENT-STATUS.md)。设置支持本地图片/视频壁纸；减少动态效果会暂停背景视频，隐藏页面也停止播放。RunningHub 已移除，不再提供相关接口或安排接入。


| 能力 | 实现情况 |
| --- | --- |
| Codex 执行循环 | 真实 app-server 进程，工具结果回传、连续对话与线程恢复 |
| 对话交互 | 用户提问、MCP 表单与授权链接、命令/文件/权限审批、旧版审批兼容 |
| 执行反馈 | 当前输出、计划、工具过程、执行中补充指令与停止执行；不展示隐藏的完整内部推理 |
| 图像与视频生成 | 多元接口适配、参考素材、任务记录、状态查询与结果展示；依赖上游模型能力和有效凭据 |
| 素材与文件 | 素材库、对话关联文件、预览与下载；参考素材按输入框明确 `@` 选择发送 |
| 视频理解 | 视频画面时序分析、音轨提取与音频转写适配；结果取决于可读取的素材和上游服务 |
| OpenMontage | 本地 sidecar 与工具桥接；不等于已经验收上游项目的全部功能 |
| 独立浏览器 | 搜索、打开网页和读取页面内容；需要桌面宿主，不是任意网站操作自动化 |
| 剪映控制 | Windows 窗口与可访问界面读取、受限点击/输入/快捷键；完整导入—剪辑—导出流程尚未验收 |
| 本地执行 | Codex 原生执行与 Zora 本地工作区工具；部分本地执行流程依赖 Docker |
| 技能 | 项目内技能及导入的 Codex 技能资源；不代表自动继承 Codex 桌面的全部插件和连接器 |

### 尚未完整接入的交互

本机协议中的服务端请求已有明确处理分支，但以下请求需要额外的可信服务：

- ChatGPT 登录令牌刷新。
- 客户端证明（attestation）。
- MCP 专用身份验证（`openai/userVerification`）。

当前 API Key 模式不会伪造这些凭据或返回虚假的验证成功。通用 MCP 表单支持常见字段及复杂值的 JSON 输入，不能据此宣称支持任意 JSON Schema 的全部语义。

## 环境要求

- Windows；Node.js **22 或更新版本**。当前目录内附带 Node.js 24 运行时。
- 包内开源 Codex 0.154.0 运行时，提供 `app-server`。启动器只读取包内清单路径，不查找系统 PATH 或 Codex 桌面安装目录；缺失时明确失败。
- 桌面模式需要 Electron 依赖；浏览器和剪映桥需要桌面进程运行。
- 使用 Docker 执行路径时，需要 Docker Desktop 引擎与相应镜像就绪。仅安装 Docker 命令不代表引擎已启动。
- OpenMontage、视频分析等功能需要各自的 sidecar、Python、FFmpeg 等运行依赖。

本地终端已有运行时、vendor 和依赖目录时，无需为每次启动重新安装；新环境不能假设这些目录已经齐全。

## 启动

### 桌面客户端

在项目目录执行：

```powershell
cd D:\zora
.\start-zora-desktop.cmd
```

桌面壳默认使用端口 `4317`，会启动或复用后端。首次缺少 Electron 依赖时，在 Node/npm 已加入 PATH 的终端执行：

```powershell
npm run desktop:install
npm run desktop
```

### 仅启动后端与网页界面

```powershell
cd D:\zora
$env:PORT = '4317'
& '.\runtime\node-v24.21.0-win-x64\node.exe' apps/server/server.mjs
```

随后打开 <http://127.0.0.1:4317>。不设置 `PORT` 时，服务代码的默认端口是 `8787`，环境配置可能覆盖它。

`start-zora.cmd` 也可启动后端：从包内清单读取 Node 与 Codex，启用 Agent，并由服务加载已保存的凭据。

### 重启与确认

停止自己启动的后端进程，再重新执行启动命令。若桌面壳复用了已有后端，仅关闭并重开桌面窗口未必会重启该后端。不要批量结束所有 Node 进程。

```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/agent/status | ConvertTo-Json -Depth 5
```

检查 `backend` 为 `app-server`、`foundation` 为 `codex-app-server`，且 `kernel.available` 为 `true`。这表示内核进程就绪，不等于上游模型、媒体生成或全部工具已经通过实际调用验证。

## 配置

后端读取环境变量和本地环境文件；Agent 默认值位于 [agent.json](apps/server/config/agent.json)。不要将真实 Key 写入 README、提交到仓库、放入前端代码或发送到日志中。

| 配置 | 用途 |
| --- | --- |
| `PORT` | 后端端口；建议与桌面壳一致使用 `4317` |
| `ZORA_AGENT_BACKEND` | 使用真实内核时设为 `app-server` |
| `ZORA_AGENT_ENABLED` | `false` 会禁用主 Agent |
| `ZORA_CODEX_BIN` | 可选，仅允许包内 Codex 路径；外部路径会被拒绝 |
| `ZORA_AGENT_API_KEY` | 主文字 Agent 的凭据 |
| `ZORA_AGENT_BASE_URL` | 主 Agent 模型服务地址 |
| `ZORA_AGENT_MODEL` | 主 Agent 模型 ID；当前配置默认 `gpt-5.5` |
| `DUOYUANX_API_KEY` | 多元图像、视频等接口凭据；未设置主 Agent Key 时也作为其候选凭据 |
| `DUOYUANX_BASE_URL` | 多元生成服务地址，代码默认 `https://duoyuanx.com` |
| `ZORA_WORKSPACE_ROOT` | Zora 本地运行工具的工作区路径；不代表所有子系统都会同步迁移 |
| `ZORA_SANDBOX_IMAGE` | 本地 Docker 执行镜像，默认 `node:24-bookworm-slim` |
| `OM_ENABLED` | OpenMontage 桥开关；其他参数见 `.env.example` |

主 Agent 和生成接口可以使用不同 Key；使用同一 Key 的前提是上游确实授权该 Key 访问两个服务。配置示例文件尚未覆盖全部变量。

当前开发实现允许后端从本机环境读取凭据。项目约定要求生产场景将第三方密钥置于远程服务端，因此本地开发配置不能作为生产密钥托管方案。

包内运行时来自 `@openai/codex@0.154.0-win32-x64` 官方发布包（开源仓库 `openai/codex`）。包完整性与可执行文件 SHA-256 记录在 `runtime/runtime-manifest.json`。此处采用官方编译产物，并非声称本地 vendor 源码已经编译完成。

## 数据与目录

```text
apps/client/             对话、创作、任务、素材库与设置界面
apps/desktop/            Electron 桌面壳、浏览器与桌面桥
apps/server/             HTTP 服务、对话编排、配置与任务接口
packages/agent/          Codex 内核、交互处理及 Agent 能力
packages/duoyuanx/       多元生成接口适配
packages/desktop/       Windows 桌面驱动
packages/contracts/     模型、参数和任务契约
packages/adapters/      外部系统适配
skills/                 项目技能与导入技能
workspace/              默认工作区文件
data/                  本地持久化状态（见下方说明）
runtime/                本地运行时
vendor/                 第三方组件与运行依赖
scripts/                启动、维护与验证脚本
tests/                  自动化测试
docs/                   专项设计、接入与历史验收说明
outputs/                验证输出与运行日志
```

默认持久化目录包括 `data/chat-sessions`、`data/generation-tasks`、`data/local-approvals` 和 `data/codex-home`。备份时应同时考虑会话、任务状态、工作区文件与素材；不要只备份界面代码。

已生成的结果与任务记录需要分开判断。上游已接受但本地结果不明时，应先查询原任务，避免重复提交造成重复计费。线程恢复也不意味着可以在进程退出后无条件重放未完成的外部操作。

## 验证

包内运行时专项验证（2026-09-15）：12 项测试通过；移除外部 Codex 查找路径后，真实包内进程的工具调用、连续对话及重启恢复通过。后端实际进程路径已核实位于 `runtime/codex`。旧损坏程序已原位替换，未创建旧版本备份；验证使用本地模拟模型服务，未发起付费请求。

在 Node/npm 可用的项目终端执行：

```powershell
npm run check
npm test
npm run test:desktop
node scripts/verify-codex-kernel.mjs
node scripts/verify-codex-interactions-ui.mjs
```

- `check` 是指定入口文件的语法检查，不是完整构建或端到端验收。
- `test:desktop` 和交互界面验证依赖 Electron、Playwright 及本机测试运行环境。
- 内核验证使用真实 Codex 进程和本地模拟模型服务，验证工具循环、连续对话与重启恢复；不代表已验证付费上游模型。
- 最近一次交互接入验证：123 项回归中 122 项首次通过，Windows 窗口枚举一项首次超时、单独复测通过；Electron 表单与真实内核验证通过。这是该次运行记录，不是持续有效的服务保证。

排障时优先记录原始错误、任务 ID、所用模型、实际路由与参数。不要在问题报告中附带 Key 或浏览器桥接令牌。

## 部署与安全边界

这是本地开发应用，登录、生产计费、支付和完整远程部署尚未验收。服务启动代码未显式限定监听地址，不应将开发端口直接暴露到公网；部分本机执行接口的来源校验不能替代完整服务认证。

Codex 原生沙箱与 Docker 工具执行是不同路径，Docker 就绪不代表全部工具都在容器中运行。审批、允许的工具集合与宿主校验仍然有效。未经用户确认，不执行支付、注册、发送消息、修改账号权限或批量删除。

## 进一步阅读

- [项目约定](AGENTS.md)
- [包内运行时](docs/bundled-runtime.md)
- [Codex 主 Agent 接入](docs/codex-agent.md)
- [独立浏览器](docs/INDEPENDENT-BROWSER.md)
- [剪映桌面控制及限制](docs/JIANYING-DESKTOP-CONTROL.md)
- [OpenMontage 桥](docs/openmontage-bridge.md)
- [视频音频时序分析](docs/VIDEO-AUDIO-TIMELINE.md)
- [部署准备情况](docs/DEPLOYMENT-READINESS.md)
- [第三方组件说明](docs/THIRD_PARTY_NOTICES.md)

专项文档中可能保留早期版本的验收数字和设计描述；判断当前行为时，以实际代码、运行状态与本次验证结果为准。

### 技能与执行恢复

任务按规则自动匹配已安装的视频/人物技能，显式选择优先；在“思考与执行”查看技能、摘要、计划及工具阶段。执行记录持久保存，重启后恢复历史并标记中断任务待核对，不自动重提媒体任务。设置中的“工具管理”可搜索和启停 Zora 扩展工具，原生工具由审批模式控制。详见 [当前状态](docs/CURRENT-STATUS.md)。
