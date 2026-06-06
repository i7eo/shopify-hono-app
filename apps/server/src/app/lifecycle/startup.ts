import { getEnvProvider, getLoggerProvider } from "@/infra/provider";

export async function onAppStartup() {
  getEnvProvider(process.env);
  const logger = await getLoggerProvider();
  logger.info("🏖️ Both logger and env are initialized.");
}
