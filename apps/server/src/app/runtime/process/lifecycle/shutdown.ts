import { disposeRuntimeCapabilities } from "@/app/runtime/capabilities";
import { disposeProviders } from "@/infra/provider";

export async function onAppShutdown() {
  await disposeProviders();
  await disposeRuntimeCapabilities();
  // TODO: database/redis disconnect
}
