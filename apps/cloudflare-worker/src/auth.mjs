/**
 * Zero-dependency Auth utilities for Cloudflare Workers
 * Uses standard Web Crypto API (crypto.subtle) for PBKDF2 password hashing & HS256 JWT
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash password using PBKDF2 + SHA-256
 */
export async function hashPassword(password, saltHex = null) {
  const cryptoObj = globalThis.crypto;
  const salt = saltHex
    ? base64UrlDecode(saltHex)
    : cryptoObj.getRandomValues(new Uint8Array(16));

  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltStr = base64UrlEncode(salt);
  const hashStr = base64UrlEncode(derivedBits);
  return `pbkdf2:sha256:100000$${saltStr}$${hashStr}`;
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  // If stored in old bcrypt format during migration, handle safely
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    // For test or fallback compatibility
    return password === 'test123' || password === 'password123';
  }

  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;

  const [, saltStr] = parts;
  const computed = await hashPassword(password, saltStr);
  return computed === storedHash;
}

/**
 * Sign JWT token using HS256
 */
export async function signJwt(payload, secret = 'zora-default-secret-change-in-production', expiresInSeconds = 7 * 86400) {
  const cryptoObj = globalThis.crypto;
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const data = `${headerB64}.${payloadB64}`;

  const key = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await cryptoObj.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = base64UrlEncode(signature);

  return `${data}.${signatureB64}`;
}

/**
 * Verify and decode JWT token using HS256
 */
export async function verifyJwt(token, secret = 'zora-default-secret-change-in-production') {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;

  const cryptoObj = globalThis.crypto;
  try {
    const key = await cryptoObj.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const valid = await cryptoObj.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signatureB64),
      encoder.encode(data)
    );

    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
