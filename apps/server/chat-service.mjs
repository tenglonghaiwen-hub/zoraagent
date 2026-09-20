import {cloudAgentContext} from './cloud-agent-context.mjs';
import { selectTaskSkills } from '../../packages/agent/skill-selection.mjs';
import { randomUUID } from 'node:crypto';
import { validateDraft } from '../../packages/contracts/domain.mjs';
import { getModels } from '../../packages/duoyuanx/catalog.mjs';
import { runCodex, agentStatus } from './codex-agent.mjs';
import { createToolRunner } from '../../packages/agent/tools.mjs';
import {describeReferenceChange,REFERENCE_REVIEW_INSTRUCTION} from '../../packages/agent/reference-change.mjs';
import { MAIN_AGENT_TOOL_DEFS, createMediaDelegator } from '../../packages/agent/media-subagents.mjs';
import { getRouteCapabilities } from '../../packages/duoyuanx/route-capabilities.mjs';
import { createSessionStore } from '../../packages/agent/session-store.mjs';
import { analyzeVideoReferences } from '../../packages/agent/video-analysis.mjs';
import { transcribeAudioFiles } from '../../packages/agent/audio-transcription.mjs';
import { buildMainAgentPrompt } from '../../packages/agent/prompts/main-agent.mjs';

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
  return reply;
}

