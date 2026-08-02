import {
  createApiClient,
  type ApiClient,
  type ApiClientConfig,
} from "./request.ts";

export type BrowserApiClientConfig = ApiClientConfig;

export const createBrowserApiClient = (
  config: BrowserApiClientConfig = {},
): ApiClient =>
  createApiClient({
    credentials: "same-origin",
    ...config,
  });
