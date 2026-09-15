<!-- AUTO-TRANSLATED: 源文件 = ../../V6_SEQUENCE_PROMPT_COMPILER_MANIFEST.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# V6 序列提示词编译器清单

## 当前补丁

- 活跃包版本：`6.3.0`。
- 补丁范围：导演引擎（有动机的场景导演、单一导演声音、长篇外观脊柱）接入访谈、提示词、摄影机、灯光、动作、角色、序列和续拍；继承的提供商/路由、Seedance 2.0 Mini 命名与 Runway 源维护。
- 当前期望的活跃子技能数：28。
- 当前期望的评测用例数：122。

## 基线

本节记录原始 v6 迁移的检查历史基线。它不是当前活动发布号。

- 仓库：`Emily2040/seedance-2.0`
- 检查的基线提交：`94906cd`
- 基线版本：`5.5.2`
- 基线子技能数：24
- 基线参考数：47
- 基线评测用例数：61
- 基线验证器：`validate_skills.py`、`content_audit.py`、`eval_schema_check.py`、`design_audit.py`、`source_registry_check.py`、`vocab_schema_check.py`
- 基线 CI：六个本地 Python 验证器
- Frontmatter 约定：YAML 块包含 `name`、第三人称 `description`、`license`、`user-invocable`、`tags` 与 `metadata.version`；子技能还需 `metadata.parent: "seedance-20"`

## 新增文件

- `skills/seedance-sequence/SKILL.md`
- `skills/seedance-continuation/SKILL.md`
- `references/sequence-project-state.md`
- `references/continuation-handoff.md`
- `references/prompt-compiler.md`
- `references/reference-transfer-contract.md`
- `references/dense-storyboard-mode.md`
- `references/surface-prompt-profiles.md`
- `references/event-density.md`
- `references/continuity-qc.md`
- `references/failure-atlas.md`
- `schemas/project-state.schema.json`
- `schemas/clip-contract.schema.json`
- `schemas/take-review.schema.json`
- `schemas/prompt-spec.schema.json`
- `schemas/generation-run.schema.json`
- `scripts/prompt_lint.py`
- `scripts/project_state_check.py`
- `scripts/continuity_chain_check.py`
- `scripts/behavior_contract_check.py`
- `scripts/sequence_eval_check.py`
- `scripts/generation_run_check.py`
- `tests/test_prompt_lint.py`
- `tests/test_project_state.py`
- `tests/test_continuity_chain.py`
- `tests/test_behavior_contract.py`
- `tests/test_sequence_eval.py`
- `tests/test_generation_run_check.py`
- `evals/generation-benchmark.json`
- `data/generation-runs.example.jsonl`
- `examples/sequence-airport-arrival/*`
- `examples/sequence-observed-deviation/*`
- `examples/standalone-clip/*`
- `examples/golden-prompts/*`