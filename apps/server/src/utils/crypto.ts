import { deserializeValue } from "@shamt/utils";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function createHmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function hmacSha256Hex(
  secret: string,
  data: string,
): Promise<string> {
  const key = await createHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bufferToHex(signature);
}

export async function hmacSha256Base64(
  secret: string,
  data: ArrayBuffer,
): Promise<string> {
  const key = await createHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return bufferToBase64(signature);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBytes.byteLength; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

export async function verifyHS256JWT<T>(
  token: string,
  secret: string,
): Promise<T> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected 3 parts");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const header = parseJsonOrThrow<{ alg?: string }>(
    decoder.decode(base64UrlDecode(headerB64)),
    "Invalid JWT header JSON",
  );
  if (header.alg !== "HS256") {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
  }

  const key = await createHmacKey(secret);
  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const expectedSignature = base64UrlDecode(signatureB64);

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    // @ts-ignore
    expectedSignature,
    signingInput,
  );

  if (!isValid) {
    throw new Error("Invalid JWT signature");
  }

  const payload = parseJsonOrThrow<T>(
    decoder.decode(base64UrlDecode(payloadB64)),
    "Invalid JWT payload JSON",
  );

  return payload;
}

export function base64UrlDecode(input: string): Uint8Array {
  let base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const pad = base64.length % 4;
  switch (pad) {
    case 2: {
      base64 += "==";
      break;
    }
    case 3: {
      base64 += "=";
      break;
    }
    case 1:
      throw new Error("Invalid base64url input");
    // No default
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i)!;
  }
  return bytes;
}

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

function parseJsonOrThrow<T>(value: string, message: string): T {
  const parsed = deserializeValue<T>(value);
  if (parsed === undefined) {
    throw new SyntaxError(message);
  }
  return parsed;
}
