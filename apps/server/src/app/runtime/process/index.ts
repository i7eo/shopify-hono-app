import { serve } from "@hono/node-server";
import { DEFAULT_ENVS } from "@shamt/envs";
import { bootstrapApp } from "@/app/bootstrap";
import { registerProcessExceptions } from "@/app/runtime/process/register-process-exceptions";
import { registerProcessExits } from "@/app/runtime/process/register-process-exits";
import { getEnvProvider, getLoggerProvider } from "@/infra/provider";
import { name } from "../../../../package.json";
import { registerProcessRuntimeCapabilities } from "./capabilities";

export async function bootstrap() {
  registerProcessRuntimeCapabilities();

  const env = getEnvProvider(process.env);
  const app = await bootstrapApp({
    registerOpenApi: env.APP_ENV !== DEFAULT_ENVS.PRODUCTION,
  });
  const nodeApp = serve({
    fetch: app.fetch,
    port: env.APP__SERVER_PORT,
  });

  const logger = await getLoggerProvider();
  logger.info(
    `🎉 ${name} is running on port ${env.APP__SERVER_PORT}! OpenAPI Route: 👉 /reference`,
  );

  await registerProcessExceptions();
  await registerProcessExits(nodeApp);
}

bootstrap();
