import {dataPath} from '../../packages/runtime-paths.mjs';
import {cloudAgentContext} from './cloud-agent-context.mjs';
import { getKernel, peekKernel, findCodex } from '../../packages/agent/codex-kernel.mjs';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getModel } from '../../packages/duoyuanx/catalog.mjs';

const defaults = JSON.parse(
  (await readFile(new URL('./config/agent.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''),
);
const runtime = process.env.ZORA_DATA_DIR ? dataPath('agent-runtime') : fileURLToPath(new URL('../../runtime/agent/', import.meta.url));

// Bound the gateway reservation for every Agent round, including tool follow-ups.
const AGENT_OUTPUT_TOKEN_LIMIT = 4096;
const isQuotaError = (message) =>
  /预扣|余额|额度不足|insufficient.*(?:quota|balance)|quota.*exceed/i.test(message);

export const planSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'tasks'],
  properties: {
    reply: { type: 'string' },
    tasks: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['modelId', 'prompt', 'count', 'concurrency', 'ratio', 'resolution', 'duration'],
        properties: {
          modelId: { type: 'string' },
          prompt: { type: 'string' },
          count: { type: 'integer' },
          concurrency: { type: 'integer' },
          ratio: { type: 'string' },
          resolution: { type: 'string' },
          duration: { type: ['number', 'null'] },
        },
      },
    },
  },
};

function resolveKey(env = process.env) {
  if(cloudAgentContext.getStore())return cloudAgentContext.getStore().token;
  return env.ZORA_AGENT_API_KEY || env.DUOYUANX_API_KEY || '';
}

function resolveModel(env = process.env, override) {
  return override || env.ZORA_AGENT_MODEL || defaults.model;
}

function resolveBaseUrl(env = process.env) {
  if(cloudAgentContext.getStore())return cloudAgentContext.getStore().base;
  return env.ZORA_AGENT_BASE_URL || defaults.baseUrl;
}

function resolveBackend(env = process.env) {
  const forced = env.ZORA_AGENT_BACKEND || defaults.backend || 'responses';
  if (forced === 'app-server') return 'app-server';
  if (forced === 'cli' && env.ZORA_CODEX_BIN) return 'cli';
  return 'responses';
}

export function agentStatus(env = process.env) {
  const key = resolveKey(env);
  const baseUrl = resolveBaseUrl(env);
  const model = resolveModel(env);
  const enabled =
    env.ZORA_AGENT_ENABLED === 'true' ||
    (defaults.enabled === true && env.ZORA_AGENT_ENABLED !== 'false');
  const backend = resolveBackend(env);
  const configured = Boolean(key && baseUrl && model);
  return {
    configured,
    enabled,
    backend,
    provider: defaults.provider,
    model,
    baseUrl,
    wireApi: defaults.wireApi || 'responses',
    hasCodexBin: Boolean(env.ZORA_CODEX_BIN || findCodex()),
    foundation: backend === 'app-server' ? 'codex-app-server' : 'zora',
    kernel: peekKernel()?.status() || null,
  };
}

