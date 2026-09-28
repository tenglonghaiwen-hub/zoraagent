# Zora 接入 New API

状态：接入准备已修改并通过模拟测试；New API 尚未部署，未进行真实上游付费调用，未发布 Worker 或打包客户端。

## 链路

Zora 客户端 → Zora Worker（登录、模型开放、积分）→ New API（渠道、模型映射、上游密钥）→ 模型服务。

New API 是独立服务；本次不替换 Zora 业务网关。官方部署入口：https://docs.newapi.pro/en/docs 。先确定 Linux 服务器或本机测试环境，再选择部署方式；生产域名需支持 HTTPS，反向代理需允许 SSE 长连接并关闭流缓冲。

## 配置顺序

1. 部署 New API 并由用户完成管理员初始化。
2. 在 New API 配置实际供应商渠道与密钥，添加供应商提供的模型 ID。别名通过 New API 模型映射关联上游真实 ID；名称不代表已验证能力。
3. 为 Zora 创建专用 New API 令牌，允许所需模型。密钥只写服务端，不放客户端、仓库或聊天消息。
4. Zora 管理后台选择“自定义 / New API 中转”，填写 New API 域名根地址和专用令牌。也可用 Worker secrets CUSTOM_API_KEY 和配置 CUSTOM_BASE_URL；已有 D1 配置优先于环境值，旧配置须同步更新。
5. 对需转发的 Agent 模型选择 provider=custom。模型 ID 必须是 New API 令牌可访问的公开模型名。确认上游和所部署 New API 版本支持 Responses 后，选对应 Responses 模板与 /v1/responses 路由；仅 Chat 兼容的渠道使用 chat-completions 与 /v1/chat/completions。不要只改显示名称。
6. 后台连通性测试只检查模型列表，不证明工具、流式或多轮调用可用。实际验收需单独覆盖普通对话、SSE、工具调用及回传、跨协议旧会话和取消请求。可能计费的调用先确认。

## 本次兼容修正

- custom 缺少密钥时保持未配置，不再借用多元密钥。
- Agent 网关缺少 Base 地址时明确报错。
- 过长 call_id 在业务网关转换成稳定短 ID，调用与结果配对不变，兼容旧客户端；不会修复其他类型的不合法历史项。
- Agent POST 不自动跟随重定向，不自动重复请求。
- 模型列表探测兼容地址末尾 /v1，避免拼出 /v1/v1/models。

## 尚待验证

部署主机、域名、New API 版本与供应商能力均尚未确定。图片/视频及素材库不能因接入 New API 自动获得兼容性，本次范围是 Agent 文字与工具协议。现有积分仍按 Zora 的请求计费，不自动改为 New API token 成本结算。
