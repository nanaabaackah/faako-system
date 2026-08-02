import { createBrowserApiClient } from "@faako/api-client/browser";
import { getApiErrorPresentation } from "@faako/api-client/errors";

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

export const getPublicApiErrorMessage = (error, fallbackMessage) => {
  const presentation = getApiErrorPresentation(error, { fallbackMessage });
  return presentation.requestId
    ? `${presentation.message} Request ID: ${presentation.requestId}`
    : presentation.message;
};
