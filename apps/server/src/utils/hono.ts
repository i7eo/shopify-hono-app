import type { AppEnv } from "@/typings";
import type { Context } from "hono";

export function getContextValue<K extends keyof AppEnv["Variables"]>(
  c: Context<AppEnv>,
  key: K,
): AppEnv["Variables"][K] | undefined {
  try {
    return c.get(key);
  } catch {
    return undefined;
  }
}

export function setResponseHeaders(
  c: Context<AppEnv>,
  headers: Record<string, string>,
) {
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
}
