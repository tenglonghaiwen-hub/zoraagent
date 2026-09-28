# TT Image 2.5 接入

状态：本地代码已修复、模拟测试通过。未部署、未打包、未发起真实付费生成。

后台模型选择 custom 供应商，Base 地址 https://api.lk888.ai，模型 ID tt-image-2.5（增强版可另建 tt-image-2.5-sunburst）。协议模板选择 tt-image，请求路由 /v1/images/generations，查询路由留空。后台选择新模板会清空旧能力 JSON；可留空使用模板默认值，或填写下面 JSON：

```json
{"version":1,"status":"ready","template":"tt-image","route":"/v1/images/generations","ratios":["1:1","16:9","9:16","4:3","3:4","3:2","2:3","5:4","4:5","2:1","1:2","21:9","9:21"],"resolutions":["1K","2K","4K"],"maxCount":1,"modes":["t2i","i2i"],"revision":1,"minClientVersion":1}
```

- 参考图自动切换 /v1/images/edits。纯公网参考传 images/image_url，内嵌图片通过 multipart image[] 上传。客户端会把公网参考转成内嵌图片以支持与本地图片混用；直接 API 混合两种形式会明确拒绝，需先统一为内嵌图片。
- 4K 长边上限 3840，总像素上限 8294400；横屏 3840×2160，竖屏 2160×3840，方图 2880×2880。全部尺寸为 16 倍数。
- 使用既有 IMAGE_JOBS Durable Object 与 generation_receipts，不新增数据库迁移；缺少持久任务绑定时阻止提交。
- 客户端提交返回持久任务编号；生成在 Durable Object 中运行。若上游错误返回 error.task_id，记录后使用 GET /v1/skills/task-status 查询，最多持续 20 分钟。查询异常不重复 POST。完全断连且没有上游 ID 时保留结果待确认，不谎报成功，也不自动重提。
- 不改其他图片协议；既有 gpt-image 后台配置不会自动迁移，需部署后改为 tt-image。
- quality/background/output_format/version 已支持适配器传参，但本次未新增客户端专用控件。

文档依据：https://qiangge888.com/apidoc#model/tt-image-2.5 的 OpenAI Images 兼容页签。
验证：tests/tt-image.test.mjs，以及 cloud-image-job、cloud-image-receipts、model-capability、generation-kind、generation 回归。真实上游响应与出图仍待经授权的付费验收。
