# Seedance 2.0（强哥AI 的两种协议）

依据：[强哥AI Seedance 2.0 接口文档](https://qiangge888.com/apidoc#model/seedance-2.0-guanfang)。服务地址为 `https://api.lk888.ai`，密钥只保存在 Worker 的 `CUSTOM_API_KEY`；不要放进客户端。部署前确认后台 `CUSTOM_BASE_URL` 指向该地址，且不是带 `/api/v3` 的路径。

| Zora 模型 ID | 模板 | 创建任务 | 查询任务 |
| --- | --- | --- | --- |
| `lk-seedance-2.0-media` | `lk-seedance-media` | `POST /v1/media/generate` | `GET /v1/media/status?task_id={task_id}` |
| `lk-seedance-2.0-ark` | `lk-seedance-ark` | `POST /api/v3/contents/generations/tasks` | `GET /api/v3/contents/generations/tasks/{task_id}` |

执行 `apps/cloudflare-worker/lk-seedance-config.sql` 创建两条**默认关闭**的后台模型，初始按次积分价格为 0。管理员先填写可承担上游成本的正整数按次价格，再开启模型；价格为 0 时服务端拒绝提交，避免意外免费调用。两套协议各有独立价格和开关，不会替换多元 Seedance 或已有视频模型。默认只开放 480p、720p；1080p、4K 和更高成本的设置需管理员修改能力 JSON 与价格。上游可能按时长和分辨率计费，Zora 此处固定按次扣积分，不会按实际 token 自动补扣。上线前需复核最高成本。

两种协议均使用上游模型 `doubao-seedance-2-0-260128`，支持文生视频、首帧、首尾帧和参考生成，画面比例为 `adaptive`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`21:9`，时长可选自动或 4–15 秒。最多 9 张参考图、3 段参考视频、3 段参考音频；音频参考不能单独使用。客户端选择对应 Seedance 模型后，可在输入框下方添加图片、视频或音频的公网直链并自动引用；本地上传图片和音频只适用于本站媒体协议，参考视频在两种协议中都要先取得公网直链。火山方舟格式的全部参考素材都需要公网直链。外部直链的实际可访问性由上游最终校验。

本站媒体协议提交 `model/prompt/params`，查询以 `is_final/state/result_url` 判定。火山方舟格式提交 `model/content` 以及分辨率、比例、时长，查询以 `status/content.video_url` 判定；`failed`、`cancelled`、`expired` 均按终态失败处理。提交前保存账号所属回执并只扣一次；同一请求编号只恢复原回执。确认失败后退积分；上游提交结果不明时保留回执，避免重复请求。文档的本站媒体协议参数表与页面内部分示例不完全一致，当前实现遵照参数表；**尚未用付费上游调用验证**，启用前应使用可控额度完成一次提交、轮询和播放检查。

测试：`node --test tests/lk-seedance.test.mjs tests/lk-wan3.test.mjs tests/lk-minimax-h3.test.mjs tests/h3-operations.test.mjs`

2026-09-23 云端状态：已在 `zora-db` 执行配置脚本并读回两条模型记录；Worker `zora-api` 已发布版本 `55010279-d4e2-417c-9ddb-208dcbe5fdef`，`/health` 返回正常，`/admin` 含两个协议模板。两条模型仍为关闭、0 积分，尚未进行付费生成验证。桌面客户端的新增直链入口仍需随下一次客户端更新发布。
