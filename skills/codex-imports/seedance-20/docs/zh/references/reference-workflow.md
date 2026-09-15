<!-- AUTO-TRANSLATED: 源文件 = ../../references/reference-workflow.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# 参考工作流

## 资产角色映射

在撰写提示词散文之前，为每个上传资产分配一个角色。角色映射可防止意外传递身份、logo、场景归属或不兼容的摄影机与动作指令。

| 资产 | 良好角色 | 应避免 |
|---|---|---|
| 图像 | 身份、产品、姿态、服装、环境、首帧、尾帧 | 要求它定义未见过的动作 |
| 视频 | 动作、摄影机、节奏、走位、时序、姿态节奏 | 复制受保护身份、logo 或场景归属 |
| 音频 | 节奏、速度、氛围、环境声、表达语气、音乐质感 | 假设人声、歌曲或肖像已授权 |
| 文字简报 | 动作、类型、摄影机规划、约束 | 用含糊的情绪词取代具体的参考角色 |

## 规则

- 精确保留参考标签。
- 在撰写风格语言之前，为每个参考分配一个主要角色。
- 除非权衡明确，不要要求一个参考同时控制不兼容的角色。
- 使用自有、已授权、公共领域或明确获授权的参考。
- 写出应该传递什么、什么不应传递。
- 当授权不清晰时，传递广义的动作、节奏、氛围或制作功能，而非受保护的身份。
- 将多模态参考生成、视频剪辑、视频延长和首尾帧生成视为独立任务。它们可共享资产，但提示词应点名活跃的工作流。
- 如果音频与视频参考相互竞争，当音频时序必须占主导时将视频静音，或声明视频仅控制摄影机/动作而 `[Audio1]` 控制节奏。
- 在序列中，将规范参考与已接受连续性来源区分开：规范身份/产品参考控制不可变设计，而已接受的前序画面控制瞬时开场状态。
- 永远不要让动作参考覆盖连续性锁定、已完成节拍、保留节拍或精确参考标签。

## 工作流专属模式

| 工作流 | 使用此措辞 | 应避免 |
|---|---|---|
| 多模态参考 | `[Image1] controls product identity; [Video1] controls camera rhythm; [Audio1] controls tempo only.` | `Use all references for style.` |
| 视频剪辑 | `[Video1] is the source clip; preserve composition and timing, change only [lighting/background/VFX].` | 从零重新生成整个概念。 |
| 视频延长 | `[Video1] is the previous clip; continue the same shot for [duration] and preserve last-frame continuity.` | 以无连续性锚点开始新场景。 |
| 首尾帧 | `[Image1] is first frame; [Image2] is final visual target; generate the continuous transition only.` | 要求尾帧仅为"氛围"。 |
| 音频参考 | `[Audio1] controls tempo and energy; do not copy protected voice, song, or performance identity.` | 将音频视作授权证明。 |

## 角色范例

| 情境 | 强力映射 |
|---|---|
| 产品广告 | `[Image1] controls product identity; [Audio1] controls tempo only.` |
| 动作传递 | `[Video1] controls side-step choreography only; do not transfer performer, costume, room, or logo.` |
| 风格参考 | `[Image2] controls warm bar atmosphere only; product identity remains from [Image1].` |
| 首尾帧 | `[Image1] is first frame; [Image2] is target end frame; transition occurs through light sweep, not product deformation.` |
| 剪辑/延长 | `[Video1] is the source clip; preserve subject and camera path, replace only the failed lighting beat from 3s to 5s.` |

## 动作传递

从业者现场观察的技法；在承诺结果前测试。可能最少被使用的参考能力：供体视频驱动编排或摄影机节奏，而图像维持身份。

- 将一个供体 `[Video1]` 与一个身份锚 `[Image1]` 配对，并显式写出排除项：`[Video1] controls the choreography only - nothing of its appearance, performer, costume, room, or logo transfers.`
- 选择只有一个清晰动作、清晰轮廓、稳定摄影机的供体片段。繁忙的多人画面传递的是噪音，而非动作。
- 上传前静音供体片段，除非其声音应驱动时序；若保留声音，声明哪个参考掌管时钟。
- 传递良好的：编排、姿态时序、摄影机节奏、走位。传递较差的：精细手部细节、多人同步、面部表演。
- 仅使用自有、已授权、素材库、动捕、排练或自录的供体画面；真实人物的供体仅传递一般动作，不传递肖像。

## 模板

`[Image1] controls product identity. [Video1] controls camera pace only. [Audio1] controls tempo only. Preserve the subject from [Image1]; do not copy characters, logos, music, voice, or environment from [Video1]/[Audio1].`

## 序列传递模板

`[Video 1] is the accepted previous clip and controls only the actual opening state, camera phase, motion phase, ambience, and environment arrangement. @Image 1 controls canonical identity. Preserve both tags exactly. Do not copy unrelated identity, costume, logo, or future action from any reference.`