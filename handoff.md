## 2026-09-21 GPT-5.5 工具搜索兼容修复（已部署云端）

- 根因：Chat Completions 转换复用 Claude 工具转换，遇到 tool_search 抛出带 Claude 名称的错误；不能据此认定模型路由错误。
- 增加 client tool_search 声明、调用、结果及发现工具的转换；保留命名空间和调用标识，避免简单删掉工具造成能力丢失。Chat 请求的转换错误使用对应协议名称。
- 13 项协议转换测试通过；已部署 zora-api，版本 ec04a1bb-c96b-47d4-b6bf-b4fb289bbad7；部署后 /health 和 /api/models 均 200。用户随后确认本机与新电脑均正常输出。
- 本次 git 快照包含云端修复和下述桌面系统代理修复；桌面部分未打包，遵守用户“先不打包”要求。

## 2026-09-21 系统代理修复（随本次快照提交，未打包）

- 新安装网络默认 system；保留已有 environment/direct/proxy 设置。已有用户可在设置中选择“跟随系统代理”并重启，无需改 JSON。
- Electron 启动每次随机密钥路径的本机官方云服务转发，只允许固定官方域名 /api/，拒绝浏览器 Origin 和重定向；后台鉴权、Agent Responses、媒体提交/查询通过 Electron Session 联网。代理设置由系统规则/PAC 解析，取消请求向上游传递，不重试付费 POST。
- 增加后台模型目录连接检测、设置保存后回读校验，兼容 network.json UTF-8 BOM。
- 10 项相关测试通过；真实 Electron 两个本地测试代理分别连接官方模型目录均成功：outputs/electron-network-proof.json。未改 Windows 系统代理，未在另一台电脑验证系统 PAC 动态变化。
- Python/OM 模型下载仍依赖环境变量或手动代理，未宣称所有第三方程序均支持系统 PAC。
- 用户明确要求先不打包，现有安装包保持不变。

## 2026-09-21 无 Docker 本机脚本授权（已提交 636f8d1）

- `exec` 新增 `runtime: node/python`，`command` 为完整脚本，通过 stdin 交给包内运行程序，固定工作目录；旧 shell 命令保持 Docker 语义，不暗中改用宿主 shell。
- 新增会话内授权弹窗：完整脚本、工作目录、30 秒上限及当前用户权限说明；允许本次、拒绝、稍后处理。关闭不是批准，未提供整会话脚本免审。
- 逐步工作流继续复用一次性审批账本；拒绝不执行，中断不自动重放，运行程序或超时配置变化需重新申请。
- 限制输出为 64 KiB，保留失败日志，手动中止/超时请求终止进程树；对话停止也中止关联本机脚本。环境不透传 API 密钥；这不是文件或网络沙箱，脚本仍拥有当前用户权限。
- 本机 Node 和包内 Python 实际执行、文件回传、审批拒绝、超时、子进程停止已验证；`scripts/verify-native-approval.mjs` 使用 Chromium + 真实本机 HTTP 验证弹窗、稍后处理、批准、中止与会话隔离。
- 已纳入提交 636f8d1 和测试包 outputs/desktop-package-2026-09-21T12-26-44-676Z/release/Zora-0.1.1-win-x64-openmontage-setup.exe（894449150 字节，SHA256 43bea66e5a5404e10da8dd88f4c4cb6a1a00320cf916770ccbcf8e130f6f834b）。该包包含脚本审批，不包含后续系统代理修复；未发布 GitHub。

# 造境 Zora 开发交接

### 2026-09-21 新电脑阻塞项修复与 0.1.1（本地未提交）

