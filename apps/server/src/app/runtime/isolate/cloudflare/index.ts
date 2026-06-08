import { bootstrapApp } from "@/app/bootstrap";
import { registerCloudflareIsolateRuntimeCapabilities } from "./capabilities";
import type { AppEnv } from "@/types";

registerCloudflareIsolateRuntimeCapabilities();

export default {
  async fetch(request, env, ctx) {
    const app = await bootstrapApp({ runStartup: false });
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
