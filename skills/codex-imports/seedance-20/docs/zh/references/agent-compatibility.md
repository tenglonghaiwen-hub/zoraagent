<!-- AUTO-TRANSLATED: 源文件 = ../../references/agent-compatibility.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 智能体兼容性

last_verified: 2026-06-12

当审查本仓库是否正确塑造为 Agent Skill 包时使用本文件。这是关于打包与智能体行为，而非 Seedance 模型能力。

## 当前 Agent-Skill 形态

Codex 当前的 Agent Skills 文档将技能定义为包含必需 `SKILL.md` 文件加可选 `scripts/`、`references/`、`assets/` 与 `agents/` 文件夹的目录。它还描述渐进披露：智能体首先看到名称、描述与路径，然后仅在技能匹配任务时加载完整 `SKILL.md`。

本仓库遵循该模式：

| Agent-skill 期望 | 仓库位置 | 状态 |
|---|---|---|
| 根技能元数据与路由 | `SKILL.md` | 已存在 |
| 任务专属子技能 | `skills/*/SKILL.md` | 已存在 |
| 密集参考材料 | `references/*.md` | 已存在 |
| 验证与维护脚本 | `scripts/*.py` | 已存在 |
| README 面向的视觉资源 | `assets/*` | 已存在 |
| Codex UI 元数据 | `agents/openai.yaml` | 已存在 |
| 行为评测 | `evals/evals.json` | 已存在 |
| CI 验证 | `.github/workflows/validate-skills.yml` | 已存在 |
| 本地 Codex 安装器 | `scripts/install_codex_skill.py` | 已存在 |

## 兼容性规则

- 让每个活跃 `description` 保持第三人称激活措辞，以便工具能从一个缩短的技能列表中匹配它。
- 让根 `SKILL.md` 保持精简。路由到子技能与参考，而非将长表复制进根。
- 让易变事实留在带日期的参考中，如 `api-status.md` 与 `source-registry.md`。
- 让生成的位图图像保留在 `assets/` 中，如果它们被 README 引用。
- 让 `agents/openai.yaml` 与根技能名对齐，并让默认提示词调用 `$seedance-20`。
- 使用 `scripts/install_codex_skill.py --force` 安装或刷新本地用户级 Codex 副本到 `$CODEX_HOME/skills/seedance-20` 或 `~/.codex/skills/seedance-20`。
- 让脚本保持确定性与本地。它们应在不需要私有凭证的情况下验证结构、模式、设计与源元数据。
- 不要在技能包中存储 API 密钥、账户 cookie 或私有提示词语料。

## 跨智能体矩阵

核验于 2026-06-12 来自每个智能体的公开文档；安装路径易变 —— 在承诺行为前重新检查活跃客户端。将本仓库作为一个根技能（`seedance-20`）安装；子技能与参考通过从根开始的相对路径加载。

| 智能体 | 技能位置 | 安装路径 | 备注 |
|---|---|---|---|
| Claude Code / claude.ai | `.claude/skills/`（工作区）、托管技能 | 复制或市场 | SKILL.md 形态的起源平台。 |
| Codex | `.agents/skills/` 向上扫描 + 用户/系统目录 | `scripts/install_codex_skill.py --force` | `agents/openai.yaml` 提供 UI 元数据。 |
| Google Antigravity | `.agents/skills/`（工作区）、`~/.gemini/antigravity-cli/skills/`（全局） | 复制文件夹，重启会话 | 与 Codex 工作区相同的目录约定；SKILL.md + scripts/references/assets 形态匹配本仓库。 |
| OpenClaw | 工作区 `skills/`、`~/.openclaw/skills/`（全局） | `openclaw skills install`（git/本地期望源根处有 `SKILL.md` —— 本仓库符合） | ClawHub 是公共注册表（`clawhub` CLI 用于发布）。这里的每个技能已携带 `openclaw:` 元数据。 |
| Hermes Agent (Nous Research) | 项目 `skills/`、`~/.hermes/skills/` | `hermes skills install`（运行安全扫描） | 通过 frontmatter `description` 激活 —— 本仓库的第三人称激活措辞正是它匹配的。 |
| Gemini CLI / Cursor / Windsurf / Copilot | `.gemini/`、`.cursor/`、`.windsurf/`、`.github/` + `skills/` | 复制文件夹 | 视作安装目标，而非独立的源树。 |

## 跨客户端备注

不同的智能体客户端扫描不同的本地路径。Codex 文档说 Codex 从当前目录向上扫描 `.agents/skills` 位置，加上用户/管理员/系统技能位置。具有 `SKILL.md` 的仓库根具有正确的技能文件夹形态，但它不会被自动发现为仓库技能，除非安装在已扫描的技能目录下，或通过相关插件/分发路径打包。其他智能体客户端可能使用 `.claude/skills`、`.gemini/skills`、`.github/skills`、`.cursor/skills` 或 `.windsurf/skills`。将这些视作安装目标，而非独立的源树。

Runway MCP 是单独的智能体连接器平台。它可以通过 MCP 兼容智能体中的 Runway 暴露 Seedance 2.0，但它不会让本仓库成为 Runway 插件，也不会改变 Codex 技能安装规则。

## 来源信号

*主要来源 URL 列表保留英文以便精确核验。*

- OpenAI Codex Agent Skills 文档：https://developers.openai.com/codex/skills
- OpenAI Codex 插件文档：https://developers.openai.com/codex/plugins
- OpenAI Academy 插件与技能解释器：https://openai.com/academy/codex-plugins-and-skills/
- OpenAI 技能目录：https://github.com/openai/skills
- Agent Skills 开放标准概览：https://agentskills.io/
- Google Antigravity 技能文档：https://antigravity.google/docs/cli-plugins 与 https://codelabs.developers.google.com/getting-started-with-antigravity-skills
- OpenClaw 技能文档：https://docs.openclaw.ai/tools/skills
- Hermes Agent 技能文档：https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Runway MCP 公告：https://runwayml.com/news/mcp

## 不要声明

- 不要声明每个智能体客户端都能直接从本仓库 URL 安装。
- 不要声明 ClawHub 或任何注册表列出了本技能，除非它实际上已在那里发布。
- 不要声明每个客户端都支持除 `name` 与 `description` 之外的相同元数据字段。
- 不要声明本仓库提供实时 Seedance API 包装器。它是一个智能体技能工作流与参考包。
- 不要声明智能体对序列项目拥有隐藏的跨会话记忆。使用项目状态胶囊来恢复故事目标、最终结局、已接受片段、当前实际状态、开放动作、已完成节拍、下一片段工作、连续性锁定、允许变更、保留未来节拍、延长深度与未解决的不确定性。