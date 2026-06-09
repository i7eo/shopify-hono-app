import { requestId } from "hono/request-id";
import { trimTrailingSlash } from "hono/trailing-slash";
import {
  emojiFaviconMiddleware,
  loggerMiddleware,
  runtimeEnvMiddleware,
  runtimeLoggerMiddleware,
} from "@/shared/middlewares";
// import { compress } from "hono/compress";
// import { cors } from "hono/cors";
// import { timeout } from "hono/timeout";
import type { AppEnv } from "@/types";
import type { Hono } from "hono";

/**
 * Global middleware registration.
 */
export function registerMiddleware(app: Hono<AppEnv>) {
  app.use("*", requestId());
  app.use("*", runtimeEnvMiddleware());
  app.use("*", runtimeLoggerMiddleware());
  app.use(loggerMiddleware({ ignorePaths: ["/favicon.ico", "/public", "/"] }));
  // app.use(
  //   `/${env.APP_API_PREFIX}/*`,
  //   cors({
  //     origin: `http://${hostIPList[0]}:${env.APP__LARK_PORT}`,
  //     credentials: true,
  //   }),
  // );
  // app.use(
  //   `/${env.APP_API_PREFIX}/*`,
  //   timeout(env.APP_REQUEST_TIMEOUT, () => new timeoutError() as any),
  // );
  // app.use(compress()); // if nginx config this is not required
  app.use(trimTrailingSlash());
  app.use(emojiFaviconMiddleware("⚡️"));
}