async function runViaResponses({
  prompt,
  modelId,
  tools,
  toolRunner,
  maxRounds = 4,
  images = [],
  roleInstructions,
}) {
  const status = agentStatus();
  if (!status.configured || !status.enabled) {
    throw Object.assign(Error('主 Agent 尚未配置或启用，请在后台完成服务配置'), { status: 503 });
  }
  const model = resolveModel(process.env, modelId);
  const key = resolveKey();
  const candidates = [];
  const primary = status.baseUrl;
  candidates.push(primary);
  const duoyuanx = (process.env.DUOYUANX_BASE_URL || 'https://duoyuanx.com').replace(/\/$/, '');
  if (!candidates.includes(duoyuanx)) candidates.push(duoyuanx);

  function toResponsesEndpoint(base) {
    const u = new URL(base);
    if (u.protocol !== 'https:' || u.username || u.password) throw Error('Invalid provider URL');
    const href = u.href.replace(/\/$/, '');
    // Codex proxy base already ends with /api/codex; standard gateway needs /v1/responses
    if (/\/api\/codex$/i.test(href)) return `${href}/v1/responses`;
    return `${href}/v1/responses`;
  }

  const userContent = [{ type: 'input_text', text: prompt }];
  for (const img of (images || []).slice(0, 6)) {
    if (!img?.url) continue;
    userContent.push({ type: 'input_image', image_url: img.url });
  }
  let input = [
    {
      role: 'user',
      content: userContent,
    },
  ];
  const toolTrace = [];
  const reasoningSummary = [];
  let last = null;

  for (let round = 0; round <= maxRounds; round++) {
    const body = {
      model,
      instructions:
        roleInstructions ||
        '你是造境 Zora 的主创作 Agent。用中文协作。可调用工具与技能，可调用图片/视频生成相关 API，并可阅读用户附带的参考图片内容。回复中不要提及具体模型名或协议/底层实现。最终必须给出符合 JSON schema 的 reply 与 tasks。',
      input,
      max_output_tokens: AGENT_OUTPUT_TOKEN_LIMIT,
      tools: tools?.length
        ? tools.map((t) => ({
            type: 'function',
            name: t.name,
            description: t.description,
            parameters: t.parameters,
            strict: false,
          }))
        : undefined,
      tool_choice: tools?.length && round < maxRounds ? 'auto' : 'none',
      text: {
        format: {
          type: 'json_schema',
          name: 'zora_agent_plan',
          strict: true,
          schema: planSchema,
        },
      },
    };

    let data = null;
    let res = null;
    let lastErr = null;
    for (const base of candidates) {
      const endpoint = toResponsesEndpoint(base);
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => ({}));
      if (res.ok) break;
      const err =
        data?.error?.message || data?.error || data?.message || `上游错误 ${res.status}`;
      lastErr = Object.assign(Error(String(err)), {
        status: res.status >= 400 && res.status < 600 ? res.status : 502,
        endpoint,
      });
      if (isQuotaError(String(err))) throw lastErr;
      // try next gateway on auth / not found
      if (![401, 403, 404].includes(res.status)) throw lastErr;
    }
    if (!res?.ok) throw lastErr || Error('Agent 上游不可用');

    last = data;
    const output = Array.isArray(data.output) ? data.output : [];
    for (const item of output) {
      if (item?.type === 'reasoning') {
        for (const part of item.summary || []) {
          if (part?.type === 'summary_text' && typeof part.text === 'string') {
            reasoningSummary.push(part.text.slice(0, 6000));
          }
        }
      }
    }
    const fnCalls = output.filter((o) => o?.type === 'function_call' || o?.type === 'tool_call');
    if (!fnCalls.length || !toolRunner || round >= maxRounds) {
      break;
    }

    // Append model output then tool results for next round
    input = [...input, ...output];
    for (const call of fnCalls) {
      const name = call.name || call.function?.name;
      let args = {};
      try {
        const raw = call.arguments || call.function?.arguments || '{}';
        args = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
      } catch {
        args = {};
      }
      const startedAt = Date.now();
      const result = await toolRunner(name, args);
      toolTrace.push({ name, args, result, startedAt, durationMs: Date.now() - startedAt });
      input.push({
        type: 'function_call_output',
        call_id: call.call_id || call.id,
        output: JSON.stringify(result).slice(0, 12000),
      });
    }
  }

  const parsed = extractPlan(last);
  return { ...parsed, toolTrace, reasoningSummary, backend: 'responses', model };
}

function extractPlan(data) {
  if (!data) throw Error('Agent 无响应');
  // Prefer structured output text
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part?.type === 'output_text' && part.text) {
          try {
            return JSON.parse(part.text);
          } catch {}
        }
        if (part?.type === 'text' && part.text) {
          try {
            return JSON.parse(part.text);
          } catch {}
        }
      }
    }
  }
  if (typeof data.output_text === 'string') {
    try {
      return JSON.parse(data.output_text);
    } catch {}
  }
  // Fallback: choices-style
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch {
      return { reply: content, tasks: [] };
    }
  }
  throw Error('Agent 输出无法解析为 JSON 方案');
}


