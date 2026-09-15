# Asset Prompts

These templates convert a character image or story idea into stable AI image/video assets. Keep prompts specific and asset-like: clean background, clear structure, no poster design, no dramatic action unless making an action board.

When `$image20-quality-control` is available, append this to character asset prompts:

```text
Quality control: preserve identity first. Clean realistic texture, natural skin pores, controlled highlights, no oily shine, no plastic skin, no random spots, no dirty speckles, no blotchy background, no over-sharpening, no excessive beauty retouching, preserve true fabric/material texture and edge detail.
```

## 1. Video-Optimized Character Identity Sheet

Use this when the character will appear in AI video, multi-shot scenes, close-ups, side-face shots, or reference-to-video workflows.

```text
Generate a professional live-action character reference sheet from the provided character image. Use a clean gray studio background, neat production-design layout, not a poster, not a magazine cover, no story action, no complex scene.

The sheet is divided into two zones. The upper third contains two detailed face close-ups: left is a front-face close-up, right is a true side-face close-up. Both close-ups show head, neck, facial structure, hairline, makeup, accessories, skin texture, eyelashes, brows, stray hairs, and natural facial detail. Preserve the same face, age impression, hairstyle, makeup, head accessories, and identity from the reference image.

The lower two-thirds contains two body and wardrobe references. Left: enlarged front wardrobe/body crop in standard A-pose, from below the neck to the shoes; the head is fully cropped out so the clothing, body proportion, fabric, accessories, hands, legs, and shoes occupy more space. Right: complete back full-body view in standard A-pose, from head to shoes, showing back hair, back clothing structure, shoes, silhouette, and accessories.

All four panels show the same person, same body proportion, same outfit, same accessories, and same material logic. Use clean studio three-point lighting: left key light, right soft fill, subtle back rim light. No colored light, no heavy atmosphere, no beauty retouching, no plastic skin, no cheap CG. 

Strict constraints: upper area must contain two large face close-ups; lower left must be an enlarged front wardrobe crop with no head visible; lower right must be a complete back full-body view; do not make the lower-left figure small; do not leave any head, chin, mouth, nose, or hair edge in the lower-left crop; do not change outfit, body proportion, or accessories across panels.
```

Negative prompt:

```text
poster, magazine cover, story scene, action pose, complex background, multiple characters, different outfits across panels, changed face, changed hairstyle, changed body proportion, missing back view, missing side face, head visible in lower-left crop, small full-body front view, plastic skin, over-smoothed skin, oily highlights, dirty spots, random speckles, blotchy background, fake fabric shine, material drift, cheap CG, incorrect text, watermark, logo
```

## 2. Standard Character Identity Sheet

Use for quick filing, early exploration, or a simpler character archive.

```text
Generate a live-action character four-view reference sheet from the provided character image on a clean white or light gray background. The left side shows a large detailed front-face portrait preserving the same face, bone structure, expression, hairstyle, makeup, skin texture, pores, eyelashes, brows, hairline, and natural facial detail. The right side shows the same character in standard A-pose full-body views: front view, side view, and back view. Preserve body proportion, outfit design, fabric layers, shoes, accessories, material texture, and overall styling across all views. Clean studio lighting, no story action, no poster design, no complex scene.
```

Use this when speed matters more than maximum video consistency.

## 3. Wardrobe Asset Library

Use when the same character appears in different clothing looks.

Process:

1. Generate or select one clean full-body image of the confirmed character.
2. Replace clothing only. Preserve face, hair, body proportion, age impression, and character temperament.
3. For every accepted outfit, create a matching identity sheet or wardrobe view sheet.

Clothing replacement prompt:

```text
Replace only the outfit and accessories of the character in Image1 with the complete wardrobe from Image2. Preserve the same face, hairstyle, body proportion, age impression, posture stability, and character temperament from Image1. Do not change identity. The new clothing must keep realistic fabric, seams, folds, material thickness, shoes, accessories, and wearable structure.
```

Wardrobe sheet prompt:

```text
Generate a wardrobe reference sheet for the same character and this specific outfit. Show front clothing structure, side silhouette, back clothing structure, shoes, accessories, fabric texture, seams, layers, and material behavior. Clean gray studio background, standard A-pose, no story action, no dramatic lighting. This sheet controls wardrobe only; preserve character identity from the identity asset.
```

## 4. Expression Asset Grid

Use only expressions the story actually needs. More expressions are not automatically better.

