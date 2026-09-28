import {decodeWanInlineVideo} from '../../../packages/duoyuanx/wan-reference.mjs';

const PREFIX = 'zora/wan-reference/';
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const URL_LIFETIME_MS = 48 * 60 * 60 * 1000;
const fail = (message, status = 400) => Object.assign(Error(message), {status});
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');

async function signature(secret, id, expires) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}:${expires}`))));
}

function requireStorage(env) {
  if (!env.REFERENCE_MEDIA || !env.JWT_SECRET) throw fail('万相本地视频暂存未配置，请联系管理员', 503);
  return env.REFERENCE_MEDIA;
}

export async function stageWanVideoReferences(body, user, env, publicOrigin) {
  const references = body.references || [];
  const pending = [];
  let totalBytes = 0;
  for (let index = 0; index < references.length; index++) {
    const bytes = decodeWanInlineVideo(references[index]?.contentUrl);
    if (!bytes) continue;
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) throw fail('万相本地参考视频合计不能超过 32 MiB');
    pending.push({index, bytes});
  }
  if (!pending.length) return body;
  const bucket = requireStorage(env);
  if (!/^https:\/\/[^/]+$/.test(publicOrigin || '')) throw fail('公网媒体地址未配置', 503);
  const output = references.map(reference => ({...reference}));
  for (const item of pending) {
    const id = crypto.randomUUID();
    const expires = Date.now() + URL_LIFETIME_MS;
    await bucket.put(PREFIX + id + '.mp4', item.bytes, {
      httpMetadata:{contentType:'video/mp4'},
      customMetadata:{ownerId:String(user.id),expiresAt:String(expires)}
    });
    const sig = await signature(env.JWT_SECRET, id, expires);
    output[item.index].contentUrl = `${publicOrigin}/api/wan-reference/${id}.mp4?e=${expires}&sig=${sig}`;
  }
  return {...body, references:output};
}

export async function serveWanReference(request, env) {
  const url = new URL(request.url);
  const match = /^\/api\/wan-reference\/([0-9a-f-]{36})\.mp4$/.exec(url.pathname);
  if (!match || !['GET','HEAD'].includes(request.method)) return new Response(null, {status:404});
  const expires = Number(url.searchParams.get('e'));
  const supplied = url.searchParams.get('sig') || '';
  if (!Number.isSafeInteger(expires) || expires < Date.now() || !/^[0-9a-f]{64}$/.test(supplied)) return new Response(null, {status:404});
  const bucket = requireStorage(env);
  const expected = await signature(env.JWT_SECRET, match[1], expires);
  if (supplied !== expected) return new Response(null, {status:404});
  const key = PREFIX + match[1] + '.mp4';
  const object = request.method === 'HEAD' ? await bucket.head(key) : await bucket.get(key, {range:request.headers});
  if (!object || Number(object.customMetadata?.expiresAt) !== expires) return new Response(null, {status:404});
  const headers = new Headers({'Content-Type':'video/mp4','Cache-Control':'private, no-store','Accept-Ranges':'bytes'});
  if (object.range && typeof object.range.offset === 'number' && typeof object.range.length === 'number') {
    headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set('Content-Length', String(object.range.length));
    return new Response(request.method === 'HEAD' ? null : object.body, {status:206, headers});
  }
  headers.set('Content-Length', String(object.size));
  return new Response(request.method === 'HEAD' ? null : object.body, {status:200, headers});
}