- OM 初始化/启动失败不再阻断主界面，独立浏览器与桌面桥失败也隔离；设置显示媒体启动状态并可重试。硬链接不支持时复制配置，跨引擎版本保留用户修改。
- 持久端口冲突时更换后台监听端口，用 Electron 协议转发保持旧浏览器 origin，保留 localStorage/IndexedDB。真实 Electron 验证会话和 Blob 原素材、POST 与 Range；并用最终 payload 模拟端口占用+坏 OM 引擎，普通界面与更新入口均可加载，outputs/port-origin-smoke.json、device-boot-smoke.json。
- 补入 PPTX 校验脚本、绝对调用路径及 PptxGenJS/ExcelJS/docx/pdf-lib 固定版本。源码、stage、最终 payload 实际生成并检查四种文档，outputs/document-*-smoke.txt；未宣称 Office/WPS 视觉验收。无 Docker 的 native exec 改为明确失败，提示使用可用的原生命令工具，不再未执行却报告成功。
- 设置新增转录模型检查/下载进度/重试与 CPU 加载验证，音色选择并复制到用户数据目录；Tiny 已真实下载并验证，测试缓存留在 outputs，不随包分发。修复进度析构迟到消息覆盖 ready 的问题。
- 增加环境变量/直连/指定 HTTP(S) 代理设置，保存后重启生效；Node 后台使用 NODE_USE_ENV_PROXY，Agent 显式继承代理变量，回环直连。真实本地代理验证通过，outputs/network-proxy-smoke.txt。
- DLL 静态检查发现语音依赖 MSVCP140/140_1；附入微软签名有效的 VC++ x64 14.44.35211 官方安装程序，固定 SHA256，用户点击并确认后打开安装向导，未在本机执行安装。Python 探测改为真实 import，不能以模块文件存在冒充可用。
- 最终全量 348/348、Chromium 设置交互通过，outputs/portability-final-regression.txt、device-setup-final-ui.txt。版本升为 0.1.1，包含更新通道；安装包已完成：outputs/desktop-package-2026-09-21T11-25-17-890Z/release/Zora-0.1.1-win-x64-openmontage-setup.exe，894429890 字节，SHA256 8ba19d7e87b8a14edb0a1d66984cc4a09ae55327fdb2d002cb1f2351dbd8b912。latest.yml、blockmap 与包内更新源已生成，发布只读检查通过（outputs/portability-release-check.txt）；安装包签名状态 NotSigned。
- 未发布 GitHub、未提交 Git、未签名、未真实异机/跨版本安装、未用真实账号执行收费任务。旧包、素材、会话和测试中间文件均保留。说明 docs/NEW-PC-READINESS.md。

### 2026-09-21 稳定版更新通道（源码补齐，未发布）

- 安装版设置增加软件更新：检查、下载进度、显式确认退出并安装；网页/开发模式禁用。electron-updater 固定 6.6.2，禁止自动下载、退出自动安装、预发行和降级，安装前清理应用拥有的后台。
- 打包配置写入现有 GitHub 仓库稳定通道，构建 publish:never；新增 scripts/publish-desktop-release.mjs 校验版本、安装包大小与 SHA512，仅显式 --publish 创建草稿，需中文发布说明。
- 更新状态专项 4/4，全量 343/343 通过，outputs/desktop-updates-regression.txt；未执行真实跨版本覆盖安装。旧包无更新模块，必须完整重打并手动安装引导版本；未上传 Release、未改变线上或当前运行程序。详见 docs/DESKTOP-UPDATES.md。

更新时间：2026-09-21。本文件以当前代码和已取得的验证结果为准，替代旧交接中的版本号、测试数量及“全面完成”表述。

## 本次本地提交范围与后续操作

### 2026-09-21 包内语音运行库补齐

- 包内 Python 新增独立 media-site，安装 faster-whisper 1.2.1、Piper 1.8.0、CTranslate2、ONNX Runtime、PyAV 等依赖。speech-requirements.lock 固定版本和 wheel SHA256，scripts/install-om-speech.ps1 用于首次准备；不修改用户系统 Python。
- Piper 从包内 Python API 调用，避免 pip 启动器写死开发机路径；修复嵌入式 Python 不自动包含辅助脚本目录的问题。打包时保留 media-site 搜索路径、辅助脚本和许可证，并增加语音运行库导入预检。
- 本机状态接口实际返回 fasterWhisper=true、piper=true；WhisperX 说话人分离仍未安装，不影响基础转录。配音仍需要音色文件；安装包不包含测试模型或音色权重。
- 使用 outputs 下单独下载的测试音色和 Base 模型：包内 Piper 实际生成中文 WAV，faster-whisper 在 CPU 上返回文字与时间戳。转录有同音字误差，不宣称识别准确率保证。scripts/verify-bundled-speech.mjs 可验证隔离目录中的程序调用；全量回归 339/339 通过，outputs/om-speech-regression.txt。
- 已生成安装包 outputs/desktop-package-2026-09-21T10-10-47-618Z/release/Zora-0.1.0-win-x64-openmontage-setup.exe，858942725 字节，SHA256：2e90e6634ca3e175184a62b4f54877da24cc6664bf0058fdd2669230fc447e4c。使用较快压缩级别 1；完整记录 outputs/om-speech-package-delivery.txt。
- 暂存目录及最终 win-unpacked/resources/app 中的包内 Python 均完成中文配音和 CPU 转录验证，不借用开发目录依赖。最终运行目录中 OM sidecar 能启动，但健康返回 degraded，不声称全部可选能力 ready。记录 outputs/om-speech-relocated-check.txt、outputs/om-speech-final-payload-check.txt、outputs/om-speech-sidecar-check.txt。
- 同轮按用户截图把转录模型原生下拉框改为自定义菜单，统一背景、圆角、选中态，支持方向键、Esc、点击外部关闭。Chromium 保存恢复与键盘验证通过；安装包内 JS/CSS 已与源文件核对一致。
- 构建脚本并行计算运行库文件哈希；新增受本项目 outputs 路径约束的 --reuse-unpacked，用于修改已验证应用目录后重新封装。未提交 Git，未发布云端，未自动替用户安装。

