<!-- AUTO-TRANSLATED: 源文件 = ../../references/anti-slop-lexicon.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 反 slop 词典

用可观察的制作语言替换空洞的评价语言。在每种受支持语言的提示词社区中经现场确认：抽象的质量词会破坏生成稳定性，因为模型无法判断该强调哪个元素；将它们拆解为物理元素（摄影机动词 + 速度 + 视角、光源 + 方向 + 行为、材质 + 质感 + 动作）可使其稳定。

## 六种 slop 类别

| 类别 | 表现 | 修复 |
|---|---|---|
| 空洞评价词 | `cinematic, epic, stunning, beautiful, dramatic` | 将每个转换为赢得它的那一个可观察细节 |
| 借用的图像模型词 | `8K, masterpiece, award-winning, trending on ArtStation, Unreal Engine, RAW` | 删除；分辨率与质量是设置或结果，永远不是散文 |
| 标签沙拉 | 从图像提示词移植的逗号分隔关键词堆 | 重写为拍摄简报散文：每元素一句 —— 主体、动作、摄影机、灯光、声音 |
| 否定 slop | `no blur, no artifacts, no distortion, no extra fingers` | 否定召唤；通过构图排除 —— 描述那里有什么 |
| 形容词堆叠 | `gorgeous, breathtaking, mesmerizing sunset` | 三个同义词构成一个弱声明；挑选重要的那一个细节 |
| 感觉后缀词 | `电影感 · 雰囲気のある · 감성적인 · atmosférico · атмосферный · vibey` | 命名感觉的物理原因；每个词法文件都有语言专属的 Slop Traps 表 |

## 替换表

| 弱短语 | 替换为 |
|---|---|
| cinematic | 景别、摄影机运动、灯光、调色 |
| epic | 物理尺度、赌注、人群规模、镜头距离 |
| beautiful | 颜色、质感、构图、材质、光线行为 |
| stunning / breathtaking | 可见的对比、揭示、运动或细节 |
| dynamic | 具体运动、速度与端点 |
| dramatic | 走位、阴影、沉默或摄影机压力 |
| ultra-realistic | 材质行为、皮肤质感、镜头伪影、自然动作 |
| cool transition | 匹配剪辑、甩镜、溶解、硬切、物体擦除 |
| magical | 粒子行为、光源、运动路径、交互 |
| professional | 产品灯光设置、干净背景、受控摄影机 |
| masterpiece / award-winning | 删除；质量不是请求出来的 |
| 8K / ultra-HD / high quality | 删除；分辨率是渲染设置，不是散文 |
| atmosphere of mystery | 隐藏着什么，被什么遮挡：门、阴影、雾 |
| insanely / highly detailed | 重要的那两个细节，指名 |
| visually striking | 观众记住的那一帧，描述出来 |
| trending / viral style | 实际格式：竖屏、快钩、字幕安全构图 |

## 标签沙拉修复

图像模型习惯移植效果差：`girl, sunset, 8K, cinematic, beautiful light, masterpiece, detailed face` 给视频模型无动作、无摄影机、无时间轴。重写为简报：`A woman turns from the railing at sunset; the low sun flares behind her hair. Camera: slow push-in to a medium close-up. Sound: wind and distant surf.` 每元素一句胜过二十个逗号片段。

## 否定规则

命名缺陷会植入它。与其 `no blur, no extra fingers, no watermark text`，不如锁定正面：`hands rest still on the table`、`clean unbroken label`、`empty sky above the skyline`。仅在平台期望的约束槽中使用否定（`no on-screen text, no watermark`），而非作为质量保险。

规则：如果摄影机、麦克风、光度计或秒表无法检测到它，重写它。

`references/vocab/` 中的每种语言文件都为其自己社区的空洞词携带 Slop Traps 表：英语（`vocab/en.md`）、中文（`vocab/zh.md`）、日语（`vocab/ja.md`）、韩语（`vocab/ko.md`）、西班牙语（`vocab/es.md`）、俄语（`vocab/ru.md`）。