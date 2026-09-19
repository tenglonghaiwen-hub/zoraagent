# Zora API 文档

## 概述

Zora 提供基于 HTTP 的 RESTful API，用于与 Agent、媒体生成、工作区管理等服务交互。

**基础信息：**
- 协议：HTTP/1.1
- 格式：JSON
- 编码：UTF-8
- 默认端口：4317

## 通用规范

### 请求格式

```http
POST /api/endpoint HTTP/1.1
Host: 127.0.0.1:4317
Content-Type: application/json

{
  "field": "value"
}
```

### 响应格式

**成功响应：**
```json
{
  "ok": true,
  "data": { ... }
}
```

**错误响应：**
```json
{
  "ok": false,
  "error": "错误描述",
  "category": "validation",
  "details": "详细信息（可选）"
}
```

### HTTP 状态码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 200 | 成功 | 请求成功处理 |
| 400 | 请求错误 | 参数格式或验证失败 |
| 401 | 未授权 | 需要身份验证 |
| 403 | 禁止访问 | 无权限执行操作 |
| 404 | 不存在 | 资源未找到或已过期 |
| 409 | 冲突 | 资源正忙或状态冲突 |
| 429 | 请求过多 | 超出速率限制 |
| 500 | 服务器错误 | 内部错误 |
| 503 | 服务不可用 | 服务未配置或暂时不可用 |

### 错误分类

| 分类 | 说明 | 处理建议 |
|------|------|----------|
| `validation` | 输入验证失败 | 检查参数格式 |
| `configuration` | 服务配置错误 | 配置 API Key 等 |
| `resource` | 资源问题 | 检查资源存在性 |
| `permission` | 权限不足 | 申请授权 |
| `network` | 网络错误 | 重试或检查网络 |
| `system` | 系统错误 | 联系技术支持 |

---

## Agent API

### 1. 获取 Agent 状态

**端点：** `GET /api/agent/status`

**说明：** 获取主 Agent 的配置状态和可用性

**响应：**
```json
{
  "configured": true,
  "enabled": true,
  "backend": "app-server",
  "provider": "openai",
  "model": "gpt-5.5",
  "baseUrl": "https://api.example.com",
  "wireApi": "responses",
  "hasCodexBin": true,
  "foundation": "codex-app-server",
  "kernel": {
    "available": true,
    "pid": 12345,
    "activeCount": 0
  }
}
```

### 2. 发送对话消息

**端点：** `POST /api/chat`

**说明：** 向主 Agent 发送消息并获取回复

**请求：**
```json
{
  "message": "帮我生成一张图片",
  "conversationId": "uuid-optional",
  "messageId": "uuid-optional",
  "modelId": "gpt-5.5",
  "skills": [
    {
      "id": "skill-id",
      "name": "技能名称",
      "prompt": "技能提示词"
    }
  ],
  "references": [
    {
      "name": "example.png",
      "type": "image/png",
      "contentUrl": "data:image/png;base64,..."
    }
  ]
}
```

**字段说明：**
- `message` (必填): 用户消息，1-8000 字符
- `conversationId` (可选): 会话 ID，用于多轮对话
- `messageId` (可选): 消息 ID，用于追踪
- `modelId` (可选): 指定模型 ID
- `skills` (可选): 技能列表，最多 20 个
- `references` (可选): 参考素材，最多 6 个

**响应：**
```json
{
  "conversationId": "conv-uuid",
  "reply": "Agent 回复内容",
  "tasks": [
    {
      "id": "task-uuid",
      "modelId": "gpt-image-2",
      "prompt": "图片描述",
      "kind": "image",
      "status": "submitted",
      "count": 1,
      "ratio": "16:9",
      "resolution": "1024x1024"
    }
  ],
  "toolTrace": [
    {
      "name": "list_media_models",
      "args": {},
      "result": { ... },
      "durationMs": 50
    }
  ],
  "reasoningSummary": [],
  "generationTasks": [
    {
      "task": { ... },
      "draft": { ... }
    }
  ],
  "backend": "app-server",
  "modelId": "gpt-5.5"
}
```

**错误示例：**
```json
{
  "ok": false,
  "error": "请填写 1–8000 字的需求",
  "category": "validation"
}
```

---

## 媒体生成 API

### 3. 列出可用模型

**端点：** `GET /api/models`

**说明：** 获取所有可用的图片/视频生成模型

**响应：**
```json
{
  "models": [
    {
      "id": "gpt-image-2",
      "name": "GPT Image 2",
      "kind": "image",
      "enabled": true,
      "ratios": ["1:1", "16:9", "9:16"],
      "resolutions": ["1024x1024", "1792x1024"],
      "maxCount": 4,
      "maxConcurrency": 4,
      "routes": [
        {
          "operation": "generate",
          "path": "/v1/images/generations"
        }
      ]
    }
  ]
}
```

### 4. 预览生成任务

**端点：** `POST /api/preview`

**说明：** 校验生成任务参数，不实际提交

**请求：**
```json
{
  "modelId": "gpt-image-2",
  "prompt": "一只可爱的猫",
  "count": 1,
  "concurrency": 1,
  "ratio": "1:1",
  "resolution": "1024x1024",
  "duration": null,
  "operation": "generate",
  "references": []
}
```

**响应：**
```json
{
  "ok": true,
  "draft": {
    "id": "draft-uuid",
    "modelId": "gpt-image-2",
    "prompt": "一只可爱的猫",
    "kind": "image",
    "count": 1,
    "ratio": "1:1",
    "resolution": "1024x1024",
    "createdAt": 1726646400000
  }
}
```

