import {
  API_ERROR_CODES,
  ApiContractError,
  normalizeApiResponse,
  readRequestId,
  readRetryAfterSeconds,
} from "@faako/api-contracts";

const DEFAULT_ERROR_MESSAGE =
  "Unable to complete the demo access request right now.";

export const parseDemoAccessResponse = async (response) => {
  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    throw new ApiContractError(
      {
        code: response.ok
          ? API_ERROR_CODES.SERVER
          : API_ERROR_CODES.UPSTREAM,
        message: DEFAULT_ERROR_MESSAGE,
      },
      {
        status: response.status,
        requestId: readRequestId(response.headers),
        retryAfterSeconds: readRetryAfterSeconds(response.headers),
      },
    );
  }

  const normalized = normalizeApiResponse(payload, {
    status: response.status,
    requestId: readRequestId(response.headers),
    retryAfterSeconds: readRetryAfterSeconds(response.headers),
  });

  if (!normalized.ok) {
    throw new ApiContractError(normalized.error, {
      status: response.status,
      requestId: normalized.meta?.requestId,
      retryAfterSeconds: normalized.meta?.retryAfterSeconds,
    });
  }

  return normalized.data;
};
