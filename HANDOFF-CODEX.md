# 造境 Zora → Codex 交接文档

> 2026-09-16：此文件为历史交接记录，最新维护入口见 [文档索引](docs/README.md)。旧缓存版本、路由与测试数字不代表当前部署。

> 当前运行时说明（2026-09-15）：已使用包内开源 Codex 0.154.0 app-server，禁止外部安装回退。下文为历史交接记录；最新启动与运行时以 [README](README.md)、[包内运行时](docs/bundled-runtime.md) 和 [Agent 接入](docs/codex-agent.md) 为准。

> 日期：2026-09-12  
> 交接方：幕僚长 / Grok Bot 协作会话  
> 接收方：Codex  
> 用户：Tr2ck（Windows 账户 `强哥`，机器 `DESKTOP-TI64NQE`）

---

## 1. 产品定位（先读这个）

**造境 Zora** = 桌面端创作软件（Electron），不是网页 SaaS。

| 原则 | 说明 |
|------|------|
| Agent-first | 能力优先走 Agent 工具调用，UI 尽量少改 |
| 桌面壳 | Electron：`D:\zora\apps\desktop` |
| Comfy | RunningHub 已移除，不再接入 |
| OpenMontage | 能力嵌入客户端；本地参考仓 `D:\ui\_review\OpenMontage-current`；上游 `https://github.com/calesthio/OpenMontage` |

用户日常工具偏好：GitHub / 开发部署 > Canva/M365（除非明确要求）。

---

## 2. 仓库与路径

| 路径 | 用途 |
|------|------|
| `D:\zora` | 主工程 |
| `D:\zora\apps\client\` | 前端：`index.html` / `app.js` / `style.css` |
| `D:\zora\apps\server\` | Node 服务、API |
| `D:\zora\apps\desktop\` | Electron 主进程（`main\main.mjs`） |
| `D:\zora\packages\adapters\openmontage.mjs` | OM 适配器 |
| `D:\zora\packages\agent\` | Agent 工具/技能 |
| `D:\zora\vendor\openmontage\` | OM runtime（含 Python 等） |
| `D:\ui\_review\OpenMontage-current` | OM 本地参考源码 |
| `D:\ui` | MiniMax H3 / 仙宫云相关 UI |
| `D:\DeepSeekHarness` | 其他项目 |
| 暂存补丁常见目录 | `C:\Users\强哥\Documents\zora-agent-edit\` |

前端缓存戳（改完前端务必 bump）：当前 **`studio116`**（`index.html` 里 `?v=studio116`）。

本地 Node：`D:\zora\runtime\node-v24.21.0-win-x64\node.exe`  
OM Python：`D:\zora\vendor\openmontage\runtime\python\python.exe`

Electron 加载：`http://127.0.0.1:<port>/`（桌面壳起服务后 `loadURL`）。

---

## 3. 架构速览

```
Electron 壳
  └─ client (工作台 #studio)
       ├─ 侧栏：创作 / 画布(库) / 任务 / 素材 / 技能 / …
       ├─ 顶栏：最近对话 + Agent|画布 胶囊 + 积分/主题/账户
       ├─ Agent 模式：主创作区 + 主会话（localStorage 会话体系）
       └─ 画布模式：
            ├─ 无限画板（缩放 / 框选 / 抓手平移 / 节点）
            ├─ 多画布项目库（zora.canvases.v1）
            └─ 右侧「画布 Agent」独立会话（zora.canvasAgentSession.v1）
  └─ server
       ├─ /api/chat（Agent）
       ├─ /api/om/*（OpenMontage 工具）
       └─ 生成类 API（图片/视频等，多元等现有适配器）
```

OpenMontage：sidecar + 约 118 tools / 277 skills；任务面板有中文「执行 OM 工具」表单（工具/项目自定义卡片选择，非系统原生下拉）。

---

## 4. 本轮已完成的重要改动（2026-09-12）

### 4.1 画布库与项目

- 侧栏「画布」→ **整页** `#canvases`（非弹窗）：搜索 / 新建 / 打开 / 改名 / 复制 / 删除。
- 存储：`localStorage zora.canvases.v1`，当前：`zora.canvasCurrent.v1`。
- 画布顶栏：新建 / 删除；✎ 改名。
- **注意**：Electron 禁用原生 `prompt/confirm`，已改为应用内对话框 `__zoraPrompt` / `__zoraConfirm`（改名锚定在 ✎ 下方）。

### 4.2 画布编辑器交互

- 滚轮缩放（**仅画板** `board`，勿绑整个 `canvas-workspace`，否则会抢走侧栏菜单滚动）。
- 鼠标框选 + 抓手平移（缩放旁「鼠标/抓手」切换；空格可临时抓手）。
- 框选层挂在 **board** 上，不要挂在 `#canvas-nodes`（`renderNodes()` 的 `replaceChildren` 会清掉选框）→ `studio109`。
- 底部工具条：玻璃胶囊 + SVG 图标（曾抱怨 unicode 图标丑）。

### 4.3 顶栏一致性（Agent ↔ 画布）

- 画布全屏时曾 `display:none` 掉 `account-toolbar`（积分看不见）。
- `studio108`：**两行顶栏**——上行全局（最近对话 / Agent|画布 / 积分），下行画布项目条；避免叠层。
- 切换时若再重合，优先查 `creation` 的 `padding-top` 与 absolute 浮层 `z-index`。

### 4.4 画布右侧 Agent（独立会话）

目标：可选模型 / 技能 / 上传素材；与主 Agent **上下文与会话分离**。

