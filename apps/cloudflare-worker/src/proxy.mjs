/**
 * Upstream API Proxying for Cloudflare Workers
 * Dynamically resolves API keys and Base URLs per provider from D1 system_configs or fallback Secrets.
 * Supported providers:
 *   - minimax: MiniMax Official (https://api.minimax.cn) for MiniMax-H3 video generation & queries
 *   - duoyuanx: Duoyuanx Relay (https://duoyuanx.com)
 *   - openai: OpenAI Official (https://api.openai.com)
 *   - siliconflow: SiliconFlow (https://api.siliconflow.cn)
 *   - deepseek: DeepSeek Official (https://api.deepseek.com)
 *   - custom: Custom OneAPI / NewAPI / Relay
 */
import { getSystemConfig } from './billing.mjs';

const PROVIDER_DEFAULTS = {
  minimax: {
    keyName: 'MINIMAX_API_KEY',
    baseName: 'MINIMAX_BASE_URL',
    defaultBase: 'https://api.minimax.cn',
    title: 'MiniMax 官方'
  },
  duoyuanx: {
    keyName: 'DUOYUANX_API_KEY',
    baseName: 'DUOYUANX_BASE_URL',
    defaultBase: 'https://duoyuanx.com',
    title: '多元交叉'
  },
  openai: {
    keyName: 'OPENAI_API_KEY',
    baseName: 'OPENAI_BASE_URL',
    defaultBase: 'https://api.openai.com',
    title: 'OpenAI 官方'
  },
  siliconflow: {
    keyName: 'SILICONFLOW_API_KEY',
    baseName: 'SILICONFLOW_BASE_URL',
    defaultBase: 'https://api.siliconflow.cn',
    title: '硅基流动'
  },
  deepseek: {
    keyName: 'DEEPSEEK_API_KEY',
    baseName: 'DEEPSEEK_BASE_URL',
    defaultBase: 'https://api.deepseek.com',
    title: 'DeepSeek 官方'
  },
  custom: {
    keyName: 'CUSTOM_API_KEY',
    baseName: 'CUSTOM_BASE_URL',
    defaultBase: '',
    title: '自定义上游'
  }
};

/**
 * Resolve provider API Key and Base URL from D1 system_configs or Worker env secrets
 */
export async function resolveProviderConfig(env, provider = 'duoyuanx') {
  const normProvider = String(provider || 'duoyuanx').toLowerCase();
  const meta = PROVIDER_DEFAULTS[normProvider] || PROVIDER_DEFAULTS.duoyuanx;

  let apiKey = null;
  let baseUrl = null;

  if (env.DB) {
    try {
      apiKey = await getSystemConfig(env.DB, meta.keyName);
      baseUrl = await getSystemConfig(env.DB, meta.baseName);
    } catch {}
  }

  // Fallback to Worker Environment Secrets
  apiKey = (apiKey && apiKey.trim()) || env[meta.keyName] || '';
  baseUrl = (baseUrl && baseUrl.trim()) || env[meta.baseName] || meta.defaultBase || '';

  // Secondary fallback for general models: if specific key missing, try DUOYUANX_API_KEY if applicable
  if (!apiKey && normProvider !== 'minimax' && env.DUOYUANX_API_KEY) {
    apiKey = env.DUOYUANX_API_KEY;
    baseUrl = (baseUrl !== meta.defaultBase && baseUrl) ? baseUrl : (env.DUOYUANX_BASE_URL || 'https://duoyuanx.com');
  }

  return {
    provider: normProvider,
    title: meta.title,
    apiKey: apiKey.trim(),
    baseUrl: baseUrl.replace(/\/+$/, '')
  };
}

/**
 * Build MiniMax official content array for video generation
 */
function buildMiniMaxContent(body) {
  if (Array.isArray(body.content) && body.content.length > 0) {
    return body.content;
  }

  const prompt = body.prompt || '';
  const content = [{ type: 'text', text: prompt }];

  if (Array.isArray(body.references)) {
    for (const ref of body.references) {
      const rawType = ref.type || 'image/jpeg';
      const kind = rawType.split('/')[0];
      const url = ref.contentUrl || ref.url;
      if (!url) continue;

      if (kind === 'video') {
        content.push({
          type: 'video_url',
          video_url: { url },
          role: ref.role || 'reference_video'
        });
      } else if (kind === 'audio') {
        content.push({
          type: 'audio_url',
          audio_url: { url },
          role: ref.role || 'reference_audio'
        });
      } else {
        content.push({
          type: 'image_url',
          image_url: { url },
          role: ref.role || 'reference_image'
        });
      }
    }
  }

  return content;
}

