<!-- AUTO-TRANSLATED: 源文件 = ../../../skills/seedance-examples-ko/SKILL.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

---
name: seedance-examples-ko
description: "This skill should be used when the user asks for Korean Seedance 2.0 examples, Korean prompt patterns, example rewrites, or safe versions of working Korean video-generation prompts."
license: MIT
user-invocable: true
tags:
  - korean
  - examples
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

# seedance-examples-ko

将韩语范例用作母语提示词模式，而非翻译的英文模板。精确保留参考标签：`[Image1]`、`[Image2]`、`[Video1]`、`[Audio1]` 在韩语句子中保持不变。

## 意图

韩语范例应将 감성 转化为制作行为：感受由景别、光方向、静寂、小姿态、房间底噪与后期文字处理承载。让提示词足够紧凑以指导片段，而非叙述整个剧情。

## 范例标签

| 标签 | 含义 |
|---|---|
| `safe` | 原创概念，无受保护身份。 |
| `needs-owned-reference` | 需要用户自有、已授权、公共领域或已批准资产。 |
| `surface-specific` | 取决于活跃的网页、API 或工作流平台。 |
| `rewrite-required` | 提及受保护身份、品牌、明星、精确场景、歌曲或人声。 |

## 安全范例模式

**产品 I2V：** `[Image1]은 제품 참조이며 로고, 라벨, 병 모양, 색상을 정확히 유지한다. 변화는 작은 물방울이 표면을 따라 내려가는 움직임과 왼쪽에서 지나가는 따뜻한 실용 조명만 적용한다. Camera: locked product close-up, slow push-in. Sound: 낮은 실내 환경음, 마지막에 작은 유리 소리.`

**情节剧微表情：** `현대 아파트 주방, 두 명의 original adult characters only. Character A lowers a ceramic mug and looks away; Character B stays near the window, no approach. Camera: locked medium-wide, subtle handheld breathing sway. Lighting: warm tungsten practical, faint blue city spill. Sound: refrigerator hum, fabric movement, no music.`

**序列 Clip 01：** `오리지널 인물A가 새벽 버스 정류장에 도착한다. 이번 클립의 역할은 기다림의 이유를 암시하는 것뿐이다. A는 접힌 메모를 발견하고 손을 뻗기 직전에 멈춘다. Camera: stable lateral tracking, medium-wide. 이 클립에서는 만남이나 버스 출발을 보여주지 않는다.`

**续拍：** `이전 승인된 클립의 끝 상태에서 이어진다. A는 메모 앞에서 멈춘 상태로 시작하고, 천천히 메모를 집어 들고 멀리 들리는 안내음에 고개를 든다. 이전의 도착 동작은 반복하지 않는다. Camera: locked medium shot, slight push-in.`

**对白：** `Character A sits at a cafe table, locked medium close-up, shoulders still. She says, "괜찮아, 천천히 말해." 대사 중에는 머리 회전을 피하고 작은 입 움직임만 사용한다. Sound: clear short dialogue, soft cafe room tone, no music under the line.`

**无字幕本地化：** `9:16 한국어 SNS 컷다운. 제품은 중앙에 유지하고 가장자리에는 중요한 동작을 두지 않는다. 생성 자막, 워터마크, 광고 문구를 화면 안에 넣지 않는다. Post note: 한국어 자막, 법적 문구, CTA는 편집에서 추가한다.`

## 改写模式

如果提示词包含受保护名称，将创意功能重写为原创韩语描述符：`유명 캐릭터 그대로` 变为 `오리지널 마스크를 쓴 옥상 배달원`；`특정 작품과 똑같이` 变为 `낮은 채도 야경, 강한 사이드 라이트, 조용한 표정 연기, 망원 압축감`。

## 输出契约

返回韩语范例、标签、风险备注以及需要时的更安全韩语变体。除非用户要求结构化输出，否则保持最终 Seedance 提示词文本为自然语言。