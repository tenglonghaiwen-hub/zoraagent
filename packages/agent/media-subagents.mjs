import { AGENT_TOOL_DEFS } from './tools.mjs';
import { getRouteCapabilities } from '../duoyuanx/route-capabilities.mjs';
import { buildMediaSubagentPrompt } from './prompts/media-subagent.mjs';
import {firstEnabledMediaModel,resolveMediaModelMention,unmatchedExplicitModelRequest} from './media-model-choice.mjs';

const h3Names = new Set(['enhance_video_prompt','remix_video','query_h3_task']);
const childNames = new Set(['list_media_models', 'preview_task', 'submit_generation', 'preview_image_suite', 'submit_image_suite',...h3Names]);
const blockedMain = new Set(['preview_task', 'submit_generation', 'preview_image_suite', 'submit_image_suite', 'enhance_video_prompt','remix_video','call_api']);

// A fresh user command to generate takes precedence over planning-only wording
// carried into a delegation from an earlier turn.
export function alignDelegatedMediaTask(task, currentText) {
  const instruction = String(currentText || '').trim();
  if (!/^(?:(?:请|现在|立即|马上|直接|确认|继续|开始|正式|提交|执行)\s*)*(?:生成|制作|复刻)(?:视频|图片|照片|动画|任务)?[。！!\s]*$/u.test(instruction)) return task;
  const revised = task
    .replace(/仅做规划与提示词复核，不实际生成视频[。；;]?/gu, '')
    .replace(/不实际调用任何(?:视频|图片)?生成能力[，。；;]?/gu, '')
    .replace(/不提交生成任务[，。；;]?/gu, '')
    .replace(/不实际生成(?:视频|图片)?[，。；;]?/gu, '');
  return `当前用户明确要求实际生成：${instruction}。先调用 preview_task 校验，再调用 submit_generation 提交一次；保留以下素材职责和约束，不沿用旧轮次的仅规划限制。\n${revised.trim()}`;
}

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
  mediaModels = [],
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
    const allowedModels = mediaModels
      .filter((m) => m.kind === kind && m.enabled !== false && m.available !== false)
      .map((m) => ({ ...m, routes: m.routes || getRouteCapabilities(m) }));
    const currentText = context?.history?.at(-1)?.text || '';
    const unmatched=unmatchedExplicitModelRequest(currentText,mediaModels);
    if(unmatched)return {ok:false,status:'not_submitted',kind,toolTrace,generationTasks:[],error:`指定模型 ${unmatched} 不在当前模型目录中，请检查模型 ID 或启用状态`};
    const currentChoice = resolveMediaModelMention(currentText,mediaModels);
    const taskChoice = resolveMediaModelMention(task,mediaModels);
    const previousText = [...(context?.history||[])].reverse().find(item=>item.role==='user'&&item.text&&item.text!==currentText)?.text || '';
    const priorChoice = resolveMediaModelMention(previousText,mediaModels);
    const preferredModel=mediaModels.find(model=>model.id===context?.preferredModelId);
    const rememberedChoice=preferredModel?{model:preferredModel,explicit:true,ambiguous:false,excludedIds:[]}:null;
    const choice = currentChoice.explicit ? currentChoice : rememberedChoice || (priorChoice.explicit ? priorChoice : taskChoice);
    const unmatchedTask=unmatchedExplicitModelRequest(task,mediaModels);
    if(!currentChoice.explicit&&!rememberedChoice&&!priorChoice.explicit&&unmatchedTask)return {ok:false,status:'not_submitted',kind,toolTrace,generationTasks:[],error:`委派任务指定的模型 ${unmatchedTask} 不在当前模型目录中`};
    if(choice.ambiguous)return {ok:false,status:'not_submitted',kind,toolTrace,generationTasks:[],error:'指定的模型对应多个配置，请使用完整模型 ID'};
    if(choice.explicit&&choice.model?.kind!==kind)return {ok:false,status:'not_submitted',kind,toolTrace,generationTasks:[],error:'用户指定的模型与委派的媒体类型不一致'};
    if(choice.explicit&&(choice.model?.enabled===false||choice.model?.available===false))return {ok:false,status:'not_submitted',kind,toolTrace,generationTasks:[],error:`指定模型 ${choice.model.id} 未启用或不可用`};
    const defaultModel = choice.explicit ? allowedModels.find(model=>model.id===choice.model?.id) : firstEnabledMediaModel(allowedModels,kind,choice.excludedIds);
    if (!defaultModel) return {ok:false,status:'not_submitted',kind,toolTrace,generationTasks:[],error:`当前没有启用的${kind==='image'?'图片':'视频'}模型`};
    const roleInstructions = buildMediaSubagentPrompt(kind,defaultModel,choice.explicit);

    const childRunner = async (name, args = {}) => {
      if (!childNames.has(name)) {
        return { ok: false, error: '此子 Agent 无权调用该工具' };
      }
      if(kind!=='image'&&name.endsWith('_image_suite'))return {ok:false,error:'视频 Agent 不能提交整套图片'};
      if(kind!=='video'&&h3Names.has(name))return {ok:false,error:'H3 工具仅用于视频任务'};
      if (name === 'list_media_models') {
        return { models: allowedModels, count: allowedModels.length, defaultModelId: defaultModel.id };
      }
      const selected = args.modelId || defaultModel.id;
      if(choice.explicit&&selected!==defaultModel.id)return {ok:false,error:`用户已指定 ${defaultModel.id}，不能改用 ${selected}`};
      const selectedModel=allowedModels.find(m=>m.id===selected);
      if (!selectedModel) {
        return { ok: false, error: '模型不属于当前子 Agent 的媒体类型或不可用' };
      }
      if(h3Names.has(name)&&!String(selected).toLowerCase().includes('h3'))return {ok:false,error:'该模型不支持 H3 专用工具'};
      let toolArgs={...args,modelId:selected};
      if(name==='preview_task'||name==='submit_generation'){
        const operation=context?.references?.length?'reference':'generate';
        const route=selectedModel.routes.find(item=>item.operation===operation);
        if(!route)return {ok:false,error:`${selectedModel.name||selected} 未开放${operation==='reference'?'参考':'纯文字'}生成路由`};
        toolArgs={...toolArgs,operation,apiRoute:route.apiRoute};
      }
      const startedAt = Date.now();
      try {
        const result = await sharedRunner(name, toolArgs);
        toolTrace.push({
          name,
          args: toolArgs,
          result,
          startedAt,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } catch (e) {
        const result = { ok: false, error: String(e.message || e) };
        toolTrace.push({ name, args:toolArgs, result, startedAt, durationMs: Date.now() - startedAt });
        return result;
      }
    };

    const childContext={...context,history:(context?.history||[]).slice(0,-1)};
    const instruction=currentText&&currentText!==task?{userInstruction:currentText}:{};
    const alignedTask=alignDelegatedMediaTask(task,currentText);
    let result;
    let error;
    try {
      result = await run(
        roleInstructions + '\n' + JSON.stringify({ task:alignedTask,...instruction,context:childContext,models: allowedModels }),
        {
          modelId,
          ownerConversationId: conversationId,
          messageId,
          skills,
          roleInstructions,
          tools: AGENT_TOOL_DEFS.filter((t) => childNames.has(t.name)&&(!h3Names.has(t.name)||kind==='video'&&(!choice.explicit||String(defaultModel.id).toLowerCase().includes('h3')))),
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
