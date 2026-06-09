import { createMiddleware } from "hono/factory";
import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { getSafeProcessEnv } from "@/app/runtime/process/utils";
import { getEnvProvider } from "@/infra/provider";
import { internalServerError } from "@/shared/exceptions";
import type { AppEnv } from "@/types";

export function runtimeEnvMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    try {
      const runtimeEnvSourceResolver = getRuntimeCapability(
        "runtimeEnvSourceResolver",
      );
      const envConfig =
        runtimeEnvSourceResolver?.(c) ?? c.env ?? getSafeProcessEnv();
      const runtimeEnv = getEnvProvider(envConfig);
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
