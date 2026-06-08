import { setupApp } from "@/app/bootstrap/setup-app";
import { getLoggerProvider } from "@/infra/provider";
import { isNodeRuntime } from "@/utils";
import { name } from "../package.json";
import type { DEFAULT_RUNTIMES_VALUES } from "@shamt/envs";

async function bootstrap() {
  const logger = await getLoggerProvider();

  if (isNodeRuntime(process.env.APP_RUNTIME as DEFAULT_RUNTIMES_VALUES)) {
    (
      await import("@/app/bootstrap/register-process-exceptions")
    ).registerProcessExceptions();
  }

  const app = await setupApp();
  logger.info(`🎉 ${name} is running! OpenAPI Route: 👉 /reference`);

  if (isNodeRuntime(process.env.APP_RUNTIME as DEFAULT_RUNTIMES_VALUES)) {
    const nodeApp = (await import("@hono/node-server")).serve(app);
    (
      await import("@/app/bootstrap/register-process-exits")
    ).registerProcessExits(nodeApp);
  }

  return app;
}

bootstrap();
