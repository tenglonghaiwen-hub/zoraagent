import { getModel, getModels } from '../duoyuanx/catalog.mjs';
import {validateRouteSelection} from '../duoyuanx/route-capabilities.mjs';

function allowedDurations(model) {
  if (!model) return [];
  if (model.capability?.durations?.length) return model.capability.durations;
  if (model.fixedSeconds != null) return [model.fixedSeconds];
  if (Array.isArray(model.durations) && model.durations.length) return model.durations;
  const range = model.durationRange;
  if (range) {
    const out = [];
    for (let v = range.min; v <= range.max + 1e-9; v = Number((v + range.step).toFixed(6))) out.push(v);
    return out;
  }
  return [];
}

/**
 * Validate a creation draft against the live catalog.
 * @param {object} input
 */
export function validateDraft(input = {}, resolveModel = getModel) {
  const modelId = String(input.modelId || '');
  const model = resolveModel(modelId);
  if (!model || model.enabled === false) {
    return { ok: false, error: '模型不可用或不存在' };
  }
  const prompt = String(input.prompt || '').trim();
  if (!prompt) return { ok: false, error: '请填写创作需求' };
  const references=input.references??[];
  if(!Array.isArray(references)||references.length>(['minimax','minimax-openai'].includes(model.family)?15:6))return {ok:false,error:'参考素材数量超出模型限制'};
  const assetReference=r=>model.family==='seedance'&&/^asset:\/\/[A-Za-z0-9_-]+$/.test(r.contentUrl)&&/^(image|video|audio)\//.test(r.type||'');
  if(references.some(r=>!r||typeof r.contentUrl!=='string'||!(/^(https?:\/\/|data:(image\/(png|jpeg|webp)|video\/mp4|audio\/(mpeg|wav));base64,)/.test(r.contentUrl)||assetReference(r))))return {ok:false,error:'参考素材格式无效'};

  const count = Number(input.count);
  const maxCount = model.maxCount || 1;
  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    return { ok: false, error: `生成数量需为 1–${maxCount}` };
  }

  const concurrency = Number(input.concurrency);
  const maxConcurrency = model.maxConcurrency || 1;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > maxConcurrency) {
    return { ok: false, error: `并发需为 1–${maxConcurrency}` };
  }

  const ratio = String(input.ratio || '');
  if (!model.ratios?.includes(ratio)) {
    return { ok: false, error: '画面比例不受当前模型支持' };
  }

  const resolution = String(input.resolution || '');
  if (model.resolutions?.length && !model.resolutions.includes(resolution)) {
    return { ok: false, error: '分辨率不受当前模型支持' };
  }

  let duration = input.duration;
  if (model.kind === 'video') {
    duration = Number(duration);
    const allowed = allowedDurations(model);
    if (!allowed.length || !allowed.some((d) => Number(d) === duration)) {
      return { ok: false, error: '时长不受当前模型支持' };
    }
  } else {
    duration = undefined;
  }

  let videoMode = input.videoMode;
  if (videoMode != null && videoMode !== '') {
    videoMode = String(videoMode);
    const modes = model.modes || [];
    const hit = modes.find((m) => m.id === videoMode);
    if (!hit || hit.enabled === false) {
      return { ok: false, error: '视频模式不受当前模型支持' };
    }
  } else {
    videoMode = undefined;
  }

  const routeSelection=validateRouteSelection({...input,references,videoMode},model);
  if(!routeSelection.ok)return routeSelection;
  const draft = {
    id: `draft_${Date.now().toString(36)}`,
    modelId: model.id,
    kind: model.kind,
    family: model.family,
    route: model.route,
    queryRoute: model.queryRoute,
    contentType: model.contentType,
    prompt,
    references,
    count,
    concurrency,
    ratio,
    resolution: resolution || undefined,
    duration,
    videoMode,
    ...(input.operation!==undefined?{operation:input.operation}:{}),
    ...(input.apiRoute!==undefined?{apiRoute:input.apiRoute}:{}),
    ...(['minimax','minimax-openai'].includes(model.family)?{videoMode:routeSelection.mode,operation:routeSelection.selected.operation,apiRoute:routeSelection.selected.apiRoute,route:routeSelection.selected.apiRoute,queryRoute:routeSelection.queryRoute}:{}),
    createdAt: new Date().toISOString(),
    paused: false,
  };

  return {
    ok: true,
    draft,
    message: '参数已通过校验，可打包提交生成。',
    model,
  };
}

export function listModels() {
  return getModels();
}

export { getModel, getModels };
