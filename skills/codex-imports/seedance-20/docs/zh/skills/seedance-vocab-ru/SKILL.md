<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-vocab-ru/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-vocab-ru
description: "This skill should be used when the user asks for Russian Seedance 2.0 prompt wording, Russian cinematic vocabulary, or translation of camera, lighting, action, VFX, audio, and production terms into Russian."
license: MIT
user-invocable: true
tags:
  - russian
  - vocabulary
  - seedance-20
metadata:
  version: "6.3.0"
  updated: "2026-06-29"
  parent: "seedance-20"
  author: "Iamemily2050 (@iamemily2050)"
  repository: "https://github.com/Emily2040/seedance-2.0"
  openclaw:
    emoji: "🎬"
    homepage: "https://github.com/Emily2040/seedance-2.0"
---

# seedance-vocab-ru

当用户要求俄语提示词措辞、双语交付、紧凑翻译、角色绑定、首尾帧工作流或摄影机、灯光、动作、VFX、音频与约束的制作词汇时，使用俄语电影词汇。精确保留参考标签：`[Image1]`、`[Video1]`、`[Audio1]` 保持不变。

## 意图

俄语用户到达时已与该模型打过最艰难的对白之战，并建立了值得尊重的变通方法。这里的灵魂是尊重这种独创性：给他们经过现场测试的路径，诚实地标记极限，永不承诺社区已证明脆弱的内容。

## 使用规则

翻译制作意图，而非每个英文单词。俄语提示词应保持紧凑、具体，并按主体、动作、摄影机、光、声音与约束排序。

加载 `[ref:vocab/ru]` 获取密集的角色绑定、首尾帧、摄影机、灯光、音频、剪辑/延长、约束与安全词汇。

| 功能 | 俄语措辞 |
|---|---|
| Camera | `медленный наезд камеры`, `боковое сопровождение`, `фиксированный средний план`, `низкий ракурс`, `крупный план` |
| Lighting | `контровой свет`, `мягкий свет из окна`, `теплый практический источник`, `холодный лунный свет`, `контурная подсветка` |
| Motion | `медленно поворачивается`, `быстро проходит через кадр`, `капли стекают вниз`, `дым мягко рассеивается` |
| Audio | `тихий фон помещения`, `короткая реплика`, `мягкий металлический щелчок`, `без музыки` |
| First/last frame | `[Image1] как первый кадр`, `[Image2] как последний кадр`, `естественный переход к последнему кадру` |
| Constraints | `сохранить логотип, этикетку и форму без изменений` |

## 紧凑模式

`[Image1] — референс; сохранить лицо/форму продукта/логотип точно без изменений. Меняются только [движение/свет/камера]. Камера: [одно движение]. Звук: [аудио-сигнал].`

## 反 slop 规则

当提示词依赖 `кинематографичный`、`эпичный`、`атмосферный`、`потрясающий` 或 `высокое качество` 时，加载 `references/vocab/ru.md` 中的 Slop Traps 表并将每个分解为产生它的物理元素 —— 摄影机运动、光源、材质、声音。

## 对白规则

对口语俄语，加载 `references/vocab/ru.md` 中的俄语对白注意事项：几字的台词、每次生成一名说话者、优先西里尔字母配转写作为现场报告的回退，以及为完全配音片段规划后期配音。

## 输出契约

返回俄语提示词措辞、有用时的可选英文注释，并保留未更改的参考标签。