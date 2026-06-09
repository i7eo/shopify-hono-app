import { bootstrapApp } from "@/app/bootstrap";
import { registerCloudflareIsolateRuntimeCapabilities } from "./capabilities";
import type { RuntimeAppEnv } from "@/types";

registerCloudflareIsolateRuntimeCapabilities();

const cloudflareApp = bootstrapApp();

export default {
  async fetch(request, env, ctx) {
    const app = await cloudflareApp;
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<RuntimeAppEnv<"cloudflare">["Bindings"]>;
