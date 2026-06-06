import { Hono } from "hono";
import { isNodeRuntime } from "@/utils";
import { onAppError } from "../lifecycle/error";
import { onAppNotFound } from "../lifecycle/not-found";
import { onAppStartup } from "../lifecycle/startup";
import { registerMiddleware } from "./register-middleware";
import { registerRoutes } from "./register-routes";
import type { AppEnv } from "@/types";
import type { DEFAULT_RUNTIMES_VALUES } from "@shamt/envs";

/**
 * Central Hono app factory.
 *
 * This mirrors the src1 bootstrap shape while keeping the current Hono runtime.
 */
export async function createApp() {
  if (isNodeRuntime(process.env.APP_RUNTIME as DEFAULT_RUNTIMES_VALUES)) {
    (await import("./register-process-exceptions")).registerProcessExceptions();
  }

  await onAppStartup();

  const app = new Hono<AppEnv>();
  registerMiddleware(app);
  registerRoutes(app);
  onAppError(app);
  onAppNotFound(app);

  return app;
}
