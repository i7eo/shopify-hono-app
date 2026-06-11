import { DEFAULT_UPLOAD_TIMEOUT } from "@shamt/app-env";
import { requestId } from "hono/request-id";
// import { compress } from "hono/compress";
import { trimTrailingSlash } from "hono/trailing-slash";
import { getEnvProvider } from "@/infra/provider";
import {
  emojiFaviconMiddleware,
  loggerMiddleware,
  runtimeEnvMiddleware,
  runtimeLoggerMiddleware,
  timeoutMiddleware,
  uploadMiddleware,
} from "@/shared/middlewares";
import type { AppEnv } from "@/typings";
import type { Hono } from "hono";

/**
 * Global middleware registration.
 */
export function registerMiddleware(app: Hono<AppEnv>) {
  const env = getEnvProvider();
  const apiPrefix = `/${env.APP_API_PREFIX}`;
  const apiPath = `${apiPrefix}/:path{(?!upload(?:/|$)).*}`;
  const apiUploadPath = `${apiPrefix}/upload`;
  const apiUploadMessage = "Upload request timed out";

  app.use(emojiFaviconMiddleware("⚡️"));
  app.use(trimTrailingSlash());
  app.use("*", requestId());
  app.use("*", runtimeEnvMiddleware());
  app.use("*", runtimeLoggerMiddleware());
  app.use(apiPath, timeoutMiddleware(env.APP_REQUEST_TIMEOUT));
  app.use(
    /** must be after runtimeLoggerMiddleware, avoid logger reset */
    loggerMiddleware({
      ignorePaths: ["/favicon.ico", "/public", "/", "/reference", "/document"],
    }),
  );
  app.use(
    apiUploadPath,
    timeoutMiddleware(DEFAULT_UPLOAD_TIMEOUT, apiUploadMessage),
    uploadMiddleware(),
  );
  app.use(
    `${apiUploadPath}/*`,
    timeoutMiddleware(DEFAULT_UPLOAD_TIMEOUT, apiUploadMessage),
    uploadMiddleware(),
  );
  // app.use(compress()); // if nginx config this is not required
}
