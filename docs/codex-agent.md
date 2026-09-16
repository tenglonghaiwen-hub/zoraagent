# Codex 主 Agent 接入

> 维护说明（2026-09-15）：当前能力、入口与限制见 [当前实现状态](CURRENT-STATUS.md)。本文中的版本验收数字、当时状态和后续计划保留为历史记录；涉及 RunningHub 的接入计划已取消，相关接口现已移除。

更新日期：2026-09-16。当前默认后端是包内开源 Codex 的 **app-server**，不是旧版 `codex exec` 单次执行模式。

## 执行链路

Zora 对话服务组织指令、明确引用的素材与工具 → 通过 stdio JSON-RPC 调用包内 app-server → Codex 创建或恢复线程并运行工具循环 → 工具结果回传 → 回复与执行状态显示在对话中。

模型接口采用 Responses API。默认配置位于 `apps/server/config/agent.json`；当前模型默认 gpt-5.5，服务地址为 `https://duoyuanx.com`。模型接口和 Codex 执行内核属于不同层。

Codex 独立使用 `data/codex-home`；Zora 会话数据保存在 `data/chat-sessions`。不会共享 Codex 桌面账户配置或会话。旧版 responses/cli 代码仍在，但 app-server 失败时不自动回退重放。

## 凭据与状态

主 Agent Key 的优先级：显式环境/环境文件中的 `ZORA_AGENT_API_KEY` → `runtime/agent-key.dpapi` 中的 Windows 用户加密凭据 → 未保存专用凭据时的 `DUOYUANX_API_KEY` 回退。

存在加密凭据但解密失败时明确报错，不悄悄使用生成接口 Key。使用自定义 provider 的 env_key 向 Codex 传递凭据，不将 Key 写入前端或文档。

`GET /api/agent/status` 可检查 backend、foundation、kernel.available 和实际 bin 路径，不返回 Key。内核就绪不代表供应商已接受凭据；401 需检查对应服务的凭据与权限。

## 对话交互

支持命令/文件审批、权限申请、用户提问、MCP 表单和授权链接、旧版审批、当前时间读取及动态工具结果。执行中的输出、计划、工具过程可见，并可补充指令或停止任务；不暴露隐藏的完整内部推理。

ChatGPT 令牌刷新、客户端证明和专用身份验证需要可信宿主，目前明确返回不支持或失败，不伪造凭据。通用表单不代表实现任意 JSON Schema 的全部约束。

## 验证范围

真实包内进程的工具循环、连续对话及重启恢复已使用本地模拟模型服务验证；对话表单已做 Electron 验证。包内运行时专项 12 项测试通过。付费上游模型、任意第三方工具与新电脑部署不能由这些测试推定成功。

详见 [包内运行时](bundled-runtime.md) 和 [README](../README.md)。

鉴权排障（2026-09-15）：当前 Key 在通用入口 `/v1/models` 返回 200，专用 chat 入口返回 401；已将主 Agent Base URL 改为通用入口。`/v1/responses` 空请求返回缺少模型的 400，确认不再被认证拦截。未发起实际模型生成，端到端推理仍需另行验证。

## 执行反馈与文件交付补充

思考与执行展示上游明确返回的摘要、计划、工具输出和重试错误；最多保存 50 条错误记录，进行密钥脱敏。停止会话会向主线程及所属媒体子线程发送中止，等待确认期间不应声称已停止；已经提交的媒体任务需另行查询，不能由 Agent 中止状态推断取消。

生成 PPTX 的开发指令要求使用成熟库并调用项目根目录 scripts/validate-pptx.mjs。该指令与工作区下载前的后端拦截是两层措施；当前没有校验失败后自动重启 Agent 修复的编排。检查范围见 [文件交付](FILE-DELIVERY.md)。
