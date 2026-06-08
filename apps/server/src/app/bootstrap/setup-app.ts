import { onAppStartup } from "../lifecycle/startup";
import { createApp } from "./create-app";

export async function setupApp() {
  await onAppStartup();

  const app = createApp();

  return app;
}