### 5. 提交生成任务

**端点：** `POST /api/generate`

**说明：** 提交图片/视频生成任务到上游

**请求：** 同预览任务

**响应：**
```json
{
  "ok": true,
  "data": {
    "task": {
      "id": "task-uuid",
      "modelId": "gpt-image-2",
      "status": "running",
      "revision": 0,
      "upstreams": [
        {
          "provider": "duoyuanx",
          "taskId": "upstream-task-id"
        }
      ],
      "createdAt": 1726646400000
    }
  }
}
```

### 6. 查询任务状态

**端点：** `GET /api/generation-tasks/:taskId`

**说明：** 查询生成任务的当前状态和结果

**响应：**
```json
{
  "ok": true,
  "task": {
    "id": "task-uuid",
    "modelId": "gpt-image-2",
    "status": "completed",
    "revision": 2,
    "upstreams": [ ... ],
    "results": [
      {
        "url": "https://cdn.example.com/image.png",
        "width": 1024,
        "height": 1024
      }
    ],
    "completedAt": 1726646500000
  }
}
```

**任务状态：**
- `running` - 生成中
- `completed` - 已完成
- `failed` - 失败
- `unknown` - 状态未知（需查询原任务）

---

## 本地运行时 API

### 7. 查询运行时状态

**端点：** `GET /api/local-runtime`

**说明：** 查看本地隔离执行环境状态

**响应：**
```json
{
  "ok": true,
  "status": "ready",
  "workspace": "/path/to/workspace",
  "docker": {
    "available": true,
    "image": "node:24-bookworm-slim"
  },
  "pendingApprovals": 0,
  "workflows": []
}
```

### 8. 提议本地操作

**端点：** `POST /api/local-runtime/propose`

**说明：** 申请在工作区内执行操作（需用户审批）

**请求：**
```json
{
  "conversationId": "conv-uuid",
  "messageId": "msg-uuid",
  "kind": "read",
  "path": "data.txt"
}
```

**操作类型：**
- `read` - 读取文件
- `write` - 写入文件（需 `content` 字段）
- `exec` - 执行命令（需 `command` 字段）
- `list` - 列出目录
- `search` - 搜索文本（需 `query` 字段）

**响应：**
```json
{
  "ok": true,
  "approvalId": "approval-uuid",
  "status": "pending"
}
```

### 9. 规划工作流

**端点：** `POST /api/local-runtime/workflows`

**说明：** 创建多步骤依赖工作流

**请求：**
```json
{
  "conversationId": "conv-uuid",
  "messageId": "msg-uuid",
  "steps": [
    {
      "id": "step1",
      "dependsOn": [],
      "request": {
        "kind": "write",
        "path": "script.js",
        "content": "console.log('hello');"
      }
    },
    {
      "id": "step2",
      "dependsOn": ["step1"],
      "request": {
        "kind": "exec",
        "command": "node script.js"
      }
    }
  ]
}
```

---

## OpenMontage API

### 10. 查询 OM 状态

**端点：** `GET /api/om/status`

**响应：**
```json
{
  "ok": true,
  "enabled": true,
  "sidecar": {
    "running": false,
    "port": null
  },
  "registry": {
    "available": true,
    "tools": 42,
    "skills": 15
  }
}
```

### 11. 列出 OM 项目

**端点：** `GET /api/om/projects`

### 12. 执行 OM 工具

**端点：** `POST /api/om/tools/execute`

**请求：**
```json
{
  "projectId": "project-id",
  "tool": "video_compose",
  "args": {
    "instruction": "合成视频",
    "attachments": []
  },
  "idempotencyKey": "uuid-optional"
}
```

---

## 工作区文件 API

### 13. 列出工作区文件

**端点：** `GET /api/workspace/artifacts`

**响应：**
```json
{
  "artifacts": [
    {
      "id": "file-uuid",
      "name": "example.xlsx",
      "extension": ".xlsx",
      "size": 12345,
      "createdAt": 1726646400000,
      "conversationId": "conv-uuid"
    }
  ]
}
```

### 14. 下载工作区文件

**端点：** `GET /api/workspace/artifacts/:id`

**响应：** 文件二进制流（Content-Type 根据扩展名设置）

---

## 速率限制

当前开发版本**未实施速率限制**。建议：
- 对话 API: 每用户每分钟 10 次
- 生成 API: 每用户每分钟 5 次
- 查询 API: 每用户每分钟 60 次

## 最佳实践

1. **幂等性**: 使用 `messageId` 和 `idempotencyKey` 避免重复操作
2. **重试**: 网络错误使用指数退避重试（最多 3 次）
3. **轮询**: 查询任务状态间隔至少 2 秒
4. **验证**: 生成任务先调用 `/api/preview` 校验参数
5. **安全**: 不要在客户端代码中硬编码 API Key

## 示例代码

**JavaScript/Node.js:**
```javascript
async function sendMessage(message) {
  const response = await fetch('http://127.0.0.1:4317/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.error);
  }
  
  return data;
}
```

**Python:**
```python
import requests

def send_message(message):
    response = requests.post(
        'http://127.0.0.1:4317/api/chat',
        json={'message': message}
    )
    
    data = response.json()
    
    if not data.get('ok'):
        raise Exception(data.get('error'))
    
    return data
```

## 更新日志

- **v0.1.0** (2026-09-18): 初始 API 文档
