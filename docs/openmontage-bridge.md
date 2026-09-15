# 造境 Zora 桌面客户端 × OpenMontage 集成方案（目标对齐版）

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

> 上游仓库：**https://github.com/calesthio/OpenMontage**（AGPL-3.0）  
> 本机参考：`D:\ui\_review\OpenMontage-current`  
> 造境：`D:\zora`  
>  
> **安全提醒：** 不要下载 `Open-Montage/OpenMontage` 仿冒仓库的 Windows 安装包（社区已报告恶意行为）。只认 **calesthio/OpenMontage**。

---

## 你要的产品长什么样

| 你的目标 | 含义 |
|--|--|
| 集成 OpenMontage 功能 | 成片流水线、项目、工具、合成/剪辑能力进造境 |
| Zora = 软件客户端 | Electron（或同类）桌面壳，不是「网站产品」 |
| 内置配置与环境依赖 | 安装包自带/托管 Python、FFmpeg、Node/Remotion 等 runtime，用户少手动装环境 |
| UI 不大改 + Agent 为主 | 界面继续用现有造境壳；复杂能力靠对话调工具 |
| ComfyUI | RunningHub 云工作流已移除 |

一句话：**造境是壳与账户/Agent；OpenMontage 是内嵌视频引擎；RunningHub 已退出当前产品范围。**

---

## 集成方式（推荐）

**不要**把两个前端揉成一个巨型页面。  
**要**做「一个安装包、两套引擎、一个 Agent」：

```text
造境 Windows 客户端（安装包）
├── UI（现有 studio，基本不动）
├── 造境 App Server（Node：对话、多元探索、积分、RunningHub）
├── OpenMontage Runtime（vendored）
│   ├── studio_api（本机 loopback）
│   ├── tools / pipeline_defs / skills
│   ├── Python runtime + requirements
│   ├── FFmpeg / Remotion composer（按 OM 发行策略裁剪）
│   └── 配置目录（用户数据，非安装目录）
└── Agent
    ├── preview_task / submit_generation（多元探索，已有）
    ├── rh_*（RunningHub，现空置）
    └── om_*（OpenMontage，现空置 → 逐步接通）
```

客户端启动时：

1. 拉起造境 App Server  
2. 拉起 OM `studio_api`（bundled Python）  
3. UI 只连造境；造境再连 OM / RunningHub  

---

## P2 进度：vendor 目录已落地

路径：`D:\zora\vendor\openmontage\`（说明见该目录 `README.md`）

对齐官方桌面发行包 `resources/runtime`：

| 组件 | 相对路径 | 状态 |
|--|--|--|
| manifest | `runtime-manifest.json` | 已放 |
| Node | `runtime/node/node.exe` | 占位；探测会回退到 `D:\zora\runtime\node-v24...` |
| Python 3.12+ | `runtime/python/python.exe` | 占位 |
| FFmpeg | `runtime/ffmpeg/bin/` | 占位 |
| HyperFrames | `runtime/hyperframes/` | 占位（可选） |
| Codex | `runtime/codex/` | 占位（可选；造境已有 `vendor/codex-main`） |
| Engine | `engine/` → junction 到 OM 源码 | 用 `scripts/link-engine.ps1` |

开发机快速填满：

```powershell
cd D:\zora
pwsh vendor\openmontage\scripts\link-engine.ps1 -Source "D:\ui\_review\OpenMontage-current"
# 可选：从 OM 官方 win-unpacked 拷 runtime
pwsh vendor\openmontage\scripts\sync-runtime-from-om-release.ps1 -Source "...\win-unpacked\resources\runtime"
node vendor\openmontage\scripts\probe-runtime.mjs
# 或 HTTP：GET /api/om/status （已带 runtime 探针字段）
```

**仍不接真实 OM HTTP**，直到你确认拷贝/链接依赖。

---

## 分阶段（可交付）

### P0 — 产品与法务边界（已做）

- 锁定上游：`calesthio/OpenMontage`  
- AGPL：客户端若分发 OM 代码，整体开源义务需确认  
- 空接口已占位：`/api/om/*`、`om_*`、`/api/rh/*`、`rh_*`

### P1 — 桌面壳（造境软件形态）

- Electron 包现有 UI + 起停 App Server  
- 用户数据目录：配置、对话、素材、OM 项目库  
- **仍不大改 UI**

### P2 — 内嵌 OM Runtime（进行中）

- [x] `vendor/openmontage` 目录骨架 + manifest + 探针脚本  
- [x] Adapter `openMontageStatus` 返回 runtime 探测  
- [ ] 链接 engine / 同步官方 runtime 二进制  
- [ ] 真连本机 `studio_api`

### P3 — Agent 接通 OM 功能（主用法）

用户在造境对话里说「做一条解说短片 / 合成这些素材」→ Agent 调：

- `om_list_projects` / `om_get_project`  
- 白名单 `om_execute_tool`（合成、拼接、校验等）  
- 结果进现有任务清单 / 素材预览  

### P4 — RunningHub Comfy

- 填 `rh_run_workflow` / `rh_get_task`  
- 工作流 ID 本地配置，不开放任意 URL  

### P5 — 安装包体验

- 一键安装、托盘、自动更新策略  
- 首次运行：依赖自检、模型/密钥配置向导（精简）

---

## 和「网页上找不到」的关系

网页预览里**不会出现** OpenMontage 菜单，因为按你的要求：**UI 不大改、Agent 调用为主**，且引擎还没真正拉起。

临时单独用 OM：开本地 `OpenMontage-current`；与造境并行。

---

## 建议的下一步

1. 在本机执行 `link-engine.ps1`（及可选 runtime sync）  
2. 确认 `/api/om/status` 探针字段符合预期  
3. 再做 P1 桌面壳，或直接起 sidecar 接通 API  

---

## P2 进度更新（sidecar 已接通）

- Sidecar：`vendor/openmontage/scripts/start-sidecar.mjs` / `stop-sidecar.mjs`
- 状态文件：`vendor/openmontage/sidecar-state.json`（勿提交）
- 造境路由：`GET /api/om/status|health|projects|projects/:id`，`POST /api/om/sidecar/start|stop`，`POST /api/om/tools/execute`
- Agent 工具：`om_status` / `om_list_projects` / `om_get_project` / `om_execute_tool` / `om_start_sidecar` / `om_stop_sidecar`
- 本机验证：sidecar health 可能为 `degraded`（缺可选 toolchain 属正常）；项目列表已可读

---

## P1 进度：Electron 壳已落地

路径：`D:\zora\apps\desktop`

启动：
- `D:\zora\start-zora-desktop.cmd`
- 或 `cd D:\zora\apps\desktop && npm start`

行为：复用/拉起 `PORT`（默认 4317）上的造境服务，默认自动连/起 OM sidecar，窗口加载现有 UI。
