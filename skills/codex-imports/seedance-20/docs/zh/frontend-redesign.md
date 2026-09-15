<!-- AUTO-TRANSLATED: 源文件 = ../frontend-redesign.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# V6 首屏设计

本仓库目前不包含独立的网络应用。公共前端是 GitHub README、生成的位图主角/信息图资产与 SVG 支持图。

## V6 设计目标

- 以 v6 序列状态承诺打头：一个故事状态、一个当前片段契约、一个编译的 Seedance 提示词。
- 让 README 在英语、中文、日文和韩语读者到达安装章节前对他们有用，包括完整的母语读者文档与活动示例子技能。
- 展示 Seedance 的实际范围：参考、首尾帧连续性、续拍、产品揭示、时间轴控制、音频与摄影机方向。
- 使用生成的电影感信息图用于操作系统概览、技能地图、技能能力图、CDN 分发图、参考角色图、制作交付图与 QC 栈。
- 当文字大、已修正、视觉平衡且在附近可搜索 Markdown 中重复时，允许文字密集信息图。
- 让 SVG 资产保持为支持图，而非主要情感表面。
- 使用 `scripts/design_audit.py` 验证 README 完整性、画廊覆盖、PNG 尺寸与资产存在性。

## 母语读者要求

- 首屏必须声明项目是当前 v6 工作。
- README 必须包含可见的中文、日文与韩文文案，而不仅是说这些语言存在的英文标签。
- 母语行必须链接到活动技能文件与活动词法参考，而非迁移的旧文件。
- 日文与韩文必须拥有与中文范例同等状态的活动示例子技能路由。
- 参考标签如 `[Image1]`、`[Video1]`、`[Audio1]`、`@图1`、`@视频1` 必须精确展示，以便读者不会将它们翻译掉。
- 除非用户明确要求简单的屏幕生成文本，本地化指引必须将字幕、法律文案与市场文案保留在后期。

## 资产

- `assets/hero-command-center.png`
- `assets/hero-global-filmmaker-mode.png`
- `assets/infographic-skill-capabilities.png`
- `assets/infographic-cdn-delivery-map.png`
- `assets/infographic-reference-role-map.png`
- `assets/infographic-production-delivery.png`
- `assets/infographic-professional-qc-stack.png`
- `assets/hero-cinematic.png`
- `assets/skill-os-infographic.png`
- `assets/skill-map-cinematic.png`
- `assets/hero-dark.svg`
- `assets/hero-light.svg`
- `assets/skill-map.svg`

## 设计规则

- SVG 中无外部字体或脚本。
- 每个 SVG 需要 `<title>` 与 `<desc>`。
- README 应在移动端与深色模式下保持可读。
- 避免密集徽章墙与嘈杂装饰文字。
- 仅对在 README 宽度下保持清晰的大、短标签使用文字密集生成信息图。
- 提交前检查每个生成文字图像；拒绝乱码词、丑陋字体、对比度差或看起来像占位符的面板。
- 在每个文字密集图像旁保留等效的 Markdown 解释，使仓库保持可访问与可搜索。

## V6 编辑系统

报头从生成的位图艺术转为手工构建的编辑系统：衬线显示叠加等宽规范标签、暖墨/纸主题配单一琥珀色强调、胶片链轮与取景器线条工作、零渐变。`assets/hero-dark.svg` 与 `assets/hero-light.svg` 通过 `prefers-color-scheme` picture 元素提供，使主角匹配查看者的 GitHub 主题；`assets/skill-map.svg` 被重建为规范图（关卡 → 根 → 集群 → 参考库 → 验证）。徽章统一为扁平方形墨水/琥珀。生成的位图 —— 主角镜头与文字密集信息图，包括 `assets/infographic-cdn-delivery-map.png` —— 留在策展的视觉画廊中，配可搜索的 alt 文本，加上从正文搬迁的操作系统艺术。令牌位于 `references/frontend-design-system.md`。