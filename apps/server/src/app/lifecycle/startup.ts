import { getEnvProvider, getLoggerProvider } from "@/infra/provider";

export async function onAppStartup() {
  getEnvProvider(process.env);
  await getLoggerProvider();
}
