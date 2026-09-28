import test from 'node:test';
import assert from 'node:assert/strict';
import {signJwt, verifyJwt} from '../apps/cloudflare-worker/src/auth.mjs';

test('same-second concurrent session tokens are unique and verifiable', async (t) => {
  t.mock.method(Date, 'now', () => 1790160000000);
  const payload = {userId:'test-user', role:'user', jti:'must-not-be-reused'};
  const tokens = await Promise.all(Array.from({length:100}, () => signJwt(payload, 'test-only-secret')));
  assert.equal(new Set(tokens).size, 100);
  const claims = await Promise.all(tokens.map(token => verifyJwt(token, 'test-only-secret')));
  assert.equal(new Set(claims.map(claim => claim.jti)).size, 100);
  for (const claim of claims) {
    assert.equal(claim.userId, payload.userId);
    assert.equal(claim.role, 'user');
    assert.notEqual(claim.jti, payload.jti);
    assert.equal(claim.exp - claim.iat, 7 * 86400);
  }
  assert.equal(await verifyJwt(tokens[0], 'wrong-secret'), null);
});
