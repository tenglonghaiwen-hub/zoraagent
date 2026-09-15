<!-- AUTO-TRANSLATED: 源文件 = ../../references/quick-ref.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 快速参考

## 默认路由

- 模糊想法：`seedance-interview`。
- 清晰想法：`seedance-prompt`。
- 长故事或相连片段：`seedance-sequence`。
- 续拍、延长、修复尾部或重新锚定已接受画面：`seedance-continuation`。
- 短提示词：`seedance-prompt-short`。
- 糟糕结果：`seedance-troubleshoot`。
- IP 或真实人物风险：`seedance-copyright`。
- 被屏蔽的提示词：`seedance-filter`。
- 摄影机、灯光、动作、风格、VFX、音频或角色专属工作：加载匹配的专家子技能。

## 提示词清单

| 关卡 | 通过条件 |
|---|---|
| 模式 | T2V、I2V、V2V 或 R2V 是明确的。 |
| 参考 | 每个资产恰好有一个主要角色，除非刻意分层。 |
| 主体 | 主体出现在第一子句中，且在需要时具有稳定的标签。 |
| 动作 | 一个可见节拍具有可观察的端点。 |
| 摄影机 | 一个主要运动具有起点、速度、主体关系与端点。 |
| 灯光 | 来源、方向、颜色、氛围或过渡是物理的。 |
| 音频 | 对白、环境声、音效、音乐或安静是有意的。 |
| 安全 | 受保护身份、IP 与不安全措辞被改写或授权门控。 |
| 反 slop | 空洞加成词被可观察的制作语言取代。 |
| 预算 | 最终提示词符合已验证活跃平台的提示词预算。 |
| 序列血统 | 序列提示词在续拍时具有 `project_id`、`clip_id` 与父级。 |
| 实际状态 | 续拍从已接受观察状态开始，而非计划状态。 |
| 片段范围 | 已完成节拍被排除，保留的未来节拍保持在外。 |

## 快速修复短语

| 失败 | 添加或替换为 |
|---|---|
| I2V 漂移 | `preserve [Image1] subject/product exactly; only motion, light, and camera change` |
| 泛化外观 | `physical light source + material behavior + specific camera endpoint` |
| 摄影机混乱 | `one controlled [move] from [start frame] to [end frame]` |
| 弱动作 | `actor + verb + timing + consequence + final state` |
| 唇形同步不稳定 | `locked medium close-up, short quoted line, no head turn during dialogue` |
| 嘈杂 VFX | `source + material + path + interaction + dissipation endpoint` |
| 风格/IP 风险 | `medium + texture + palette + composition + motion rhythm` |
| 计划结尾不匹配 | `begin from the observed final frame: [actual visible state]` |
| 未来节拍泄露 | `this clip stops at [endpoint]; do not show [reserved future beat] yet` |