### 2026-09-21 OM 本地媒体设置与用户自带素材服务密钥（本地未提交）

- 设置新增“本地媒体能力”面板：4 类能力开关、默认转录模型、Piper 音色路径、素材来源、真实依赖检查及管线说明。配置持久化，后续工具调用执行限制；不取消在途任务，不自动下载安装。
- 用户追加要求允许自己申请并填入 Pexels 等密钥，已接 Pexels/Unsplash；Windows DPAPI 按当前账户加密，本机同源接口，只返回是否配置。按所选检索来源注入对应子进程，Agent 和云端不接收明文。其他生成模型密钥与 OM GPU/独立大模型策略不变。
- 新增 om-preferences.mjs、om-credentials.mjs、依赖探测脚本及素材兼容 hooks；打包脚本纳入辅助文件。Pexels 更新视频检索路径，Unsplash 下载事件上报，保留素材来源、作者和许可。
- 本机依赖实际检测：FFmpeg/FFprobe/Python/requests 存在；faster-whisper/WhisperX/Piper 缺失，页面显示缺项。没有真实服务密钥，未验证线上素材检索或音色推理，未付费或注册。
- 全量 339/339 通过；Chromium 验证实际本地 HTTP、测试密钥加密保存/重载/清除、无明文回显和桌面/窄窗口布局。记录 outputs/om-settings-regression.txt、outputs/om-settings-ui.txt。文档 docs/OPENMONTAGE-PIPELINES.md。
- 开发客户端需退出重启加载，未强制中止原进程；旧安装包未重打，无云端发布，Git 未提交。

### 2026-09-21 OM 按用户意图选择管线，媒体生成复用已配置 API（本地未提交）

- Zora 主 Agent 判断是否使用 OM，选择管线并建立项目；需要新媒体时通过 delegate_media_task 调用 Zora 已配置 API，query_generation_task 查询真实结果，再导入项目进行本地后期。普通问答和单独生成不强制走 OM，付费步骤保留授权约束。
- 新增 9 条管线及工具参数查询、项目准备、媒体副本导入工具。当前为 Zora Agent 编排，非 OM 独立大模型执行器；计划落盘不代表管线已经执行。
- 新增 vendor/openmontage/zora-policy.json，限制 21 个本地工具和 14 个技能；Node/Python 双入口拒绝 OM 模型生成和 GPU 管理能力，Python 只加载允许的目标模块，子进程过滤主服务密钥。保留本地剪辑、字幕、ASR、Piper，以及 Zora 主 Agent 和媒体 API；未批量删除上游源码。
- 修复 OM 工具/技能列表带查询参数时被 Agent API 白名单误拒绝的问题；打包脚本包含新策略文件。
- 全量回归 336/336，通过真实本地 FFmpeg 裁剪和输出探测，原视频字节不变。上游生成下载使用模拟回执，没有真实付费生成；未逐项实测全部 ASR/TTS 依赖。记录 outputs/om-pipelines-regression.txt、outputs/om-pipelines-tests.txt。
- 文档 docs/OPENMONTAGE-PIPELINES.md。当前源码修改需重启开发客户端加载，旧安装包未重打；未强制中断现有进程，Git 未提交。本次 OM 改动不需要云端部署。

### 2026-09-21 多元 MiniMax 官方格式全部创建操作与 Agent 选择（已部署）

