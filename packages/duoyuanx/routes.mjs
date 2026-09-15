/** Documented 多元探索 upstream route patterns (path after host). */
export const DUOYUANX_BASE_URL = 'https://duoyuanx.com';

/** Explicit method+path patterns for status/reporting. Wildcards end with /* or include {param}. */
export const DUOYUANX_ROUTE_PATTERNS = [
  // Texts
  'POST /v1/chat/completions',
  'POST /v1/completions',
  'POST /v1/messages',
  'POST /v1/responses',
  'POST /v1/responses/compact',
  'GET /v1/realtime',
  'GET /v1/models',
  'GET /v1/models/{model}',
  'GET /v1beta/models',
  'POST /v1beta/models/{model}:{action}',
  'GET /v1beta/openai/models',
  // Images
  'POST /v1/images/generations',
  'POST /v1/images/edits',
  'POST /v1/edits',
  'POST /v1/images/variations',
  'POST /mj/submit/imagine',
  'POST /mj/submit/blend',
  'POST /mj/submit/describe',
  'POST /mj/submit/edits',
  'POST /mj/submit/video',
  'GET /mj/task/{id}/fetch',
  'GET /mj/image/{id}',
  'POST /v1beta/models/{model}:generateContent',
  // Videos
  'POST /v1/videos',
  'GET /v1/videos/{task_id}',
  'GET /v1/videos/{task_id}/content',
  'POST /v1/videos/{video_id}/remix',
  'POST /v1/video/create',
  'POST /v1/video/remix',
  'GET /v1/video/query',
  'POST /v1/video/generations',
  'GET /v1/video/generations/{task_id}',
  'ALL /v1/seedance/asset/*',
  // Audio
  'POST /v1/audio/transcriptions',
  'POST /v1/audio/translations',
  'POST /v1/audio/speech',
  'ALL /suno/*',
  // Upload
  'PUT /v1/file/upload',
  // Account
  'GET /api/usage/token/',
  'GET /dashboard/billing/subscription',
  'GET /v1/dashboard/billing/subscription',
  'GET /dashboard/billing/usage',
  'GET /v1/dashboard/billing/usage',
  'GET /api/oauth/state',
  'GET /api/oauth/{provider}',
];

/**
 * Path prefixes mounted as local proxies (method-agnostic catch-through).
 * More specific prefixes first where needed; catch-all /api/duoyuanx/* strips prefix.
 */
export const DUOYUANX_PROXY_PREFIXES = [
  '/v1/chat/completions',
  '/v1/completions',
  '/v1/messages',
  '/v1/responses',
  '/v1/realtime',
  '/v1/models',
  '/v1beta/models',
  '/v1beta/openai/models',
  '/v1/images',
  '/v1/edits',
  '/mj',
  '/v1/videos',
  '/v1/video',
  '/v1/seedance/asset',
  '/v1/audio',
  '/suno',
  '/v1/file/upload',
  '/api/usage/token',
  '/dashboard/billing',
  '/v1/dashboard/billing',
  '/api/oauth',
];

export function routesCount() {
  return DUOYUANX_ROUTE_PATTERNS.length;
}
