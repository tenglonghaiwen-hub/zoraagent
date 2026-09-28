const normalized = value => String(value || '').toLowerCase().replace(/[\s._．-]+/g, '');

function modelAliases(model) {
  const name = String(model?.name || '');
  // Catalog display names may append a provider, e.g. 万相 3.0（强哥AI）.
  const baseName = name.replace(/\s*[（(][^（）()]{1,40}[）)]\s*$/u, '').trim();
  return new Set([model.id, name, baseName, ...(Array.isArray(model.aliases) ? model.aliases : [])]);
}

export function resolveMediaModelMention(text, models = [], kind) {
  const source = normalized(text);
  const matches = [];
  for (const model of Array.isArray(models) ? models : []) {
    if (!['image', 'video'].includes(model?.kind) || kind && model.kind !== kind) continue;
    for (const alias of modelAliases(model)) {
      const needle = normalized(alias);
      if (needle.length < 4) continue;
      for (let index = source.indexOf(needle); index >= 0; index = source.indexOf(needle, index + needle.length)) {
        const prefix = source.slice(Math.max(0, index - 16), index);
        const negative = /(?:不要|不用|别用|禁止|排除)[^，。；,;]{0,8}$/.test(prefix);
        const positive = !negative && /(?:使用|改用|选用|选择|指定|切换到|用)[^，。；,;]{0,8}$/.test(prefix);
        matches.push({model, index, length:needle.length, negative, positive});
      }
    }
  }
  const excludedIds = [...new Set(matches.filter(match => match.negative).map(match => match.model.id))];
  const candidates = matches.filter(match => !match.negative);
  const positives = candidates.filter(match => match.positive);
  if (positives.length) {
    positives.sort((a, b) => b.index - a.index || b.length - a.length);
    const hit = positives[0];
    const tied = positives.some(other => other !== hit && other.index === hit.index && other.length === hit.length && other.model.id !== hit.model.id);
    return {model:tied ? null : hit.model, explicit:true, ambiguous:tied, excludedIds};
  }
  const byId = [...new Map(candidates.map(match => [match.model.id, match.model])).values()];
  return {model:byId.length === 1 ? byId[0] : null, explicit:byId.length > 0, ambiguous:byId.length > 1, excludedIds};
}

export function firstEnabledMediaModel(models = [], kind, excludedIds = []) {
  return (Array.isArray(models) ? models : []).find(model => model?.kind === kind
    && model.enabled !== false && model.available !== false && !excludedIds.includes(model.id)) || null;
}

export function unmatchedExplicitModelRequest(text, models = []) {
  if (resolveMediaModelMention(text, models).explicit) return null;
  const source=String(text||'');
  const requests=[...source.matchAll(/(?:使用|改用|选用|选择|指定|切换到|用)\s*(?:模型\s*)?([a-z][a-z0-9._-]*(?:\s+[a-z0-9._-]+){0,3}|[\u4e00-\u9fa5]{1,8}\s*\d+(?:[.．]\d+)?)/ig)];
  const candidate=requests.at(-1)?.[1]?.trim();
  return candidate&&/\d/.test(candidate)&&!/^(?:图片|参考图|视频|素材|文件|第)\d/.test(candidate) ? candidate : null;
}
