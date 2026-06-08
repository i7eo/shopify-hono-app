import { serve } from "@hono/node-server";
import { bootstrapApp } from "@/app/bootstrap";
import { checkProcessDiskAccess } from "@/app/modules/health/disk.node";
import { registerProcessDiskHealthChecker } from "@/app/modules/health/service";
import { registerProcessExceptions } from "@/app/runtime/process/register-process-exceptions";
import { registerProcessExits } from "@/app/runtime/process/register-process-exits";
import { registerProcessLoggerSetup } from "@/infra/logger";
import { setupProcessLogger } from "@/infra/logger/process";
import { getLoggerProvider } from "@/infra/provider";
import { name } from "../../../../package.json";

async function bootstrap() {
  registerProcessLoggerSetup(setupProcessLogger);
  registerProcessDiskHealthChecker(checkProcessDiskAccess);

  await registerProcessExceptions();

  const app = await bootstrapApp();
  const nodeApp = serve(app);

  const logger = await getLoggerProvider();
  logger.info(`🎉 ${name} is running! OpenAPI Route: 👉 /reference`);
  await registerProcessExits(nodeApp);
}

bootstrap();
