import { bootstrapApp } from "@/app/bootstrap";
import type { AppEnv } from "@/types";

export default {
  async fetch(request, env, ctx) {
    const app = await bootstrapApp({ runStartup: false });
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
