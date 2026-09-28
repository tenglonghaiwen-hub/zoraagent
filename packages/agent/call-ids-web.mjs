// Cloudflare Workers use Web Crypto; keep the same SHA-256 identifier mapping as the desktop relay.
export async function normalizeCallIdsWeb(body) {
  if (!Array.isArray(body?.input)) return body;
  const reserved = new Set(body.input.map(item => item?.call_id).filter(id => typeof id === 'string' && id.length <= 64));
  const mapping = new Map();
  const cryptoObj = Reflect.get(globalThis, 'crypto');
  if (!cryptoObj?.subtle) throw Error('Web Crypto 不可用，无法规范化工具编号');
  for (const item of body.input) {
    const id = item?.call_id;
    if (typeof id !== 'string' || id.length <= 64 || mapping.has(id)) continue;
    let salt = 0;
    let short;
    do {
      const digest = await cryptoObj.subtle.digest('SHA-256', new TextEncoder().encode(id + '\0' + salt++));
      short = 'call_' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 56);
    } while (reserved.has(short));
    reserved.add(short);
    mapping.set(id, short);
  }
  if (!mapping.size) return body;
  return {...body, input: body.input.map(item => mapping.has(item?.call_id) ? {...item, call_id: mapping.get(item.call_id)} : item)};
}
