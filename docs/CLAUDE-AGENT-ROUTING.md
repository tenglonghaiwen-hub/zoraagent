# Claude Agent 路由与协议适配

云端 `/api/agent/v1/responses` 接收包内 Codex 的 Responses 请求。服务端 `server_models.route` 为 `/v1/messages` 时，网关转换为 Claude Messages 请求；其他模型保持原 Responses 链路。客户端或模型输出不能覆盖上游地址。

文字、多模态输入、工具调用使用同一 `/v1/messages` 地址。Agent 可通过 `tool_choice: auto` 选择提供给它的工具；模型自身请求的协议和路由由服务端模型配置确定，不能在尚未调用模型时由模型选择。

适配包括系统指令、完整历史、图片 URL/base64、普通和命名空间工具、自定义工具、工具结果回传、JSON Schema 输出，以及 SSE 文本、完成、异常、截断和取消。保留提供商 HTTP 错误状态，不自动换模型或路由。工具名采用请求内映射，返回 Codex 时恢复原名称及命名空间。

限制：OpenAI 托管 web_search 不发送给 Claude，联网使用已有 Zora browser_search/browser_read 工具，需用户已启用这些工具。跨提供商 reasoning 状态不复用，也不展示原始 thinking 块；previous_response_id 不支持，必须提供完整历史。未知工具类型返回明确错误，不静默丢弃。计费沿用网关成功接收请求后按调用扣费的现有规则，不新增退款机制。

验证：`node --test tests/claude-responses.test.mjs tests/cloud-agent-responses.test.mjs`；`node scripts/verify-claude-kernel.mjs` 使用包内真实 Codex 与本地模拟 Claude，验证两次请求和一次本地工具执行，无付费上游调用。生产 Claude 的可用性、余额和真实渠道能力仍需实际使用验证。

接口依据：[多元探索 Claude Messages 文档](https://docs.deepwl.cn/duoyuanx/zh/texts/claude-messages)。
