<!-- AUTO-TRANSLATED: 源文件 = ../../../examples/sequence-airport-arrival/sequence-plan.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 序列计划：机场抵达

## 项目摘要

旅行者穿过机场的雨与人流压力到达一辆等待中的黑色轿车。完整故事仅在轿车载着旅行者驶离交通时收束。

## 故事脊柱

初始条件：航站楼出口与人群压力。
目标：到达等待中的车辆。
升级：雨、人群与距离减慢接近速度。
最终结局：旅行者在轿车内且车辆离开。

## 序列映射

Clip 01：离开航站楼并接近打开的车后门。计划端点为在打开的车门旁。已接受观察端点为两步之外。

Clip 02：从两步外开始，完成接近，进入车辆，关闭车门。不要重演航站楼出口。不要展示车辆离开。

Clip 03：车辆驶离路缘并消失在交通中。在 Clip 02 被接受前保持临时。

## 项目状态胶囊

PROJECT ID: seq_airport_arrival
STORY GOAL: traveler reaches waiting car and escapes airport crowd
FINAL OUTCOME: black sedan leaves traffic with traveler inside
SURFACE: unknown conservative generic profile
REFERENCE TAGS: @Image 1, [Video 1]
CANONICAL REFERENCES: @Image 1 controls traveler identity and wardrobe
ACCEPTED CLIPS: clip_01 accepted_with_deviation
CURRENT ACTUAL STATE: traveler is two steps from the open rear car door
OPEN MOTION: traveler and camera continue left-to-right
COMPLETED BEATS: terminal exit
NEXT CLIP JOB: finish approach, enter car, close door
CONTINUITY LOCKS: identity, wardrobe, travel direction, sedan, curbside environment
ALLOWED CHANGES: traveler may enter rear seat and close door
RESERVED FUTURE BEATS: vehicle departure
EXTENSION DEPTH: 1
UNRESOLVED UNCERTAINTIES: exact active surface limits