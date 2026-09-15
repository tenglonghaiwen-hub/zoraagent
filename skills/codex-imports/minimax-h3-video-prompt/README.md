# MiniMax H3 Video Prompt Skill

> 作者B站：penpos<br>
> 其他项目：[开源赛博女友](https://www.bilibili.com/video/BV1Qt3B6oESF/?vd_source=6ecc8cb46963ff59eab7e9e854adecf8#reply116998935676747)

根据用户需求和图片、视频、音频素材，自动选择 MiniMax H3 的正确能力路径，生成并复核可直接使用的视频提示词。

它不是 Prompt 案例库，也不会检索相似案例进行拼接。所有提示词都围绕当前用户需求现场生成。

## 能做什么

- 文生视频、首帧/尾帧和首尾帧视频提示词。
- 图片、视频、音频联合参考与职责分配。
- 人物、产品、动作、机位、运镜、风格、声音和节奏的拆分控制。
- 保留参考视频拍法，只替换人物、产品、场景和品牌视觉。
- 人物、物体、场景、光影、特效、声音、台词和音色的精准编辑。
- 品牌影视、视觉包装、AI 剧情、产品电商、数字体验、游戏、动画等商用方向。
- 硬件工业、机械设备、机器人和具身智能演示。
- 复杂多项指令的覆盖检查与冲突修正。
- 时长、素材数量、画幅和 Prompt 字符数的规则校验。

## 工作方式

```text
用户需求
  → 原子需求清单
  → MiniMax H3 能力路由
  → 参考素材职责分配
  → 生成完整 Prompt
  → 语义复核
  → 官方限制校验
  → 交付最终 Prompt
```

生成后会检查：

- 用户要求是否全部落实。
- 每份素材是否有明确、无冲突的职责。
- 人物、产品、文字、UI 和关键道具是否得到锁定。
- 时间轴、动作、镜头和转场是否能在目标时长内完成。
- 对白、音色、口型、音乐和音效是否归属准确。
- 是否存在互相冲突的机位、运镜或编辑要求。
- 是否符合 MiniMax H3 的输入输出限制。

默认只向用户交付最终结果，不展示内部推理和复核过程。

## 安装

### 通用安装

```bash
npx skills add penposs/minimax-h3-video-prompt
```

安装程序会让你选择 Codex、Claude Code 或其他已检测到的 Agent，以及项目级或全局安装范围。

### 安装到 Codex

项目级：

```bash
npx skills add penposs/minimax-h3-video-prompt --agent codex -y
```

全局：

```bash
npx skills add penposs/minimax-h3-video-prompt --agent codex -g -y
```

### 安装到 Claude Code

项目级：

```bash
npx skills add penposs/minimax-h3-video-prompt --agent claude-code -y
```

全局：

```bash
npx skills add penposs/minimax-h3-video-prompt --agent claude-code -g -y
```

### 安装到多个工具

```bash
npx skills add penposs/minimax-h3-video-prompt --all
```

对于 WorkBuddy 或其他能够读取 Agent Skills / `SKILL.md` 的工具，也可以克隆仓库后，将整个目录放入它的项目级或全局技能目录。

### 手动安装

```bash
git clone https://github.com/penposs/minimax-h3-video-prompt.git
```

把克隆后的整个目录放入目标工具的技能目录，不要只复制 `SKILL.md`，否则能力路由、官方规则和校验脚本不会完整生效。

## 使用示例

```text
用 MiniMax H3 做一条 15 秒瓶装饮料广告。图1负责人物，图2负责产品，视频1负责动作和运镜，音频1负责卡点。
```

```text
保留视频1的时间轴、动作、机位、运镜和转场，只把人物、服装、背景和产品换成我上传的素材。
```

```text
严格保留原视频，只把人物手中的黑伞改成白色郁金香，其余内容不要变化。
```

```text
生成一条工业机械臂分拣易碎零件的演示视频，重点控制关节运动、抓取接触、受力反馈和安全边界。
```

如果只想要结果，可以直接说：

```text
只给我最终提示词，不要解释。
```

## 当前规则边界

- 模型名：`MiniMax-H3`
- 输出分辨率：768P 或 2K
- 单次生成时长：4—15 秒整数
- 输出画幅：`adaptive`、`21:9`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`；文生视频不能使用 `adaptive`
- Prompt：不超过 7000 字符
- 参考图片：最多 9 张
- 参考视频：最多 3 段，每段 2—15 秒，合计不超过 15 秒
- 参考音频：最多 3 段，每段 2—15 秒，合计不超过 15 秒
- 图片、视频和音频合计：最多 12 个文件
- 音频不能单独作为参考输入，必须同时提供图片或视频
- 首尾帧输入与多模态参考输入不能混用

模型规则更新时，修改 `references/official-rules.md` 和校验脚本即可，不需要重写整套 Skill。

## 本地校验

```bash
python scripts/validate_h3_prompt.py \
  --input prompt.txt \
  --mode reference-to-video \
  --duration 15 \
  --ratio 16:9 \
  --images 2 \
  --videos 1 \
  --audios 1 \
  --video-durations 15 \
  --audio-durations 15
```

校验器会检查机械限制；Skill 本身负责需求覆盖、素材职责和镜头冲突等语义复核。

## 目录结构

```text
minimax-h3-video-prompt/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── capability-map.md
│   ├── official-rules.md
│   └── prompt-framework.md
└── scripts/
    └── validate_h3_prompt.py
```

## License

[MIT](LICENSE)
