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

  const isVideo = body.duration !== undefined || body.videoMode !== undefined || body.kind === 'video';

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

/**
 * Proxy chat completion to upstream LLM
 */
export async function proxyChat({ body, env, provider = null, route = null }) {
  const modelId = body.modelId || body.model || 'gpt-5.5';

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
  const messages = Array.isArray(body.messages)
    ? body.messages
    : [{ role: 'user', content: String(body.message || '') }];

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

  const reply = data.choices?.[0]?.message?.content || '(无回复)';
  return {
    conversationId: body.conversationId || `conv-${Date.now()}`,
    reply,
    provider: targetProvider,
    upstream: data
  };
}

