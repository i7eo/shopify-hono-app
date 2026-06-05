import {
  runtimeEnvConfigMiddleware,
  runtimeLoggerMiddleware,
} from "@/shared/middlewares";
import type { AppEnv } from "../../types";
import type { Hono } from "hono";

/**
 * Global middleware registration.
 */
export function registerMiddleware(app: Hono<AppEnv>) {
  app.use("*", runtimeEnvConfigMiddleware());
  app.use("*", runtimeLoggerMiddleware());
  app.use("*", async (c, next) => {
    // eslint-disable-next-line no-console
    console.log(`[${c.req.method}] ${c.req.url}`);
    await next();
  });
}
