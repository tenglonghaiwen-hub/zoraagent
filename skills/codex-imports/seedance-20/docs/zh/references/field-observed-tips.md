<!-- AUTO-TRANSLATED: 源文件 = ../../references/field-observed-tips.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 现场观察技巧

last_verified: 2026-05-30

这些是从公开社区材料中收集的从业者模式。将它们视作现场观察的，而非官方平台保证。

## 稳定工作流

1. 先短后长：在 10–15 秒片段上花费之前先测试 3–5 秒。
2. 每次重试仅改一个变量：摄影机、灯光、动作或参考角色。
3. 将每个参考资产绑定到一个工作。
4. 对脆弱身份、产品 logo、可读文字、唇形同步、手部或复杂 VFX 使用锁定构图。
5. 使用视频参考用于动作节奏或摄影机行为，而非未授权的身份传递。
6. 使用音频参考用于节奏、情绪或环境声，除非人声/音乐为自有、已授权或已获授权。
7. 当仅一个节拍失败时，偏好剪辑、延长或片段替换而非重生整个片段。
8. 对于续拍，当平台支持时保存返回的尾帧并将其用作下一首帧锚点。
9. 如果音频参考应控制时序，在上传前静音竞争参考视频，或显式将它们的角色降低为仅摄影机/动作。
10. 对于序列，在请求下一提示词之前记下观察到的最终状态；不要假设计划的端点已发生。

## 提示词纪律

| 弱模式 | 强模式 |
|---|---|
| `cinematic, epic, beautiful` | `soft side backlight, wet asphalt reflections, locked medium shot, quiet room tone` |
| `make it move naturally` | `shoulders rise once with breathing, hand releases the cup, final pose holds for one second` |
| `use this video as style` | `[Video1] provides only side-tracking camera rhythm; do not transfer performer identity or background` |
| `make product luxury` | `narrow warm light sweep across the label, black acrylic table reflection, no label redesign` |

## 高风险领域

- 快速手势。
- 小文字、标志、标签与字幕。
- 无标签的多角色动作。
- 多个同时摄影机运动。
- 当身份必须保持固定时的产品变形。
- 真实人物面部、人声、明星肖像与受保护角色。
- 在一次生成中要求太多剪辑、地点与角色回合的长脚本式提示词。
- 无尾帧锚点的延长链；质量与连续性可能在重试间降级。
- 未记录已完成节拍、保留节拍或精确参考标签的序列链。

## 安全的隐藏技巧

最好的"技巧"不是绕过过滤器。是让意图清晰：来源、角色、动作路径、摄影机端点、光源、声音提示与约束。