/**
 * Unified error handling and user-friendly messages for Zora
 */

/**
 * Error categories for better user guidance
 */
export const ErrorCategory = {
  CONFIGURATION: 'configuration',
  VALIDATION: 'validation',
  RESOURCE: 'resource',
  PERMISSION: 'permission',
  NETWORK: 'network',
  SYSTEM: 'system',
};

/**
 * Create a user-friendly error with HTTP status and category
 */
export function createError(message, { status = 500, category = ErrorCategory.SYSTEM, details = null, cause = null } = {}) {
  const error = Object.assign(new Error(message), {
    status,
    category,
    details,
    userFriendly: true,
  });

  if (cause) {
    error.cause = cause;
  }

  return error;
}

/**
 * Common error constructors with sensible defaults
 */
export const Errors = {
  // Configuration errors (503)
  agentNotConfigured: (service = 'Agent') =>
    createError(`${service}尚未配置或启用，请在设置中完成配置`, {
      status: 503,
      category: ErrorCategory.CONFIGURATION,
      details: '需要配置 API Key 和服务地址',
    }),

  serviceUnavailable: (service, reason = null) =>
    createError(`${service}服务暂时不可用`, {
      status: 503,
      category: ErrorCategory.SYSTEM,
      details: reason,
    }),

  // Validation errors (400)
  invalidInput: (field, constraint) =>
    createError(`${field}格式不正确：${constraint}`, {
      status: 400,
      category: ErrorCategory.VALIDATION,
    }),

  missingRequired: (field) =>
    createError(`缺少必填字段：${field}`, {
      status: 400,
      category: ErrorCategory.VALIDATION,
    }),

  inputTooLarge: (field, limit) =>
    createError(`${field}超出限制（最大 ${limit}）`, {
      status: 400,
      category: ErrorCategory.VALIDATION,
    }),

  // Resource errors (404, 410)
  notFound: (resource) =>
    createError(`${resource}不存在或已过期`, {
      status: 404,
      category: ErrorCategory.RESOURCE,
      details: '请检查资源 ID 或刷新页面',
    }),

  resourceExpired: (resource) =>
    createError(`${resource}已过期，请重新创建`, {
      status: 410,
      category: ErrorCategory.RESOURCE,
    }),

  resourceExhausted: (resource, limit) =>
    createError(`${resource}数量已达上限（${limit}）`, {
      status: 429,
      category: ErrorCategory.RESOURCE,
    }),

  // Permission errors (403, 401)
  permissionDenied: (action) =>
    createError(`无权执行操作：${action}`, {
      status: 403,
      category: ErrorCategory.PERMISSION,
      details: '此操作需要用户授权',
    }),

  authenticationRequired: () =>
    createError('需要身份验证', {
      status: 401,
      category: ErrorCategory.PERMISSION,
    }),

  // Concurrency errors (409, 429)
  resourceBusy: (resource) =>
    createError(`${resource}正在处理中，请稍后重试`, {
      status: 409,
      category: ErrorCategory.RESOURCE,
    }),

  rateLimitExceeded: (retryAfter = null) =>
    createError('请求过于频繁，请稍后重试', {
      status: 429,
      category: ErrorCategory.RESOURCE,
      details: retryAfter ? `请在 ${retryAfter} 秒后重试` : null,
    }),

  // Network errors
  networkError: (operation, cause = null) =>
    createError(`网络请求失败：${operation}`, {
      status: 502,
      category: ErrorCategory.NETWORK,
      details: '请检查网络连接或稍后重试',
      cause,
    }),

  timeout: (operation, duration) =>
    createError(`操作超时：${operation}（${duration}秒）`, {
      status: 504,
      category: ErrorCategory.NETWORK,
    }),

  // System errors
  internalError: (context = null, cause = null) =>
    createError('系统内部错误，请联系技术支持', {
      status: 500,
      category: ErrorCategory.SYSTEM,
      details: context,
      cause,
    }),
};

/**
 * Check if an error indicates quota/balance issues
 */
export function isQuotaError(message) {
  if (typeof message !== 'string') return false;
  return /预扣|余额|额度不足|insufficient.*(?:quota|balance)|quota.*exceed/i.test(message);
}

/**
 * Extract actionable message from an error
 */
export function getErrorMessage(error) {
  if (!error) return '未知错误';

  // User-friendly error already has good message
  if (error.userFriendly) {
    return error.details ? `${error.message}：${error.details}` : error.message;
  }

  // Check for quota errors
  const message = error.message || String(error);
  if (isQuotaError(message)) {
    return '账户余额不足或配额已用完，请充值后重试';
  }

  // Network errors
  if (error.code === 'ECONNREFUSED') {
    return '无法连接到服务，请检查服务是否启动';
  }
  if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return '网络连接超时，请检查网络设置';
  }

  // Fallback to original message, sanitized
  return sanitizeErrorMessage(message);
}

/**
 * Sanitize error message to remove sensitive information
 */
export function sanitizeErrorMessage(message, apiKey = null) {
  let text = String(message || '').slice(0, 500);

  // Remove API keys
  if (apiKey) {
    text = text.split(apiKey).join('[redacted]');
  }
  text = text.replace(/Bearer\s+[^\s"',;}]+/gi, 'Bearer [redacted]');
  text = text.replace(/\b(?:sk-|ghp_|key-)[A-Za-z0-9_-]+/g, '[redacted]');
  text = text.replace(/([?&](?:key|token|api_key|apikey)=)[^&\s]+/gi, '$1[redacted]');

  // Remove file paths
  text = text.replace(/[A-Z]:\\[^\s"]+/g, '[path]');
  text = text.replace(/\/(?:home|Users|root)\/[^\s"]+/g, '[path]');

  return text;
}

/**
 * Format error for HTTP response
 */
export function formatErrorResponse(error) {
  const status = error.status || 500;
  const message = getErrorMessage(error);

  const response = {
    ok: false,
    error: message,
  };

  // Add category for client-side handling
  if (error.category) {
    response.category = error.category;
  }

  // Add details if available
  if (error.details && error.userFriendly) {
    response.details = error.details;
  }

  // Add retry information for rate limits
  if (status === 429 && error.retryAfter) {
    response.retryAfter = error.retryAfter;
  }

  return { status, body: response };
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('Error in handler:', error);
      throw error.userFriendly ? error : Errors.internalError(null, error);
    }
  };
}