- 新增 H3-Context-IR `/v2/h3_context_ir`、视频再生成 `/v2/video_regeneration`；原视频生成 `/v2/video_generation` 和查询 `/v2/query/video_generation/{task_id}` 统一使用异步持久回执。供应商 duoyuanx，模板 minimax。
- Agent 按指令选择工具，已接入视频专业 Agent 工具白名单与提示规则。增强只返回文本；再生成支持本账号已完成源任务或一个源视频+提示词，输出固定 2K。查询不重提。
- 新增后台独立价格输入，用户明确确认增强/再生成均为每次 5 积分，后续可分别修改。线上 MiniMax-H3 能力 revision=5，原常规生成价格 100 积分未更改。实际提交核对 expectedCost，旧报价不能按新价静默扣费。
- 复用 generation_receipts，无新增迁移；保存源任务归属、原供应商地址、路由、输出类型。事务预留积分、失败仅退回一次，超时/缺失 task_id 保持 unknown，不自动重复扣费或重提。旧任务无持久回执时使用源视频方式。客户端桥接保留真实回执 id。
- 专项与全量回归 331/331 通过；后台价格字段 Chromium 页面验证通过；Worker dry-run 通过。验收记录 outputs/h3-operations-*.txt；HTTP 分发到客户端结果使用隔离 SQLite 和模拟上游，未真实付费生成。
- 已部署 Worker 版本 77f6944c-1157-4d4c-a5ff-11cfdbfb41b8；health/admin 200，线上目录显示两项已启用且均 5 积分。生产配置备份 outputs/h3-model-before.json，更新结果 outputs/h3-price-update-result.json，线上验证 outputs/h3-operations-smoke.json。
- 本机现有开发客户端监听 14317（不是 4317），进程尚未加载新工具；未强制终止，退出客户端并重新启动后生效。一次启动检查遇到已有端口占用，未影响原进程。
- 说明 docs/MINIMAX-OFFICIAL-OPERATIONS.md。OpenAI v1 Remix 仍不在本次范围；旧安装包未重打，Git 未提交。本段覆盖下方“Remix 未接入”的旧说明，但只指多元官方格式 v2。


### 2026-09-21 MiniMax 多元 OpenAI 格式已补充并部署

- 新模板 `minimax-openai` 对应 duoyuanx 的 `/v1/videos` 与 `/v1/videos/{task_id}`；现有 `minimax` 仍是 v2 content 格式。没有自动修改线上模型、收费或权限配置。
- `packages/duoyuanx/minimax-openai.mjs` 独立组装 prompt/duration/size/images/metadata，ratio 放 metadata 中。1–2 张图片选择多模态参考时明确拒绝，防止网关自动识别为首尾帧；图生模式强制 adaptive。
- 云端查询补充 video_url、metadata.url、progress 和错误解析，生成优先读取网关 id；新模板缺失 id 返回结果未知。
- 修复后台切换供应商后因模型 ID 是 MiniMax-H3 将 v1 覆盖成 v2 的问题。选择新模板自动设置正确路由、清空旧 JSON。
- 321 项测试全部通过；模板选择/供应商切换/保存的 Chromium 页面验收通过；Worker dry-run 通过。记录见 `outputs/minimax-openai-*.txt`。
- 已发布版本 `e57e9df0-a069-4587-86a5-b64da7c0ecbe`；health/admin 200，线上页面已包含新模板和 v1 查询路径。未付费生成、未提交 Git、未重打客户端包。
- 用户需刷新后台选择新模板并保存；旧客户端需更新以使用新预览与 Agent 校验。操作说明 `docs/MINIMAX-OPENAI.md`。Remix 仍未接入，通用媒体持久回执仍待后续补齐。

### 2026-09-21 生产后端已部署（覆盖下方旧的未部署状态）

- 用户明确要求部署后，已执行远程 `model-capabilities.sql`、`seedance-assets.sql` 两份增量迁移，未重置数据库。
- Worker `zora-api` 发布成功，版本 `a39aa91f-ecd4-4896-9ab4-9856f07153d1`，地址 `https://zora-api.tenglonghaiwen.workers.dev`。
- 线上验证：health 200；模型目录 capabilityVersion=1，7 个启用模型均 ready；后台页面包含素材库开关；未登录请求素材查询返回 401。没有提交付费生成或真实上传。
- 模型配置备份 `outputs/model-config-before-deploy-20260921.json`；发布前版本列表 `outputs/deployments-before-20260921.txt`；发布输出 `outputs/deploy-20260921.txt`；验证结果 `outputs/deploy-smoke-20260921.json`。
- 当前线上没有 Seedance 模型，未自动新增或启用；素材库接口已部署但需后台配置对应模型与工作流。
- 客户端安装包尚未重新打包，Git 尚未提交。下方“未部署”仅为开发当时记录，现在后端已部署，旧客户端仍需升级才能使用新增 Agent 工具。

### 2026-09-21 续作：Seedance 素材库（本地未提交、未部署）

