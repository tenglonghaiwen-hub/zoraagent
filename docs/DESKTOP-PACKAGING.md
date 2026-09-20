# Windows 本地测试打包

版本：0.1.0，Windows x64 本地测试包。源码基于 `659ada6` 加本轮打包适配；不是已签名的正式发行版。当前默认内置 OpenMontage，之前的首包为未带该引擎的精简测试包。

## 构建

在仓库根目录使用包内 Node：

```powershell
& .\runtime\node-v24.21.0-win-x64\node.exe scripts/package-desktop.mjs
```

或已配置 Node 的开发环境运行 `npm run desktop:package`。首次需在 `apps/desktop` 安装锁文件中的开发依赖；electron-builder 固定为 26.0.12。构建使用现有 Electron 37.10.3，不安装新的运行时版本。生产依赖由根锁文件通过 `npm ci --omit=dev --ignore-scripts` 安装到新暂存目录。

每次创建独立的 `outputs/desktop-package-<时间>/`，不清理以前产物。`outputs/latest-desktop-package.json` 指向最近一次成功构建；失败构建不会更新它。目录包含：

- `release/Zora-0.1.0-win-x64-openmontage-setup.exe`：内置 OpenMontage、按当前 Windows 用户安装的向导，可选择安装目录。
- `release/win-unpacked/Zora.exe`：未压缩的独立程序，必须保留整个目录。
- `SHA256SUMS.json`：安装包等产物的 SHA-256。
- `stage/`：源码与生产依赖的暂存副本，不是用户数据备份。

使用 electron-builder 的 [NSIS 安装向导](https://www.electron.build/v26/docs/nsis/)，禁止构建时自动发布，安装完成也不自动打开程序。

## 内容和数据边界

包含客户端、本地后台、桌面桥、技能、生产依赖、Node、Codex、FFmpeg/FFprobe，以及 OpenMontage 引擎、Python、HyperFrames/Chromium、Remotion 合成依赖及相应许可证。Node 可执行文件校验值与原下载归档内文件、OpenJS 有效签名核对；历史 runtime-manifest 的 `sha256` 是 ZIP 校验值，构建清单另记 `nodeSha256`。

使用白名单复制，不打包 `.env`、DPAPI 密钥、数据库、账号会话、工作区素材、开发日志、构建工具、云端部署配置或 OpenMontage 本机目录链接。

安装版数据位于 Electron 的用户数据目录（`app.getPath('userData')`，使用 `--user-data-dir` 验收时遵从指定目录）：`data/` 保存任务、会话、数据库和连接描述文件，`workspace/` 保存工作文件，`openmontage/` 保存引擎工作副本、项目和配置；浏览器数据也在此目录。首启选择可用回环端口并保存为 `local-port.json`，以后复用这个端口以保留 localStorage 和 IndexedDB。端口被占用时明确报错，不接管其他服务。程序默认仅监听 127.0.0.1。

开发目录 `D:\zora` 的旧会话和素材不自动迁移。安装版需单独登录；卸载配置保留用户数据。后台仅随启动它的应用退出，开发模式仍可复用已运行后台。

## 验收与限制

```powershell
& .\runtime\node-v24.21.0-win-x64\node.exe scripts/verify-packaged-desktop.mjs '<产物目录>\release\win-unpacked\Zora.exe'
```

验证脚本使用独立临时用户目录：检查包内运行时、真实 Codex 初始化握手、视频探测、程序启动、本地模型和执行接口、两次启动后的端口与浏览器状态保持、应用退出后的后台关闭，以及没有个人配置进入产物。握手使用本地假凭据，不发送模型推理或付费任务。

当前包已把开发机的 OpenMontage 链接转换为实际文件，安装版自动初始化、启动和关闭引擎；项目与配置不保存在安装目录。实际本地拼接与裁剪验收及剩余能力边界见 [OpenMontage 内置说明](OPENMONTAGE-BUNDLE.md)。媒体生成与 Agent 模型推理仍需要登录和网络；会员付款仍为演示流程。

当前未配置代码签名，使用默认 Electron 图标；未验证另一台无开发环境电脑、正式安装升级迁移、真实支付及付费媒体生成。打包成功和本机独立程序验收不代表上述项目已完成，也没有自动提交 Git 或上传安装包。
