import { runtimeCapabilityNodeDispose } from "@/app/runtime/process/runtime-capabilities";
import { providersDispose } from "@/infra/provider";

export async function onAppShutdown() {
  await runtimeCapabilityNodeDispose();
  await providersDispose();
}
