# Zora 稳定性与交接验收报告 — studio117

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

验收日期：2026-09-12（北京时间）；最终桌面记录时间：20:48:14。

## 结论与适用范围

本轮约定的**隔离环境稳定性验收通过**：31 项 Electron 桌面场景全部通过，9 项本地单元/HTTP 测试全部通过，最终桌面运行记录中页面脚本异常为 0。前端 JS、CSS 引用统一更新为 `studio117`。

这是现有功能的稳定性修复和本地验收，不代表真实模型、付费生成、RunningHub、OpenMontage 执行或正式分发已验收。聊天响应、OM 工具/项目列表均由本地模拟服务提供；截图中的“中断”“RunningHub 尚未接入”气泡是有意注入的失败场景。

两份原交接文档内容完全相同，且本轮未修改：

- `D:\zora\HANDOFF-CODEX.md`
- `D:\zora\docs\HANDOFF-CODEX.md`
- 两者 SHA-256：`0D59D414D15D26DFD7CBC526E2512E8B10562FAFEA7D4DC6C8850EB884A943F2`

原文中的操作指令作为交接背景审阅；本次实施依据用户明确批准的稳定性验收计划。

## 环境、备份与执行边界

- 主工程：`D:\zora`，当前目录不是 Git 仓库；本轮没有初始化 Git。
- 测试运行器：本地 Node `v24.21.0`；真实桌面壳：Electron `37.10.3` / Chromium `138.0.7204.251`。
- 使用现有 Electron 主进程入口，连接独立随机回环端口的模拟服务；通过独立 `--user-data-dir` 隔离测试数据。没有使用用户日常 Electron 配置目录。
- 桌面窗口验证尺寸：1440×900、1100×700；截图为窗口内容区域，故像素尺寸略小。
- 模拟服务不加载生产 `.env`，不启动 OM sidecar；真实服务 HTTP 测试在导入服务前显式禁用提供商并清空相关测试进程密钥值。
- 未修改生产 `.env`，未提交真实生成、支付、注册、外部消息或权限变更。删除功能只操作隔离 localStorage 中的验收画布记录；没有删除文件或文件夹。
- 修改前备份目录：`D:\zora\outputs\acceptance-20260912-201810\baseline`。备份包含相关源码、测试、package.json、配置模板和两份交接文档，不含 `.env`。
- `baseline-hashes.json` 保存原文件哈希；`final-hashes.json` 保存最终代码与测试文件哈希。恢复时应先核对文件是否又被其他工作修改，仅恢复所需文件，不整目录覆盖或删除。

## 已修复问题与证据

| 问题 | 复现/代码依据 | 最终行为 |
|---|---|---|
| 删除当前画布覆盖下一项目 | A、B 各有不同节点，删除 A 后 B 被写入 A 的节点；`before-fix` 和 `baseline-regression` 留有失败记录 | 删除后加载剩余项目时跳过旧画板保存，B 保持原节点 |
| 快速刷新漏存项目节点 | 新增节点后立即刷新，旧逻辑尚未完成 450ms 延迟保存；`baseline-regression` 失败 | 编辑时同步写入当前项目，延迟仅用于保存提示 |
| 撤销记录跨项目 | 在 A 编辑后新建空画布，点击撤销会带入 A 节点；`baseline-regression` 失败 | 项目 ID 改变时清空撤销/重做历史，并复制载入的节点数据 |
| 项目/节点容量被静默截断 | 第 41 个画布挤掉已有项目；第 121 个节点出现在界面但不被保存；`capacity-before` 失败 | 新建/复制达到 40 项、新增达到 120 节点时明确提示；保存不截断已有数据 |
| 启动误报目录加载失败 | 初次 `modelChanged()` 调用早于 `pickers` 初始化；`baseline-regression` 失败 | 提前初始化 picker 容器，正常目录响应不再误报 |
| 从画布库返回创作页后画板隐藏 | 库页返回创作，所选模式仍是画布但画板不可见；`expanded-regression` 失败 | 根据工作台、当前页和所选模式统一同步画板、全屏状态和滚动锁 |
| 全局栏与项目栏/模式按钮重叠 | 全局栏底部 y=66，项目栏原始顶部 y=64；最小窗口下模式按钮与账户栏相交 | 预留 76px 全局栏空间；窄窗口限制目录宽度并调整模式按钮位置 |
| 聊天后模式按钮消失/离开视口 | 活跃会话旧选择器隐藏模式按钮，旧布局让聊天内容撑出视口；`chat-regression`、`layout-probe` 失败 | 主会话记录放入 Agent 工作区；保留模式按钮，修正容器伸缩与滚动，画布中不显示主会话消息 |
| 画布请求期间可新建会话 | 延迟响应期间“新会话”仍可点击，响应处理引用可被替换的会话变量 | 发送期间禁用新会话按钮并增加处理函数保护，结束后恢复 |
| 刷新后遗留 pending 状态 | 向本地记录注入未完成请求后刷新，旧界面持续显示省略号 | 两个 Agent 的已中断请求显示明确错误，可再次发送；不自动重新调用服务 |
| 画布库改名锚点与确认框样式 | 原库页改名使用隐藏的画布顶栏按钮作锚点；确认框沿用此前改名位置 | 库页使用实际点击按钮作锚点；确认框恢复居中；取消按钮有明确文字颜色 |

“主会话”和“画布会话”仍按不同 `conversationId` 隔离。未新增服务端 `channel` 归属校验，也没有跨服务重启的会话持久化；过期时提示新建会话。

