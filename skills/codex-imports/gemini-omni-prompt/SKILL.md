---
name: gemini-omni-prompt
description: Optimize, rewrite, compress, translate, or diagnose prompts for Google Gemini Omni Flash video generation and conversational video editing. Use when the user asks for an Omni Flash prompt, wants an existing video prompt improved, needs text-to-video or reference-image prompt structure, requests timed beats, camera or audio direction, or reports drift, unwanted cuts, weak motion, inconsistent references, or unintended changes after an edit. Produce prompts only; never call a generation API or create video unless the user separately asks and confirms any paid operation.
---

# Gemini Omni Flash Prompt Optimization

Optimize prompts without invoking Gemini, uploading media, reading API keys, or generating video.

## Workflow

1. Identify the operation:
   - New generation from an idea.
   - Rewrite or compress an existing prompt.
   - Reference-image or first-frame guidance.
   - Conversational edit of an existing clip.
   - Troubleshoot a failed result.
2. Preserve the user's intended subject, action, style, framing, language, and exclusions. Do not invent identity-critical or brand-critical details.
3. Resolve contradictions and reduce the request to actions that can fit the requested duration. If duration is missing, optimize without fabricating a hard value.
4. Return the finished prompt first. Add a short diagnosis only when it helps the user understand a material change.
5. Default to an English production prompt with a concise Chinese note when the user writes Chinese. Follow an explicit language request instead.

## Generation Prompt Structure

Use only the fields that matter. Prefer one coherent paragraph or a compact timed sequence over a keyword pile.

1. Format and continuity: aspect ratio or duration if supplied; state `single continuous shot, no scene cuts` when the user wants one take.
2. Subject and setting: identify the subject, environment, spatial relationship, and visible starting state.
3. Action and timing: describe observable motion in chronological order. Use ranges such as `[0-3s]` only when multiple beats must land at specific times.
4. Camera: specify shot scale, camera position, and one compatible camera move. Avoid stacking conflicting moves.
5. Look: name motivated lighting, palette, material, and texture details that affect the result.
6. Audio: state dialogue, ambience, sound effects, or music explicitly. Say `no dialogue` or `no music` when silence or restraint matters.
7. Constraints: express exclusions in prose because Omni Flash does not use a separate negative-prompt control.

## Reference Inputs

- Assign every supplied reference a single explicit role: first frame, character identity, object/product, setting, motion, or style.
- Bind references in the prompt with the interface's supported labels when known, such as `<FIRST_FRAME>` and `<IMAGE_REF_0>`.
- Describe what must remain stable and what is allowed to change.
- Do not claim a reference is present when the user has not supplied it.
- Avoid asking one reference to control identity, pose, camera, style, and environment simultaneously unless the user explicitly intends that coupling.

## Conversational Video Edits

Use a short surgical delta, not a rewritten generation prompt:

`Change only [target] to [new state]. Keep timing, camera, subject identity, composition, motion, lighting, and audio unchanged. Keep everything else the same.`

Include only preservation constraints relevant to the requested edit. Split unrelated changes into separate edit prompts when feasible.

## Quality Rules

- Replace vague praise such as `epic`, `stunning`, `cinematic masterpiece`, and `ultra detailed` with visible, directable choices.
- Prefer concrete verbs and physical trajectories over `dynamic motion` or `comes alive`.
- Keep subject motion and camera motion distinguishable.
- Avoid contradictory lighting, lens, framing, speed, and continuity instructions.
- Name who performs each action; do not rely on ambiguous pronouns in multi-character scenes.
- Use one primary visual style and describe its observable traits.
- Keep dialogue short enough for the requested duration and mark the speaker.
- For troubleshooting, map symptoms to prompt fixes: unwanted cuts -> require one continuous shot; weak motion -> specify path, speed, and endpoint; reference drift -> bind roles and repeat invariants; unintended edit changes -> shorten to a single delta plus preservation sentence.

## Output Format

For a normal request, return:

1. `优化后的提示词` — directly usable prompt.
2. `调整重点` — up to three brief points, only when useful.

For troubleshooting, return:

1. `问题判断` — evidence-based diagnosis without pretending to have seen an output that was not provided.
2. `修正版提示词` — directly usable prompt.

Do not add API commands, SDK code, pricing, or generation steps unless explicitly requested.
