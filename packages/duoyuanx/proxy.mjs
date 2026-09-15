import { DUOYUANX_BASE_URL, DUOYUANX_PROXY_PREFIXES, routesCount } from './routes.mjs';
import { catalogPayload } from './catalog.mjs';

export function isDuoyuanxConfigured() {
  return Boolean(process.env.DUOYUANX_API_KEY && String(process.env.DUOYUANX_API_KEY).trim());
}

export function duoyuanxStatus() {
  return {
    configured: isDuoyuanxConfigured(),
    baseUrl: process.env.DUOYUANX_BASE_URL || DUOYUANX_BASE_URL,
    routesCount: routesCount(),
  };
}

function missingKeyResponse(res) {
  res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: '未配置 DUOYUANX_API_KEY' }));
}

/**
 * Forward an incoming Node request to duoyuanx.com.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} upstreamPath pathname + search (must start with /)
 */
export async function proxyToDuoyuanx(req, res, upstreamPath) {
  if (!isDuoyuanxConfigured()) {
    missingKeyResponse(res);
    return;
  }
  const base = (process.env.DUOYUANX_BASE_URL || DUOYUANX_BASE_URL).replace(/\/$/, '');
  const url = base + upstreamPath;
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (['host', 'connection', 'content-length', 'authorization'].includes(key)) continue;
    headers[k] = v;
  }
  headers.authorization = `Bearer ${process.env.DUOYUANX_API_KEY}`;
  /** @type {Buffer|undefined} */
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await readRawBody(req);
    if (body?.length) headers['content-length'] = String(body.length);
  }
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: body && body.length ? body : undefined,
    });
    const outHeaders = { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' };
    const cache = upstream.headers.get('cache-control');
    if (cache) outHeaders['Cache-Control'] = cache;
    res.writeHead(upstream.status, outHeaders);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '多元探索上游请求失败', detail: String(err?.message || err) }));
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function matchProxyPrefix(pathname) {
  for (const prefix of DUOYUANX_PROXY_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return true;
    }
    // exact file upload
    if (prefix === '/v1/file/upload' && pathname === '/v1/file/upload') return true;
  }
  return false;
}

/**
 * Attach helpers + proxies onto a Node http server request pipeline.
 * Call from server.mjs before other handlers return false.
 * @returns {boolean} true if handled
 */
export async function handleDuoyuanxRequest(req, res, url) {
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/models') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(catalogPayload()));
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/duoyuanx/status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(duoyuanxStatus()));
    return true;
  }

  // Catch-all: /api/duoyuanx/* → strip prefix and forward
  if (pathname === '/api/duoyuanx' || pathname.startsWith('/api/duoyuanx/')) {
    const stripped = pathname.slice('/api/duoyuanx'.length) || '/';
    const upstreamPath = stripped + (url.search || '');
    await proxyToDuoyuanx(req, res, upstreamPath.startsWith('/') ? upstreamPath : '/' + upstreamPath);
    return true;
  }

  // Direct pass-through of documented upstream paths on the local server
  if (matchProxyPrefix(pathname)) {
    await proxyToDuoyuanx(req, res, pathname + (url.search || ''));
    return true;
  }

  return false;
}

export { DUOYUANX_PROXY_PREFIXES, catalogPayload };
