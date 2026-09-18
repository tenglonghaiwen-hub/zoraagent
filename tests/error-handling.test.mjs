import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createError,
  Errors,
  ErrorCategory,
  isQuotaError,
  getErrorMessage,
  sanitizeErrorMessage,
  formatErrorResponse,
  withErrorHandling,
} from '../packages/agent/error-handling.mjs';

test('createError creates user-friendly errors with metadata', () => {
  const error = createError('测试错误', {
    status: 400,
    category: ErrorCategory.VALIDATION,
    details: '详细信息',
  });

  assert.equal(error.message, '测试错误');
  assert.equal(error.status, 400);
  assert.equal(error.category, 'validation');
  assert.equal(error.details, '详细信息');
  assert.equal(error.userFriendly, true);
});

test('Errors factory creates common error types with correct status codes', () => {
  const agentError = Errors.agentNotConfigured('主 Agent');
  assert.equal(agentError.status, 503);
  assert.match(agentError.message, /尚未配置/);

  const validationError = Errors.invalidInput('用户名', '长度 3-20 字符');
  assert.equal(validationError.status, 400);
  assert.match(validationError.message, /格式不正确/);

  const notFoundError = Errors.notFound('对话');
  assert.equal(notFoundError.status, 404);
  assert.match(notFoundError.message, /不存在或已过期/);

  const permissionError = Errors.permissionDenied('删除文件');
  assert.equal(permissionError.status, 403);
  assert.match(permissionError.message, /无权执行/);

  const busyError = Errors.resourceBusy('Agent');
  assert.equal(busyError.status, 409);
  assert.match(busyError.message, /正在处理中/);

  const rateLimitError = Errors.rateLimitExceeded();
  assert.equal(rateLimitError.status, 429);
  assert.match(rateLimitError.message, /请求过于频繁/);

  const networkError = Errors.networkError('上传文件');
  assert.equal(networkError.status, 502);
  assert.match(networkError.message, /网络请求失败/);

  const internalError = Errors.internalError();
  assert.equal(internalError.status, 500);
  assert.match(internalError.message, /系统内部错误/);
});

test('isQuotaError detects quota-related errors', () => {
  assert.equal(isQuotaError('余额不足'), true);
  assert.equal(isQuotaError('预扣失败'), true);
  assert.equal(isQuotaError('额度不足'), true);
  assert.equal(isQuotaError('insufficient quota'), true);
  assert.equal(isQuotaError('quota exceeded'), true);
  assert.equal(isQuotaError('insufficient balance'), true);
  assert.equal(isQuotaError('normal error'), false);
  assert.equal(isQuotaError(null), false);
});

test('getErrorMessage extracts actionable messages', () => {
  const userFriendlyError = createError('配置错误', { details: '缺少 API Key' });
  assert.match(getErrorMessage(userFriendlyError), /配置错误/);
  assert.match(getErrorMessage(userFriendlyError), /缺少 API Key/);

  const quotaError = new Error('insufficient quota remaining');
  assert.match(getErrorMessage(quotaError), /账户余额不足/);

  const networkError = Object.assign(new Error('connection failed'), { code: 'ECONNREFUSED' });
  assert.match(getErrorMessage(networkError), /无法连接到服务/);

  const timeoutError = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
  assert.match(getErrorMessage(timeoutError), /网络连接超时/);

  const genericError = new Error('something went wrong');
  assert.equal(getErrorMessage(genericError), 'something went wrong');

  assert.equal(getErrorMessage(null), '未知错误');
});

test('sanitizeErrorMessage removes sensitive information', () => {
  const withApiKey = 'Error with key sk-abc123def456 in request';
  assert.doesNotMatch(sanitizeErrorMessage(withApiKey), /sk-abc123def456/);
  assert.match(sanitizeErrorMessage(withApiKey), /\[redacted\]/);

  const withBearer = 'Authorization: Bearer sk-secret123';
  assert.doesNotMatch(sanitizeErrorMessage(withBearer), /sk-secret123/);
  assert.match(sanitizeErrorMessage(withBearer), /Bearer \[redacted\]/);

  const withPath = 'File not found: C:\\Users\\test\\secret.txt';
  assert.doesNotMatch(sanitizeErrorMessage(withPath), /C:\\Users/);
  assert.match(sanitizeErrorMessage(withPath), /\[path\]/);

  const withCustomKey = 'Failed with my-secret-key-123';
  assert.doesNotMatch(sanitizeErrorMessage(withCustomKey, 'my-secret-key-123'), /my-secret-key-123/);
  assert.match(sanitizeErrorMessage(withCustomKey, 'my-secret-key-123'), /\[redacted\]/);

  const longMessage = 'a'.repeat(1000);
  assert.ok(sanitizeErrorMessage(longMessage).length <= 500);
});

test('formatErrorResponse creates structured HTTP error responses', () => {
  const error = Errors.invalidInput('邮箱', '格式不正确');
  const response = formatErrorResponse(error);

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.ok(response.body.error);
  assert.equal(response.body.category, 'validation');

  const rateLimitError = Object.assign(
    Errors.rateLimitExceeded(),
    { retryAfter: 60 }
  );
  const rateLimitResponse = formatErrorResponse(rateLimitError);
  assert.equal(rateLimitResponse.status, 429);
  assert.equal(rateLimitResponse.body.retryAfter, 60);
});

test('withErrorHandling wraps async handlers and converts errors', async () => {
  const successHandler = withErrorHandling(async (value) => value * 2);
  assert.equal(await successHandler(21), 42);

  const userFriendlyHandler = withErrorHandling(async () => {
    throw Errors.notFound('资源');
  });
  await assert.rejects(userFriendlyHandler(), (err) => {
    return err.status === 404 && err.userFriendly === true;
  });

  const genericHandler = withErrorHandling(async () => {
    throw new Error('unexpected error');
  });
  await assert.rejects(genericHandler(), (err) => {
    return err.status === 500 && /系统内部错误/.test(err.message);
  });
});

test('error categories are properly defined', () => {
  assert.equal(ErrorCategory.CONFIGURATION, 'configuration');
  assert.equal(ErrorCategory.VALIDATION, 'validation');
  assert.equal(ErrorCategory.RESOURCE, 'resource');
  assert.equal(ErrorCategory.PERMISSION, 'permission');
  assert.equal(ErrorCategory.NETWORK, 'network');
  assert.equal(ErrorCategory.SYSTEM, 'system');
});

test('errors include cause chain when provided', () => {
  const originalError = new Error('原始错误');
  const wrappedError = Errors.networkError('下载文件', originalError);

  assert.equal(wrappedError.cause, originalError);
});
