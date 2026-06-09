import { getEnvProvider, getLoggerProvider } from "@/infra/provider";
import { isDev } from "@/utils";

/**
 * Register global exception handlers for uncaught errors
 */
export async function registerProcessExceptions() {
  const env = getEnvProvider();
  const logger = await getLoggerProvider();

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: unknown, promise: Promise<any>) => {
    logger.error({ promise, reason, $message: "Unhandled Rejection" });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    logger.error({ error, $message: "Uncaught Exception" });
    !isDev(env.APP_ENV) && process.exit(1);
  });

  process.on("beforeExit", (code) => {
    logger.info(`Process beforeExit event with code: ${code}`);
  });

  process.on("exit", (code) => {
    logger.info(`Process exit event with code: ${code}`);
  });
}
