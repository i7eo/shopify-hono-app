import { serve } from "@hono/node-server";
import { bootstrapApp } from "@/app/bootstrap";
import { registerProcessExceptions } from "@/app/runtime/process/register-process-exceptions";
import { registerProcessExits } from "@/app/runtime/process/register-process-exits";
import { getLoggerProvider } from "@/infra/provider";
import { name } from "../../../../package.json";
import { registerProcessRuntimeCapabilities } from "./capabilities";

export async function bootstrap() {
  registerProcessRuntimeCapabilities();

  const app = await bootstrapApp();
  const nodeApp = serve(app);

  const logger = await getLoggerProvider();
  logger.info(`🎉 ${name} is running! OpenAPI Route: 👉 /reference`);

  await registerProcessExceptions();
  await registerProcessExits(nodeApp);
}

bootstrap();
