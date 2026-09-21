# 模型能力配置与自动路由方案

MiniMax 新增多元 OpenAI 格式独立模板，配置与边界见 [MINIMAX-OPENAI.md](MINIMAX-OPENAI.md)。模板切换会同步 v1 生成/查询路由，现有配置不会自动改动。

发布状态（2026-09-21）：两份增量迁移及生产 Worker 发布已完成，版本 `a39aa91f-ecd4-4896-9ab4-9856f07153d1`。线上健康、能力目录、后台页面和素材接口鉴权检查通过。以下“本次未部署”是开发阶段记录；客户端安装包仍待更新，线上尚未配置 Seedance 模型，未启用真实素材工作流。

目标：后台维护模型能力，Agent 按用户指令选择模型和操作，执行器按固定协议模板组装请求。配置不能携带任意脚本、供应商密钥或绕过收费与审批。

## 配置与执行

1. 每个模型关联版本化能力配置：协议模板、允许的生成模式、比例、分辨率、时长、数量限制。模型原有 provider、route、queryRoute 仍由服务端维护。
2. 同协议新模型复用模板；新协议必须增加适配器与测试。未知模板/路由不能自动降级为其他协议。
3. `/api/models` 发布可执行能力与兼容版本，客户端和 Agent 从同一目录获取；旧配置按已有模型迁移，未知模型不默认开放全部模式。
4. Agent 只选择模型、模式和参数；客户端请求不得覆盖服务端 provider/route。服务端在提交前再次校验配置，拒绝不支持的模式。
5. 配置修改保存历史快照，支持读取历史后恢复。回滚恢复配置内容，版本号继续递增。历史从部署后首次保存开始记录；发布前须备份现有配置。任务回执的统一版本快照属于下阶段，当前不能声称所有旧媒体任务均已覆盖。

## 协议范围与维护边界

- 文字：Responses、Claude Messages、Chat Completions 转换为本地内核可读的 Responses 事件。
- 图片/视频：复用已实现的生成适配器。未完成的特殊上传、素材审核、mask、remix 不因添加路由而被宣称可用。
- Seedance 素材库模板必须具备创建组、导入、查询至 Active 和 asset 引用四步；创建操作不可盲目重试，超时保留 task_id。该专用模板单独验收后才能开放。
- API 地址变化、参数范围变化可通过配置更新；增加客户端无法理解的操作需提升兼容版本并更新客户端。

## 验收与发布

使用隔离数据库和模拟上游测试配置保存、目录发布、参数校验、真实请求路径、工具调用事件、错误和取消。测试不进行付费生成。
发布顺序：备份配置 → 执行数据库迁移 → 发布 Worker → 安装兼容客户端 → 小范围验证。代码修改本身不代表线上已生效；本任务不自动修改生产账户权限或提交付费请求。

## 本次已落地（2026-09-21，本地源码）

- 后台模型编辑增加协议模板和能力 JSON；保存时校验类型、模式、比例、分辨率、时长、数量与路径。失败不会保存配置。
- `server_models.config` 保存能力；`model_config_history` 保存每次成功发布的快照。模型与历史在同一事务写入；版本冲突返回 409。恢复历史需保存，生成新的版本。
- 云端 `/api/models`、客户端显示、Agent 工具校验和最终草稿使用同一能力目录；目录不可读取时显示错误，不静默回退本机旧目录。
- `/api/generate` 和 `/api/chat` 根据数据库选择供应商和路由，拒绝客户端覆盖。媒体请求复用协议适配器；Qwen 参考图使用模板声明的 edits 路由。
- Agent 的 Chat Completions 路由支持文字、图片输入、工具及工具结果，转换为内核的 Responses 事件；流中断输出失败，取消向上游传递。普通聊天也分别组装三种文字协议请求。
- 未知模板不自动开放全部生成模式。视频云端单次限制一个任务，避免适配器忽略批量数量；图片按实际请求数量计价。

管理员可填写的能力示例（实际参数必须以供应商支持范围为准）：

```json
{
  "version": 1,
  "template": "gpt-image",
  "modes": ["t2i", "i2i"],
  "ratios": ["1:1", "9:16"],
  "resolutions": ["1K", "2K"],
  "maxCount": 2
}
```

选择同协议模板并填入模型 ID、供应商和生成路由后保存；Agent 下次请求模型目录即可识别。这里的校验只证明配置与适配器一致，不证明上游账号已获得模型权限。

