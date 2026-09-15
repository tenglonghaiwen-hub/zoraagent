<!-- AUTO-TRANSLATED: 源文件 = ../../references/json-schema.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# Seedance 提示词 JSON 模式

当用户想要结构化输出或自动化流水线需要稳定字段时使用本模式。

```json
{
  "mode": "t2v | i2v | v2v | r2v | flf2v | edit | extend | audio-led",
  "duration": "string",
  "aspect_ratio": "string",
  "references": [
    {"tag": "Image1", "role": "identity | product | pose | environment | style | first_frame | last_frame | reference_image"},
    {"tag": "Video1", "role": "motion | camera | pacing | blocking | source_clip | reference_video"},
    {"tag": "Audio1", "role": "voice | rhythm | ambience | music | tempo | reference_audio"}
  ],
  "characters": [],
  "production": {
    "phase": "brief | preproduction | generation | review | post | localization | delivery",
    "role": "director | dp | producer | editor | colorist | sound | localization | qc",
    "delivery_surface": "web | broadcast | social | theatrical | client_review | archive",
    "approval_owner": ""
  },
  "shot_list": [
    {
      "shot_id": "S01_SH01",
      "purpose": "establish | reveal | demonstrate | emotional_turn | end_card",
      "shot_contract": "shot size, angle, lens feel, camera move, endpoint",
      "start_frame": "",
      "end_frame": "",
      "risks": []
    }
  ],
  "continuity_anchors": {
    "character": [],
    "product": [],
    "wardrobe": [],
    "props": [],
    "location": "",
    "screen_direction": "",
    "eyeline": "",
    "lighting_state": "",
    "audio_state": ""
  },
  "scene": "",
  "camera": "",
  "motion": "",
  "lighting": "",
  "style": "",
  "audio": "",
  "color_pipeline": {
    "look_intent": "",
    "working_assumption": "",
    "output_transform": "SDR Rec.709 | HDR PQ | theatrical | social",
    "show_lut_or_cdl_notes": "",
    "qc_notes": []
  },
  "subtitle_plan": {
    "subtitles": false,
    "sdh": false,
    "forced_narrative": false,
    "dubbing": false,
    "textless_required": false,
    "languages": []
  },
  "audio_deliverables": {
    "full_mix": true,
    "stems": [],
    "m_and_e": false,
    "loudness_target": "",
    "sync_cues": []
  },
  "delivery": {
    "frame_rate": "",
    "resolution": "",
    "aspect_ratio": "",
    "safe_area": "",
    "version_name": "",
    "qc_checks": []
  },
  "safety_notes": [],
  "final_prompt": ""
}
```

JSON 包装用于规划。最终提示词仍需自然阅读。对于专业工作，让制作、镜头列表、连续性、本地化、音频、调色与交付字段保留为交接元数据；不要将它们全部塞入提示词。

## 序列状态模式

版本 6 在 `schemas/` 下添加了机器验证状态 fixture：

- `project-state.schema.json` 用于项目状态、故事、节拍、片段血统、镜头历史、正典修订与参考注册表。
- `clip-contract.schema.json` 用于当前片段生产任务。
- `take-review.schema.json` 用于观察到的开始/结束状态、已接受偏差、已完成节拍与拒绝/修复裁决。
- `prompt-spec.schema.json` 用于内部提示词编译元数据。
- `generation-run.schema.json` 用于合成基准与本地运行记录。

这些模式是规划产物。最终 Seedance 提示词保持自然语言，除非用户明确请求结构化输出。