```text
Generate a live-action character expression asset grid from the same character reference, clean gray studio background, regular 3x3 or 4x4 layout. Every cell preserves the same face shape, facial proportions, feature structure, hairstyle, makeup, age impression, and identity. Each cell shows one controlled expression state relevant to the story: [list emotions]. Expression changes must be realistic and restrained, not cartoonish, not exaggerated, not changing the face. Preserve skin texture and natural facial detail; clean unified studio lighting; simple background.

Quality control: natural pores, clean under-eye and cheek texture, controlled forehead/nose highlights, no oily skin, no waxy smoothing, no random spots, no dirty speckles, no over-retouching. Quality cleanup must not change identity.
```

Suggested expression sets:

- Slice-of-life: neutral, curious, slight smile, tired, embarrassed, disappointed, relieved, distracted, soft eye contact.
- Action: focused, alert, tense, strained, angry, controlled, determined, exhausted, calm after danger.
- Suspense: observing, doubtful, suppressed fear, startled, thinking, suspicious, tense silence, realization, guarded.
- Romance: restrained smile, avoiding eye contact, hesitation, hurt, softened gaze, relief, longing, nervous calm, heart-moved.

## 5. Action Asset Board

Use action boards to create visual motion references, not real-world harm instructions.

```text
Act as a film action storyboard designer and visual prompt engineer. Turn the user's scene idea into a 16-panel visual action reference board. Extract the core conflict, character relationship, location, mood, and action style. Split the sequence into 16 consecutive visual beats; each panel shows one clear frozen moment. For every panel include: number, action name, visual description, motion emphasis, and a single-image generation prompt. Keep character wardrobe, scene, lighting, and camera style consistent. Describe cinematic visuals only; do not provide real injury instructions or tactical how-to steps. Do not ask the image model to generate readable Chinese text; text is for later layout.

Output:
Board title
Overall visual direction
Character setup
Scene setup
16 visual beats
Single-image prompt for each beat
Board layout prompt
Post-production text labels
```

Genre variants:

- Action: two characters in close conflict, 16 attack/defense visual beats, grounded and non-graphic.
- Suspense: detective finds clues, 16 observing/tracking/confronting beats.
- Horror: protagonist hides or escapes, 16 fear/discovery/survival beats, no gore.
- Sci-fi: character uses equipment, infiltrates, escapes, or operates future tech.
- Romance: two people move through misunderstanding, distance, approach, reconciliation.

## 6. Scene, Prop, and Palette Support

Character work often needs support assets:

- Scene asset: use a 3x3 grid, eight camera angles plus one floor-plan layout. Include front, reverse, left, right, entrance, corner, overhead detail, key prop close-up, and plan view.
- Physical prop asset: use front/side/back views plus detail close-up on a white or gray background. Make it if the prop is carried, used, placed repeatedly, or affects continuity.
- Virtual prop or effect: use a 16-panel action/effect board, because effects need stages such as start, charge, release, trail, hit, and dissipate.
- Palette asset: use seven colors with roles: main, secondary, shadow, highlight, skin, environmental reflection, accent. Each needs HEX value and use location.

## 7. Video Model Reference Labels

Use clear labels when uploading references:

```text
Image1 is the female lead identity asset. Use it to preserve face structure, hairstyle, body proportion, age impression, and overall temperament. Do not copy the gray studio background or sheet layout.

Image2 is the female lead sports wardrobe asset. Use it to preserve clothing, shoes, accessories, fabric structure, and outfit silhouette for this scene. Do not change the character identity.

Image3 is the expression asset. For this shot, use the "embarrassed but pretending to stay calm" expression. Keep it restrained and realistic, not exaggerated comedy.

Image4 is the action asset. Use panel 07 as the motion reference for the body pose and movement rhythm only. Do not copy the board layout or text.

Image5 is the scene asset. Use it to preserve the table-tennis hall layout, entrance, bench, drinking area, table placement, and actor movement path. Do not add people from the reference.

Image6 is the prop asset. Use it to preserve the green sports bag shape, color, material, zipper position, and shoulder-strap structure. In this shot, place it beside the bench; do not put it in the character's hand.

Image7 is the palette asset. Use it to unify color. Main color controls background/environment, shadow color controls edges and depth, highlight color controls lamps/reflections, accent color appears only on small props. Avoid saturated neon colors unless requested.
```

Rule: asset controls stability, label controls usage, prompt controls the shot.

## 8. Final Checklist

Before delivering, confirm:

- The character identity asset includes front face and side face.
- The board includes back hair and back outfit information.
- The wardrobe asset changes clothing only, not identity.
- Expressions match the story's emotional range.
- Actions are visual beats, not unsafe instructions.
- Scene, prop, and palette references are labeled when used.
- The video prompt states what each reference controls and what it must not transfer.
