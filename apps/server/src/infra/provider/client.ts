import { createClient } from "@/infra/http/client";
import { providerDisposers, providers } from "./constants";

export type HttpClient = ReturnType<typeof createClient>;

export function getClientProvider(): HttpClient {
  if (!providers.has("client")) {
    setClientProvider(createClient());
  }

  return providers.get("client") as HttpClient;
}

export function resetClientProvider() {
  providers.delete("client");
  providerDisposers.delete("client");
}

function setClientProvider(client: HttpClient) {
  providers.set("client", client);
  providerDisposers.set("client", resetClientProvider);
}