生产行为变更位于 `apps/client/app.js`、`apps/client/style.css`、`apps/client/index.html`。服务端和 Electron 主进程源码保持原样。新增可复跑桌面测试入口 `npm run test:desktop`，没有新增 npm 依赖或进行安装。

## 验收矩阵

| 范围 | 状态 | 已验证内容 |
|---|---|---|
| 模式、路由与顶栏 | 通过 | 反复切换模式、库页返回、活跃主会话后切换、积分栏可见、最小窗口全局栏不相交、欢迎/登录页无画布遮罩 |
| 画布项目 | 通过 | 新建、打开、改名、复制、搜索、删除/取消、刷新保存、撤销跨项目隔离、40 项和 120 节点边界 |
| 画板交互 | 通过 | 可见框选及节点选中、抓手平移、空格临时抓手并恢复、画板滚轮缩放 |
| 画布 Agent | 通过 | 侧栏折叠及刷新恢复；模型/技能菜单滚轮不改变画板缩放；选定模型、技能和测试 PNG 内容进入请求 |
| 会话隔离 | 通过 | 两个 UI 使用不同会话 ID；模拟运行器接收各自多轮历史；画布请求不写入主会话存储；主会话日志不显示在画布区域 |
| 异常恢复 | 通过 | 两个 Agent 的 502、409、404；过期后显式新建；按钮恢复；刷新中断提示；请求期间阻止重置画布会话 |
| OM 菜单 | 通过（模拟列表） | 1440×900 和 1100×700 下工具/项目自定义菜单位于触发器下方；未执行工具 |
| RunningHub 未接入状态 | 通过 | 真实本地服务状态为 stub/live:false，任务接口返回 501/ok:false；前端注入相同类型失败时显示错误 |
| 本地目录与接口测试 | 通过 | 全部现有媒体模型基础参数、非法参数与未知模型、私有文件不作为静态资源暴露、禁用 Agent 返回 503 |
| 明暗主题截图 | 已检查 | 保留两张最终截图；不等同于完成全面视觉/无障碍审计 |
| 真实模型/图片视频生成、真实 OM 执行与工具数量 | 未测试 | 按本轮边界不调用；原文 118 tools / 277 skills 数量不作为已核实结论 |
| RunningHub 真实工作流、正式打包分发、语音 | 未测试 | 仍为后续工作，不作为本轮完成项 |
| 财务账本、存储配额耗尽、损坏数据恢复、多实例同时编辑 | 未测试 | 不在此次隔离回归范围；不能据本报告认定已满足生产要求 |

旧测试最初在模块加载阶段全部失败，分别引用已移除的 `loadCatalog`、`createServer`、`costToMicroPoints` 等接口。已按当前目录、校验结果对象及服务导出重写测试；没有为让旧测试通过而恢复过时接口。原价格测试对应功能不再存在于该模块，本次未宣称计费验证通过。

画布 Agent 目前仍使用一个独立于主 Agent 的全局画布会话，未实现每个画布项目独立会话，也未实现回复进入节点的生成闭环。

## 证据文件与复跑方式

证据根目录：`D:\zora\outputs\acceptance-20260912-201810`。

- [最终桌面结果（31/31）](/D:/zora/outputs/acceptance-20260912-201810/acceptance-final/desktop-results.json)
- [本地测试结果（9/9）](/D:/zora/outputs/acceptance-20260912-201810/unit-final.txt)
- [修改前后差异](/D:/zora/outputs/acceptance-20260912-201810/changes.diff)
- [修改前哈希](/D:/zora/outputs/acceptance-20260912-201810/baseline-hashes.json)、[最终代码哈希](/D:/zora/outputs/acceptance-20260912-201810/final-hashes.json)
- [日间截图](/D:/zora/outputs/acceptance-20260912-201810/acceptance-final/desktop.png)、[夜间截图](/D:/zora/outputs/acceptance-20260912-201810/acceptance-final/desktop-night.png)

`before-fix`、`baseline-regression`、`expanded-regression`、`chat-regression`、`layout-probe`、`capacity-before` 等目录保留失败复现和中间验证。部分中间失败属于测试准备不足（例如刷新后创作类型恢复为视频），不得据此认定仍有同名产品故障。最终以 `acceptance-final` 为准。测试配置目录全部保留，未自动清理。

PowerShell 复跑：

```powershell
Set-Location D:\zora
& .\runtime\node-v24.21.0-win-x64\node.exe --test tests/agent.test.mjs tests/catalog.test.mjs tests/skeleton.test.mjs
& .\runtime\node-v24.21.0-win-x64\node.exe --check apps/client/app.js
& .\runtime\node-v24.21.0-win-x64\node.exe --check apps/server/server.mjs
& .\runtime\node-v24.21.0-win-x64\node.exe scripts/acceptance-desktop.mjs
```

桌面脚本默认使用本机已安装的 Playwright 和项目现有 Electron。其他机器可用 `ZORA_TEST_NODE_MODULES` 指向含 Playwright 的 node_modules 目录。`ZORA_ACCEPTANCE_OUTPUT` 可指定新证据目录；不指定时自动创建时间戳目录。`ZORA_ACCEPTANCE_ONLY` 仅用于定向排查，完整验收时必须留空。脚本会显示测试窗口并在完成后关闭自己启动的实例，不关闭其他应用。

下一阶段顺序保持为：画布 Agent 回复进入节点 → RunningHub 接入设计 → Electron 分发方案 → 语音与编辑器增强。第三方密钥托管应遵守项目约定，仅位于远程服务端；这些能力均未由本报告宣告完成。
