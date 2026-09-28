# Agent 按需上下文

本次改动：普通对话首轮只提供简短角色/安全规则、会话历史、用户选用技能及必要素材信息。完整媒体目录不再写入主 Agent 每轮 prompt；图片/视频专业子 Agent 仍获得当前对应类型目录。

首轮工具仅有 delegate_media_task、discover_agent_tools、invoke_agent_tool。由模型根据任务选择 local/browser/research/desktop/om/media/skills 能力组。发现返回原始工具 schema 与对应操作规则，invoke 仅允许本轮已发现工具，保留原始执行器、审批、媒体委派边界，并检查参数基本类型/必填项。工作区状态和文档运行库说明在发现 local 时读取，不再每次聊天强行查询。

角色规则通过 contextInstructions 传递到 Responses instructions、Chat system 和 Codex developerInstructions；任务及历史保留在用户输入。当前会话历史未被删除或截断，已有 Codex 原生线程中的旧长提示不会被追溯清除。旧会话可能仍有较大历史输入；新建会话最适合验证首轮开销。

验证：23 项相关测试通过，覆盖简单回复、能力完整性、未发现工具拒绝、媒体委派边界、参考图和视频分析、旧会话恢复与本地状态按需刷新。模拟“回复ok”中，旧完整主规则+工具定义共16449字符；新规则+3工具定义+实际输入共1566字符。这个比较不含旧媒体目录、Codex自身指令、原生工具及历史，不能直接等同服务商token或费用下降比例。

未真实调用付费模型验证；未重启运行服务、部署或打包。部署/启动最新代码后生效。
