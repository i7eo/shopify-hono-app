import { serve } from "@hono/node-server";
import { DEFAULT_ENVS } from "@shamt/app-env";
import { bootstrapApp } from "@/app/bootstrap";
import { registerJobs } from "@/app/bootstrap/register-jobs";
import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { registerProcessExceptions } from "@/app/runtime/process/register-process-exceptions";
import { registerProcessExits } from "@/app/runtime/process/register-process-exits";
import { getEnvProvider, getLoggerProvider } from "@/infra/provider";
import { name } from "../../../../package.json";
import { registerProcessRuntimeCapabilities } from "./capabilities";

export async function bootstrap() {
  registerProcessRuntimeCapabilities();
  registerJobs();

  // error catch first
  await registerProcessExceptions();

  const env = getEnvProvider();
  const app = await bootstrapApp({
    registerOpenApi: env.APP_ENV !== DEFAULT_ENVS.PRODUCTION,
  });
  const nodeApp = serve({
    fetch: app.fetch,
    port: env.APP__SERVER_PORT,
  });
  await registerProcessExits(nodeApp);

  const logger = await getLoggerProvider();
  logger.info(
    `🎉 ${name} is running on port ${env.APP__SERVER_PORT}! OpenAPI Route: 👉 /reference`,
  );

  const queueConsumerFactory = getRuntimeCapability("queueConsumerFactory");
  const queueConsumer = await queueConsumerFactory?.(env);
  await queueConsumer?.start({
    logger,
    runtimeEnv: env,
  });
  const schedulerFactory = getRuntimeCapability("schedulerFactory");
  const scheduler = await schedulerFactory?.(env);
  await scheduler?.start({
    logger,
    runtimeEnv: env,
  });
}

bootstrap();
