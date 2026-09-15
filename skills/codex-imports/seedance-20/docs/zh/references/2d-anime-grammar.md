<!-- AUTO-TRANSLATED: 源文件 = ../../references/2d-anime-grammar.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 2D / 动画语法 —— 指挥媒介，而非摄影机装备

*Seedance 2.0 能很好地渲染风格化的 2D 和动画动作，但实拍语法会降低其效果：镜头、景深与传感器词汇会让输出偏向照片写实或假移轴外观。改用动画制作语言指挥 2D 作品。标签：[field] = 从业者报告 · [heuristic] = 待验证的默认。工艺指引汇编于 2026-06-11；不含平台可用性声明。*

## 核心规则 [field]

首先点名媒介，并将每句话保持在动画制作流程之内："hand-drawn 2D animation, cel-shaded characters over a painted background"（手绘 2D 动画，水彩绘制背景上的赛璐璐上色角色）。在 2D 提示词中绝不要使用镜头、散景、景深、焦距或机身词汇 —— 它会召唤照片写实渲染。

## 图层语法 [field]

2D 场景读作堆叠的美术图层，模型会响应图层语言：

- **赛璐璐层叠在水彩绘制背景上：** 清晰的赛璐璐上色主体置于柔和的水彩或水粉绘制背景上。
- **背景横移 / 多层视差：** "the painted background scrolls past"（绘制背景横移）或 "foreground silhouettes slide faster than the distant skyline"（前景剪影比远方天际线滑动更快）以营造视差。
- **背景保持、主体动画：** 声明保持静止的部分 —— 保持帧是媒介的特征，而非失败。

## 动作语法 [field]

- **爆发动画（sakuga）与保持帧：** 在全力高强度爆发与保持姿态之间交替："a burst of fluid full animation as she turns, then a held frame on her expression"（她转身时的一阵流畅全力动画，然后定格在她表情上）。
- **节奏：** "animated on twos"（一拍二动画）以获经典赛璐璐节奏；"on ones"（一拍一）仅用于亮点动作。[heuristic]
- **冲击帧：** "a single high-contrast impact frame on the hit"（击中瞬间单张高对比冲击帧）。
- **速度线与涂抹：** "speed lines streak the background during the dash"（冲刺时背景拖出速度线），"her arm smears across the swing"（挥击时她的手臂成涂抹状）。
- **跟随动作：** 头发、衣物、外套尾部在身体停止后继续收尾。

## 2D 中的摄影机 [field]

"摄影机"是悬浮在美术之上的绘图台：横移过绘制背景、缓慢推近定格的脸、沿塔楼美术垂直下倾。每个镜头依然适用一条有动机的运动。避免滑动、手持晃动和镜头呼吸感的写实措辞。

## 2D 中的光线与色彩 [field]

光线是被画出来的，而非被渲染的："hard two-tone cel shadow"（硬二调赛璐璐阴影）、"rim light as a clean shape along the jaw"（轮廓光勾勒下颌为干净形状）、"specular drawn as a white wedge in the eye"（高光在眼中画为白色楔形）。指名调色与质感："limited palette, warm paper texture"（限定调色，暖纸纹理）、"flat color with painted light bloom"（平涂色彩配手绘光晕）。

## 2D 中的声音 [heuristic]

风格化的声音比写实的音效更易读：涂抹帧上的风声、冲击帧上的尖锐弦乐、定格帧上掉出房间底噪。

## 风格安全 [field]

描述技法、年代与调色 —— 绝不指明工作室、系列或在世艺术家。"1990s hand-painted TV-anime look with grainy film texture"（1990 年代手绘 TV 动画外观配颗粒胶片质感）是安全语法；指名工作室或系列的风格请求路由到 `[skill:seedance-copyright]` 与 `[skill:seedance-style]`。

## 失败 → 修复 [field]

| 症状 | 修复 |
|---|---|
| 输出偏向照片写实或 3D-CG | 移除镜头与景深词汇；以 "hand-drawn 2D cel animation"（手绘 2D 赛璐璐动画）起头；指明绘制背景 |
| 动作感觉轻飘或描摹感 | 要求干脆的 "on twos" 爆发、节拍之间的定格、动作弧线上的涂抹 |
| 快动作时面部崩解 | 把速度放到线条、涂抹和背景横移中，而非面部细节；切到一张定格冲击帧 |
| 多镜头之间风格闪烁 | 在多镜头提示词的每个镜头中重复完全相同的媒介句；保持调色短语一致 |

## 序列边界 [heuristic]

对于相连的 2D 片段，保留角色表、调色、线条粗细、图层角色、屏幕方向与开放动作。使用已接受片段观察到的最终布局作为下一片段的开场布局。在撰写续拍提示词时不要切换到摄影镜头或传感器语言。