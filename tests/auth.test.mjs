import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  getUserFromToken,
  checkUserBalance,
  deductUserQuota,
  addUserQuota,
} from '../packages/auth/index.mjs';
import { queryOne, closeDatabase } from '../packages/database/schema.mjs';
import fs from 'node:fs';

// Use test database
const TEST_DB = 'data/zora-test.db';

test.before(async () => {
  // Override database path for testing
  process.env.DATABASE_PATH = TEST_DB;
  await closeDatabase();
  // Clean up test database
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
});

test.after(async () => {
  await closeDatabase();
  // Clean up
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
});

test('registerUser creates new user with hashed password', async () => {
  const result = await registerUser({
    email: 'test@example.com',
    password: 'password123',
    username: 'Test User',
  });

  assert.ok(result.userId);
  assert.equal(result.email, 'test@example.com');
  assert.equal(result.username, 'Test User');

  // Verify user in database
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [result.userId]);

  assert.equal(user.email, 'test@example.com');
  assert.ok(user.password_hash);
  assert.notEqual(user.password_hash, 'password123'); // Password should be hashed
  assert.equal(user.quota_balance, 100); // Initial balance
});

test('registerUser rejects duplicate email', async () => {
  await registerUser({
    email: 'duplicate@example.com',
    password: 'password123',
  });

  await assert.rejects(
    registerUser({
      email: 'duplicate@example.com',
      password: 'another-password',
    }),
    (error) => error.message.includes('已被注册')
  );
});

test('registerUser validates input', async () => {
  await assert.rejects(
    registerUser({ email: 'invalid-email', password: 'pass' }),
    (error) => error.message.includes('邮箱格式')
  );

  await assert.rejects(
    registerUser({ email: 'valid@example.com', password: '123' }),
    (error) => error.message.includes('密码至少')
  );
});

test('loginUser returns token and user info', async () => {
  const registered = await registerUser({
    email: 'login@example.com',
    password: 'password123',
    username: 'Login Test',
  });

  const result = await loginUser({
    email: 'login@example.com',
    password: 'password123',
  });

  assert.ok(result.token);
  assert.ok(result.expiresAt);
  assert.equal(result.user.email, 'login@example.com');
  assert.equal(result.user.quotaBalance, 100);
});

test('loginUser rejects wrong password', async () => {
  await registerUser({
    email: 'wrongpass@example.com',
    password: 'correct-password',
  });

  await assert.rejects(
    loginUser({
      email: 'wrongpass@example.com',
      password: 'wrong-password',
    }),
    (error) => error.status === 401
  );
});

test('getUserFromToken retrieves user from valid token', async () => {
  await registerUser({
    email: 'tokentest@example.com',
    password: 'password123',
  });

  const loginResult = await loginUser({
    email: 'tokentest@example.com',
    password: 'password123',
  });

  const user = await getUserFromToken(loginResult.token);

  assert.ok(user);
  assert.equal(user.email, 'tokentest@example.com');
});

test('getUserFromToken returns null for invalid token', async () => {
  const user = await getUserFromToken('invalid-token');
  assert.equal(user, null);
});

test('logoutUser invalidates token', async () => {
  await registerUser({
    email: 'logout@example.com',
    password: 'password123',
  });

  const loginResult = await loginUser({
    email: 'logout@example.com',
    password: 'password123',
  });

  // Token should work before logout
  let user = await getUserFromToken(loginResult.token);
  assert.ok(user);

  // Logout
  await logoutUser(loginResult.token);

  // Token should not work after logout
  user = await getUserFromToken(loginResult.token);
  assert.equal(user, null);
});

test('refreshToken generates new token', async () => {
  await registerUser({
    email: 'refresh@example.com',
    password: 'password123',
  });

  const loginResult = await loginUser({
    email: 'refresh@example.com',
    password: 'password123',
  });

  const refreshResult = await refreshToken(loginResult.token);

  assert.ok(refreshResult.token);
  assert.notEqual(refreshResult.token, loginResult.token);
  assert.ok(refreshResult.expiresAt);

  // New token should work
  const user = await getUserFromToken(refreshResult.token);
  assert.ok(user);
  assert.equal(user.email, 'refresh@example.com');
});

test('quota operations work correctly', async () => {
  const registered = await registerUser({
    email: 'quota@example.com',
    password: 'password123',
  });

  // Initial balance
  let balance = await checkUserBalance(registered.userId);
  assert.equal(balance, 100);

  // Add quota
  await addUserQuota(registered.userId, 50);
  balance = await checkUserBalance(registered.userId);
  assert.equal(balance, 150);

  // Deduct quota
  const newBalance = await deductUserQuota(registered.userId, 30, {
    resourceType: 'chat',
    modelId: 'gpt-5.5',
  });
  assert.equal(newBalance, 120);

  balance = await checkUserBalance(registered.userId);
  assert.equal(balance, 120);

  // Deducting more than balance should fail
  await assert.rejects(
    deductUserQuota(registered.userId, 200),
    (error) => error.status === 429
  );
});
