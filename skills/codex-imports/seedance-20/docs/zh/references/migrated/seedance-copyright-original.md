<!-- AUTO-TRANSLATED: 源文件 = ../../../references/migrated/seedance-copyright-original.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# `seedance-copyright` 的旧版体

于 2026-04-27 在 v5.1.0 期间迁移。除非在 `references/api-status.md` 或 `references/source-registry.md` 中确认，否则将本文件中的平台、策略、API 与安全声明视为旧版。

---

# seedance-copyright

Seedance 2.0 的内容策略与 IP 保护规则。
每次生成必须在提交前清除此清单。

---

## ⚠️ 2026 年 2 月执行上下文

> **发生了什么（2026 年 2 月 12–25 日）：**
> 字节跳动于 2 月 12 日发布 Seedance 2.0。几天之内，迪士尼、派拉蒙天舞、Netflix、美国电影协会（MPA）和 SAG-AFTRA 全部发出了停止侵权函。迪士尼的信件称其为 IP 的"虚拟砸抢"。Netflix 将其标注为"高速盗版引擎"。日本政府开启了监管调查。
>
> 字节跳动的回应（2 月 15 日）："我们正在采取措施加强当前的安全保障，同时努力防止用户未经授权使用知识产权和肖像。"
>
> **API 状态是平台特定的，必须对照当前官方文档**从计划的 2 月 24 日日期检查。截至 2 月 25 日未设定新发布日期。
>
> **这对你的提示词意味着：** 硬性阻止比 v3.0 更严格。许多角色/肖像过滤已经收紧。假设任何指名系列角色、演员或流媒体原创内容都将被拒绝或静默降级。

---

## 核心原则

Seedance 阻止引用特定受保护知识产权的内容。
模型不阻止*概念*、*美学*或*原型* —— 仅阻止指名、所有的身份。
你的工作：描述想法而不用点名其所有者。

---

## 硬性阻止（高风险，应被改写）

无论框架如何，这些都会触发内容拒绝：

| 类别 | 范例 | 为何被阻止 |
|---|---|---|
| 指名真人面部 | "Elon Musk"、"Taylor Swift"、"Obama"、"Tom Cruise" | 公开权/肖像权 |
| 指名系列角色 | "Iron Man"、"an original masked acrobat hero"、"Darth Vader"、"Deadpool" | 迪士尼/Marvel IP（停止侵权函活跃） |
| 指名 Pixar/迪士尼动画 | "Elsa"、"Woody"、"Wall-E"、"Simba" | 迪士尼 IP |
| 指名动画角色 | "Naruto"、"Goku"、"Luffy"、"Levi"、"Demon Slayer" | 工作室/发行商 IP + 日本政府调查 |
| 指名游戏角色 | "Mario"、"Master Chief"、"Geralt"、"Kratos" | 任天堂/微软/索尼/CD Projekt IP |
| 指名流媒体原创 | "Stranger Things characters"、"Squid Game guard"、"Bridgerton" | Netflix IP（停止侵权函活跃） |
| 派拉蒙 IP | "Shrek"、"SpongeBob"、"Dora"、"Mission Impossible" | 派拉蒙天舞停止侵权函活跃 |
| 指名 DC 角色 | "Batman"、"Superman"、"Wonder Woman"、"Joker" | 华纳兄弟/DC IP |
| 可见品牌 logo | Nike swoosh、Apple logo、Coca-Cola script | 商标侵权 |
| 受版权场景复刻 | 来自指名电影的精确镜头 | 电影工作室版权 |
| 指名音乐作品 | "Play Bohemian Rhapsody as the score" | 音乐发行权 |
| 深伪/换脸请求 | "Replace @Image1's face with [celeb]" | 深伪策略 + 字节跳动上传屏蔽 |
| 军事/政府徽章 | 带部队徽章的具体武装部队制服 | 监管 + 潜在策略 |

---

## 实时执行范例（2026 年 2 月）

这些在 MPA 和迪士尼的法律信函中作为被阻止的范例被具体引用：

