import { createMiddleware } from "hono/factory";
import { createResourceScope } from "@/app/runtime/resources";
import type { AppEnv } from "@/typings";

/**
 * Installs a per-request resource scope and disposes it after the response.
 *
 * Runtime-agnostic by design: disposal is a plain `await` in `finally` (no
 * Cloudflare `waitUntil`), so it behaves identically on Node, Vercel, and
 * Workers. Closing a request-bound pg socket is sub-millisecond, so awaiting it
 * before returning is negligible.
 *
 * Constraint: handlers must not return a streamed response body backed by the
 * request database, since the connection closes once the handler returns.
 */
export function resourceScopeMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const scope = createResourceScope(c.get("runtimeLogger"));
    c.set("resources", scope);

    try {
      await next();
    } finally {
      await scope.dispose();
    }
  });
}
