var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-90tV6l/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// image-job-worker.mjs
import { DurableObject } from "cloudflare:workers";

// ../../apps/cloudflare-worker/src/auth.mjs
var encoder = new TextEncoder();
var decoder = new TextDecoder();

// ../../apps/cloudflare-worker/src/billing.mjs
async function calculateQuotaCost(db, { modelId, kind = "image", count = 1 }) {
  const numCount = Math.max(1, Number(count) || 1);
  if (modelId) {
    try {
      const model = await db.prepare(
        "SELECT quota_cost_per_unit as unitCost, enabled FROM server_models WHERE id = ?"
      ).bind(modelId).first();
      if (model && model.enabled) {
        return model.unitCost * numCount;
      }
    } catch {
    }
  }
  const normalizedKind = String(kind || "").toLowerCase();
  if (normalizedKind === "agent" || normalizedKind === "chat") return 1 * numCount;
  if (normalizedKind === "video") return 100 * numCount;
  return 10 * numCount;
}
__name(calculateQuotaCost, "calculateQuotaCost");
async function deductUserQuota(db, userId, amount, metadata = {}) {
  const numAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (numAmount === 0) return;
  const now = Date.now();
  const logId = crypto.randomUUID();
  await db.prepare(
    "UPDATE users SET quota_balance = quota_balance - ?, updated_at = ? WHERE id = ?"
  ).bind(numAmount, now, userId).run();
  await db.prepare(
    `INSERT INTO usage_logs (id, user_id, resource_type, model_id, tokens_used, quota_cost, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    logId,
    userId,
    metadata.resourceType || "generation",
    metadata.modelId || null,
    metadata.tokensUsed || null,
    numAmount,
    metadata.requestId || null,
    now
  ).run();
  const user = await db.prepare("SELECT quota_balance FROM users WHERE id = ?").bind(userId).first();
  return user ? user.quota_balance : 0;
}
__name(deductUserQuota, "deductUserQuota");
async function getSystemConfig(db, key) {
  try {
    const row = await db.prepare("SELECT value FROM system_configs WHERE key = ?").bind(key).first();
    return row ? row.value : null;
  } catch {
    return null;
  }
}
__name(getSystemConfig, "getSystemConfig");

// ../../apps/cloudflare-worker/src/proxy.mjs
var PROVIDER_DEFAULTS = {
  minimax: {
    keyName: "MINIMAX_API_KEY",
    baseName: "MINIMAX_BASE_URL",
    defaultBase: "https://api.minimax.cn",
    title: "MiniMax \u5B98\u65B9"
  },
  duoyuanx: {
    keyName: "DUOYUANX_API_KEY",
    baseName: "DUOYUANX_BASE_URL",
    defaultBase: "https://duoyuanx.com",
    title: "\u591A\u5143\u4EA4\u53C9"
  },
  openai: {
    keyName: "OPENAI_API_KEY",
    baseName: "OPENAI_BASE_URL",
    defaultBase: "https://api.openai.com",
    title: "OpenAI \u5B98\u65B9"
  },
  siliconflow: {
    keyName: "SILICONFLOW_API_KEY",
    baseName: "SILICONFLOW_BASE_URL",
    defaultBase: "https://api.siliconflow.cn",
    title: "\u7845\u57FA\u6D41\u52A8"
  },
  deepseek: {
    keyName: "DEEPSEEK_API_KEY",
    baseName: "DEEPSEEK_BASE_URL",
    defaultBase: "https://api.deepseek.com",
    title: "DeepSeek \u5B98\u65B9"
  },
  custom: {
    keyName: "CUSTOM_API_KEY",
    baseName: "CUSTOM_BASE_URL",
    defaultBase: "",
    title: "\u81EA\u5B9A\u4E49\u4E0A\u6E38"
  }
};
async function resolveProviderConfig(env, provider = "duoyuanx") {
  const normProvider = String(provider || "duoyuanx").toLowerCase();
  const meta = PROVIDER_DEFAULTS[normProvider] || PROVIDER_DEFAULTS.duoyuanx;
  let apiKey = null;
  let baseUrl = null;
  if (env.DB) {
    try {
      apiKey = await getSystemConfig(env.DB, meta.keyName);
      baseUrl = await getSystemConfig(env.DB, meta.baseName);
    } catch {
    }
  }
  apiKey = apiKey && apiKey.trim() || env[meta.keyName] || "";
  baseUrl = baseUrl && baseUrl.trim() || env[meta.baseName] || meta.defaultBase || "";
  if (!apiKey && normProvider !== "minimax" && env.DUOYUANX_API_KEY) {
    apiKey = env.DUOYUANX_API_KEY;
    baseUrl = baseUrl !== meta.defaultBase && baseUrl ? baseUrl : env.DUOYUANX_BASE_URL || "https://duoyuanx.com";
  }
  return {
    provider: normProvider,
    title: meta.title,
    apiKey: apiKey.trim(),
    baseUrl: baseUrl.replace(/\/+$/, "")
  };
}
__name(resolveProviderConfig, "resolveProviderConfig");
function buildMiniMaxContent(body) {
  if (Array.isArray(body.content) && body.content.length > 0) {
    return body.content;
  }
  const prompt = body.prompt || "";
  const content = [{ type: "text", text: prompt }];
  if (Array.isArray(body.references)) {
    for (const ref of body.references) {
      const rawType = ref.type || "image/jpeg";
      const kind = rawType.split("/")[0];
      const url = ref.contentUrl || ref.url;
      if (!url) continue;
      if (kind === "video") {
        content.push({
          type: "video_url",
          video_url: { url },
          role: ref.role || "reference_video"
        });
      } else if (kind === "audio") {
        content.push({
          type: "audio_url",
          audio_url: { url },
          role: ref.role || "reference_audio"
        });
      } else {
        content.push({
          type: "image_url",
          image_url: { url },
          role: ref.role || "reference_image"
        });
      }
    }
  }
  return content;
}
__name(buildMiniMaxContent, "buildMiniMaxContent");
async function proxyGeneration({ body, env, provider = null, route = null, queryRoute = null }) {
  const modelId = body.model || body.modelId || "flux-schnell";
  let targetProvider = provider;
  if (!targetProvider) {
    if (modelId === "MiniMax-H3" || modelId.toLowerCase().includes("minimax")) {
      targetProvider = "minimax";
    } else {
      targetProvider = "duoyuanx";
    }
  }
  const { apiKey, baseUrl, title } = await resolveProviderConfig(env, targetProvider);
  if (!apiKey) {
    throw Object.assign(
      new Error(`\u670D\u52A1\u7AEF\u672A\u914D\u7F6E ${title} API \u5BC6\u94A5 (${PROVIDER_DEFAULTS[targetProvider]?.keyName || "API_KEY"})\uFF0C\u8BF7\u5728\u540E\u53F0\u914D\u7F6E`),
      { status: 500 }
    );
  }
  const isVideo = body.kind === "video" || body.duration !== void 0 && Number(body.duration) > 0 || ["t2v", "i2v", "fl", "v2v"].includes(body.videoMode);
  let targetRoute = route;
  if (!targetRoute) {
    if (targetProvider === "minimax" || modelId === "MiniMax-H3") {
      targetRoute = "/v2/video_generation";
    } else if (isVideo) {
      targetRoute = "/v1/videos";
    } else {
      targetRoute = "/v1/images/generations";
    }
  }
  const endpoint = `${baseUrl}${targetRoute.startsWith("/") ? targetRoute : "/" + targetRoute}`;
  if (targetProvider === "minimax") {
    const payload = {
      model: modelId,
      content: buildMiniMaxContent(body),
      duration: body.duration || 5,
      resolution: body.resolution || "720P",
      ratio: body.ratio || "16:9",
      aigc_watermark: body.aigc_watermark !== void 0 ? body.aigc_watermark : false
    };
    const upstreamRes2 = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    const data2 = await upstreamRes2.json().catch(() => ({}));
    if (!upstreamRes2.ok || data2.base_resp && data2.base_resp.status_code !== 0) {
      const errMsg = data2.base_resp?.status_msg || data2.error?.message || data2.message || `MiniMax \u5B98\u65B9\u63A5\u53E3\u9519\u8BEF (${upstreamRes2.status})`;
      throw Object.assign(new Error(errMsg), { status: upstreamRes2.status || 400 });
    }
    const taskId = data2.task_id || data2.taskId || "";
    return {
      task_id: taskId,
      taskId,
      status: "processing",
      provider: "minimax-official",
      route: targetRoute,
      base_resp: data2.base_resp,
      upstream: data2
    };
  }
  const upstreamRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const data = await upstreamRes.json().catch(() => ({}));
  if (!upstreamRes.ok) {
    throw Object.assign(
      new Error(data.error?.message || data.error || data.message || `\u4E0A\u6E38\u751F\u6210\u63A5\u53E3\u9519\u8BEF (${upstreamRes.status})`),
      { status: upstreamRes.status }
    );
  }
  return {
    ...data,
    route: targetRoute
  };
}
__name(proxyGeneration, "proxyGeneration");

// ../../apps/cloudflare-worker/src/image-job-core.mjs
async function putLarge(storage, key, value) {
  const text = JSON.stringify(value), chunks = Math.ceil(text.length / 32e3);
  await storage.transaction(async (tx) => {
    for (let i = 0; i < chunks; i++) await tx.put(key + ":" + i, text.slice(i * 32e3, (i + 1) * 32e3));
    await tx.put(key + ":chunks", chunks);
  });
}
__name(putLarge, "putLarge");
async function getLarge(storage, key) {
  return storage.transaction(async (tx) => {
    const count = await tx.get(key + ":chunks");
    if (count === void 0) return null;
    let text = "";
    for (let i = 0; i < count; i++) text += await tx.get(key + ":" + i);
    return JSON.parse(text);
  });
}
__name(getLarge, "getLarge");
var ImageJobCore = class {
  static {
    __name(this, "ImageJobCore");
  }
  constructor(ctx, env, deps = {}) {
    this.ctx = ctx;
    this.env = env;
    this.generate = deps.generate || proxyGeneration;
    this.price = deps.price || calculateQuotaCost;
    this.deduct = deps.deduct || deductUserQuota;
  }
  async enqueue(job) {
    if (this.enqueuing) return this.enqueuing;
    this.enqueuing = this.initialize(job);
    try {
      return await this.enqueuing;
    } finally {
      this.enqueuing = null;
    }
  }
  async initialize(job) {
    const existing = await this.ctx.storage.get("job");
    if (existing) {
      if (existing.fingerprint !== job.fingerprint) throw Error("\u4EFB\u52A1\u53C2\u6570\u51B2\u7A81");
      if (existing.state === "queued" && await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + 10);
      return this.receipt();
    }
    await putLarge(this.ctx.storage, "input", job.input);
    await putLarge(this.ctx.storage, "receipt", job.task);
    const { input, task, ...meta } = job;
    await this.ctx.storage.put("job", { ...meta, next: 0, state: "queued" });
    await this.ctx.storage.setAlarm(Date.now() + 10);
    return job.task;
  }
  async receipt() {
    return getLarge(this.ctx.storage, "receipt");
  }
  async save(task, job) {
    await putLarge(this.ctx.storage, "receipt", task);
    const index = { ...task, upstreams: [], resultCount: task.upstreams.length, executor: "durable-object" };
    try {
      await this.env.DB.prepare("UPDATE generation_receipts SET task_json = ?, updated_at = ? WHERE user_id = ? AND request_id = ?").bind(JSON.stringify(index), Date.now(), job.userId, task.id).run();
    } catch {
      console.error(JSON.stringify({ event: "image_receipt_index_failed", requestId: task.id }));
    }
  }
  async alarm() {
    const storage = this.ctx.storage, job = await storage.get("job");
    if (!job || job.state === "done") return;
    const task = await this.receipt();
    if (["completed", "partial", "failed", "unknown"].includes(task.status)) {
      await storage.put("job", { ...job, state: "done" });
      return;
    }
    if (job.state === "submitting") {
      task.status = "unknown";
      task.submissionUnknown = true;
      task.pollError = "\u4E0A\u6B21\u63D0\u4EA4\u540E\u6267\u884C\u4E2D\u65AD\uFF0C\u672A\u81EA\u52A8\u91CD\u53D1\uFF0C\u5DF2\u4FDD\u7559\u73B0\u6709\u7ED3\u679C";
      task.revision++;
      await this.save(task, job);
      await storage.put("job", { ...job, state: "done" });
      return;
    }
    const input = await getLarge(storage, "input"), n = input.n;
    const batch = input;
    job.state = "submitting";
    await storage.put("job", job);
    await storage.setAlarm(Date.now() + 12 * 60 * 1e3);
    let items;
    try {
      const output = await this.generate({ body: batch, env: this.env, provider: job.provider, route: job.route });
      items = Array.isArray(output.data) ? output.data.filter((item) => item?.url || item?.b64_json) : [];
    } catch (error) {
      task.status = error.status >= 400 && error.status < 500 ? task.upstreams.length ? "partial" : "failed" : "unknown";
      task.submissionUnknown = task.status === "unknown";
      task.pollError = error.message;
      task.revision++;
      if (!task.upstreams.length && task.status === "failed") task.upstreams.push({ ok: false, error: error.message });
      await this.save(task, job);
      await storage.put("job", { ...job, state: "done" });
      return;
    }
    task.upstreams.push(...items.map((item) => ({ ok: true, upstream: item })));
    task.revision++;
    const received = task.upstreams.length;
    task.status = items.length === n ? "completed" : received ? "partial" : "unknown";
    if (items.length !== n) {
      task.submissionUnknown = !received;
      task.pollError = `\u672C\u6279\u8BF7\u6C42 ${n} \u5F20\uFF0C\u8FD4\u56DE ${items.length} \u5F20\uFF1B\u6574\u5957\u5DF2\u6536\u5230 ${received}/${input.n} \u5F20\uFF0C\u672A\u81EA\u52A8\u8865\u53D1`;
    }
    await this.save(task, job);
    try {
      if (items.length) {
        const cost = await this.price(this.env.DB, { modelId: input.model, kind: "image", count: items.length });
        await this.deduct(this.env.DB, job.userId, cost, { resourceType: "generation", modelId: input.model, requestId: task.id + "-" + job.next });
      }
    } catch {
      task.pollError = (task.pollError ? task.pollError + "\uFF1B" : "") + "\u56FE\u7247\u5DF2\u4FDD\u5B58\uFF0C\u79EF\u5206\u8BB0\u8D26\u5F85\u6838\u5BF9";
      task.revision++;
      await this.save(task, job);
    }
    job.state = "done";
    await storage.put("job", job);
  }
};

// image-job-worker.mjs
var MockImageJob = class extends DurableObject {
  static {
    __name(this, "MockImageJob");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.core = new ImageJobCore(ctx, { DB: { prepare() {
      return { bind() {
        return this;
      }, async run() {
        return {};
      } };
    } } }, { generate: /* @__PURE__ */ __name(async ({ body }) => ({ data: Array.from({ length: body.n }, (_, i) => ({ url: "https://mock.invalid/image-" + i + ".png" })) }), "generate"), price: /* @__PURE__ */ __name(async () => 4, "price"), deduct: /* @__PURE__ */ __name(async () => {
    }, "deduct") });
  }
  enqueue(job) {
    return this.core.enqueue(job);
  }
  receipt() {
    return this.core.receipt();
  }
  alarm() {
    return this.core.alarm();
  }
};
var image_job_worker_default = { async fetch(request, env) {
  const job = env.IMAGE_JOBS.getByName("mock-only-4");
  if (request.method === "POST") return Response.json(await job.enqueue({ input: { model: "gpt-image-2", n: 4, prompt: "test" }, task: { id: "mock-only-4", status: "running", revision: 1, upstreams: [] }, userId: "test", fingerprint: "mock" }));
  return Response.json(await job.receipt());
} };

// C:/Users/强哥/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/强哥/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-90tV6l/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = image_job_worker_default;

// C:/Users/强哥/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-90tV6l/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  MockImageJob,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=image-job-worker.js.map
