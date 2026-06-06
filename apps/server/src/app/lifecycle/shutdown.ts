import { disposeProviders } from "@/infra/provider";

export async function onAppShutdown() {
  await disposeProviders();
}
