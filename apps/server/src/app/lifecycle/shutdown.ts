import { disposeProviders } from "@/infra/provider";
import type { AppEnv } from "@/types";
import type { Hono } from "hono";

export async function onAppShutdown(app: Hono<AppEnv>) {
  await console.info(typeof app);
  await disposeProviders();
}