| 提示词类型 | 触发了什么阻止 |
|---|---|
| "an original masked acrobat hero fighting Captain America on the streets of New York" | 指名 Marvel 角色 |
| "Anakin Skywalker and Rey battling with lightsabres" | 指名星球大战角色 |
| "Stranger Things characters in a new scene" | 指名 Netflix 原创 |
| "Deadpool and Wolverine fight sequence" | 指名 Marvel 角色 |
| "Shrek walks through a swamp" | 指名派拉蒙角色 |
| "Tom Cruise and Brad Pitt fight scene" | 指名真实演员（2 月 15 日后病毒式拒绝） |

> **注意：** 引发争议的病毒式 Tom Cruise / Brad Pitt 战斗片段是在 2 月 15 日收紧之前生成的。2 月 15 日之后，指名真人请求静默失败或返回通用拒绝消息。

---

## 软性阻止（依赖上下文）

这些可能通过也可能失败，取决于框架和视觉特异性：

| 类别 | 风险级别 | 备注 |
|---|---|---|
| 真实建筑外观 | 低-中 | 埃菲尔铁塔 = 公共领域。悉尼歌剧院 = 受版权保护直到 2067。 |
| 历史人物 | 中 | 去世 70+ 年 = 通常安全。近期历史 = 提升的风险。 |
| 通用超级英雄美学 | 低 | 红金装甲服 = OK。"Iron Man 服" = 被阻止。 |
| 时尚/品牌色彩方案 | 低 | Tiffany 蓝色连衣裙 = OK。"Tiffany & Co. 品牌" = 被阻止。 |
| 文化/宗教意象 | 中 | 上下文敏感。在商业上下文中避免神圣符号。 |
| 真实地点附近的暴力 | 高 | 避免生成引用真实具名地点的暴力内容。 |
| 动画风格角色（未命名） | 低-中 | 原创角色设计 OK；与指名角色的视觉相似性 = 风险。 |
| Netflix/流媒体 UI 元素 | 高 | 显示 logo、剧集卡、界面 = 被阻止。 |

---

## 安全替换表

用描述性原型替换指名 IP。始终思考：*它看起来像什么，而不是被称为什么？*

### 电影与银幕角色

| ❌ 指名 IP | ✅ 安全描述符 |
|---|---|
| Iron Man | red-and-gold powered exoskeleton, chest reactor glow |
| Batman | dark armored vigilante, scalloped cape, bat emblem absent |
| an original masked acrobat hero | red-and-blue spandex web-shooter acrobat |
| Darth Vader | black full-helmet respirator suit, red energy blade |
| Deadpool | red-and-black tactical suit, masked mercenary, dual katanas on back |
| Terminator | chrome endoskeleton humanoid, single red eye |
| The Joker | smeared clown makeup, green hair, purple coat |
| Thanos | large purple-skinned humanoid with golden gauntlet |
| Elsa (Frozen) | platinum-haired woman in ice-blue gown, frost particles emanating from hands |
| Shrek | large green-skinned ogre, brown vest, Scottish accent implied in gesture |

### Netflix / 流媒体原创角色

| ❌ 指名 IP | ✅ 安全描述符 |
|---|---|
| Stranger Things – Eleven | young girl, buzzed head, nosebleed, telekinetic gesture |
| Stranger Things – Demogorgon | multi-petaled faceless biped, tall, dark biomass skin |
| Squid Game guard | hot-pink coverall figure, black circle/triangle/square mask |
| Bridgerton aesthetic | Regency-era ballroom, empire-waist gowns, string quartet |

### 动画角色

| ❌ 指名 IP | ✅ 安全描述符 |
|---|---|
| Naruto | blond spiky-haired shinobi, orange jumpsuit, whisker scars |
| Goku | dark spiky-haired martial artist, orange gi, muscular |
| Luffy | straw-hat pirate, red vest, scar under left eye |
| Sailor Moon | blonde twin-tailed girl, white sailor uniform, crescent moon |
| Evangelion Unit-01 | purple-and-green giant mecha, single horn, four eyes |
| Totoro | large grey forest spirit, pointed ears, cat-like body |
| Demon Slayer – Tanjiro | dark-haired boy, checkered haori, box on back |
| Attack on Titan – Levi | short dark-haired soldier, vertical maneuvering gear, green cape |

