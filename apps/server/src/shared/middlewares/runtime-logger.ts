import { getLoggerProvider } from "@/infra/provider";
import type { AppEnv } from "@/types";
import type { MiddlewareHandler } from "hono";

export function runtimeLoggerMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    try {
      const runtimeEnvConfig = c.get("runtimeEnvConfig");
      const runtimeLogger = await getLoggerProvider(runtimeEnvConfig);
      c.set("runtimeLogger", runtimeLogger);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`runtime logger 获取报错: ${message}`);
      return c.json(
        {
          error: "runtime logger 获取报错",
          message,
        },
        500,
      );
    }

    await next();
  };
}