- 上一节方案的素材库缺口已补入源码：创建组 → 内嵌文件签名上传/公网 HTTPS 导入 → GetAsset 审核查询 → 全部 Active 后生成使用 asset 引用。
- 新模块 `apps/cloudflare-worker/src/seedance-assets.mjs`，新增账号隔离的 `seedance_asset_receipts`。增量迁移 `apps/cloudflare-worker/seedance-assets.sql`，新库 schema 已包含；发布前两份增量 SQL 都要执行。
- 后台模型表单新增启用选项，只允许 `duoyuanx + seedance`；能力配置为 `assetWorkflow: seedance-library-v1`，默认未启用。Agent 新增 `prepare_seedance_assets`、`query_seedance_assets`，生成工具新增 `assetReceiptId`。
- 准备操作分步骤返回，不挂长连接。持久状态和并发租约防重复创建；响应丢失/重启后未知状态不盲目补发。审核查询失败保留原 taskId，原素材更换后拒绝复用旧素材。直接 asset 引用必须通过所属账号已审核回执解析。
- 专项测试使用真实隔离 SQLite 和模拟上游，覆盖持久恢复、并发、签名上传凭据隔离与失败状态；没有真实上传、付费生成、生产迁移或发布。完整测试与打包结果见 `outputs/seedance-assets-regression.txt`、`outputs/seedance-assets-ui.txt`、`outputs/seedance-assets-build.txt`。
- 后续仍需推进所有媒体家族的统一持久回执/生成路由快照；本次素材回执不是通用视频生成回执。旧安装包仍不包含当前修改。

### 2026-09-21 模型能力配置与自动路由（本地未提交、未部署）

- 方案与边界：`docs/MODEL-CAPABILITY-PLAN.md`。后台维护版本化协议模板、生成模式和参数限制；客户端、云端 Agent 草稿和工具使用云端目录。未知能力不自动开放。
- 新增 `packages/contracts/model-capability.mjs`、Chat Completions → Responses 桥、后台配置历史/恢复。普通聊天按三种协议组装；生成及聊天请求不能覆盖后台供应商与路由。
- D1 增量文件 `apps/cloudflare-worker/model-capabilities.sql` 必须在发布 Worker 前执行；新库 schema 已包含该表。未执行生产迁移，未改生产配置、未付费生成，旧安装包没有这些改动。
- 本地回归 **312/312 通过**，`outputs/model-capability-regression.txt`；隔离 Chromium 验证模板显示、历史恢复、版本保留、保存与跨模型历史清理通过，`outputs/model-capability-ui.txt`。增加弹窗内部滚动，确保小窗口也能操作保存按钮。
- Wrangler 4 dry-run 打包通过，记录 `outputs/model-capability-build.txt`。本地代码尚未 git commit/push。
- 尚未实现：Seedance 素材组创建/审核至 Active 的专用工作流、所有媒体家族统一的持久回执与原始路由快照、mask/remix 等新操作。不能声称已支持供应商所有接口。当前视频云端单次一个任务；更新旧任务使用的路由前先等待它们完成。
- 保留前一轮审批设置修复：安装端无需本地开发密钥即可读取/保存设备审批偏好；失败支持重试，详见下方记录。

### OpenMontage 内置安装包（本次本地提交）

- 安装包内嵌压缩数据检查通过（`outputs/openmontage-installer-integrity.txt`，Everything is Ok）；NSIS 附加数据产生尾部警告，未执行正式安装向导。签名实测为 `NotSigned`。
- 最终安装包已生成：687,603,093 字节（约 655.7 MiB），SHA-256 `42139b628aa71f0636862ed8f2b9c45af5c8777333cbd71c4a82603724f1a204`；成功产物索引 `outputs/latest-desktop-package.json` 已更新。`release/安装说明.txt` 给出正确用户数据路径及能力范围。

