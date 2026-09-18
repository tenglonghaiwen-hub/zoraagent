# Zora 故障排查指南

## 概述

本指南帮助您诊断和解决 Zora 使用过程中遇到的常见问题。

---

## 启动问题

### 问题：服务启动失败

**症状：**
- 启动脚本报错
- 无法访问 http://127.0.0.1:4317
- 进程立即退出

**诊断步骤：**

1. **检查 Node.js 版本**
```powershell
.\runtime\node-v24.21.0-win-x64\node.exe --version
# 期望: v24.21.0
```

2. **检查端口占用**
```powershell
netstat -ano | findstr :4317
```
如果端口被占用，终止占用进程或更改端口：
```powershell
$env:PORT = '8787'
```

3. **检查 Codex 可执行文件**
```powershell
Test-Path runtime\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe
# 期望: True
```

4. **查看启动日志**
```powershell
.\runtime\node-v24.21.0-win-x64\node.exe apps/server/server.mjs
# 查看详细错误信息
```

**常见原因和解决方案：**

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `EADDRINUSE` | 端口被占用 | 更改端口或终止占用进程 |
| `Cannot find module` | 依赖缺失 | 检查 node_modules 是否完整 |
| `Codex 可执行文件未找到` | 运行时缺失 | 重新解压完整包 |
| `Key invalid` | API Key 格式错误 | 检查环境变量中的 Key |

---

### 问题：桌面客户端无法启动

**症状：**
- `start-zora-desktop.cmd` 报错
- Electron 窗口不出现

**诊断步骤：**

1. **检查 Electron 依赖**
```powershell
Test-Path apps\desktop\node_modules\electron
# 期望: True
```

2. **安装 Electron 依赖**
```powershell
npm run desktop:install
```

3. **检查后端是否启动**
```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/agent/status
```

4. **查看 Electron 日志**
- 按 `F12` 打开开发者工具
- 查看 Console 中的错误

---

## Agent 问题

### 问题：Agent 未配置或启用

**症状：**
```json
{
  "error": "主 Agent 尚未配置或启用"
}
```

**解决方案：**

1. **检查 API Key**
```powershell
$env:ZORA_AGENT_API_KEY
# 应该有值
```

2. **配置 API Key**
```powershell
$env:ZORA_AGENT_API_KEY = 'your-api-key'
$env:ZORA_AGENT_BASE_URL = 'https://api.example.com'
```

3. **重启服务**
```powershell
# 停止当前服务（Ctrl+C）
.\start-zora.cmd
```

4. **验证配置**
```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/agent/status
```

期望输出：
```json
{
  "configured": true,
  "enabled": true
}
```

---

### 问题：Agent 无响应或超时

**症状：**
- 消息发送后长时间无响应
- 超时错误

**诊断步骤：**

1. **检查网络连接**
```powershell
Test-NetConnection api.example.com -Port 443
```

2. **检查 Agent 状态**
```powershell
$status = Invoke-RestMethod http://127.0.0.1:4317/api/agent/status
$status.kernel.available
# 期望: True
```

3. **查看控制台日志**
- 检查是否有网络错误
- 检查是否有超时信息

4. **测试简单请求**
```powershell
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:4317/api/chat `
  -ContentType 'application/json' `
  -Body '{"message":"测试"}'
```

**常见原因：**
- API Key 无效或过期
- 上游服务故障
- 网络代理配置问题
- 请求体过大

---

### 问题：Agent 正在处理中（409 错误）

**症状：**
```json
{
  "error": "Agent 正在处理另一条消息，请稍后重试"
}
```

**原因：**
- Agent 同时只能处理一条消息
- 上一条消息尚未完成

**解决方案：**
1. 等待当前消息处理完成
2. 如果长时间卡住，重启服务
3. 检查是否有死锁（查看日志）

---

## 生成任务问题

### 问题：生成任务一直是 running 状态

**症状：**
- 任务提交后状态长时间不变
- 查询任务返回 `running`

**诊断步骤：**

1. **检查任务详情**
```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/generation-tasks/TASK-ID
```

2. **检查上游状态**
- 查看 `upstreams` 字段
- 记录 `taskId` 和 `provider`

3. **查看轮询日志**
- 控制台应该有轮询记录
- 检查是否有网络错误

**正常情况：**
- 图片生成：30秒 - 2分钟
- 视频生成：2 - 10 分钟

**异常情况：**
- 超过 10 分钟仍无响应
- 轮询返回错误

**解决方案：**
1. 等待更长时间（视频生成可能需要 5-10 分钟）
2. 检查账户余额
3. 检查上游服务状态
4. 如果确认失败，重新提交

---

### 问题：生成任务失败

**症状：**
```json
{
  "status": "failed",
  "error": "..."
}
```

**常见错误和解决方案：**

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `insufficient quota` | 配额不足 | 充值账户 |
| `invalid parameter` | 参数不合法 | 使用 `/api/preview` 检查 |
| `content policy violation` | 内容违规 | 修改 prompt |
| `network error` | 网络问题 | 重试 |
| `timeout` | 超时 | 重新提交 |

---

### 问题：无法找到生成的素材

**症状：**
- 任务状态 `completed`
- 但找不到结果文件

**检查：**

1. **查看任务结果**
```powershell
$task = Invoke-RestMethod http://127.0.0.1:4317/api/generation-tasks/TASK-ID
$task.results
```

2. **检查 URL 是否有效**
```powershell
Invoke-WebRequest $task.results[0].url -Method Head
```

3. **检查下载目录**
- 桌面版：`用户下载目录/Zora/`
- 检查是否有对应文件

