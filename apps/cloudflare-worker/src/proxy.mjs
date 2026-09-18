/**
 * Upstream API Proxying for Cloudflare Workers
 * Injects DUOYUANX_API_KEY dynamically from D1 system_configs or fallback Secret
 */
import { getSystemConfig } from './billing.mjs';

async function resolveUpstreamConfig(env) {
  let apiKey = null;
  let baseUrl = null;

  if (env.DB) {
    try {
      apiKey = await getSystemConfig(env.DB, 'DUOYUANX_API_KEY');
      baseUrl = await getSystemConfig(env.DB, 'DUOYUANX_BASE_URL');
    } catch {}
  }

  // Fallback to environment secrets
  apiKey = (apiKey && apiKey.trim()) || env.DUOYUANX_API_KEY || '';
  baseUrl = (baseUrl && baseUrl.trim()) || env.DUOYUANX_BASE_URL || 'https://duoyuanx.com';

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, '')
  };
}

/**
 * Proxy generation request to Duoyuanx API
 */
export async function proxyGeneration({ body, env }) {
  const { apiKey, baseUrl: base } = await resolveUpstreamConfig(env);

  if (!apiKey) {
    throw Object.assign(new Error('服务端未配置上游 API 密钥 (DUOYUANX_API_KEY)，请在后台或环境变量中配置'), { status: 500 });
  }

  // Determine upstream route based on model/kind
  const isVideo = body.duration !== undefined || body.videoMode !== undefined || body.kind === 'video';
  const endpoint = isVideo ? `${base}/v1/videos/generations` : `${base}/v1/images/generations`;

  const upstreamRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await upstreamRes.json().catch(() => ({}));
  if (!upstreamRes.ok) {
    throw Object.assign(
      new Error(data.error?.message || data.error || data.message || `上游生成接口错误 (${upstreamRes.status})`),
      { status: upstreamRes.status }
    );
  }

  return data;
}

/**
 * Proxy chat completion to upstream LLM
 */
export async function proxyChat({ body, env }) {
  const { apiKey, baseUrl: base } = await resolveUpstreamConfig(env);

  if (!apiKey) {
    throw Object.assign(new Error('服务端未配置上游 API 密钥 (DUOYUANX_API_KEY)，请在后台或环境变量中配置'), { status: 500 });
  }

  const endpoint = `${base}/v1/chat/completions`;
  const messages = Array.isArray(body.messages)
    ? body.messages
    : [{ role: 'user', content: String(body.message || '') }];

  const payload = {
    model: body.modelId || 'gpt-5.5',
    messages,
    stream: false,
  };

  const upstreamRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
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
    upstream: data,
  };
}
