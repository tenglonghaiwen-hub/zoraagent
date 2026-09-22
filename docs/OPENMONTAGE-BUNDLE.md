# OpenMontage 随 Windows 安装包内置

构建基于本机 `calesthio/OpenMontage` 工作副本，来源提交 `0416fb7c5b9a7b07154b1f88c717c23fc5aba95c`，包含本机已实现的 Studio API 本地工具接口等源码修改。没有修改外部引擎工作副本，也不把它的账号、个人项目或环境配置复制给用户。

## 随包内容

- Studio API、工具注册表、工具实现、技能、流程定义、模板和模式文件。
- Python 3.12.10 及当前已安装依赖。
- 语音运行库位于 Python 的 `media-site`：faster-whisper 1.2.1、Piper 1.8.0、CTranslate2、ONNX Runtime、PyAV 等。版本及 wheel SHA256 固定在 `speech-requirements.lock`，构建前检查能否导入；缺失则打包失败。使用 `scripts/install-om-speech.ps1 -PipPython <构建机带 pip 的 Python>` 可首次准备依赖，不依赖用户安装 Python。
- Piper 通过包内 Python API 执行，不使用写死开发机路径的 pip 启动器。安装目录换位置后仍可调用。安装包不含语音模型权重：Whisper 首次运行可能下载所选模型，Piper 仍需用户提供已有音色文件及配置。
- HyperFrames 0.8.12、配套 Chromium headless shell、Remotion composer 与本地 npm 依赖。
- 复用 Zora 已携带的 Node、Codex、FFmpeg 和 FFprobe，不重复放置另一套二进制。
- OpenMontage 原始许可证、组件许可证以及 `bundle.json` / `bundle-files.json` 来源和逐文件校验清单。

仅允许清单中的源码目录。引擎顶层开发链接在构建时解析为真实文件，拒绝内部嵌套链接；不复制 `.git`、`.env`、账号数据、个人项目、缓存、日志或 Python 字节码。开发副本新增的必要源码也纳入白名单检查，未跟踪的素材目录不自动进入包。引擎默认 `config.yaml` 取自来源提交，不采用本机私有配置。

## 用户数据与升级

安装文件位于 `resources/app/vendor/openmontage/`。用户数据位于 Electron 用户数据目录下的 `openmontage/`（应用名已核验为 `Zora`，Windows 默认根目录为 `%APPDATA%\Zora`，实际取 `app.getPath('userData')`）：

| 目录 | 内容 |
| --- | --- |
| `projects/` | 用户项目、素材与合成结果 |
| `config/config.yaml` | 用户配置；首次复制默认值，升级保留 |
| `engines/<内容摘要>/` | 可写的引擎工作副本，支持 Remotion 的项目暂存和渲染缓存 |
| `state/` | 本机进程状态与临时鉴权信息，不上传 |
| `cache/` | 可下载模型等缓存位置 |

首次启动用 Windows 自带 Robocopy 并行初始化引擎，之后相同内容版本直接复用。配置通过同一用户目录内的文件硬链接与引擎连接；新版本引擎继续使用原配置。旧引擎缓存不会自动批量删除，项目目录不随引擎版本更换。

安装版设置 `OM_VENDOR_ROOT`、`OM_ENGINE_ROOT`、`OM_STATE_DIR`、`OM_PROJECTS_ROOT`。API 使用的 `OPENMONTAGE_PROJECTS_ROOT` 和底层工具使用的 `OPENMONTAGE_PROJECTS_DIR` 指向同一位置。Python 禁止写入字节码，内置 `._pth` 不引用开发机路径。

客户端自动启动并检查 OpenMontage；启动失败显示原因。退出时等待自己启动的引擎停止，避免遗留后台。开发模式的外部引擎布局保持兼容。

## 构建和验收

```powershell
& .\runtime\node-v24.21.0-win-x64\node.exe scripts/package-desktop.mjs --stage-only
& .\runtime\node-v24.21.0-win-x64\node.exe scripts/verify-bundled-openmontage.mjs '<构建目录>\stage'
& .\runtime\node-v24.21.0-win-x64\node.exe scripts/package-desktop.mjs '--from-stage=<构建目录>\stage'
& .\runtime\node-v24.21.0-win-x64\node.exe scripts/verify-packaged-desktop.mjs '<构建目录>\release\win-unpacked\Zora.exe'
```

`--from-stage` 只接受本仓库 `outputs` 下的暂存目录；它直接打包已经验收的快照，不重新同步源代码。修改源码后应重新暂存和验收，避免把旧快照当成新代码。

引擎验收使用独立用户目录及程序生成的红、蓝色块短片，通过 Studio API 的 `video_compose` 合成，并经注册表调用 `video_trimmer`，读取实际文件确认结果。桌面验收检查启动、重启后数据保留，以及 Zora 后台与 OpenMontage 都随应用关闭。不会调用付费模型或读取用户素材。

## 能力边界

随包携带运行时不等于全部工具已经可用。GPU 工具、额外模型权重、外部服务账号与 API 权限需按工具要求另行配置；不得把目录中列出的工具数量当作已通过全部执行验收。安装包仍是未签名测试版，真实付费生成和另一台干净电脑的独立安装验收另行进行。
