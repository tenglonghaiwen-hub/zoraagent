# 文件交付与 PPTX 检查

更新：2026-09-16。以当前源码为依据，部署中的后台需重启才能加载服务端变更。

## 文件入口

`packages/agent/workspace-artifacts.mjs` 枚举允许交付的工作区文件；`GET /api/workspace-files` 返回列表，`GET /api/workspace-files/{id}` 读取文件。文件名、目录边界、符号链接与隐藏/敏感文件限制继续生效。执行记录中的 artifacts 关联表示观察到的文件变化，不代表内容质量或事实准确性已经验收。

## PPTX 交付防护

- Codex 的开发指令要求使用成熟演示文稿库，交付前运行校验，失败后修复重导出。这是 Agent 指令，不能当作每次都已实际运行的证据。
- 文件列表为 PPTX 附加 `validation`，包含 `ok`、`scope: structure` 和失败时的 `error`。失败文件仍保留在磁盘和列表中。
- 工作区下载接口在读取 PPTX 前再次校验；失败返回 HTTP 422 和原因，阻止该接口交付文件。其他外部 URL 或用户直接打开磁盘文件不经过此入口。
- 检查覆盖常见 ZIP 目录问题、必需包文件、母版声明、常见页面顺序/尺寸错误、幻灯片版式关联声明及本次发现的错误加粗写法。
- 上限：文件 64 MiB，声明的解压总大小 128 MiB。超限返回校验失败，不能据此判定文件本身已损坏。

这是针对已知问题的结构检查，**不是完整 OOXML Schema、CRC、全部关系目标、渲染或 WPS 兼容性验证**，也不核实演示文稿中的参数和引用。当前没有下载失败后自动发起新 Agent 任务的修复服务；应将错误交给 Agent 修复再交付。前端尚未针对 validation 增加专用状态卡。

## 手动校验

在项目根目录执行；从其他目录调用时使用脚本的绝对路径：

```powershell
cd D:\zora
& '.\runtime\node-v24.21.0-win-x64\node.exe' scripts/validate-pptx.mjs 'D:\zora\workspace\示例.pptx'
```

退出码 0 表示上述检查通过，1 表示失败，标准输出为 JSON。通过后仍应使用目标办公软件打开并检查布局；原文件保留，修复版本单独命名。

实现：[校验模块](../packages/agent/pptx-validation.mjs)、[命令入口](../scripts/validate-pptx.mjs)、[文件服务测试](../tests/workspace-artifacts.test.mjs)。

## 媒体下载与素材保存

桌面生成媒体通过 `zoraDesktop.downloadMedia` 和主进程下载接口保存至系统下载目录的 `Zora` 子目录，以下载完成事件确认成功；不再用打开外部网页作为失败后的下载替代。网页模式走 fetch/Blob，仍受网络与浏览器限制。主进程或 preload 改动需要退出并重开桌面客户端。

上传参考素材保存在当前浏览器配置的 IndexedDB `zora.referenceFiles.v1`，会话引用使用 storageId 恢复文件和临时 URL。刷新同一配置可恢复；清空网站数据、更换浏览器配置或换电脑不能保证恢复。未保存的旧素材无法由提示词找回，备份会话 JSON 不等于备份素材二进制。发送仍只携带本轮明确 @ 的参考素材。

生成素材按相同结果 URL 合并展示，避免重复入库；这不是按内容哈希去重，签名不同的 URL 仍可能出现多个条目，不删除原文件。