- 当前构建默认携带 OpenMontage 的实际引擎源码、Python 及依赖、HyperFrames/Chromium 和 Remotion 合成依赖；复用 Zora 的 Node、Codex 与 FFmpeg。已将外部引擎链接解析为实际文件，没有改动 `D:\ui` 下的引擎工作副本，也没有复制账号数据、个人项目或 `.env`。
- 引擎来源提交 `0416fb7c5b9a7b07154b1f88c717c23fc5aba95c`，包含本机工作副本修改（包括未提交的 `services/studio_api/local_tools.py`）；`bundle-files.json` 记录 28,712 个随包文件的校验，`engineDigest` 为 `d6e25abdd63bc87f0bcbf359fb1aa83d32a81383658a452a8e44e42715fc3f1c`。
- 安装版用户目录由 `app.getPath('userData')` 决定，应用名实测为 `Zora`，默认对应 `%APPDATA%\Zora`；此前文档的 `zora-agent` 目录名已更正。`openmontage/projects`、`config`、`state`、`cache` 独立保存；引擎工作副本按内容摘要分版本，升级保留项目和配置，不自动清理旧版本。
- 新增源码/依赖白名单打包、清单与来源记录，Python 路径不依赖开发机；两类项目环境变量指向同一用户项目目录。安装版自动启动引擎并检查健康状态；退出等待引擎停止，不遗留本次启动的后台。
- 全套 **304 项测试通过，0 失败**（`outputs/openmontage-packaging-regression.txt`）。最终独立程序的两次启动、存储恢复、OpenMontage 自动启动及双后台退出检查通过，报告 `outputs/package-smoke-1789899815657/result.json`。
- 最终程序内真实 Studio API 成功合成两段测试色块视频，产物约 1.23 秒；注册表 `video_trimmer` 成功裁剪并写出视频，报告 `outputs/openmontage-smoke-1789900011621/result.json`。发现 123 个注册工具，但这不是 123 个工具全部执行通过；GPU/模型权重/外部 API 功能仍有各自依赖，未做付费任务。
- 构建目录：`outputs/desktop-package-2026-09-20T10-04-39-460Z/`；安装包名 `Zora-0.1.0-win-x64-openmontage-setup.exe`。构建与验收说明见 [OpenMontage 内置](docs/OPENMONTAGE-BUNDLE.md)。未签名，未在另一台干净电脑安装验收；本轮源码、测试及文档已纳入本次本地提交，不推送远程。

### 首次 Windows x64 打包（659ada6 之后，纳入本次提交）

- 已生成 0.1.0 NSIS 测试安装包：`outputs/desktop-package-2026-09-20T09-47-43-015Z/release/Zora-0.1.0-win-x64-setup.exe`，338,765,874 字节，SHA-256 `44d8f954507b96fd8203ba82e7c0ee33188d645e7f9dae2661db11502ef5b3e9`。`outputs/latest-desktop-package.json` 记录成功产物位置。
- 新增 `npm run desktop:package`，使用白名单暂存、锁定生产依赖和包内 Electron/Node/Codex/FFmpeg；不包含个人密钥、会话、素材或开发工具。应用文件保持可由包内 Node 直接读取，未使用 ASAR；未配置代码签名，仍为默认 Electron 图标。
- 安装版使用 Electron 用户数据目录下的独立数据、工作区与浏览器存储；首次选择回环端口并持久化，支持单实例，退出时停止自己启动的后台。原开发目录数据不会自动迁移，需重新登录。开发模式现有数据路径保持原样，后台默认仅监听 127.0.0.1。
- 全套 **302 项测试通过，0 失败**（`outputs/packaging-regression.txt`）；随后启动相关 3 项复验通过。独立打包程序两次启动、稳定端口和本地存储、接口、包内 Codex 真正初始化握手、视频探测、无个人配置、退出后台停止均通过，证据 `outputs/package-smoke-1789897923934/`。安装包内嵌 7z 数据检查通过；7-Zip 对 NSIS 附加数据报告尾部警告，不能把它表述为完整安装向导验收。
- OpenMontage 开发引擎是外部目录链接，首包不包含该引擎及 Python 运行时，不自动启动该 sidecar。首包未在另一台无开发环境电脑验收，未操作真实登录、付款或媒体生成；没有安装到当前用户的正式目录，没有上传或提交本轮打包修改。说明见 [Windows 打包](docs/DESKTOP-PACKAGING.md)。

### 当前本地快照（2026-09-20）

- 本次在唯一工作目录 `D:\zora`、分支 `codex/fix-internal-error` 汇总自 `776b7ee` 之后的源码、测试与文档，创建中文本地提交；不推送远程。提交号以 `git log -1 --oneline` 为准。
- 范围：启动失败诊断、普通日间与性能模式分离、会话参考素材延续及换图提示词更新、会员续费/购买/预约降级、积分卡片、系统消息未读角标，以及消息日期、执行区域归组与滚动位置保持。
- 当前回归基线为 **301 项通过，0 失败**，日志 `outputs/conversation-view-regression.txt`；日间主题、会员、积分、未读角标及对话显示均有隔离 Electron 验证脚本。下方较小测试数量与旧缓存版本为各阶段记录，不代表当前基线。
- 当前前端入口、样式与实时执行模块为 `studio206`；本机服务端口为 `14317`。最新已部署 Worker 为 `63b83a8f-acfc-462e-98ad-1d9e3dc3eb35`，包含会员生命周期及系统消息分页；本次整理文档和提交不再次部署或重启。
- 本机 `.env`、密钥、会话、原始素材、运行时、输出日志与截图不纳入提交；未进行真实支付、账号会员变更、发送系统消息或付费媒体生成。会员收银台仍为演示支付，视觉生成质量未通过付费任务验收。


