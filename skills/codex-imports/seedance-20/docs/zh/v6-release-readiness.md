<!-- AUTO-TRANSLATED: 源文件 = ../v6-release-readiness.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# V6 发布就绪

在合并前检查活动首屏时使用本文档。

## 当前发布表面

- README 徽章、更新行、变更日志指针、评测元数据、验证器预期、范例与活动技能元数据必须显示 `6.3.0`。
- 活动文档应描述 v6 序列状态架构、提示词编译器行为与多语言读者路径。
- 历史版本详情属于更早的 `CHANGELOG.md` 条目、`references/migrated/` 或 Git 历史，而非活动 README 表面。

## 首屏检查

- README 拥有可见的母语起始章节，面向英语、中文、日文和韩语读者。
- README 链接到完整的母语读者指南：`docs/zh/README.md`、`docs/README.ja.md` 与 `docs/README.ko.md`。
- 中文、日文和韩语行链接到活动技能文件与活动词法参考。
- 日文与韩文拥有活动示例子技能，而不仅是词法技能。
- 旧规划文档不再是活动 docs 目录的一部分。
- 设计文档描述当前 v6 首屏要求。

## 验证

在发布或合并首屏更新前，从 README 运行仓库验证套件。