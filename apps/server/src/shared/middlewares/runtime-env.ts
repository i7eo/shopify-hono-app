import { createMiddleware } from "hono/factory";
import { getEnvProvider, getLoggerProvider } from "@/infra/provider";
import { internalServerError } from "@/shared/exceptions";
import { isCloudflareRuntime } from "@/utils";
import type { AppEnv } from "@/types";

export function runtimeEnvMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    try {
      const logger = await getLoggerProvider();
      const envConfig = isCloudflareRuntime(c.env.APP_RUNTIME)
        ? c.env
        : process.env;
      const runtimeEnv = getEnvProvider(envConfig, { merge: true });
      logger.info("🏖️ cloudflare binding env are merged.");
      c.set("runtimeEnv", runtimeEnv);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw internalServerError("runtime env errors", {
        details: { cause: error, message },
        expose: true,
      });
    }

    await next();
  });
}
