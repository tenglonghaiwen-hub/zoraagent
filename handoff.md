# 造境 Zora 开发交接

更新时间：2026-09-20。本文件以当前代码和已取得的验证结果为准，替代旧交接中的版本号、测试数量及“全面完成”表述。

## 本次本地提交范围与后续操作

- 本地快照包含此前尚未提交的 Claude 路由适配、图片生成持久收据、Durable Objects 独立执行，以及本轮整套图片 Agent 和客户端归组展示；不是仅修改交接文档。
- 提交位于 `D:\zora` 的 `codex/fix-internal-error` 分支，提交说明：**修复模型路由与图片结果恢复，新增统一风格套图 Agent**。实际提交号用 `git log -1 --oneline` 查询；本次不推送远程。
- 测试基线：273 项通过，未运行新的付费生成。源码、测试及文档纳入提交；本地数据、密钥、素材、运行时与 Wrangler 临时构建产物不纳入。
- 待操作：重启包内后台、刷新客户端，然后在用户授权生成后验证实际整套图片效果。旧任务缺失的成图未恢复；不得自动补单。

## 本次补充：整套图片 Agent

- 新增 `preview_image_suite` / `submit_image_suite`，仅图片子 Agent 使用；共同风格与逐张描述结构化，逐张固定数量 1、共享原始参考图。保留普通多变体生成，不做超限数量自动拆批。
- 客户端按套图编号归组，顶部整套说明、下方有序并排结果、统一下载/加入参考/画板操作；单页失败或未完成保持原位，详细信息可查逐张提示词和请求。重新编辑/规划进入 Agent，不重新提交合并总提示词。
- 同轮重复工具调用去重；提交失败或未知时停止后续页面，未提交项不自动补交。收据随会话保存，旧版本不覆盖完成结果。
- 全套 **273 项测试通过**，包括模拟上游和实际卡片渲染函数测试；日志 `outputs/image-suite-regression.txt`。未做真实付费生图或当前运行客户端的视觉实测。
- 代码写入唯一工作目录 `D:\zora` 并纳入本次本地快照，未推送、未重启后台。重启本机后台并刷新客户端后加载；套图功能本身不需要更改或部署云端接口。详见 [整套图片 Agent](docs/IMAGE-SUITE-AGENT.md)。

## 本次补充：Claude Agent 协议

本次同时修复 gpt-image-2 的数量映射和结果丢失：`count → n`、`references → image`、比例分辨率转像素尺寸；新增按账号隔离的云端 D1 回执及本地长请求承接，重复编号不重复提交，查询回执不再误走 MiniMax。全套 262 项测试通过。详见 [图片生成恢复](docs/IMAGE-GENERATION-RECOVERY.md)。旧的 22:49:47 请求未保留成图地址，尚不能恢复，未自动重新生成。

云端回执表已创建，Worker 已部署为 `9bcf1b10-caff-4695-96fe-567c5e64d074`，未登录查询回执返回 401。**本机后台重启被自动审批以 `blocked by policy` 拒绝，新本机代码尚待用户手动重启加载**；不得把代码测试通过表述成当前客户端已完成实测。此次未进行付费生图。

后续修正：用户已手动重启后台，但 23:27:07 的 4 张任务仍没有完成回执。现已改用 SQLite Durable Objects alarm 独立执行，避免 HTTP 生命周期结束后丢失结果；完整结果分块持久化，本地旧 revision 不覆盖新结果。云端当前版本 `5cc5a786-f416-4533-9b6b-9dbf8db820bf`，全套 266 项测试及真实 workerd 本地 alarm（模拟上游 4 张）通过。用户明确不要自动拆分；当前 gpt-image-2 渠道实际上限 4，代码拒绝超过 4 的请求。新增本地修改仍需下次重启生效。此前已扣费的原图未找回，不能声称已恢复。

- 修复模型配置 `/v1/messages` 仍被固定发送至 `/v1/responses` 的问题，新增云端 Claude Messages 与 Codex Responses 转换器。
- 路由由服务端模型配置决定；Agent 可以选择已提供的工具，不允许从模型输出覆盖自身上游地址。
- 包内真实 Codex + 模拟 Claude 已验证两次请求、一次工具调用及结果回传；未进行付费 Claude 实测。
- 全套 257 项测试通过，转换器调整后相关 10 项测试复验通过；Wrangler 预检及部署成功，Worker 版本 `955c666a-942a-444e-8e4d-4703f4c23f33`。
- 实现、限制及复验命令见 [Claude Agent 路由](docs/CLAUDE-AGENT-ROUTING.md)。

## 1. 接手先确认

