import { createMiddleware } from "hono/factory";
import { getLoggerProvider } from "@/infra/provider";
import { internalServerError } from "@/shared/exceptions";
import type { AppEnv } from "@/types";

export function runtimeLoggerMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    try {
      const runtimeEnv = c.get("runtimeEnv");
      const runtimeLogger = await getLoggerProvider(runtimeEnv);
      c.set("runtimeLogger", runtimeLogger);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw internalServerError("runtime logger errors", {
        details: { cause: error, message },
        expose: true,
      });
    }

    await next();
  });
}
