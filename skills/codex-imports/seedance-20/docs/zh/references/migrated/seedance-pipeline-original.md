<!-- AUTO-TRANSLATED: 源文件 = ../../../references/migrated/seedance-pipeline-original.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# `seedance-pipeline` 的旧版体

于 2026-04-27 在 v5.1.0 期间迁移。除非在 `references/api-status.md` 或 `references/source-registry.md` 中确认，否则将本文件中的平台、策略、API 与安全声明视为旧版。

---

# seedance-pipeline

Seedance 2.0 的 API、ComfyUI 与后期处理。

## 平台访问

| 平台 | 端点 / 应用 | 备注 |
|---|---|---|
| Web | jimeng.jianying.com (Dreamina) | 4–15 秒，最高 1080p |
| Mobile | CapCut / Jianying · Xiaoyunque | 5–10 秒 |
| API | Volcengine `Doubao-Seedance-2.0` | 见下方速率限制 |
| Consumer | Doubao app | 标准 Web 限制 |

## 火山引擎 API

```
POST https://ark.cn-beijing.volces.com/api/v3/videos/generations
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

```json
{
  "model": "Doubao-Seedance-2.0",
  "prompt": "<compiled plain-text prompt>",
  "duration": 8,
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "seed": 42
}
```

**规则**
- 永远不要发送原始 JSON 模式 —— 先编译为纯文本。
- `seed` 可选；省略以求变化，设置以求可复现性。
- 检查响应中的 `status` 字段：`queued → processing → completed | failed`。
- 以 5 秒间隔轮询；超时 120 秒。

## 文件预算（"12 规则"）

| 类型 | 最大数量 | 每个最大大小 | 格式 |
|---|---|---|---|
| 图像 | 9 | 30 MB | JPG · PNG · WEBP |
| 视频 | 3 | **合计 ≤ 15 秒** | MP4 · MOV |
| 音频 | 3 | 合计 ≤ 15 秒 | MP3 |
| **总文件数** | **12** | — | — |

## ComfyUI 节点工作流

```
[Load Image / Load Video] → [Seedance2 Sampler]
      ↓                           ↓
[CLIP Text Encode]          [Prompt Compiler]
      └────────────────────────→ ↓
                         [Video Output Node]
                                 ↓
                      [Frame Interpolation]
                                 ↓
                         [Upscale Node]
                                 ↓
                       [Color Grade Node]
                                 ↓
                        [Export / Mux Audio]
```

关键节点参数：`duration`、`aspect_ratio`、`resolution`、`seed`、`motion_strength`。

## 后期处理链

### 1 · 升频
- 工具：Topaz Video AI · Real-ESRGAN · ffmpeg `scale=iw*2:ih*2`
- 目标：720p → 1080p（标准） · 1080p → 2K（高端）

### 2 · 帧插值
- 工具：RIFE v4.x · DAIN
- 标准：24 fps → 60 fps（平滑动作）
- 战斗 / 快速动作：24 fps → 120 fps

### 3 · 调色
- 工具：DaVinci Resolve · FFmpeg LUT
- 工作流：标准化曝光 → 应用 LUT → 蒙版提亮阴影 → 完成。
- LUT 槽：Rec.709（Web） · Log-C（归档）。

### 4 · 音频合成