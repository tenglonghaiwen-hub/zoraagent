# LK MiniMax H3

文档：https://qiangge888.com/apidoc#model/minimax-h3

- 独立模型 ID：`minimax-h3`，显示名称：`MiniMax H3（强哥AI）`。
- 服务商：`custom`，复用后台 `CUSTOM_BASE_URL=https://api.lk888.ai` 和服务端密钥。
- 协议模板：`lk-minimax-h3`。
- 生成路由：`/v1/media/generate`。
- 查询路由：`/v1/media/status?task_id={task_id}`，只允许此固定查询参数格式。
- 模式：文生、首帧、首尾帧、多模态参考；首尾帧顺序为第一张首帧、第二张尾帧。
- 图片最多 9 张、视频最多 3 个、音频最多 3 段；首尾帧最多 2 张图片。视频必须提供公网 URL，图片/音频可使用内嵌数据。
- 时长 4–15 秒；分辨率枚举按文档为 768P、1080P、2K、4K。未付费实测各档输出。
- 本模板没有接入提示词增强和 Remix，不能调用多元的对应接口。

## 按次积分

使用后台模型的“扣除积分单价”，单次只生成一个视频。客户端按次预扣，不按时长或参考视频秒数乘算；确认生成失败后退回积分。新请求使用当前价格，已提交任务保留原价格。上游仍按自己的按秒规则收费。

首次配置默认关闭，0 为待配置占位。管理员在“模型管理”中设置此模型的积分单价，再勾选向客户端开放。原有多元 `MiniMax-H3` 不变。

提交前保存账号所属回执，重复 requestId 只恢复原任务。上游 task_id 支持数字或字符串；查询用 is_final/state/result_url，未知提交不会自动再次 POST。供应商地址变更后阻止把旧任务送往新地址。

验证命令：`node --test tests/lk-minimax-h3.test.mjs tests/h3-operations.test.mjs tests/tt-image.test.mjs`。