### 对话消息、执行过程与滚动整理

- 对话按实际消息日期分组（今天/昨天/具体日期）；缺失时间显示历史记录，不在渲染时写入当前时间冒充旧消息时间。
- `conversation-view.js` 统一主回复与实时执行的滚动策略：底部阅读跟随新内容，向上阅读按消息锚点保持位置，异步高度变化时修正偏移；提供“回到最新”，发送新消息、打开会话时定位最新。
- 点击执行详情视为主动阅读，展开时停止自动追底；保留原有进行中展开、完成后折叠一次、手动展开后不再自动收起的行为。
- 有实时执行记录时统一外层“思考与执行”，回复工具结果放到该区域内，隐藏重复等待面板；无实时记录仍显示回复附带执行记录。未关联后台会话的活动不会混入当前对话。
- 后台刷新重新挂载补充指令/审批表单时恢复原焦点及选区；恢复任务显示核对中，和明确失败区分。无文本回复如实提示，不生成假结果。
- 全套 **301 项测试通过**（`outputs/conversation-view-regression.txt`）；隔离 Electron 验证实际日期、底部跟随、后台/整页更新与卡片异步增高时阅读位置、回到最新、执行区域归组、手动展开和补充输入保留。脚本 `scripts/verify-conversation-view.mjs`。
- 前端入口、样式与 runtime-panel 缓存版本为 `studio206`。本次只修改前端，不需云端部署或重启后台，刷新客户端加载；未执行真实生成、审批或付费操作；相关修改纳入本次本地快照。


### 系统消息未读角标

- 消息图标右上方显示未读提示：1 条为 6px 圆形小红点，2–99 条显示数字，超过 99 显示 `99+`；无未读隐藏。数字角标高 14px、移除粗白边，定位在图标上方，不遮挡主图标。点击直接进入官方/系统消息，实际展示的消息记为已读。
- 已读 ID 按网关与账号保存在本机 localStorage，刷新保留、账号隔离；不跨设备同步。窗口可见时每 30 秒查询，重新聚焦、恢复可见或账号刷新时立即查询；当前为轮询，不是 WebSocket 推送。
- `/api/messages` 新增稳定排序、分页 offset 和 hasMore，单页最多 100 条；客户端逐页获取、去重，分页失败时保留旧未读状态。后台新消息可自动亮起；窗口正显示系统消息时新内容展示后标为已读。
- 云端版本 `63b83a8f-acfc-462e-98ad-1d9e3dc3eb35` 已部署，公共消息接口只读验证正常。前端入口与样式 `studio205`，刷新客户端加载。
- 全套 299 项测试通过；隔离 Electron 验证 105 条显示 99+、查看清除、刷新保持已读、新增两条显示 2、网络失败保持状态、切换账号隔离。脚本 `scripts/verify-message-badge.mjs`，截图 `outputs/message-badge-1789892087987/`。未发送真实系统消息；相关修改纳入本次本地快照。


### 积分页卡片优化

- 积分套餐沿用会员页的圆角矩形、浅色调/玻璃表面与四色强调色；突出价格及到账积分，赠送信息降为辅助标签，选中套餐显示勾选文字和边框。余额概览、自定义金额和支付区域统一表面配色。
- 原套餐金额、积分换算和赠送规则不变；卡片提供 `aria-pressed`，自定义金额时取消套餐选择状态。前端缓存版本 `studio203`，刷新客户端即可加载。
- 17 项相关测试通过；`scripts/verify-credits-page.mjs` 通过隔离 Electron 检查点击、键盘选择、自定义金额、三种主题和窄窗口布局。无真实充值、付款或账号变更。相关修改纳入本次本地快照。


### 会员页与到期降级

- 同等级显示续费，更高等级显示购买，更低等级预约降级；按用户确认，除终身会员外，在当前会员到期日期次日的北京时间 00:00 生效。预约时保留原权益，赠送积分生效时到账；终身会员禁用重复购买和降级。
- 卡片改为带套餐强调色的圆角矩形；选中态、价格、次要说明分层，支持方向键选择。普通日间保留玻璃壁纸，性能日间使用不透明浅色调。
- 新增 `membership-state.sql`、`membership-lifecycle.mjs`；原子处理预约、到期切换与幂等。客户端移除网络失败后本地模拟开通的兜底。收银台仍为演示支付，未接入正式扣款。
- 云端已执行增量建表并部署版本 `cfd21147-b262-4e70-bf18-681e43f1006b`。前端入口 `studio202`、CSS `studio199.2`，刷新客户端加载。检查时本机后台未运行，已通过 `scripts/start-agent-server.ps1` 隐藏启动；14317 的模型接口与新版前端文件均返回 200。
- 全套 **294 项测试通过**，日志 `outputs/membership-regression.txt`；隔离 Electron 三主题与布局验收通过，截图 `outputs/membership-page-1789890531535/`。未操作真实账号的购买、续费、降级或付款。
- 详见 [会员逻辑与迁移说明](docs/MEMBERSHIP.md)。旧账号无明确套餐记录时按并发权益暂映射；已有预约不允许重复购买，目前无取消或修改预约入口。相关修改纳入本次本地快照，不推送远程。