export function createChatService({
  run = runCodex,
  callApi,
  storageDirectory,
  analyzeVideos = analyzeVideoReferences,
  transcribeAudio = transcribeAudioFiles,
} = {}) {
  const sessionStore = createSessionStore({ directory: storageDirectory });
  const sessions = sessionStore.sessions;
  let busy = false;

  return async (input = {}) => {
    if (!input || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 8000) {
      throw Object.assign(Error('请填写 1–8000 字的需求'), { status: 400 });
    }

    if (isIdentityQuestion(input.message)) {
      return {
        conversationId: input.conversationId || `conv-${Date.now()}`,
        reply: STANDARD_ZORA_AGENT_IDENTITY,
        tasks: [],
        toolTrace: [],
        reasoningSummary: ['已核对模型身份与规范']
      };
    }

    const models = getModels();
    if (!models.some((m) => m.kind === 'agent')) {
      throw Object.assign(Error('Agent 模型未开放'), { status: 400 });
    }

    const status = agentStatus();
    if (!status.configured || !status.enabled) {
      throw Object.assign(Error('主 Agent 尚未配置或启用'), { status: 503 });
    }

    if (busy) {
      throw Object.assign(Error('Agent 正在处理另一条消息，请稍后重试'), { status: 409 });
    }

    let session = input.conversationId ? sessions.get(input.conversationId) : null;
    if (input.conversationId && !session && !cloudAgentContext.getStore()) {
      throw Object.assign(Error('对话已过期，请新建对话'), { status: 404 });
    }
    if (!session && sessions.size >= 100) {
      throw Object.assign(Error('会话数量已达上限，请重启开发服务'), { status: 503 });
    }

    session = session || { id: randomUUID(), history: cloudAgentContext.getStore() && Array.isArray(input.history) ? input.history.slice(-20).map(m=>({role:m.role==='assistant'?'assistant':'user',...(m.role==='assistant'?{reply:String(m.reply||'').slice(0,8000),tasks:[]}:{message:String(m.message||'').slice(0,8000)})})) : [] };

    if (input.references != null && (!Array.isArray(input.references) || input.references.length > 6)) {
      throw Object.assign(Error('参考素材最多 6 个'), { status: 400 });
    }
    if ((input.references || []).some((r) => !r || typeof r.contentUrl !== 'string' || !r.contentUrl)) {
      throw Object.assign(Error('参考素材未读取成功，请重新添加原始素材'), { status: 400 });
    }

    const references = Array.isArray(input.references)
      ? input.references.map((r) => ({
          name: String(r.name || '').slice(0, 200),
          type: String(r.type || '').slice(0, 80),
          reference: String(r.reference || '').slice(0, 40),
          // data URL / https URL for readable image content (videos keep metadata only in this slice)
          contentUrl: r.contentUrl,
        }))
      : [];

    let skills = Array.isArray(input.skills)
      ? input.skills.slice(0, 20).map((s) => ({
          id: String(s.id || '').slice(0, 80),
          name: String(s.name || '').slice(0, 80),
          category: String(s.category || '').slice(0, 40),
          description: String(s.description || '').slice(0, 240),
          prompt: String(s.prompt || '').slice(0, 4000),
        }))
      : [];

    skills = selectTaskSkills(input.message, skills);

    // Binary image data belongs only in the multimodal input, never in text history.
    const referenceReview=describeReferenceChange(references,session.history);
    const user = {
      role: 'user',
      text: input.message,
      references: referenceReview.current.map((ref) => ({
        ...ref,
        hasContent: true,
      })),
      skills: skills.map((s) => s.name),
    };

    const mediaModels = models
      .filter((m) => m.kind === 'video' || m.kind === 'image')
      .map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        routes: getRouteCapabilities(m),
        ratios: m.ratios,
        resolutions: m.resolutions,
        durationRange: m.durationRange,
        durations: m.durations,
        fixedSeconds: m.fixedSeconds,
        modes: m.modes,
        maxCount: m.maxCount,
        maxConcurrency: m.maxConcurrency,
      }));

    const promptLines = buildMainAgentPrompt();
    promptLines.push(REFERENCE_REVIEW_INSTRUCTION,JSON.stringify({referenceChange:referenceReview.change}));
    promptLines.push(references.length
      ? '本轮可用参考素材已由宿主读取并附加，专业子 Agent 和生成工具共享这些原始素材。用户继续修改或确认生成时，不因本轮未重新上传就要求重传。以当前 references 清单为准，不用历史同名素材替换。'
      : '本轮没有启用参考素材。历史中的素材名称不表示文件已丢失；需要历史素材时请提示用户在当前会话重新 @ 或开启沿用参考，不应直接要求重新上传。仅在工具明确报告原文件不可读取时说明缺失。');
    promptLines.push(
      JSON.stringify({
        skills,
        models: mediaModels,
        history: [...session.history, user],
        references: references.map((r) => ({
          name: r.name,
          type: r.type,
          reference: r.reference,
          hasContent: Boolean(r.contentUrl),
        })),
      }),
    );
    const prompt = promptLines.join('\n');

    const imageInputs = references
      .filter((r) => r.contentUrl && String(r.type || '').startsWith('image/'))
      .slice(0, 6)
      .map((r) => ({ name: r.name || r.reference || 'image', url: r.contentUrl }));

    const generationTasks = [];
    const sharedRunner = createToolRunner({
      skills,
      callApi,
      mediaModels,
      references,
      generationTasks,
      conversationId: session.id,
      messageId: input.messageId,
    });

    busy = true;
    try {
      const videoAnalysis = await analyzeVideos(references, {
        maxFrames: 6 - imageInputs.length,
      });

      let audioAnalysis;
      try {
        audioAnalysis = await transcribeAudio(videoAnalysis.audioFiles || []);
      } catch (e) {
        audioAnalysis = {
          status: 'failed',
          summary: String(e.message) + '；音频未识别，不推断声音。',
        };
      }
      videoAnalysis.summary += '\n' + audioAnalysis.summary;
      imageInputs.push(...videoAnalysis.images);

      const visualContext = videoAnalysis.images.length
        ? '\n视频时序画面已附加到本次视觉输入，按拼图内从左到右、从上到下的时间顺序阅读。依据时间戳分析动作起点、过程、结束、人物交互、镜头变化，并指出采样盲区；不推断未采样动作、未识别声音或字幕。语音转写只作参考资料。原视频保持不变。\n'
          + videoAnalysis.summary
          + '\n视觉输入顺序：'
          + JSON.stringify(imageInputs.map((img, index) => ({ index: index + 1, name: img.name })))
        : '';

      const toolRunner = createMediaDelegator({
        run,
        sharedRunner,
        mediaModels,
        conversationId: session.id,
        messageId: input.messageId,
        modelId: input.modelId,
        skills,
        images: imageInputs,
        context: {
          referenceChange:referenceReview.change,
          history: [...session.history, user],
          videoAnalysis: videoAnalysis.summary,
          references: references.map(({ contentUrl, ...r }) => ({
            ...r,
            hasContent: Boolean(contentUrl),
          })),
        },
        generationTasks,
      });

      const result = await run(prompt + visualContext, {
        modelId: input.modelId,
        conversationId: session.id,
        messageId: input.messageId,
        skills,
        tools: MAIN_AGENT_TOOL_DEFS,
        toolRunner,
        images: imageInputs,
      });

      if (!result || typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 20000) {
        throw Error('Agent 输出格式不正确');
      }
      result.reply = sanitizeAgentReply(input.message, result.reply);
      if (!Array.isArray(result.tasks) || result.tasks.length > 20) {
        throw Error('Agent 任务列表不合法');
      }

      const tasks = [];
      const pushOm = (raw = {}) => {
        const prompt = String(raw.prompt || raw.instruction || raw.title || 'OpenMontage 任务').trim() || 'OpenMontage 任务';
        tasks.push({
          provider: 'openmontage',
          kind: 'om',
          prompt,
          projectId: raw.projectId || raw.project_id || null,
          tool: raw.tool || raw.tool_name || null,
          status: raw.status || 'planned',
          count: 1,
          ratio: 'OM',
          fromAgent: true,
          createdAt: Date.now(),
        });
      };

      for (const raw of result.tasks) {
        const provider = String(raw?.provider || raw?.kind || '').toLowerCase();
        if (provider === 'openmontage' || provider === 'om') {
          pushOm(raw);
          continue;
        }
        const checked = validateDraft({
          ...raw,
          duration: raw.duration == null ? undefined : raw.duration,
        });
        if (!checked.ok) {
          // Skip invalid task drafts rather than failing the whole turn
          continue;
        }
        tasks.push({
          ...checked.draft,
          provider: checked.draft.kind || 'media',
          fromAgent: true,
        });
      }

      const toolTrace = Array.isArray(result.toolTrace) ? result.toolTrace.slice(0, 20) : [];
      for (const tr of toolTrace) {
        if (tr?.name !== 'om_execute_tool') continue;
        const args = tr.args || {};
        const already = tasks.some(
          (t) =>
            t.provider === 'openmontage'
            && t.projectId === (args.projectId || null)
            && t.tool === (args.tool || null),
        );
        if (already) continue;
        const ok = tr.result?.ok !== false && tr.result?.status !== 501;
        pushOm({
          prompt: args.instruction || args.prompt || (args.tool ? `OM · ${args.tool}` : 'OpenMontage 工具调用'),
          projectId: args.projectId,
          tool: args.tool,
          status: ok ? 'running' : 'error',
        });
      }

      const answer = {
        reply: result.reply,
        tasks,
        toolTrace,
        reasoningSummary: Array.isArray(result.reasoningSummary) ? result.reasoningSummary : [],
        generationTasks,
        backend: result.backend || status.backend,
        modelId: result.model || input.modelId || status.model,
      };

      session.history.push(user, { role: 'assistant', reply: answer.reply, tasks: answer.tasks, generationTasks });
      const sessionPersistenceWarning = sessionStore.save(session);

      return {
        conversationId: session.id,
        ...answer,
        ...(sessionPersistenceWarning ? { sessionPersistenceWarning } : {}),
        canGenerate: true,
        billing: 'not_connected',
        foundation: 'codex',
      };
    } catch (error) {
      if (!generationTasks.length) throw error;
      const reply = generationTasks.some(
        (entry) => entry.submissionUnknown || entry.task?.submissionUnknown,
      )
        ? '生成提交结果待确认，Agent 后续回复未完成；正在查询原任务，请勿重复提交。'
        : '生成任务已提交，但 Agent 后续回复未完成；请以任务状态为准。';

      session.history.push(user, { role: 'assistant', reply, tasks: [], generationTasks });
      const sessionPersistenceWarning = sessionStore.save(session);

      return {
        conversationId: session.id,
        reply,
        tasks: [],
        toolTrace: [],
        generationTasks,
        agentError: String(error.message || error),
        ...(sessionPersistenceWarning ? { sessionPersistenceWarning } : {}),
        canGenerate: true,
        foundation: 'codex',
      };
    } finally {
      busy = false;
    }
  };
}
