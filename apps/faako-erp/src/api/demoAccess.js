import {
  API_CLIENT_ERROR_CODES,
  ApiClientError,
  createBrowserApiClient,
} from "@faako/api-client";

const DEFAULT_ERROR_MESSAGE =
  "Unable to complete the demo access request right now.";

export const createDemoAccessApi = ({
  endpoint,
  mode = "api",
  fetch: fetcher,
  requestIdFactory,
} = {}) => {
  const client = createBrowserApiClient({
    credentials: "same-origin",
    fetch: fetcher,
    requestIdFactory,
  });

  return {
    async submit(payload, { signal, requestId } = {}) {
      if (String(mode).trim().toLowerCase() === "local") {
        throw new Error(
          "Demo access must be verified by the Faako API. Configure VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT.",
        );
      }

      const data = await client.post(String(endpoint || "/api/demo-access"), {
        json: payload,
        signal,
        requestId,
        responseMode: "data",
        fallbackMessage: DEFAULT_ERROR_MESSAGE,
      });

      if (!data || typeof data !== "object") {
        throw new ApiClientError(DEFAULT_ERROR_MESSAGE, {
          code: API_CLIENT_ERROR_CODES.INVALID_RESPONSE,
          method: "POST",
          url: String(endpoint || "/api/demo-access"),
          requestId,
          payload: data,
        });
      }

      return data;
    },
  };
};
