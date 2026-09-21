# Windows 稳定版更新通道

2026-09-21。源码接入 electron-updater，更新源为现有 GitHub 仓库 tenglonghaiwen-hub/zoraagent 的公开稳定 Release。

## 用户操作

设置 → 软件更新 → 检查更新 → 下载更新 → 退出并安装。显示当前版本、下载进度与错误。只有安装版可用；不会自动下载、退出时自动安装或降级，预发行版本不进入此稳定通道。安装前有独立确认，先停止应用拥有的后台再启动 NSIS 安装程序。

用户需先保存工作并结束本地任务。退出不等于取消云端生成。现有安装器保留 userData；更新不会主动删除素材、会话或项目，仍建议发布前做迁移与覆盖安装验收。

## 维护者发布步骤

1. 修改根 package.json 与 apps/desktop/package.json 的版本及各自 lockfile 根版本。每个公开安装包使用新的 x.y.z，不能用相同 0.1.0 覆盖来触发更新。
2. 写中文发布说明，执行测试。使用完整 `node scripts/package-desktop.mjs` 构建，不复用不含更新模块的旧 stage 或 win-unpacked。
3. 打包生成安装 exe、blockmap、latest.yml；win-unpacked/resources/app-update.yml 应包含 GitHub 更新源。构建强制 publish:never，不因环境中存在令牌而自动发布。
4. 执行 `node scripts/publish-desktop-release.mjs` 只读校验清单、大小、SHA512与版本。
5. 获得发布授权并登录 GitHub CLI 后，执行 `node scripts/publish-desktop-release.mjs --publish --notes=发布说明文件路径`。它创建 draft Release，不覆盖旧版本。
6. 在另一台 Windows 电脑验证安装、启动、旧会话保留和更新流程，再在 GitHub 将草稿发布为正式 Release。仓库或资产必须对用户可读；不在客户端内置 GitHub token。

公开 Release 必须同时包含同次构建的 latest.yml 和 exe，推荐保留 blockmap。下载使用 electron-updater 的 SHA512校验；这不等于 Windows代码签名。当前安装包仍未配置代码签名。

## 首次迁移与验证边界

此前 0.1.0 安装包没有更新模块，不能远程自行补上；必须手动安装一次新的引导版本。源码改完也不代表旧安装包已经改变。

本次补充代码、发布校验脚本和状态测试；未发布 GitHub Release、未改线上配置、未执行真实安装替换。首次公开发布前必须完成两个不同版本间的真实下载与覆盖安装验收，不能将模拟状态测试称为自动更新端到端通过。