- **唯一开发、实际启动与 GitHub Desktop 工作目录：`D:\zora`**。
- `D:\zoraagent` 已核对为重复源码副本，无独有内容或分支，后续不再作为开发目录；用户已确认清理，GitHub Desktop 旧管理记录已移除；文件夹删除被自动审批以 blocked by policy 拒绝，旧文件夹仍保留，不再用于开发。GitHub Desktop 已添加并选中 `D:\zora`，仓库显示名称仍可能是远程名称 `zoraagent`。
- 历史已推送基线为 `f70d25e`；本次在 `D:\zora` 的 `codex/fix-internal-error` 分支新增本地提交，不再同步旧目录。
- 仓库：<https://github.com/tenglonghaiwen-hub/zoraagent>。
- 历史基线说明：**修复画布媒体生成并接入通用电脑操作，优化执行过程折叠**；本轮变更范围见本文开头，本交接文档随本轮代码一并提交。
- 使用包内 Node 与 Codex，不调用电脑其他目录安装的 Codex。
- 遵守 [AGENTS.md](AGENTS.md)：禁止未经确认批量删除；付款、注册、发送消息、修改账号权限须再次确认；第三方密钥只放远程服务端；报价、模型开放与并发以服务端为准。

## 2. 当前架构与请求链路

Zora 是 Electron 桌面创作客户端，以包内开源 Codex app-server 执行 Agent 循环。模型推理需要所配置的远程服务，并非离线模型。

```text
客户端云端登录 JWT
  → 同源 /api/agent/chat
  → 官方网关验证用户
  → 本地包内 Codex app-server（执行工具循环）
  → 云端 /api/agent/v1/responses
  → 服务端配置的模型提供商

本地工具 → 工作区、桌面桥、浏览器桥、OpenMontage
媒体生成 → 登录后的云端 /api/generate → 上游任务回执 → 查询结果
```

- `apps/client/auth.js`：云模式 Agent 对话转到同源 `/api/agent/chat`；其他接口按网关配置选择。
- `apps/server/routes/generation.mjs`、`cloud-agent-context.mjs`：用户验证、云端调用上下文及本地会话隔离。
- `packages/agent/codex-kernel.mjs`：包内进程、动态工具、审批、事件与多模态工具结果。
- `apps/cloudflare-worker/src/agent-responses.mjs`：鉴权、模型检查、Responses 与流式响应转发，供应商密钥不下发客户端。
- `apps/server/cloud-agent-api.mjs`：模型目录和生成提交走云端，其他本地工具仍留在本机。
- 云用户会话及 Codex home 按用户 ID 哈希分目录。旧云端会话缺少本地记录时创建新线程，主对话附带最近十轮可见文字；旧素材与执行轨迹不能凭空恢复。
- 已移除“回答中出现供应商名称就整段替换”的过滤。直接身份问题仍按产品约定处理。不要恢复会破坏正常技术回复的笼统过滤。

详情：[云端登录与本地 Agent 修复](docs/AGENT-CLOUD-LOOP-FIX.md)。

## 3. 最近交付的改动

### 画布媒体生成

原问题：节点在提交前把预分配 UUID 写入 `genBatchId`，公共函数误走查询分支，导致 `record not found (1000)`。

- 使用独立 `genRequestId` 预留编号，首次调用提交生成，收到回执后查询。
- 云端不再要求仅本地提供的持久任务能力接口；收到上游编号后走 `/api/tasks` 查询。
- 继续传递画幅、分辨率、时长和参考素材。
- 云端回执丢失时提示先核对记录，并阻止同一画布节点直接重复提交，避免重复扣费。

代码：`apps/client/node-workflow.js`、`apps/client/app.js`。详情：[画布媒体生成修复](docs/CANVAS-MEDIA-FIX.md)。

### 通用电脑操作

新增 `desktop_control`，用户只需说出目标，不需要自行枚举应用或提供窗口编号。

- `openApp(name)`：后台按名称匹配安装项并打开；不唯一或找不到时明确报错。
- `listWindows`、`focus`、`readWindow`：自动定位、激活窗口并读取可访问控件，不再只支持剪映。
- `captureWindow`：取得前台窗口截图，以 Codex `inputImage` 工具结果回传。图片二进制不写入 Zora 工具执行记录，但会作为模型输入发送给已配置的服务。
- `click`、`type`、`keys`：窗口内点击、输入和快捷键，支持 Win / Ctrl+Escape，可通过开始菜单和截图操作，不要求应用启动一定依赖安装清单。
- 保留桌面操作确认、焦点和坐标边界检查；不猜坐标，不以“已发送启动请求”代替“已核验窗口”。
- 浏览器导航失败时关闭旧窗口并报错，避免继续显示旧页面；浏览器工具不能替代启动桌面软件。