| 项 | 值 |
|----|-----|
| UI | 上消息、下统一 composer |
| 存储 | `zora.canvasAgentSession.v1` |
| 侧栏折叠 | `zora.canvasAgentRailCollapsed.v1` |
| 发送 | `POST /api/chat`，自带 `conversationId`，`channel:'canvas'`（服务端可忽略） |
| 收起 | 顶栏「收起」；展开：右侧竖条「Agent」 |
| 模型菜单 | 自定义玻璃卡片，**禁止**系统原生 `<select>` 下拉（风格不统一） |

关键修复史：

- `studio116`：收起被 `.canvas-agent-rail { display:flex !important }` 钉死 → 用 `.is-agent-rail-collapsed` + 更高优先级 `display:none !important`，并加 **document 委托点击**（`#canvas-agent-hide` / `#canvas-agent-show`）。
- `studio114`：菜单滚轮被画布 `wheel`+`preventDefault` 抢走 → 缩放只绑 `board`，rail/菜单放行。

入口脚本：`app.js` 内 `initCanvasAgentPanel` + `studio116` 委托折叠 IIFE（在 `ensureBackdrops()` 附近）。

### 4.5 侧栏图标

- `railIconPaths` 需含 `canvases`（画板+节点 SVG）。缺了会显示字面量 `#`。

### 4.6 任务面板 OM

- 工具/项目选择：自定义卡片菜单（贴触发器下方，玻璃风）。曾因 `position:fixed` + 父级 transform 错位。

### 4.7 其他已知已修坑

- 勿把大段逻辑插进 `function route()`（曾递归爆栈，进不了工作台）。
- 画布库初始化勿依赖已删除的 `#canvas-library-panel`（只要 `#canvas-lib-list`）。
- welcome/login 上勿挂 `canvas-fullscreen` 遮罩。

---

## 5. 关键 localStorage Key

| Key | 含义 |
|-----|------|
| `zora.workMode.v1` | `agent` \| `canvas` |
| `zora.canvases.v1` | 多画布项目列表 |
| `zora.canvasCurrent.v1` | 当前画布 id |
| `zora.canvasNodes.v1` | 当前画布节点（与项目同步） |
| `zora.canvasAgentSession.v1` | 画布 Agent 独立会话 |
| `zora.canvasAgentRailCollapsed.v1` | 右侧栏是否收起 |
| 主 Agent 会话 | 既有 conversations/projects 体系（与画布分离） |

---

## 6. 前端改动约定（务必遵守）

1. **改 `index.html` / `app.js` / `style.css` 后 bump 缓存戳**（如 `studio116` → `studio117`），否则 Electron/浏览器会吃旧资源。  
2. 验证：`node --check apps/client/app.js`。  
3. Windows 上用 Python 改文件时注意 **PowerShell 吞 `$`**，大段 JS 补丁写成 `.py` / `.js` 文件再执行。  
4. 新 UI 浮层：优先 **absolute 贴触发器** + 玻璃圆角卡片；少用原生 `select/prompt`。  
5. 画布相关 CSS 后写覆盖前写；`!important` 战争时用 `#canvas-workspace.is-…` 提高优先级。

---

## 7. 未完成 / 下一步建议

按优先级：

1. **画布 Agent 产品化**  
   - 回复落到画布节点的闭环（现在主要是聊天）。  
   - 服务端若需隔离，可识别 `channel:'canvas'` 或强制新 conversation。  
   - 技能/素材与主创作区视觉再对齐一版。

2. **RunningHub**  
   - 已移除接口与适配器，不再安排接入。

3. **Electron 打包**  
   - 壳已有，正式打包分发未完。

4. **语音输入**  
   - Electron 麦克风权限已摸过；云端 Speech 常 `network` 失败，需本地 STT 或其它方案。

5. **顶栏切换回归**  
   - Agent ↔ 画布、侧栏「画布」页 ↔ 创作，多切几次看积分顶栏与标题行是否再叠。

6. **框选 / 抓手 / 缩放**  
   - 基础可用；可补：缩放到光标、多选拖动体验等。

---

## 8. 给 Codex 的开工检查清单

```text
[ ] 读完本文档第 1、4、6、7 节
[ ] 打开 D:\zora\apps\client\{index.html,app.js,style.css}，确认 studio116+
[ ] 启动 desktop/server，硬刷新客户端
[ ] 冒烟：
      - Agent|画布切换，顶栏积分仍在
      - 画布：鼠标框选有蓝框；抓手可平移；滚轮只缩放网格
      - 画布 Agent：模型/技能菜单可滚轮；收起/展开侧栏
      - 侧栏「画布」进整页库；✎ 应用内改名
      - 任务页 OM 工具/项目菜单在输入框下方
[ ] 改前端必 bump studio 戳
```

---

## 9. 用户偏好备忘

- 中文沟通；UI 文案中文。  
- 讨厌：系统原生丑下拉、弹窗错位、对比度不够、图标风格不统一、切换叠层。  
- 喜欢：玻璃胶囊、卡片贴触发器下方、Agent-first、桌面一体。

---

## 10. 联系点（代码锚）

搜索这些符号可快速定位：

- `initWorkModeCanvas` — Agent/画布模式与画板交互  
- `initCanvasLibrary` — 多画布库  
- `initCanvasAgentPanel` — 画布 Agent 面板  
- `studio116: canvas agent rail toggle` — 收起委托  
- `railIconPaths` — 侧栏 SVG  
- `openOmProjectMenu` / `openOmToolMenu` — 任务 OM 选择器  
- `__zoraPrompt` — Electron 安全输入框  

---

**交接完成标志**：Codex 能独立复现上述冒烟项，并在不破坏「主 Agent / 画布 Agent 会话分离」与「顶栏积分常显」的前提下继续迭代。
