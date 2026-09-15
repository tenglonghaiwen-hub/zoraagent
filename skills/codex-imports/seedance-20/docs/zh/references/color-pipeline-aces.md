<!-- AUTO-TRANSLATED: 源文件 = ../../references/color-pipeline-aces.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 调色流水线与 ACES 备注

当 Seedance 输出必须进入专业剪辑、调色、HDR/SDR 通过、代理审阅或交付工作流时，使用本参考。

## 诚实边界

Seedance 提示词可以描述调色意图、灯光动机、对比度、调色板、材质响应与情绪。它们不能取代测量的色彩管理、校准的监视器、合规、调色、法律范围检查或交付转换。让提示词语言保持创意；让流水线语言成为后期的元数据。

## 提示词层调色意图

使用：

- 光源：钨丝实用光、阴天日光、钠路灯、霓虹灯、凉爽月光轮廓；
- 对比度：柔和低对比、硬黑色对比、干净产品对比、高调美妆；
- 调色板：克制的冷暖分割、柔和冬季调色板、饱和 MV 调色板；
- 材质响应：拉丝金属高光、肤色滚降、光泽亚克力反射、湿地高光；
- 过渡：实用灯温暖脸部，闪电短暂硬化轮廓。

避免：

- 诸如仅凭提示词实现精确 ACES 合规的不支持声明；
- 不可能的堆叠如 HDR Dolby Vision、16mm、霓虹、漂白旁路与柔和粉彩商业全部出现在一段短镜头中；
- 使用 LUT 名称作为神奇风格词，而不描述可见结果。

## 后期待追踪元数据

对于专业交接，记录：

| 字段 | 含义 |
|---|---|
| 捕获/来源 | 生成来源、参考片段、静帧、源帧 |
| 工作色彩空间 | 项目工作假设，通常为 ACEScct/ACEScg 或剪辑师管理的替代 |
| IDT/源转换 | 源媒体如何被解读（如适用） |
| 片场外观 | 创意外观描述、LUT/CDL/LMT 备注 |
| 输出转换 | SDR Rec.709、HDR PQ、影院/DCP、社交平台转换 |
| 修剪通过 | 单独的 SDR/HDR/社交审阅备注 |
| QC 备注 | 剪切、非法电平、条带、肤色、产品颜色、logo 颜色 |

## ACES 友好交接

当用户询问 ACES 时，回应为双层答案：

1. 提示词：Seedance 能理解的可见调色与灯光指令。
2. 交接：ACES/AMF/调色备注供剪辑师或调色师在 Seedance 外核验。

范例：

`Prompt look: cool overcast daylight with a warm practical lamp reflected in the bottle, soft contrast, clean highlight rolloff, no crushed blacks. Post note: conform generated clip into the project color pipeline, verify source interpretation, preserve product color, create SDR Rec.709 and HDR trim review if required.`

## 调色失败修复

| 症状 | 修复 |
|---|---|
| 画面平淡 | 添加有动机的关键光源、轮廓/分离光与一个材质高光 |
| 过度处理调色 | 减少风格名称；指定自然对比度与中性肤色/产品颜色 |
| 镜头间调色不一致 | 在每个镜头中重复灯光方向、一天中的时间、调色板与片场外观备注 |
| 产品颜色错误 | 使用 I2V 产品参考、锁定摄影机与产品颜色保持约束 |
| HDR/社交不匹配 | 保持提示词中性；在后期规划单独的调色/导出版本 |