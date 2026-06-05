import logger, { setupBootstrapLogger } from "@/infra/logger";

export async function onAppStartup() {
  await setupBootstrapLogger();
  logger.info("App startup initialized");
}
