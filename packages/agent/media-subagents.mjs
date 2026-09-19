import { selectTaskSkills } from './skill-selection.mjs';
import { AGENT_TOOL_DEFS } from './tools.mjs';
import { getRouteCapabilities } from '../duoyuanx/route-capabilities.mjs';
import { buildMediaSubagentPrompt } from './prompts/media-subagent.mjs';

const childNames = new Set(['list_media_models', 'preview_task', 'submit_generation']);
const blockedMain = new Set(['preview_task', 'submit_generation', 'call_api']);

export const MAIN_AGENT_TOOL_DEFS = [
  ...AGENT_TOOL_DEFS.filter((t) => !blockedMain.has(t.name)),
  {
    type: 'function',
    name: 'delegate_media_task',
    description:
      '将图片或视频任务委派给对应专业子 Agent。仅需要媒体规划或生成时调用，普通对话不需要。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: ['image', 'video'] },
        task: {
          type: 'string',
          description: '完整任务与明确参数，保留用户限制；说明仅规划还是实际生成。',
        },
      },
      required: ['kind', 'task'],
    },
  },
];

export function createMediaDelegator({
  run,
  sharedRunner,
  mediaModels,
  modelId,
  conversationId,
  messageId,
  skills = [],
  images = [],
  context,
  generationTasks = [],
}) {
  let delegates = 0;
  let queue = Promise.resolve();

  const execute = async ({ kind, task }) => {
    const toolTrace = [];
    const before = new Set(generationTasks.map((t) => t.task.id));
    const roleInstructions = buildMediaSubagentPrompt(kind);
    const allowedModels = mediaModels
      .filter((m) => m.kind === kind)
      .map((m) => ({ ...m, routes: m.routes || getRouteCapabilities(m) }));

    const childRunner = async (name, args = {}) => {
      if (!childNames.has(name)) {
        return { ok: false, error: '此子 Agent 无权调用该工具' };
      }
      if (name === 'list_media_models') {
        return { models: allowedModels, count: allowedModels.length };
      }
      const selected = args.modelId || (kind === 'image' ? 'gpt-image-2' : 'MiniMax-H3');
      if (!allowedModels.some((m) => m.id === selected)) {
        return { ok: false, error: '模型不属于当前子 Agent 的媒体类型或不可用' };
      }
      const startedAt = Date.now();
      try {
        const result = await sharedRunner(name, { ...args, modelId: selected });
        toolTrace.push({
          name,
          args: { ...args, modelId: selected },
          result,
          startedAt,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } catch (e) {
        const result = { ok: false, error: String(e.message || e) };
        toolTrace.push({ name, args, result, startedAt, durationMs: Date.now() - startedAt });
        return result;
      }
    };

    let result;
    let error;
    try {
      result = await run(
        roleInstructions + '\n' + JSON.stringify({ task, context, models: allowedModels }),
        {
          modelId,
          ownerConversationId: conversationId,
          messageId,
          skills,
          roleInstructions,
          tools: AGENT_TOOL_DEFS.filter((t) => childNames.has(t.name)),
          toolRunner: childRunner,
          images,
          maxRounds: 4,
        },
      );
    } catch (e) {
      error = String(e.message || e);
    }

    const receipts = generationTasks.filter((t) => !before.has(t.task.id));
    if (!error && !receipts.length && !toolTrace.length && !(result?.tasks?.length)) {
      error = '子 Agent 未调用校验或生成工具，未提交任务；这不是上游生成失败';
    }

    return {
      ok: !error,
      status: receipts.length ? 'submitted' : error ? 'not_submitted' : 'planned',
      toolTrace,
      kind,
      reply: typeof result?.reply === 'string'
        ? result.reply
        : '子 Agent 回复未完成，请以实际任务状态为准',
      tasks: Array.isArray(result?.tasks) ? result.tasks : [],
      generationTasks: receipts,
      ...(error ? { error } : {}),
    };
  };

  return async (name, args = {}) => {
    if (name !== 'delegate_media_task') {
      if (blockedMain.has(name)) {
        return { ok: false, error: '媒体任务请使用 delegate_media_task 委派给图片或视频子 Agent' };
      }
      return sharedRunner(name, args);
    }

    if (!['image', 'video'].includes(args.kind)
      || typeof args.task !== 'string'
      || !args.task.trim()
      || args.task.length > 8000) {
      return { ok: false, error: '委派任务类型或内容无效' };
    }
    if (delegates >= 4) {
      return { ok: false, error: '本轮最多委派 4 个媒体子任务' };
    }

    delegates++;
    const pending = queue.then(() => execute(args));
    queue = pending.catch(() => {});
    return pending;
  };
}