### 换素材后更新提示词

- 后端新增素材 SHA-256 指纹（只保存指纹，不把图片字节写入文本历史），识别同名换图、替换、追加及编号角色变化；旧历史无指纹时要求复核。
- 主 Agent 与图片子 Agent 接收 `referenceChange`，要求重新分析本轮参考、更新逐张提示词和 sharedStyle 中的旧主体细节，保留仍适用的风格与页面安排；不自动重新生成、不修改历史成图。
- 针对性 11 项及全套 **282 项测试通过**，日志 `outputs/reference-change-regression.txt`。实际提示词重写由 Agent 执行，未付费验证视觉质量；后端重启后加载，本轮相关修改纳入本次本地快照。

### 多轮对话参考素材延续

- 主对话此前仅发送本轮输入框 `@` 的素材，后端历史仅留名称，不足以给新建的图片子 Agent 提供原图。现在主对话默认沿用本会话最近一次已发送的参考列表，输入框旁显示可关闭的“沿用本会话参考”；本轮明确 `@` 替换沿用列表，新会话不继承，生成结果卡片不反向覆盖原图。
- 历史 `@图片/视频/音频编号` 可直接解析会话中已发送的素材，不依赖上传托盘仍在。素材发送前按 `storageId` 等待 IndexedDB 文件恢复，避免刷新后的异步恢复尚未结束就报缺失。仅有文件名但本机没有实际文件时仍如实提示。
- 后端提示区分“本轮未启用参考”与“文件丢失”，不因后续消息没重新上传就要求重传。前端入口缓存版本为 `studio199.6`；前端刷新生效，后端提示修改需重启加载。
- 针对性 12 项测试及全套 **279 项测试通过**：25 轮后继续引用、序列化恢复、新会话隔离、关闭继承、当前 @ 替换、真实参考注入。全套日志 `outputs/conversation-reference-regression.txt`。未执行付费生成；本轮相关修改纳入本次本地快照。此规则针对主对话，画布 Agent 保持其原有素材选择流程。

### 日间与性能模式分离

- 修正 `style.css` 中把性能日间的不透明白底覆盖到普通日间的选择器；该组简化样式现在仅在 `html.low-memory-mode[data-theme="day"]` 下生效。普通日间复用原有壁纸、玻璃面板和文字配色。
- 样式缓存版本更新为 `studio199.1`。只需刷新客户端加载，不需重启后台。
- `scripts/verify-day-performance-theme.mjs` 在隔离 Electron 测试窗口验证普通日间→性能日间→恢复普通日间，检查真实计算样式并截图；验证通过。截图位于 `outputs/day-theme-1789885730338/`，未操作用户的壁纸数据。此修改尚相关修改纳入本次本地快照。

### 启动端口修复（上述套图提交之后）

- 本地提交已完成：`776b7ee`。随后用户报告客户端无法启动，实际复现后台 `listen EACCES 0.0.0.0:4317`；Windows TCP 排除端口范围为 `4311–4410`，包含原端口。
- 仅本机 `.env` 的 `PORT` 改为已验证可用的 `14317`，未修改系统端口保留策略。原 `start-zora-desktop.cmd` 已成功启动客户端，`/api/models` 返回 200，窗口标题正常。
- 启动器新增子进程退出/启动失败检查，直接显示后台错误，不再只等待后显示 fetch failed。两项针对性测试通过，这部分修复纳入本次本地快照。
- 当前本机地址为 `http://127.0.0.1:14317`；下文 `4317` 为历史默认端口。本地 `.env` 不纳入 Git，其他机器需根据实际端口配置启动。

### 历史快照 `776b7ee`（以下为此前交付记录）

- 该历史快照包含此前尚未提交的 Claude 路由适配、图片生成持久收据、Durable Objects 独立执行，以及本轮整套图片 Agent 和客户端归组展示；不是仅修改交接文档。
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
6. 已生成首次 Windows x64 测试安装包并完成本机独立程序验收；正式签名、正式安装升级迁移及另一台无开发环境电脑的完整验收未完成，见本文开头。

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
