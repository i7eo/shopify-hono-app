import { onAppStartup } from "../lifecycle/startup";
import { registerHealthController } from "../modules/health";
import { createApp } from "./create-app";

export async function setupApp() {
  await onAppStartup();

  const app = createApp();
  registerHealthController(app);

  return app;
}
