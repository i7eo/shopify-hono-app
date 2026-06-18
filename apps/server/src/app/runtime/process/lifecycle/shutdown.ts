import { disposeRuntimeCapabilities } from "@/app/runtime/capabilities";
import { disposeProviders } from "@/infra/provider";

export async function onAppShutdown() {
  await disposeRuntimeCapabilities();
  await disposeProviders();
}
