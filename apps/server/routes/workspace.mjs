import fs from 'node:fs';
import { createWorkspaceArtifacts } from '../../../packages/agent/workspace-artifacts.mjs';

/**
 * Handle /api/workspace-files routes.
 * Returns true if the request was handled.
 */
export async function handleWorkspaceRoutes(req, res, url, { sendJson, workspaceRoot, runtime }) {
  if (req.method !== 'GET') return false;
  if (url.pathname !== '/api/workspace-files' && !url.pathname.startsWith('/api/workspace-files/')) {
    return false;
  }

  // Same-origin local-only access check
  if (
    !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    || req.headers['sec-fetch-site'] === 'cross-site'
    || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
  ) {
    sendJson(res, 403, { error: '文件库仅允许本机同源访问' });
    return true;
  }

  try {
    const artifacts = createWorkspaceArtifacts({ workspaceRoot });

    if (url.pathname === '/api/workspace-files') {
      const ownership = new Map();
      for (const record of runtime().list({ includeDeleted: true })) {
        for (const artifact of record.artifacts || []) {
          const ids = ownership.get(artifact.id) || new Set();
          if (record.conversationId) ids.add(record.conversationId);
          ownership.set(artifact.id, ids);
        }
      }

      const conversationId = url.searchParams.get('conversationId');
      const files = artifacts.list().map((file) => ({
        ...file,
        conversationIds: [...(ownership.get(file.id) || [])],
        origins: runtime()
          .list({ includeDeleted: true })
          .filter((r) => (r.artifacts || []).some((a) => a.id === file.id))
          .map((r) => ({
            conversationId: r.conversationId,
            messageId: r.messageId,
            createdAt: r.createdAt,
          })),
      }));

      sendJson(res, 200, {
        files: conversationId
          ? files.filter((file) => file.conversationIds.includes(conversationId))
          : files,
      });
      return true;
    }

    // Single file download with range support
    const file = artifacts.open(url.pathname.slice('/api/workspace-files/'.length));
    const inline = ['image', 'video', 'audio', 'pdf'].includes(file.kind);
    const encoded = encodeURIComponent(file.name).replace(
      /['()*]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    );

    let start = 0;
    let end = file.size - 1;
    let status = 200;

    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2])) {
        fs.closeSync(file.fd);
        res.writeHead(416, { 'Content-Range': `bytes */${file.size}` });
        res.end();
        return true;
      }
      if (!range[1]) start = Math.max(0, file.size - Number(range[2]));
      else start = Number(range[1]);
      if (range[1] && range[2]) end = Math.min(end, Number(range[2]));
      if (start > end || start >= file.size) {
        fs.closeSync(file.fd);
        res.writeHead(416, { 'Content-Range': `bytes */${file.size}` });
        res.end();
        return true;
      }
      status = 206;
    }

    res.writeHead(status, {
      'Content-Type': file.mimeType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`,
      'Content-Length': Math.max(0, end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${file.size}` } : {}),
    });

    const stream = fs.createReadStream(null, {
      fd: file.fd,
      autoClose: true,
      ...(file.size ? { start, end } : {}),
    });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
    return true;
  } catch (e) {
    sendJson(res, e.status || 500, { error: String(e.message || e) });
    return true;
  }
}
