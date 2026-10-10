import {
  createBrowserApiClient,
  isApiClientError,
} from "@faako/api-client";

const client = createBrowserApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || undefined,
  credentials: "include",
});

export async function reebsApiResponse(path, options = {}) {
  try {
    return await client.request(path, {
      ...options,
      responseMode: "response",
    });
  } catch (error) {
    if (!isApiClientError(error) || !error.status) throw error;
    const payload = error.payload && typeof error.payload === "object"
      ? error.payload
      : { error: error.message };
    const headers = new Headers({ "Content-Type": "application/json" });
    if (error.requestId) headers.set("X-Request-Id", error.requestId);
    return new Response(JSON.stringify(payload), {
      status: error.status,
      statusText: error.statusText,
      headers,
    });
  }
}
