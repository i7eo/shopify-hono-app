import { onAppStartup } from "../lifecycle/startup";
import { createApp } from "./create-app";

export async function bootstrapApp(
  options: {
    runStartup?: boolean;
  } = {},
) {
  const { runStartup } = options;

  if (runStartup) {
    await onAppStartup();
  }

  const app = createApp();

  return app;
}
