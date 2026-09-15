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

## 打包（后续）

尚未接 `electron-builder`；先验证开窗与起停即可。