---

## 本地运行时问题

### 问题：Docker 不可用

**症状：**
```json
{
  "docker": {
    "available": false
  }
}
```

**诊断步骤：**

1. **检查 Docker 是否运行**
```powershell
docker ps
```

2. **检查 Docker Desktop**
- 打开 Docker Desktop
- 确认引擎正在运行

3. **检查镜像**
```powershell
docker images | findstr node:24-bookworm-slim
```

4. **拉取镜像**
```powershell
docker pull node:24-bookworm-slim
```

**如果 Docker 不可用：**
- 本地执行功能将受限
- 无法执行容器命令
- 可以使用非容器执行（有安全风险）

---

### 问题：审批一直 pending

**症状：**
- 提交审批后无响应
- 状态一直是 `pending`

**原因：**
- 审批需要用户在对话界面手动批准
- 不会自动执行

**解决方案：**
1. 检查对话界面是否有审批卡片
2. 点击"批准"或"拒绝"按钮
3. 如果卡片未出现，检查前端日志

---

### 问题：工作流执行失败

**症状：**
- 工作流部分步骤失败
- 依赖步骤未执行

**诊断步骤：**

1. **查询工作流状态**
```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/local-runtime
```

2. **检查失败步骤**
- 查看错误信息
- 检查依赖关系是否正确

3. **检查工作区文件**
```powershell
ls workspace\
```

**常见原因：**
- 步骤依赖错误
- 文件路径不正确
- 命令语法错误
- 权限不足

---

## 浏览器工具问题

### 问题：无法打开网页

**症状：**
```json
{
  "error": "浏览器不可用"
}
```

**原因：**
- 浏览器工具需要桌面进程
- Playwright 依赖未安装

**解决方案：**

1. **使用桌面客户端**
```powershell
.\start-zora-desktop.cmd
```

2. **检查 Playwright**
```powershell
Test-Path apps\desktop\node_modules\playwright
```

---

## 剪映控制问题

### 问题：无法读取剪映界面

**症状：**
```json
{
  "error": "无法访问窗口"
}
```

**诊断步骤：**

1. **检查剪映是否运行**
```powershell
Get-Process | Where-Object {$_.ProcessName -like "*jianying*"}
```

2. **检查 UI 自动化权限**
- Windows 设置 → 隐私 → 辅助功能
- 确认应用有权限访问

3. **使用 listWindows 验证**
- 先调用 `listWindows`
- 确认剪映窗口在列表中

**限制：**
- 某些界面元素可能无法访问
- 需要管理员权限
- 不支持所有操作

---

## 性能问题

### 问题：响应缓慢

**症状：**
- 请求响应时间过长
- 界面卡顿

**诊断：**

1. **检查系统资源**
```powershell
Get-Process node | Select-Object CPU, WorkingSet
```

2. **检查会话数量**
```powershell
$status = Invoke-RestMethod http://127.0.0.1:4317/api/agent/status
$status.sessions
```

3. **检查任务数量**
- 大量进行中的任务会占用资源

**优化建议：**
- 重启服务清理会话（开发版本有 100 会话限制）
- 限制并发生成任务
- 关闭不需要的工具

---

## 数据问题

### 问题：会话丢失

**症状：**
- 重启后会话不见了
- 无法恢复历史对话

**原因：**
- 会话存储在 `data/chat-sessions/`
- 文件被删除或损坏

**解决方案：**
1. 检查 `data/chat-sessions/` 目录
2. 恢复备份（如果有）
3. 无法恢复则重新开始

**预防措施：**
- 定期备份 `data/` 目录
- 导出重要会话记录

---

### 问题：素材上传后找不到

**症状：**
- 上传素材后无法在 `@` 菜单中找到

**原因：**
- 素材保存在浏览器 IndexedDB
- 清空浏览器数据会丢失

**解决方案：**
1. 重新上传素材
2. 不要清空浏览器数据
3. 使用同一浏览器

**注意：**
- 不同浏览器不共享素材
- 隐私模式下素材不持久
- 换电脑需要重新上传

---

## 日志和调试

### 启用详细日志

```powershell
$env:DEBUG = 'zora:*'
.\runtime\node-v24.21.0-win-x64\node.exe apps/server/server.mjs
```

### 查看内核日志

```powershell
ls data\codex-home\.tmp\
# 查看 Codex 内核日志
```

### 查看生成任务日志

```powershell
ls data\generation-tasks\
# 查看任务持久化记录
```

### 查看审批记录

```powershell
ls data\local-approvals\
# 查看审批历史
```

---

## 获取帮助

如果以上方法都无法解决问题：

1. **收集信息：**
   - 错误信息（完整文本）
   - 操作步骤
   - 系统环境（Windows 版本、Node.js 版本）
   - 相关日志

2. **检查文档：**
   - `docs/` 目录
   - `README.md`
   - `CLAUDE.md`

3. **提交问题：**
   - GitHub Issues
   - 包含收集的信息
   - 不要包含 API Key 或敏感数据

---

## 快速参考

### 重启服务
```powershell
# 停止服务（Ctrl+C）
.\start-zora.cmd
```

### 清理缓存
```powershell
Remove-Item data\chat-sessions\* -Recurse -Force
Remove-Item data\codex-home\.tmp\* -Recurse -Force
```

### 验证配置
```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/agent/status | ConvertTo-Json -Depth 5
```

### 测试生成
```powershell
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:4317/api/preview `
  -ContentType 'application/json' `
  -Body '{"modelId":"gpt-image-2","prompt":"测试","count":1,"ratio":"1:1","resolution":"1024x1024"}'
```
