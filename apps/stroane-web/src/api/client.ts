import { createBrowserApiClient } from "@faako/api-client/browser";
import { API_BASE_URL } from "./config";

/**
 * Shared browser boundary for both Stroane surfaces. The API owns auth through
 * HttpOnly cookies; the client adds request IDs and normalizes contract errors.
 */
export const stroaneApiClient = createBrowserApiClient({
  baseUrl: API_BASE_URL,
  credentials: "include",
});
