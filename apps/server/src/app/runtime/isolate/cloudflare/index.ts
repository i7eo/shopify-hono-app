import { bootstrapApp } from "@/app/bootstrap";
import { getRuntimeConfig } from "@/infra/env";
import logger, { setupLogger } from "@/infra/logger";
import { consumeCloudflareQueueBatch } from "@/infra/queue";
import { runCloudflareScheduledTasks } from "@/infra/scheduler";
import { registerCloudflareIsolateRuntimeCapabilities } from "./capabilities";
import type { RuntimeAppEnv } from "@/typings";

registerCloudflareIsolateRuntimeCapabilities();

const cloudflareApp = bootstrapApp();

export default {
  async fetch(request, env, ctx) {
    const app = await cloudflareApp;
    return app.fetch(request, env, ctx);
  },
  async queue(batch, env) {
    await consumeCloudflareQueueBatch(
      batch,
      await createCloudflareQueueJobContext(env),
    );
  },
  async scheduled(controller, env) {
    await runCloudflareScheduledTasks(
      controller.cron,
      await createCloudflareSchedulerTaskContext(env, controller.cron),
    );
  },
} satisfies ExportedHandler<RuntimeAppEnv<"cloudflare">["Bindings"]>;

async function createCloudflareQueueJobContext(
  env: RuntimeAppEnv<"cloudflare">["Bindings"],
) {
  const runtimeEnv = getRuntimeConfig(env);
  await setupLogger(runtimeEnv);

  return {
    bindings: env,
    logger,
    runtimeEnv,
  };
}

async function createCloudflareSchedulerTaskContext(
  env: RuntimeAppEnv<"cloudflare">["Bindings"],
  cron: string,
) {
  const runtimeEnv = getRuntimeConfig(env);
  await setupLogger(runtimeEnv);

  return {
    bindings: env,
    cron,
    logger,
    runtimeEnv,
  };
}
