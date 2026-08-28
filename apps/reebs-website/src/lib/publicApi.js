import { createBrowserApiClient } from "@faako/api-client/browser";
import { getApiErrorPresentation, isApiClientError } from "@faako/api-client/errors";
import { createReebsApi } from "@faako/api-client/reebs";

const normalizePublicApiBaseUrl = (value) => {
  const configured = String(value || "").trim().replace(/\/+$/, "");
  if (!configured) return "/api";
  return configured.endsWith("/api") ? configured : `${configured}/api`;
};

export const publicApi = createBrowserApiClient({
  baseUrl: normalizePublicApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_BASE_URL,
  ),
  credentials: "same-origin",
});

export const reebsPublicApi = createReebsApi(publicApi, { pathPrefix: "/v1" });

/** Response-compatible bridge for React views that still parse Response directly. */
export const publicApiResponse = async (path, options = {}) => {
  try {
    return await publicApi.request(path, { ...options, responseMode: "response" });
  } catch (error) {
    if (!isApiClientError(error) || !error.status) throw error;
    const legacyPayload = error.payload && typeof error.payload === "object"
      ? error.payload
      : { error: error.message };
    const headers = new Headers({ "Content-Type": "application/json" });
    if (error.requestId) headers.set("X-Request-Id", error.requestId);
    return new Response(JSON.stringify(legacyPayload), {
      status: error.status,
      statusText: error.statusText,
      headers,
    });
  }
};

export const getPublicApiErrorMessage = (error, fallbackMessage) => {
  const presentation = getApiErrorPresentation(error, { fallbackMessage });
  return presentation.requestId
    ? `${presentation.message} Request ID: ${presentation.requestId}`
    : presentation.message;
};
