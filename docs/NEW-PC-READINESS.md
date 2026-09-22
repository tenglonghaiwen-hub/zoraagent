## 补充：无需 Docker 的脚本执行

当前源码已接入逐次授权的本机 Node.js / Python 执行。Agent 使用 `propose_local_action` 或 `plan_local_workflow`，设置 `kind: exec`、`runtime: node/python`，并在 `command` 中填写完整脚本。旧容器命令没有改变含义。

授权弹窗显示脚本、工作目录、时间限制和权限范围。关闭或拒绝不会执行；选择“允许本次”才启动。运行时可点“中止脚本”。每个后续步骤仍需批准，失败或拒绝会阻止依赖步骤。

这是当前用户权限下的宿主进程，不提供 Docker 文件或网络隔离，不需要提升为管理员。包内 Node/Python 缺失会直接报错，不自动安装或转用系统程序。输出有上限，默认 30 秒超时，保留审批和结果记录；进程树终止失败会在错误中说明。

此改动尚未重新打入安装包。下文 0.1.1 安装包验证结论仍对应当时版本。

# 0.1.1 新电脑兼容修复

2026-09-21。目标为 Windows x64 安装版，不依赖 D:\zora 开发目录。没有声称完成另一台实体电脑的验收。

| 问题 | 处理 |
| --- | --- |
| OM 异常导致整个窗口打不开 | OM 初始化异常隔离；主界面先打开，再启动 sidecar。设置可查失败原因、重试；初始化失败需要用户确认重启后重新初始化 |
| 持久端口被占用 | 后台使用空闲端口；Electron 仅在本地原地址上转发，浏览器 origin 不变，不迁移/清空 localStorage 或 IndexedDB。外来 Origin 拒绝转发，不占用或终止其他程序 |
| 配置硬链接失败 | 在明确的不支持/权限类错误下复制配置；保留用户修改，升级时沿用上一版本配置。不删除旧引擎 |
| PPTX 校验漏打包 | 校验脚本纳入白名单，Agent 使用包内 Node 和绝对脚本路径 |
| 新电脑没有文档生成库 | 固定 PptxGenJS、ExcelJS、docx、pdf-lib，由应用 package.json 的 createRequire 加载，不依赖用户工作区安装模块 |
| 无 Docker 的脚本执行假成功 | native 工作区执行脚本明确失败；Agent 在可用时使用原生命令工具和对应审批，不能把脚本交付当成最终文件 |
| 语音模型和音色未准备 | 设置增加模型检查、明确授权下载、进度、重试和 CPU 加载校验；已有 Piper 音色可选择复制到用户数据目录，再保存设置 |
| 语音库隐式依赖系统 C++ DLL | 包内附微软官方 x64 C++ 运行库安装程序，下载时验证微软签名并固定 SHA256。用户在设置点击并确认后打开，未静默安装；可能需管理员许可 |
| 代理未传给 Agent | 网络设置提供环境变量/直连/指定代理；重启后用于 Node 后台、Agent 和本地媒体下载。本地回环直连；不在 UI 保存带账号密码的代理 URL |
| 旧包没有更新通道 | 0.1.1 纳入更新代码及 GitHub 稳定通道元数据，需先手动安装一次引导包。未发布 GitHub Release |

## 新电脑操作

本次解包后的应用目录实测约 2.51 GiB，此外还需要首次启动的引擎副本、模型缓存和安装临时空间；建议安装盘及用户数据所在磁盘预留足够空间，首次试用按至少 6 GiB 的总余量准备。

1. 安装 0.1.1，打开客户端并重新登录；旧开发机登录、素材不会自动跨设备同步。
2. 在设置检查本地媒体；若缺 DLL，点击“安装 / 修复 Microsoft C++ 运行库”，完成微软安装向导，再重新检查。安装程序已经附在包内，不要求在用户电脑重新下载。
3. 转录选择模型并检查缓存；未准备时点击下载/重试。网络受限时在网络设置指定 HTTP/HTTPS 代理，完全退出并重启后再试。
4. 配音选择自己获授权的 .onnx 音色，旁边须有同名 .onnx.json。选择会保存副本，不改原文件；再点击保存媒体设置。
5. 先验证普通对话、小文件文档生成、已有视频裁剪，再按报价确认云端图片/视频生成。

## 验证记录与边界

- 348 项回归通过（再次包含最终运行库检查修改的结果以 outputs/portability-final-regression.txt 为准）。
- Electron 真实窗口验证端口转发后 localStorage 与 IndexedDB Blob 保持、POST 与 Range 读取正常：outputs/port-origin-smoke.json。
- 实际安装包目录代码在隔离用户目录、无开发机密钥环境下运行；模拟端口占用、缺失 OM 引擎，主窗口和更新入口仍正常：outputs/device-boot-smoke.json。此为本机故障模拟，不是另一台干净电脑。
- 源码、stage 与最终 payload 均实际生成 PPTX/XLSX/DOCX/PDF 并回读或结构校验：outputs/document-*-smoke.txt。未做 WPS/Office 视觉渲染验收。
- Tiny 模型真实联网下载并 CPU 加载；缓存重查及管理器 ready 状态通过：outputs/model-preparation-smoke.txt、model-cache-check.txt、model-manager-smoke.txt。测试缓存不纳入安装包。
- 新设置的 Chromium 交互测试：outputs/device-setup-final-ui.txt。音色选择的 UI 测试使用模拟返回；现有包内真实 Piper 配音测试见原 handoff。
- DLL 导入检查发现 MSVCP140.dll、MSVCP140_1.dll 依赖，因此没有将“开发机导入成功”当成新电脑不需要系统运行库。依赖探测现在实际 import，不仅检查 Python 模块文件存在。
- 仍需真实异机安装、微软运行库安装、真实账号对话、付费媒体任务和两个版本间更新安装验收；没有执行这些账号/付费操作，也没有签名证书，Zora 安装包仍未签名。

## 维护

完整打包前运行 scripts/prepare-windows-prerequisites.ps1，只下载和校验，不安装运行库。微软地址更新后哈希不一致会停止，维护者需核验再更新，不可跳过校验。

微软安装程序来源：https://aka.ms/vs/17/release/vc_redist.x64.exe 。来源、签名与哈希记录：outputs/vcredist-source.json。Microsoft C++ 采用官方安装程序及其许可，不从开发机 System32 抽取 DLL 分发。

## 本次安装包

`outputs/desktop-package-2026-09-21T11-25-17-890Z/release/Zora-0.1.1-win-x64-openmontage-setup.exe`，894429890 字节，SHA256：`8ba19d7e87b8a14edb0a1d66984cc4a09ae55327fdb2d002cb1f2351dbd8b912`。

`latest.yml` 和 `.blockmap` 已生成；发布脚本只读校验通过，尚未上传。微软运行库安装程序已签名，Zora 安装程序未签名，两者需区别。
