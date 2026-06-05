import { getRuntimeConfig } from "@/configs/runtime";
import { isCloudflareRuntime } from "@/utils";
import type { AppEnv } from "@/types";
import type { MiddlewareHandler } from "hono";

export function runtimeEnvConfigMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    try {
      const envConfig = isCloudflareRuntime(c.env.APP_RUNTIME)
        ? c.env
        : process.env;
      const runtimeEnvConfig = getRuntimeConfig(envConfig);
      c.set("runtimeEnvConfig", runtimeEnvConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`runtime env 获取报错: ${message}`);
      return c.json(
        {
          error: "runtime env 获取报错",
          message,
        },
        500,
      );
    }

    await next();
  };
}