/**
 * Proxy video or image generation to upstream provider
 */
export async function proxyGeneration({ body, env, provider = null, route = null, queryRoute = null }) {
  const modelId = body.model || body.modelId || 'flux-schnell';
  
  // Auto-detect provider if not explicitly given
  let targetProvider = provider;
  if (!targetProvider) {
    if (modelId === 'MiniMax-H3' || modelId.toLowerCase().includes('minimax')) {
      targetProvider = 'minimax';
    } else {
      targetProvider = 'duoyuanx';
    }
  }

  const { apiKey, baseUrl, title } = await resolveProviderConfig(env, targetProvider);

  if (!apiKey) {
    throw Object.assign(
      new Error(`服务端未配置 ${title} API 密钥 (${PROVIDER_DEFAULTS[targetProvider]?.keyName || 'API_KEY'})，请在后台配置`),
      { status: 500 }
    );
  }

  const isVideo = body.kind === 'video' || (body.duration !== undefined && Number(body.duration) > 0) || ['t2v', 'i2v', 'fl', 'v2v'].includes(body.videoMode);

  // Determine upstream route for this specific model
  let targetRoute = route;
  if (!targetRoute) {
    if (targetProvider === 'minimax' || modelId === 'MiniMax-H3') {
      targetRoute = '/v2/video_generation';
    } else if (isVideo) {
      targetRoute = '/v1/videos';
    } else {
      targetRoute = '/v1/images/generations';
    }
  }
  const endpoint = `${baseUrl}${targetRoute.startsWith('/') ? targetRoute : '/' + targetRoute}`;

  // 1. MiniMax Official Protocol
  if (targetProvider === 'minimax') {
    const payload = {
      model: modelId,
      content: buildMiniMaxContent(body),
      duration: body.duration || 5,
      resolution: body.resolution || '720P',
      ratio: body.ratio || '16:9',
      aigc_watermark: body.aigc_watermark !== undefined ? body.aigc_watermark : false
    };

    const upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await upstreamRes.json().catch(() => ({}));
    if (!upstreamRes.ok || (data.base_resp && data.base_resp.status_code !== 0)) {
      const errMsg = data.base_resp?.status_msg || data.error?.message || data.message || `MiniMax 官方接口错误 (${upstreamRes.status})`;
      throw Object.assign(new Error(errMsg), { status: upstreamRes.status || 400 });
    }

    const taskId = data.task_id || data.taskId || '';
    return {
      task_id: taskId,
      taskId,
      status: 'processing',
      provider: 'minimax-official',
      route: targetRoute,
      base_resp: data.base_resp,
      upstream: data
    };
  }

  // 2. Duoyuanx / OpenAI / SiliconFlow / Custom Protocol
  const upstreamRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await upstreamRes.json().catch(() => ({}));
  if (!upstreamRes.ok) {
    throw Object.assign(
      new Error(data.error?.message || data.error || data.message || `上游生成接口错误 (${upstreamRes.status})`),
      { status: upstreamRes.status }
    );
  }

  return {
    ...data,
    route: targetRoute
  };
}

/**
 * Proxy task query (e.g. video polling) to upstream provider
 */
