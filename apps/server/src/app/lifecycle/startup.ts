import { getEnvProvider, getLoggerProvider } from "@/infra/provider";

export async function onAppStartup() {
  getEnvProvider();
  await getLoggerProvider();
}