## 尚未开放的后续工作

1. Seedance 素材库工作流已在本地接入，见下节；尚未部署和做真实上游验收。需迁移素材回执表，并由管理员启用，才向 Agent 开放。
2. 所有媒体家族统一的持久任务回执与提交时配置快照；当前 GPT 图片已有专用回执，其他家族沿用原逻辑。更新路由前应等待旧任务完成。
3. mask、remix、其他未实现模型家族需要专门适配与验收，不能靠添加模板名称启用。

## 发布操作清单

现有数据库需先执行 `apps/cloudflare-worker/model-capabilities.sql`，新库的 `schema.sql` 已包含历史表。只执行这份增量 SQL，不重置现有库。

在 `D:\zora\apps\cloudflare-worker` 使用项目发布环境执行：

```powershell
npx wrangler d1 execute zora-db --remote --file=./model-capabilities.sql
npx wrangler d1 execute zora-db --remote --file=./seedance-assets.sql
npx wrangler deploy --dry-run
npx wrangler deploy
```

上述是后续发布步骤，本次只做了 dry-run；随后还需重新打包客户端，旧安装包没有这些修改。首次发布前备份模型配置，并检查所有启用的未知模型，给它们选择受支持的模板。

## 本地验证入口

- `node --test tests/*.test.mjs`：配置事务与回滚、参数约束、实际请求路径、流式工具参数和取消等。
- `node scripts/verify-model-capability-ui.mjs`：隔离 Chromium 操作模板、历史恢复和保存；使用包内浏览器及本机 Playwright 测试依赖。
- `outputs/model-capability-regression.txt`、`outputs/model-capability-ui.txt`、`outputs/model-capability-build.txt` 保存验证输出。

发布命令依据 [Wrangler 命令文档](https://developers.cloudflare.com/workers/wrangler/commands/)，数据库事务依据 [D1 batch 文档](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)。

## Seedance 素材库接入（2026-09-21 续作）

供应商文档已逐页核对：[创建素材组](https://docs.deepwl.cn/duoyuanx/zh/videos/seedance-2/asset-create-group)、[导入素材](https://docs.deepwl.cn/duoyuanx/zh/videos/seedance-2/asset-create-media)、[查询审核](https://docs.deepwl.cn/duoyuanx/zh/videos/seedance-2/asset-get)。这是多元接口，不能移植其字段到其他 Seedance 供应商。

后台选择 `seedance` 模板、`duoyuanx` 供应商，勾选“启用多元 Seedance 素材库工作流”。配置保存 `assetWorkflow: "seedance-library-v1"`。默认不启用，不修改现有线上配置。

Agent 流程：

1. `prepare_seedance_assets` 使用当前会话原素材，创建持久回执及素材组；返回 id。
2. `preparing` 时复用同一 id 继续准备。公网 HTTPS 素材直接导入；内嵌文件先通过签名地址上传，再导入。单次至多 6 个素材，总内嵌内容约 20 MiB；更大文件使用公网 HTTPS 地址。
3. `processing` 时调用 `query_seedance_assets`，每次查询一个待审核素材。无需保持一个长 HTTP 连接；下轮对话可用原 id 恢复查询。
4. 只有全部 `Active` 才返回 `ready`。`submit_generation` 携带 `assetReceiptId`；服务端核对账号、模型、原素材指纹及供应商地址，再将引用替换为 `asset://Id`。此步骤才提交视频生成，素材准备不会自动生成视频。

`seedance_asset_receipts` 保存状态、groupId、assetId、taskId 和供应商地址快照，不保存密钥或内嵌文件。相同请求编号不能更换素材；并发租约防止重复创建。发送创建请求前先记入执行阶段；响应丢失或进程中断时标记 unknown，禁止自动重建。审核查询失败保留 taskId，可继续查询；Failed 显示上游审核原因。

生成入口不接受无所属账号审核回执的直接 asset 引用。更换原素材需重新准备；模型供应商地址改变时不能复用旧回执。unknown 创建记录仍需人工核对上游，当前文档没有可安全补回丢失创建响应的接口。

验证：真实 SQLite 隔离数据库 + 模拟供应商请求，覆盖完整准备/查询/生成引用、跨账号隔离、原图更换、并发创建、断线与重启恢复、审核失败、签名存储不携带供应商凭据；后台启用选项使用隔离 Chromium 操作验证。输出在 `outputs/seedance-assets-*.txt`。未进行真实素材上传或付费生成。