export async function proxyQueryTask({ taskId, provider = 'minimax', queryRoute = null, env }) {
  const normProvider = String(provider || 'minimax').toLowerCase();
  const { apiKey, baseUrl, title } = await resolveProviderConfig(env, normProvider);

  if (!apiKey) {
    throw Object.assign(new Error(`未配置 ${title} API 密钥`), { status: 500 });
  }

  // Determine query endpoint
  let targetQueryRoute = queryRoute;
  if (!targetQueryRoute) {
    if (normProvider === 'minimax') {
      targetQueryRoute = '/v2/query/video_generation/{task_id}';
    } else {
      targetQueryRoute = '/v1/videos/{task_id}';
    }
  }

  const queryPath = targetQueryRoute
    .replace('{task_id}', encodeURIComponent(taskId))
    .replace('{taskId}', encodeURIComponent(taskId));
  const endpoint = `${baseUrl}${queryPath.startsWith('/') ? queryPath : '/' + queryPath}`;

  const upstreamRes = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  const data = await upstreamRes.json().catch(() => ({}));
  if (!upstreamRes.ok) {
    const errMsg = data.base_resp?.status_msg || data.error?.message || data.message || `查询任务状态失败 (${upstreamRes.status})`;
    throw Object.assign(new Error(errMsg), { status: upstreamRes.status });
  }

  if (normProvider === 'minimax') {
    // MiniMax returns { task: { id, status: 'succeeded'|'running'|'failed', content: { url } }, file_id }
    const rawStatus = (data.task?.status || data.status || '').toLowerCase();
    const isSuccess = rawStatus === 'succeeded' || rawStatus === 'success';
    const isFailed = rawStatus === 'failed' || rawStatus === 'fail';
    const url = data.task?.content?.url || data.file_url || data.download_url || null;

    return {
      ok: true,
      taskId,
      status: isSuccess ? 'succeeded' : isFailed ? 'failed' : 'processing',
      url,
      provider: 'minimax-official',
      route: targetQueryRoute,
      upstream: data
    };
  }

  return {
    ok: true,
    taskId,
    status: data.status || 'processing',
    url: data.url || data.output_url || (data.data && data.data[0]?.url) || null,
    provider: normProvider,
    route: targetQueryRoute,
    upstream: data
  };
}

export const STANDARD_ZORA_AGENT_IDENTITY = '我是zora agent，我可以帮你回答问题、解释概念、写作、翻译、编程、制作图片和视频以及一起分析和解决问题。你想进行什么工作？';

export function isIdentityQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim().toLowerCase();
  const patterns = [
    /^(你|您)?是(谁|什么|哪位|哪个ai|什么ai|什么模型|哪个模型)(呢|呀|阿|啊|啦|\?|？|！|!|，|,|\.|\s)*$/i,
    /(你|您)(是|叫|基于|用的?(是)?)(什么|哪个|哪款|哪家|谁家的?)(模型|ai|大模型|语言模型|架构|名字|称呼)/i,
    /(你|您)(的?(底[层座]|基[础座]|原始)?(模型|名字|称呼)(是|叫)?(什么|哪[个款]|谁))/i,
    /(介绍|说明|讲讲)?(一下)?(你|您)(自己|的身份|是谁|的名字)/i,
    /(你|您)?是(gpt|chatgpt|openai|claude|deepseek|minimax|文心|通义|kimi|豆包|llama)/i,
    /(模型|身份)等?相关问题/i,
    /^(你是谁|你叫什么|你是哪位|你是哪家|你哪位|谁开发了你|你谁啊|你是什么)/i
  ];
  return patterns.some(p => p.test(t));
}

export function sanitizeAgentReply(userText, reply) {
  if (isIdentityQuestion(userText)) {
    return STANDARD_ZORA_AGENT_IDENTITY;
  }
  if (!reply || typeof reply !== 'string') return reply;
  if (/(chatgpt|openai|由\s*openai|anthropic|claude|deepseek|我是.*(?:人工智能助手|语言模型))/i.test(reply)) {
    return STANDARD_ZORA_AGENT_IDENTITY;
  }
  return reply;
}

/**
 * Proxy chat completion to upstream LLM
 */
