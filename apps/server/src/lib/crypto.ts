/**
 * Cryptographic helpers using the Web Crypto API.
 * No external dependencies — works natively in Cloudflare Workers.
 */

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// HMAC-SHA256 key creation
// ---------------------------------------------------------------------------

async function createHmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 → hex digest (used for OAuth callback validation)
// ---------------------------------------------------------------------------

export async function hmacSha256Hex(
  secret: string,
  data: string,
): Promise<string> {
  const key = await createHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bufferToHex(signature);
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 → base64 (used for webhook verification)
// ---------------------------------------------------------------------------

export async function hmacSha256Base64(
  secret: string,
  data: ArrayBuffer,
): Promise<string> {
  const key = await createHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return bufferToBase64(signature);
}

// ---------------------------------------------------------------------------
// Constant-time string comparison
// ---------------------------------------------------------------------------

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const aBytes = await encoder.encode(a);
  const bBytes = await encoder.encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }

  // XOR all bytes and accumulate — constant time regardless of where mismatch is
  let result = 0;
  for (let i = 0; i < aBytes.byteLength; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// HS256 JWT verification
// ---------------------------------------------------------------------------

export async function verifyHS256JWT<T>(
  token: string,
  secret: string,
): Promise<T> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected 3 parts");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify header declares HS256
  const header = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(headerB64)),
  );
  if (header.alg !== "HS256") {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
  }

  // Verify signature
  const key = await createHmacKey(secret);
  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const expectedSignature = base64UrlDecode(signatureB64);

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    expectedSignature,
    signingInput,
  );

  if (!isValid) {
    throw new Error("Invalid JWT signature");
  }

  // Decode and return payload
  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64)),
  );

  return payload as T;
}

// ---------------------------------------------------------------------------
// Base64URL decoding (for JWT segments)
// ---------------------------------------------------------------------------

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  // Convert base64url to standard base64
  let base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  // Pad if necessary
  const pad = base64.length % 4;
  if (pad === 2) base64 += "==";
  else if (pad === 3) base64 += "=";

  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i)!;
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCodePoint(b);
  }
  return btoa(binary);
}
