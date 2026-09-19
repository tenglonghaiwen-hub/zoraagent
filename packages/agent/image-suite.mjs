import { validateDraft } from '../contracts/domain.mjs';

const parameters = {
  type: 'object', additionalProperties: false,
  properties: {
    modelId: { type: 'string' }, title: { type: 'string' },
    sharedStyle: { type: 'string', description: '整套共同的主体不变量、色彩、背景、光线、构图、字体与留白规范' },
    ratio: { type: 'string' }, resolution: { type: 'string' },
    operation: { type: 'string', enum: ['generate', 'reference'] }, apiRoute: { type: 'string' },
    items: { type: 'array', minItems: 2, maxItems: 12, items: {
      type: 'object', additionalProperties: false,
      properties: { title: { type: 'string' }, prompt: { type: 'string', description: '只描述当前一张的画面与文案，不包含其他页面的要求' } },
      required: ['title', 'prompt'],
    } },
  }, required: ['modelId', 'title', 'sharedStyle', 'ratio', 'resolution', 'items'],
};
export const IMAGE_SUITE_TOOLS = ['preview_image_suite', 'submit_image_suite'].map(name => ({
  type: 'function', name, parameters,
  description: name === 'preview_image_suite'
    ? '免费校验整套图片：共享风格＋逐张独立描述。不同内容的系列图片必须用此工具，不能用一个总提示词搭配 count。'
    : '提交已获用户生成授权的整套图片（每张会计费）。每张独立提示词、相同原始参考图、数量1，结果合并展示；不自动补图或重试。',
}));

export function planImageSuite(args, references = []) {
  const text = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;
  if (!text(args.title, 160) || !text(args.sharedStyle, 8000) || !Array.isArray(args.items) || args.items.length < 2 || args.items.length > 12)
    return { ok: false, error: '整套图片需要标题、共同风格及 2–12 条独立页面描述' };
  if (args.items.some(item => !item || !text(item.title, 160) || !text(item.prompt, 8000)))
    return { ok: false, error: '每张图片必须有标题和独立描述' };
  if (new Set(args.items.map(item => item.prompt.trim())).size !== args.items.length)
    return { ok: false, error: '整套图片的逐张描述不能完全相同；同一描述的多个版本请使用普通生成' };
  const drafts = [];
  for (const item of args.items) {
    const prompt = `共同风格与主体约束：\n${args.sharedStyle.trim()}\n\n当前页面：${item.title.trim()}\n${item.prompt.trim()}\n\n只生成当前页面的一张独立成图，不包含其他页面，不把整套作品拼成四格、多页缩略图或联系表。保留当前页面明确要求的设计元素。`;
    const checked = validateDraft({ ...args, prompt, count: 1, concurrency: 1, references });
    if (!checked.ok) return checked;
    if (checked.draft.kind !== 'image') return { ok: false, error: '整套图片工具仅支持图片模型' };
    const { id, createdAt, ...draft } = checked.draft;
    drafts.push(draft);
  }
  return { ok: true, drafts, title: args.title.trim(), sharedStyle: args.sharedStyle.trim(),
    items: args.items.map((item, index) => ({ index, title: item.title.trim(), description: item.prompt.trim(), prompt: drafts[index].prompt })) };
}
