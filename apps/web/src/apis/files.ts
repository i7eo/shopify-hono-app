import { shopifyClient } from "@/utils/client.shopify";
import type { InsertFile } from "@shamt/database";

export interface ApiResponse<TData> {
  data?: TData;
}

/**
 * Uploads a raw file body to the backend file module.
 */
export function uploadFile(file: File, signal?: AbortSignal) {
  const headers = new Headers();
  headers.set("Content-Type", file.type || "application/octet-stream");
  headers.set("X-File-Name", file.name);

  return shopifyClient.post<ApiResponse<InsertFile>, File>("files", file, {
    headers,
    signal,
  });
}
