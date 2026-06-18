import { disposeRuntimeCapabilities } from "@/app/runtime/capabilities";
import { disposeProviders } from "@/infra/provider";
import { stopProcessQueueConsumer } from "@/infra/queue";
import { stopProcessScheduler } from "@/infra/scheduler";

export async function onAppShutdown() {
  await stopProcessScheduler();
  await stopProcessQueueConsumer();
  await disposeProviders();
  await disposeRuntimeCapabilities();
  // TODO: database/redis disconnect
}