export async function proxyChat({ body, env, provider = null, route = null }) {
  const modelId = body.modelId || body.model || 'gpt-5.5';

  const userQuery = Array.isArray(body.messages)
    ? [...body.messages].reverse().find(m => m.role === 'user')?.content
    : String(body.message || '');

  // Intercept identity questions directly to enforce unified Zora Agent identity
  if (isIdentityQuestion(userQuery)) {
    return {
      conversationId: body.conversationId || `conv-${Date.now()}`,
      reply: STANDARD_ZORA_AGENT_IDENTITY,
      provider: 'zora',
      upstream: { model: modelId, choices: [{ message: { role: 'assistant', content: STANDARD_ZORA_AGENT_IDENTITY } }] }
    };
  }

  // Determine provider if not provided
  let targetProvider = provider;
  if (!targetProvider) {
    if (modelId.startsWith('deepseek')) targetProvider = 'deepseek';
    else if (modelId.startsWith('gpt')) targetProvider = 'openai';
    else targetProvider = 'duoyuanx';
  }

  const { apiKey, baseUrl, title } = await resolveProviderConfig(env, targetProvider);

  if (!apiKey) {
    throw Object.assign(
      new Error(`服务端未配置 ${title} API 密钥 (${PROVIDER_DEFAULTS[targetProvider]?.keyName || 'API_KEY'})，请在后台配置`),
      { status: 500 }
    );
  }

  const targetRoute = route || '/v1/chat/completions';
  const endpoint = `${baseUrl}${targetRoute.startsWith('/') ? targetRoute : '/' + targetRoute}`;
  let messages = Array.isArray(body.messages)
    ? [...body.messages]
    : [{ role: 'user', content: String(body.message || '') }];

  const systemIdentityRule = '你是zora agent。当用户问及你的模型身份、你是谁、基于什么模型或哪个底层AI等相关问题时，只能回答：“我是zora agent，我可以帮你回答问题、解释概念、写作、翻译、编程、制作图片和视频以及一起分析和解决问题。你想进行什么工作？”，严禁透露任何第三方厂商或底层模型信息。';
  const hasSystem = messages.some(m => m.role === 'system');
  if (hasSystem) {
    messages = messages.map(m => m.role === 'system' ? { ...m, content: `${systemIdentityRule}\n${m.content}` } : m);
  } else {
    messages.unshift({ role: 'system', content: systemIdentityRule });
  }

  const payload = {
    model: modelId,
    messages,
    stream: false,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {})
  };

  const upstreamRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await upstreamRes.json().catch(() => ({}));
  if (!upstreamRes.ok) {
    throw Object.assign(
      new Error(data.error?.message || data.error || `上游对话接口错误 (${upstreamRes.status})`),
      { status: upstreamRes.status }
    );
  }

  let reply = data.choices?.[0]?.message?.content || '(无回复)';
  reply = sanitizeAgentReply(userQuery, reply);

  return {
    conversationId: body.conversationId || `conv-${Date.now()}`,
    reply,
    provider: targetProvider,
    upstream: data
  };
}

/**
 * Test connectivity and API key validity for a given provider
 */
export async function testProviderConnectivity({ provider, apiKey = null, baseUrl = null, env }) {
  const normProvider = String(provider || 'duoyuanx').toLowerCase();
  const resolved = await resolveProviderConfig(env, normProvider);

  const effectiveKey = (apiKey != null && String(apiKey).trim()) ? String(apiKey).trim() : resolved.apiKey;
  const effectiveBase = (baseUrl != null && String(baseUrl).trim()) ? String(baseUrl).trim().replace(/\/+$/, '') : resolved.baseUrl;

  if (!effectiveKey) {
    return {
      ok: false,
      provider: normProvider,
      title: resolved.title,
      baseUrl: effectiveBase,
      status: 400,
      latency: 0,
      error: `未配置或未提供 ${resolved.title} API 密钥`
    };
  }

  let probeUrl = `${effectiveBase}/v1/models`;
  if (normProvider === 'deepseek') {
    probeUrl = `${effectiveBase}/models`;
  } else if (normProvider === 'minimax') {
    probeUrl = `${effectiveBase}/v1/models`;
  }

  const startTime = Date.now();
  try {
    const res = await fetch(probeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${effectiveKey}`,
        'Accept': 'application/json'
      },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });

    const latency = Date.now() - startTime;
    const isSuccess = res.status >= 200 && res.status < 300;
    const body = await res.json().catch(() => ({}));

    if (isSuccess) {
      return {
        ok: true,
        provider: normProvider,
        title: resolved.title,
        baseUrl: effectiveBase,
        status: res.status,
        latency,
        modelCount: Array.isArray(body.data) ? body.data.length : (Array.isArray(body.models) ? body.models.length : null)
      };
    } else {
      const errMsg = body.error?.message || body.message || `上游鉴权或服务响应 HTTP ${res.status}`;
      return {
        ok: false,
        provider: normProvider,
        title: resolved.title,
        baseUrl: effectiveBase,
        status: res.status,
        latency,
        error: errMsg
      };
    }
  } catch (err) {
    return {
      ok: false,
      provider: normProvider,
      title: resolved.title,
      baseUrl: effectiveBase,
      status: 504,
      latency: Date.now() - startTime,
      error: err.message || '网络连接超时或上游未响应'
    };
  }
}

