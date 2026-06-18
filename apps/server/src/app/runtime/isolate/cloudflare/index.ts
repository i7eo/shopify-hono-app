import { bootstrapApp } from "@/app/bootstrap";
import { registerJobs } from "@/app/bootstrap/register-jobs";
import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { getEnvProvider, getLoggerProvider } from "@/infra/provider";
import { registerCloudflareIsolateRuntimeCapabilities } from "./capabilities";
import type { RuntimeAppEnv } from "@/typings";

registerCloudflareIsolateRuntimeCapabilities();
registerJobs();

const cloudflareApp = bootstrapApp();

export default {
  async fetch(request, env, ctx) {
    const app = await cloudflareApp;
    return app.fetch(request, env, ctx);
  },
  async queue(batch, env) {
    const context = await createCloudflareQueueJobContext(env);
    const queueConsumerFactory = getRuntimeCapability("queueConsumerFactory");
    const queueConsumer = await queueConsumerFactory?.(context.runtimeEnv);
    await queueConsumer?.consume(batch, context);
  },
  async scheduled(controller, env) {
    const context = await createCloudflareSchedulerTaskContext(
      env,
      controller.cron,
    );
    const schedulerFactory = getRuntimeCapability("schedulerFactory");
    const scheduler = await schedulerFactory?.(context.runtimeEnv);
    await scheduler?.run(controller.cron, context);
  },
} satisfies ExportedHandler<RuntimeAppEnv<"cloudflare">["Bindings"]>;

async function createCloudflareQueueJobContext(
  env: RuntimeAppEnv<"cloudflare">["Bindings"],
) {
  const runtimeEnv = getEnvProvider(env);
  const logger = await getLoggerProvider(runtimeEnv);

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
  const runtimeEnv = getEnvProvider(env);
  const logger = await getLoggerProvider(runtimeEnv);

  return {
    bindings: env,
    cron,
    logger,
    runtimeEnv,
  };
}
