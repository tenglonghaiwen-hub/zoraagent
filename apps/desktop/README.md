# 造境桌面壳（Electron）

最小壳：主进程起停 / 复用本地 `apps/server`，可选拉起 OpenMontage sidecar，窗口加载现有 studio UI。

## 开发启动

```powershell
cd D:\zora\apps\desktop
npm install
npm start
```

或根目录：

```powershell
npm run desktop
```

## 行为

- 读取仓库根 `.env`（`PORT` 默认 4317）
- 若端口已有造境服务 → 复用，不重复拉起
- 默认尝试 `startSidecar`（`OM_AUTO_SIDECAR=false` 可关）
- 退出时只停**本壳拉起**的子进程；复用的外部服务不杀

## Windows 首次打包

已接入 `electron-builder`，在根目录运行 `npm run desktop:package`，输出内置 OpenMontage 的 Windows x64 NSIS 测试安装包和独立程序目录。安装版使用独立用户数据目录，不带入开发机密钥、会话与素材；自动初始化并启动剪辑引擎，退出时等待引擎停止。构建步骤与验证见 [桌面打包说明](../../docs/DESKTOP-PACKAGING.md)及 [OpenMontage 内置说明](../../docs/OPENMONTAGE-BUNDLE.md)。
