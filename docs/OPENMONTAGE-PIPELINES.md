# OpenMontage 管线与 Zora 媒体 API

2026-09-21。Zora 主 Agent 理解用户指令并编排任务，OpenMontage 提供本地媒体处理工具。

## 调用顺序

1. Agent 判断任务是否需要剪辑、字幕、配音、混剪或多阶段交付。普通问答、单独生图或生视频不强制使用 OM。
2. 使用 `om_list_pipelines`、`om_get_pipeline` 选择管线，通过 `om_prepare_pipeline` 创建项目计划。
3. 管线需要新图片或视频时，调用 `delegate_media_task`，复用 Zora 已配置的模型、供应商、参数校验、报价和生成 API。OM 不另行配置生成模型或密钥。付费步骤仍需用户授权。
4. 用 `query_generation_task` 查询原任务回执，拿到真实完成的媒体地址后，用 `om_import_media` 导入项目。已有参考素材也可按引用序号导入；保存副本，不覆盖原素材。
5. 按需检查或启动 OM sidecar，用 `om_describe_tool` 读取参数定义，再调用 `om_execute_tool` 执行管线中的本地工具。
6. 检查输出文件和工具结果后交付。创建计划、提交生成和取得任务编号均不代表任务完成。

## 能力范围

### 本地媒体能力设置

设置页新增“本地媒体能力”折叠面板，可配置剪辑、语音转录、本地配音与素材检索开关，选择默认转录模型、已有 Piper ONNX 音色路径及素材来源。设置持久保存，后续调用执行检查；关闭开关不取消已在运行的任务。面板区分“允许使用”与“依赖已检测到”，不会把库存在误报成模型已下载或服务已连通。

素材来源开放 Archive.org、NASA、Wikimedia，以及用户自行申请密钥的 Pexels、Unsplash。后两项默认不选中，面板提供申请链接、密码输入框和清除选项。用户最新明确要求允许自带素材服务密钥，此处为素材检索配置例外；Zora 生成模型密钥仍按原有云端配置管理。

- 素材服务密钥使用 Windows DPAPI CurrentUser 加密保存，仅当前 Windows 账户可解密；API 只返回配置状态，不返回明文。换电脑需重新配置。非 Windows 环境明确拒绝此保存方式，不回退到明文。
- 密钥只注入 `direct_clip_search` 本次选中的素材提供商，其他 OM 工具、Agent 提示词和云端不接收这些密钥；执行器再次清理上游 BaseTool 从 engine/.env 导入的凭据，工具输出中命中的密钥被脱敏。
- Pexels 使用当前 `/v1/videos/search`；Unsplash 下载前记录官方 download_location 事件。保留作者、来源与许可信息，Agent 交付时给出署名。
- 本机检测到 FFmpeg、FFprobe、Python、requests；未检测到 faster-whisper、WhisperX、Piper。没有自动安装运行库或下载模型，也没有真实素材服务密钥，因此没有声称在线检索成功。
- `GET /api/om/capabilities` 为依赖与配置状态；`PUT /api/om/preferences` 保存非敏感设置；`PUT /api/om/credentials` 更新或清除素材服务凭据。这三个接口只允许本机同源请求，不开放给 Agent 改写。
- 339 项全量测试通过；真实本地 HTTP 与 Chromium 验证密钥加密保存、刷新恢复、清除及桌面/窄屏布局。记录 `outputs/om-settings-regression.txt`、`outputs/om-settings-ui.txt`。使用测试密钥，未向第三方发起注册或真实 API 检索。

当前提供 9 条由 Zora Agent 编排的管线：视频创作与后期、剪辑合成、长视频拆短片、字幕配音、播客再剪辑、素材混剪、图文动画、录屏后期、口播后期。它们不是原 OM 独立大模型管线执行器。

`vendor/openmontage/zora-policy.json` 集中管理允许的 21 个工具和 14 个技能。Node 入口和 Python 执行入口均限制工具；Python 仅加载目标工具模块，不扫描加载全部模型提供商。OM 子进程不继承主服务的模型密钥。

OM 内置 GPU 租用管理、模型配置、独立大模型及远程模型生成工具从 Zora 可调用能力中移除。保留 Zora 主 Agent、现有图片视频接口、本地剪辑、字幕、ASR 和本地 TTS。没有批量删除 OM 上游源码。

## 验证和限制

- 全量自动测试 336/336 通过，记录 `outputs/om-pipelines-regression.txt`。
- 真实本地 FFmpeg 验证：生成测试视频、模拟已完成上游下载、导入副本、裁剪、探测输出，确认原文件不变。未调用付费媒体生成。
- ASR、Piper 等依赖仍需所在电脑具备相应运行库和模型文件；未逐一实测全部工具。
- 媒体导入当前支持内嵌数据或公网 HTTPS 直链，最多 64 MiB，不跟随重定向；超限或不支持的地址明确失败。
- 任务查询复用现有持久回执能力，不保证恢复缺少回执的历史任务。项目计划已落盘，尚无独立的管线逐步自动恢复引擎。
- 本次只修改本地源码，需退出并重新启动开发客户端；旧安装包需重新打包才能包含这些功能。没有重启现有任务、提交 Git 或发布新安装包。