### 游戏角色

| ❌ 指名 IP | ✅ 安全描述符 |
|---|---|
| Master Chief | green full-body military power armor, golden visor |
| Link (Zelda) | green-tunic elf warrior, pointed hat, triangular shield |
| Geralt | white-haired witcher, dual swords on back, amber eyes |
| Kratos | bald grey-skinned warrior, red facial tattoo, chain blades |
| Aloy | red-haired hunter, tribal leather armor, focus device on ear |
| 2B (NieR) | blindfolded android, black gothic dress, white hair |

### 品牌与 Logo 替换

| ❌ 品牌引用 | ✅ 安全描述符 |
|---|---|
| Nike swoosh | curved checkmark logo on athletic wear |
| Apple logo | silver bitten-fruit icon on laptop |
| McDonald's arches | golden M arches, fast food restaurant |
| Coca-Cola script | red can, white cursive brand lettering |
| Ferrari horse | rearing black horse emblem on red sports car hood |
| Louis Vuitton print | repeating tan-and-brown monogram canvas |

---

## 真实人物策略

### 已故公众人物（70+ 年）
通常对历史描绘是安全的。使用时代准确的服装和设置。
```
✅ Victorian-era inventor in a laboratory, period suit, white beard, working on electrical coils
```

### 在世公众人物
**永远不要** 通过姓名或带鲜明肖像生成。（2 月 15 日过滤收紧阻止了大多数基于姓名的请求。）
```
❌ "Elon Musk standing next to a rocket"
✅ "tech billionaire in casual black T-shirt, standing on launch pad"

❌ "Tom Cruise in a fight scene"
✅ "athletic 50s male actor type, sharp jaw, cropped brown hair, grey blazer, fighting stance"
```

### 历史人物（近期，去世 < 70 年）
提升的风险。使用原型语言。
```
❌ "Martin Luther King Jr. giving a speech"
✅ "civil rights leader at a podium, crowd in Washington Mall, 1960s period dress"
```

### 虚构演员肖像
永远不要使用演员的脸，即使在演虚构角色时。
```
❌ "Robert Downey Jr. as Tony Stark"
✅ "genius billionaire in a red-gold suit, goatee, reactor in chest"
```

### 真实人物上传（@Image 中的脸）
字节跳动于 2026 年 2 月 15 日暂停了真人的用户图像上传。
```
❌ Upload photo of Tom Cruise → "Generate as action hero"
✅ Upload original character art → "Generate as action hero"
```

---

## 建筑与建筑

一些建筑仍处于活动版权下。

| 建筑 | 状态 | 备注 |
|---|---|---|
| 埃菲尔铁塔（白天） | 公共领域 | 安全 |
| 埃菲尔铁塔（夜间照明） | 受版权保护 | 灯光秀设计受保护 |
| 悉尼歌剧院 | 保护至约 2067 | 使用"iconic white shell-roof opera house" |
| 古根海姆毕尔巴鄂 | 受版权保护 | 使用"titanium-clad curvilinear museum" |
| 卢浮宫金字塔 | 保护至 2029 | 使用"glass pyramid in courtyard of classical stone palace" |
| 帝国大厦 | 一些限制 | 通用外观通常没问题；精确复制有风险 |
| 大多数 1900 年前的建筑 | 公共领域 | 安全 |

---

## 音乐与音频

| ❌ 被阻止 | ✅ 安全 |
|---|---|
| "Play Stairway to Heaven as the score" | "electric guitar power chord progression, rising tempo" |
| "BGM similar to Hans Zimmer's Inception theme" | "deep brass sting, slow bwaaah, building tension" |
| "Use a Drake beat" | "trap hi-hats 140 BPM, 808 bass, minimalist" |
| "Beethoven's 5th Symphony" | "dramatic orchestral opening, four-note fate motif, strings" |