async function runViaChatCompletions({
  prompt,
  modelId,
  tools,
  toolRunner,
  maxRounds = 4,
  images = [],
  roleInstructions,
}) {
  const status = agentStatus();
  if (!status.configured || !status.enabled) {
    throw Object.assign(Error('主 Agent 尚未配置或启用'), { status: 503 });
  }
  const base = (process.env.DUOYUANX_BASE_URL || 'https://duoyuanx.com').replace(/\/$/, '');
  const endpoint = `${base}/v1/chat/completions`;
  const model = resolveModel(process.env, modelId);
  const key = resolveKey();

  if (typeof prompt === 'string' && /^(你|您)?是(谁|什么|哪位|哪个ai|什么ai|什么模型|哪个模型)|(你|您)(是|叫|基于|用的?(是)?)(什么|哪个|哪款|哪家|谁家的?)(模型|ai|大模型)|(模型|身份)等?相关问题/i.test(prompt.trim())) {
    return {
      reply: '我是zora agent，我可以帮你回答问题、解释概念、写作、翻译、编程、制作图片和视频以及一起分析和解决问题。你想进行什么工作？',
      tasks: [],
      toolTrace: [],
      reasoningSummary: ['已核对模型身份与规范']
    };
  }

  const instructions =
    roleInstructions ||
    '你是造境 Zora 的主创作 Agent。用中文协作。当用户问及模型身份等相关问题时，只回答：“我是zora agent，我可以帮你回答问题、解释概念、写作、翻译、编程、制作图片和视频以及一起分析和解决问题。你想进行什么工作？”，严禁提及任何第三方模型名称或底层提供方。可调用工具与技能，可调用图片/视频生成相关 API，并可阅读用户附带的参考图片。最终必须只输出 JSON 对象，包含 reply(string) 与 tasks(array)。';

  const userContent = images?.length
    ? [
        { type: 'text', text: prompt },
        ...images.slice(0, 6).map((img) => ({ type: 'image_url', image_url: { url: img.url } })),
      ]
    : prompt;

  let messages = [
    { role: 'system', content: instructions },
    { role: 'user', content: userContent },
  ];
  const toolTrace = [];
  const reasoningSummary = [];
  const openaiTools = (tools || []).map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  let lastMessage = null;
  for (let round = 0; round <= maxRounds; round++) {
    const body = {
      model,
      messages,
      temperature: 0.4,
      max_tokens: AGENT_OUTPUT_TOKEN_LIMIT,
      tools: openaiTools.length && round < maxRounds ? openaiTools : undefined,
      tool_choice: openaiTools.length && round < maxRounds ? 'auto' : undefined,
      response_format: { type: 'json_object' },
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err =
        data?.error?.message || data?.error || data?.message || `上游错误 ${res.status}`;
      throw Object.assign(Error(String(err)), {
        status: res.status >= 400 && res.status < 600 ? res.status : 502,
      });
    }
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw Error('Agent 无响应');
    lastMessage = msg;
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (!calls.length || !toolRunner || round >= maxRounds) break;
    messages.push(msg);
    for (const call of calls) {
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {
        args = {};
      }
      const startedAt = Date.now();
      const result = await toolRunner(name, args);
      toolTrace.push({ name, args, result, startedAt, durationMs: Date.now() - startedAt });
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 12000),
      });
    }
  }

  const content =
    typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage?.content || '');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw Error('Agent 输出无法解析为 JSON 方案');
    parsed = JSON.parse(m[0]);
  }
  if (!parsed.tasks) parsed.tasks = [];
  return { ...parsed, toolTrace, reasoningSummary, backend: 'chat', model };
}

