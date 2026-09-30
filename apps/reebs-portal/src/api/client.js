import {
  createBrowserApiClient,
  createReebsApi,
  isApiClientError,
} from "@faako/api-client";

const AUTH_CREDENTIAL_PATHS = new Set([
  "/api/login",
  "/api/v1/auth/login",
  "/api/forgotPassword",
  "/api/v1/auth/forgot-password",
  "/api/resetPassword",
  "/api/v1/auth/reset-password",
]);

const isAuthCredentialRequest = (path) => {
  try {
    return AUTH_CREDENTIAL_PATHS.has(
      new URL(String(path), "https://reebs.invalid").pathname
    );
  } catch {
    return false;
  }
};

export const createReebsPortalApi = ({ fetch: configuredFetch } = {}) => {
  const fetcher = configuredFetch || ((input, init) => globalThis.fetch(input, init));
  const client = createBrowserApiClient({
    // REEBS API paths are rewritten to the dedicated API origin in production
    // and to localhost:8888 during local development. The authenticated browser
    // session lives in an HttpOnly cookie on that API origin, so both login's
    // Set-Cookie response and every later request must opt into credentials.
    credentials: "include",
    fetch: fetcher,
  });

  return {
    client,
    /**
     * Response-compatible seam for legacy pages. It keeps their successful
     * Response contract while the shared transport adds standard credentials,
     * request IDs, cancellation, parsing, and normalized HTTP errors.
     */
    async response(path, options = {}) {
      try {
        return await client.request(path, {
          ...options,
          responseMode: "response",
        });
      } catch (error) {
        if (!isApiClientError(error) || !error.status) throw error;
        const legacyPayload =
          error.payload && typeof error.payload === "object"
            ? error.payload
            : { error: error.message };
        const shouldShowSessionExpired =
          error.status === 401 && !isAuthCredentialRequest(path);
        const payload = {
          ...legacyPayload,
          ...(shouldShowSessionExpired
            ? { error: "Your session has expired. Sign in again." }
            : error.status === 403
              ? { error: "You do not have permission to complete this action." }
              : {}),
        };
        const headers = new Headers({ "Content-Type": "application/json" });
        if (error.requestId) headers.set("X-Request-Id", error.requestId);
        return new Response(JSON.stringify(payload), {
          status: error.status,
          statusText: error.statusText,
          headers,
        });
      }
    },
  };
};

export const reebsPortalApi = createReebsPortalApi();
export const reebsApiResponse = reebsPortalApi.response;
export const reebsContractApi = createReebsApi(reebsPortalApi.client);
