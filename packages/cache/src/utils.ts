import { hashString, isObject } from "@shamt/utils";

export function buildCacheKey(prefix: string, key: string): string {
  return `${prefix}${key}`;
}

export function buildCacheTag(key: string): string {
  return hashString(key).toString(36);
}

export function estimateSize(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (value instanceof Uint8Array) return value.byteLength;
  if (isObject(value)) return JSON.stringify(value).length;
  return String(value).length;
}
