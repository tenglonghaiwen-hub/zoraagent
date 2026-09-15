---
name: ai-character-assets
description: "Use when building stable AI character assets for image or video generation: base character image checks, character identity boards, four-view sheets, face/front/side/body/back references, wardrobe/looks asset libraries, expression grids, action boards, reference-role labels, and prompts that keep a character consistent across AI video shots. Especially useful for Seedance, image-to-video, reference-to-video, short-drama character development, multi-shot stories, and any workflow where a single pretty character image is not stable enough. Automatically pair with image20-quality-control when generating or reviewing character asset images so spots, oily skin, plastic texture, over-smoothing, dirty backgrounds, and fabric/material drift are controlled."
---

# AI Character Assets

Use this skill to turn a character idea or reference image into a video-ready asset system. The core rule is: prompts give the model a task; assets give it evidence. Stable videos need both.

## Core Workflow

1. Check whether the user has a stable base character image. If not, create or request one before making asset boards.
2. Build a character identity board: face structure, front face, side face, body proportion, wardrobe structure, and back view.
3. Build wardrobe assets when the same character appears in different looks. Each look needs its own view sheet.
4. Build expression assets for emotions the story will actually use.
5. Build action assets when movement, choreography, fighting, pursuit, or gesture continuity matters.
6. Label every uploaded asset with its role before using it in an image/video prompt.
7. Apply `$image20-quality-control` to identity boards, face close-ups, wardrobe boards, expression grids, and prop boards before final delivery.
8. Run the stability checks before final delivery.

## Base Image Gate

Before making a character asset board, make sure the base image has:
- clear face, hairline, head outline, and age/gender impression
- recognizable wardrobe or styling feature
- simple background, limited atmosphere, no heavy bokeh, no strong lens flare
- neutral enough pose and lighting that future assets can inherit structure

If the base image is too stylized, cropped, blurry, or over-lit, tell the user to regenerate a cleaner mother image first.

## Asset Board Choice

Use one of two board types:

- **Standard identity sheet**: one large front-face portrait plus front/side/back full-body views. Use for quick character filing and early exploration.
- **Video-optimized identity sheet**: front-face close-up, side-face close-up, enlarged front wardrobe/body crop, and full back view. Use for video, multi-shot work, side-face shots, close-ups, and character consistency.

Prefer the video-optimized sheet when the user cares about video stability. It spends more visual space on face structure and wardrobe details instead of repeating a small full-body front view.

## Output Contract

When the user asks for a character asset prompt, return:

1. **Asset Plan**: which boards to create and why.
2. **Generation Prompt(s)**: direct copy-ready prompts for the selected asset board.
3. **Reference Labels**: how to label each asset when sending it to a video model.
4. **Stability Checks**: what to reject or re-roll.

If the user only wants a prompt, output the prompt and negative prompt only.

## Reference Role Labels

Always assign each reference one primary job:

- `identity_asset`: face, hair, body proportion, age impression, overall character identity
- `wardrobe_asset`: clothing, shoes, accessories, material, silhouette for one specific look
- `expression_asset`: controlled facial expression for one named emotion
- `action_asset`: pose, motion beat, choreography, physical rhythm
- `scene_asset`: space layout, camera directions, background continuity
- `prop_asset`: shape, color, material, scale, detail placement for an important prop
- `palette_asset`: color system and where each color is allowed to appear

State what must not transfer when needed: do not copy background, lighting mood, extra people, logo, text, scene style, or unrelated colors.

## Stability Checks

Reject or rewrite if:
- the board has only one face angle for a video character
- the side face, back hair, shoe, or clothing back structure is missing
- the outfit changes across views
- the face is beautiful but not structurally readable
- the expression changes the face identity
- the action board gives real harm instructions instead of visual beats
- the video prompt says only "same character" without labeling reference roles
- too many references are uploaded without telling the model what each one controls
- the image has random spots, dirty speckles, oily skin, plastic skin, over-smoothed face, blotchy studio background, fake fabric shine, or material texture drift

## Automatic Quality Hook

When creating or reviewing any image prompt inside this skill, also use `$image20-quality-control` if it is installed. Add a compact quality-control block that preserves identity first, then cleans texture:

`身份优先：保持同一张脸、同一脸型比例、同一发型、同一年龄感和同一身体比例。画质控制只清理斑点、油腻感和材质问题，不改变人物身份。皮肤保留自然毛孔和真实纹理；服装保留面料纹理、缝线、褶皱和反光逻辑；背景干净无灰斑。`

## References

Load `references/asset-prompts.md` for copy-ready templates, expression/action prompt patterns, and video-model labeling examples. Load `$image20-quality-control/references/prompt-blocks.md` when image outputs show spots, oily skin, plastic texture, dirty backgrounds, or material drift.
