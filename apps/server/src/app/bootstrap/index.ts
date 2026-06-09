import { onAppStartup } from "../lifecycle/startup";
import { createApp } from "./create-app";
import { registerOpenAPI } from "./register-openapi";

export async function bootstrapApp(
  options: {
    runStartup?: boolean;
    registerOpenApi?: boolean;
  } = {},
) {
  const { runStartup, registerOpenApi } = options;

  if (runStartup) {
    await onAppStartup();
  }

  const app = createApp();
  registerOpenAPI(app, { enabled: registerOpenApi });

  return app;
}
