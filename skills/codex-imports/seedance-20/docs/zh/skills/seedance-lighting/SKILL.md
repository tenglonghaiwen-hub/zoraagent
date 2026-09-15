<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-lighting/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-lighting
description: "This skill should be used when the user asks for lighting design, atmosphere, time of day, color temperature, shadow, reflections, weather light, practical lights, or mood transitions in Seedance 2.0."
license: MIT
user-invocable: true
tags:
  - lighting
  - atmosphere
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

# seedance-lighting

灯光应描述物理来源与过渡，而非抽象的美。实用的灯光提示词告诉模型光来自哪里、其色温、阴影如何行为、什么氛围捕捉光、以及光在片段中是否变化。

当用户询问 ACES、HDR/SDR、片场外观、调色、LUT、CDL、产品颜色或专业调色交接时，加载 `[ref:color-pipeline-aces]`。当灯光作为情绪 —— 比例、主光方向、色温、动机与随戏剧转折变化的光 —— 加载 `[ref:directing-engine]`，使光表达场景的意图而非仅照亮它。

## 意图

当用户说情绪词时，他们几乎总是在询问光。本技能的目的是将"温馨"、"孤独"或"电光"转化为太阳、灯或窗户的回答 —— 因为那是感受在画面中物理居住的地方。把他们的情绪作为他们可指向的光源还给他们。

## 灯光契约

陈述：主光来源、方向、色温、氛围、阴影行为、反射行为与任何过渡。

| 情绪或任务 | 提示词就绪的灯光 | 为何有效 |
|---|---|---|
| 产品奢华 | `narrow warm strip light sweeps across brushed metal, black acrylic reflection remains clean` | 材质与反射被控制。 |
| 夜景剧 | `warm practical lamp from frame left, blue moonlight rim on shoulders, soft hallway shadows` | 使用有动机的来源。 |
| 发现 | `door crack opens and a thin white beam widens across dust in the air` | 光随动作变化。 |
| 美食写实 | `large soft window light from the right, gentle bounce on the plate, no harsh specular glare` | 让质感保持可读。 |
| 风暴氛围 | `cool overcast daylight, intermittent lightning flashes briefly sharpen the silhouette` | 天气影响对比度。 |

## 来源选择

对室内、亲密与可见的动机使用 **practical lamps（实用灯）**。对自然主义与美食或生活方式场景使用 **window light（窗光）**。当分离重要时使用 **rim light（轮廓光）**。对黑色、刺眼阳光或图形化阴影使用 **hard light（硬光）**。对美妆、皮肤、产品润色与儿童或家庭场景使用 **soft light（柔光）**。当场景需要可见变化时使用 **moving light（移动光）**。

## 色彩与氛围

仅在色温重要时命名：暖钨、凉月光、绿色荧光、钠路灯、中性阴天日光。克制地添加氛围：薄雾、灰尘、雨条纹、烟或冷凝应与光和主体交互，而非仅装饰画面。

## 失败修复

如果输出看起来平淡，添加有动机的关键光源、轮廓分离与一个材质专属高光。如果看起来过度处理，去除宽泛的风格声明并指定更柔和的对比度。如果闪烁或灯光跳跃出现，让光源保持稳定并移除竞争过渡。

## 序列状态

当序列状态存在时，继承持久实用光源、主光方向、灯光相位、当前片段范围、连续性锁定、精确参考标签与保留的未来节拍。除非过渡或允许变更明确许可，否则不要重置白天/夜晚、实用灯或天气光。

## 输出契约

返回一个紧凑的灯光块、若需要则有过渡备注，以及一句提示词就绪的整合句。