async function runViaCli(prompt) {
  const status = agentStatus();
  if (!status.configured || !status.enabled) {
    throw Object.assign(Error('主 Agent 尚未配置或启用，请在后台完成服务配置'), { status: 503 });
  }
  if (!process.env.ZORA_CODEX_BIN) throw Error('未配置 ZORA_CODEX_BIN');
  try {
    await access(process.env.ZORA_CODEX_BIN, fsConstants.X_OK);
  } catch {
    throw Error('Codex 二进制不可用，请改用 responses 后端或重装 @openai/codex');
  }
  const url = new URL(resolveBaseUrl());
  if (url.protocol !== 'https:' || url.username || url.password || url.search) {
    throw Error('Invalid provider URL');
  }

  await mkdir(runtime, { recursive: true });
  const dir = await mkdtemp(path.join(runtime, 'request-'));
  const home = path.join(dir, 'home');
  await mkdir(home);
  await writeFile(path.join(dir, 'schema.json'), JSON.stringify(planSchema));

  const args = [
    'exec',
    '--ignore-user-config',
    '--ignore-rules',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox', 'read-only',
    '--disable', 'shell_tool',
    '--disable', 'unified_exec',
    '--disable', 'shell_snapshot',
    '-c', 'approval_policy="never"',
    '-c', 'web_search="disabled"',
    '-c', 'model_provider="zora"',
    '-c', 'model_providers.zora.name="Zora backend"',
    '-c', 'model_providers.zora.wire_api="responses"',
    '-c', 'model_providers.zora.requires_openai_auth=false',
    '-c', 'model_providers.zora.env_key="ZORA_AGENT_API_KEY"',
    '-c', `model_providers.zora.base_url=${JSON.stringify(url.href)}`,
    '-m', resolveModel(),
    '--output-schema', path.join(dir, 'schema.json'),
    '-o', path.join(dir, 'result.json'),
    '--color', 'never',
    '-',
  ];

  const env = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    if (process.env[k]) env[k] = process.env[k];
  }
  Object.assign(env, {
    CODEX_HOME: home,
    ZORA_AGENT_API_KEY: resolveKey(),
  });

  await new Promise((resolve, reject) => {
    const child = spawn(process.env.ZORA_CODEX_BIN, args, {
      cwd: dir,
      env,
      windowsHide: true,
      shell: false,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let diagnostic = '';
    child.stderr.on('data', (chunk) => {
      diagnostic = (diagnostic + chunk.toString()).slice(-12000);
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 120000);
    child.on('error', () => {
      clearTimeout(timer);
      reject(Error('Codex 进程启动失败'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const safe = diagnostic
          .split(resolveKey())
          .join('[REDACTED]')
          .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
        writeFile(path.join(dir, 'diagnostic.txt'), safe).catch(() => {});
      }
      code === 0 && !timedOut
        ? resolve()
        : reject(Error(timedOut ? 'Agent 响应超时' : 'Codex 调用失败，请检查后台模型与凭据'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });

  const result = await readFile(path.join(dir, 'result.json'), 'utf8');
  if (result.length > 100000) throw Error('Agent 输出过大');
  return { ...JSON.parse(result), backend: 'cli', model: resolveModel() };
}

/**
 * @param {string} prompt
 * @param {{ modelId?: string, tools?: any[], toolRunner?: Function, maxRounds?: number }} [opts]
 */
function preferChatCompletions(modelId) {
  const m = getModel(modelId);
  if (!m) return false;
  if (m.route === '/v1/chat/completions') return true;
  if (m.family && /claude|gemini/i.test(m.family)) return true;
  return false;
}

function isResponsesUnsupportedError(err) {
  const msg = String(err?.message || err || '');
  return /not implemented|convert_request_failed|unsupported.*responses/i.test(msg);
}

export async function runCodex(prompt, opts = {}) {
  const backend = resolveBackend();

  if (backend === 'app-server') {
    const base = resolveBaseUrl().replace(/\/$/, '');
    return getKernel({
      base: base.endsWith('/v1') ? base : base + '/v1',
      key: resolveKey(),
      model: resolveModel(),
    }).run(prompt, { ...opts, outputSchema: planSchema });
  }

  if (backend === 'cli') return runViaCli(prompt);

  const args = {
    prompt,
    modelId: opts.modelId,
    tools: opts.tools,
    toolRunner: opts.toolRunner,
    maxRounds: opts.maxRounds ?? defaults.maxToolRounds ?? 4,
    images: opts.images || [],
    roleInstructions: opts.roleInstructions,
  };

  if (preferChatCompletions(opts.modelId)) {
    return runViaChatCompletions(args);
  }

  try {
    return await runViaResponses(args);
  } catch (err) {
    if (isQuotaError(String(err?.message || err))) throw err;
    if (isResponsesUnsupportedError(err)) {
      return runViaChatCompletions(args);
    }
    // Some models advertise responses but reject schema/tools — fall back once.
    if (err?.status === 500 || err?.status === 400) {
      try {
        return await runViaChatCompletions(args);
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

export async function startCodexKernel() {
  if (resolveBackend() !== 'app-server') return;
  if (!agentStatus().enabled || !agentStatus().configured) return;
  const base = resolveBaseUrl().replace(/\/$/, '');
  return getKernel({
    base: base.endsWith('/v1') ? base : base + '/v1',
    key: resolveKey(),
    model: resolveModel(),
  }).start();
}