代码：`packages/desktop/windows-driver.mjs`、`scripts/windows-desktop.ps1`、`apps/desktop/main/desktop-bridge.mjs`、`packages/agent/desktop-tool-content.mjs`。详情：[通用电脑操作](docs/DESKTOP-CONTROL.md)。

### 思考与执行展开行为

- 执行时默认展开，任务结束时自动折叠一次。
- 用户手动展开后，轮询和对话重绘不再自动关闭。
- 内层工具详情也保留展开状态。
- 仅显示明确返回的推理摘要、计划、工具和进度，不编造隐藏推理。

代码：`apps/client/execution-disclosure.js`、`runtime-panel.js`、`app.js`。

## 4. 启动与运行检查

```powershell
Set-Location D:\zora
.\start-zora-desktop.cmd
```

桌面启动器使用包内 Node，并启动或复用本地后台。修改 Electron 桥接或后台后应完整重启；仅前端修改可刷新页面。

- 本地 Node：`D:\zora\runtime\node-v24.21.0-win-x64\node.exe`。
- 包内 Codex：`D:\zora\runtime\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`；正式解析优先使用 `runtime/runtime-manifest.json`。
- 桌面后台默认端口 `4317`；高级设置的本地网关默认值仍为 `4318`，不要把两个端口视为同一个服务。
- 本次更新时确认 `4317` 正在监听。PID 会变化，后续必须实时查询，不能按旧 PID 停止进程。
- 此前已验证桌面窗口启动、`/api/generation-capabilities` 响应以及桌面桥真实窗口读取。
- 前端 `app.js` / `runtime-panel.js` 入口版本为 `studio199.3`，其他资源有独立缓存版本；修改时按实际引用递增。
- 重启仅操作核验属于本工程的进程，禁止批量结束电脑上的 Node、Electron 或 Codex。

## 5. 验证结果与边界

最新代码提交前执行：

```powershell
Set-Location D:\zora
& .\runtime\node-v24.21.0-win-x64\node.exe --test tests/*.test.mjs
```

**250 项测试通过，0 失败**。最近日志位于 `data/pre-push-tests.log`，属于本地验证资料，不提交运行数据。

新增覆盖：首次媒体提交与实际编号查询、回执丢失、桌面参数校验、截图回传格式、执行面板完成后折叠一次及手动展开保留。

此前真实包内 Codex 对接本地模拟模型已验证工具调用、连续对话和重启恢复。模拟模型测试不等于付费上游端到端验收。

尚未完成：

1. 付费模型与媒体生成实测；不能保证供应商输出画幅一定遵循请求参数。
2. 让 Agent 完整打开并操作微信的端到端验证；不同应用、多个显示器、高 DPI 的兼容性验证。
3. 提权桌面、锁屏、通用拖拽及任意快捷键不在当前已实现能力内。截图要求目标窗口处于前台且未最小化，模型必须支持图片输入。
4. 云端媒体持久化、按本地 UUID 找回任务、幂等、提供商查询差异仍有缺口；回执丢失不应盲目重提。
5. 模型流请求在成功接受时按现有方法扣费；流中断退款、并发预占等生产计费机制尚未完善。
6. 正式打包、签名和无开发环境电脑上的完整独立安装验收未完成。

## 6. 数据、密钥与同步规则

- `data/`、`workspace/`、用户素材、会话、IndexedDB、数据库、运行日志和密钥不是源码交付物，不批量复制或提交 Git。
- `data/desktop-bridge.json` 与 `data/browser-bridge.json` 含本地桥接凭据，不展示 token，不上传。
- 云端网关：`https://zora-api.tenglonghaiwen.workers.dev`。此前部署的版本不能当作实时状态；需要时重新查询部署记录。
- 两个旧副本的 Git 换行设置曾不同；本次确认 7,996 个文件仅换行格式不同，无内容差异。以后只在 `D:\zora` 工作，不再双向同步。
- Git 提交标题和正文使用中文，列明实际修改、验证及限制。推送当前工作分支，不强制覆盖远程历史。

## 7. 后续接手建议

先核对 `D:\zora` 的 Git 状态和实际运行进程，再检查最近请求的工具记录。电脑操作问题应确认是否调用 `desktop_control`、截图是否作为图片输入返回、窗口核验是否成功；不要重新把桌面指令导向浏览器。

优先补充可控测试窗口的打开、截图、输入、读取结果闭环，再做微信等真实应用验收。涉及发送消息、付款或权限变更，仍需明确用户确认。

其他资料：[文档索引](docs/README.md)、[API 规范](docs/API.md)、[架构分离](docs/ARCHITECTURE-SEPARATION.md)、[当前状态](docs/CURRENT-STATUS.md)。其他文档如仍有旧测试数量或旧完成声明，以当前代码和本文件已明确区分的验证边界为准。
