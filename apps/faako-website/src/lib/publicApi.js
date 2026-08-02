import { createBrowserApiClient } from "@faako/api-client/browser";
import { getApiErrorPresentation } from "@faako/api-client/errors";

const LEGACY_NETLIFY_FUNCTIONS_PATH = "/.netlify/functions";

const normalizeConfiguredApiBaseUrl = (value) => {
  const configuredBaseUrl = String(value || "").trim().replace(/\/+$/, "");
  if (!configuredBaseUrl) return "/api";

  return configuredBaseUrl.replace(
    new RegExp(
      `${LEGACY_NETLIFY_FUNCTIONS_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i",
    ),
    "/api",
  );
};

const publicApiBaseUrl = normalizeConfiguredApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
);

export const PUBLIC_SIGNUP_ENDPOINT = `${publicApiBaseUrl}/signup`;

const publicApi = createBrowserApiClient({
  baseUrl: publicApiBaseUrl,
  credentials: "omit",
});

export const submitClientIntake = (payload, idempotencyKey, signal) =>
  publicApi.post("/signup", {
    json: payload,
    headers: {
      "x-faako-idempotency-key": idempotencyKey,
    },
    signal,
    responseMode: "raw",
    fallbackMessage: "Could not submit the form. Please try again.",
  });

export const getPublicFormErrorMessage = (error, fallbackMessage) => {
  const presentation = getApiErrorPresentation(error, { fallbackMessage });
  return presentation.requestId
    ? `${presentation.message} Request ID: ${presentation.requestId}`
    : presentation.message;
};
