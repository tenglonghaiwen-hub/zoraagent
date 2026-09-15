---
name: seedance-lighting-presets
description: "Use when creating or improving Seedance 2.0 video prompts that need Chinese lighting presets, portrait lighting, film/short-drama atmosphere, or compact light-direction modules. Turns a source lighting style such as window soft light, golden-hour backlight, moonlight, lantern light, neon sidelight, rain-night streetlight, spotlight, silhouette, studio high-key, low-key dark field, reflected fill, water reflection, or split color light into Seedance-ready wording with reference roles, native Chinese support, and delivery checks."
---

# Seedance Lighting Presets

Use this skill to choose, compress, and insert a lighting setup into a Seedance 2.0 prompt. It is designed for portrait, short-drama, product/person showcase, ancient-style, urban-night, stage, suspense, and emotional close-up shots.

## Workflow

1. Identify the scene intention: tenderness, daily realism, romance, mystery, danger, ritual, isolation, commercial cleanness, conflict, or dreamlike calm.
2. Choose one primary lighting preset from `references/lighting-presets.md`. Do not combine more than two presets unless the user asks for a stylized conflict look.
3. Convert the preset into a compact lighting module. Preserve physical details: light source, direction, subject areas hit by light, fill strength, eye catchlight, background treatment, and haze/reflection if useful.
4. Merge the module with the full Seedance prompt: subject, action, camera move, lighting, sound, and constraints.
5. If references are present, assign each reference one primary role: identity, first frame, last frame, product, environment, motion, camera, timing, audio, or style. State what must not transfer.

## Prompt Module Rules

Prefer concrete light behavior over generic mood words.

Keep:
- source: window, sky, cloud cover, sunset, foggy morning sun, moon, candle, lantern, fire, neon sign, streetlight, headlights, stage follow spot, hard spotlight, backlight, softbox, side light, reflected surface, water reflection, split color lamps
- direction: side front, overhead, side overhead, side back, back, low back, lower front, side lower, front upper
- visible effect: cheek, eyes, nose bridge, lips, hands, collar, hair edge, shoulder rim, clothing folds, wet ground reflection, catchlight
- control: weak fill, no dead-black shadows, no overexposure, preserve facial structure and skin texture

Remove:
- repeated "cinematic", "high quality", "beautiful", "realistic" if the physical light already expresses it
- long emotional explanations when the scene action already carries the mood
- secondary light effects that compete with identity, action, or camera

## Native Chinese Output

When the user asks in Chinese or wants a Chinese prompt, output Chinese. Use compact prompt wording:

`灯光：以[光源]为主光，从[方向]照向人物，[受光部位]形成[效果]；正面仅弱补光，保留五官结构、皮肤纹理和眼神光；背景[虚化/压暗/反光/雾气]。`

For Japanese or Korean delivery, keep the reference tags unchanged and translate only the natural-language lighting module.

## Seedance Integration Pattern

Standalone T2V:

`[Subject] [visible action and endpoint] in [scene]. Camera: [one move]. Lighting: [compressed preset module]. Sound: [ambience/dialogue/SFX]. Constraint: [identity/IP/continuity].`

I2V:

`[Image1] preserves identity, wardrobe, and face structure; only [motion/camera/light] changes. Lighting: [compressed preset module]. Constraint: do not alter face, clothing, or background layout unless requested.`

Reference-to-video:

`[ReferenceTag] controls [one role] only. Do not transfer [identity/logo/background/style] unless assigned. Lighting: [compressed preset module].`

## Delivery Checks

Before finalizing:
- One lighting preset is dominant.
- The light source is physically motivated and visible or inferable.
- Camera, performance, and light serve one intention.
- Shadows are controlled: no dead-black face unless requested.
- Eye catchlight is specified for portrait/emotion shots.
- Prompt remains compact enough that lighting does not crowd out subject, action, camera, and endpoint.
- Chinese/Japanese/Korean output preserves exact reference tags.

## Reference

Load `references/lighting-presets.md` when choosing a preset, comparing styles, or building a reusable lighting module.
