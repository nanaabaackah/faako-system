import {
  API_ERROR_CODES,
  errorCodeForStatus,
  normalizeApiResponse,
  readRequestId,
  readRetryAfterSeconds,
  type ApiValidationIssue,
} from "@faako/api-contracts";

export const API_CLIENT_ERROR_CODES = Object.freeze({
  ABORTED: "request_aborted",
  INVALID_RESPONSE: "invalid_response",
  NETWORK: "network_error",
  SERIALIZATION: "serialization_error",
});

export type ApiClientLocalErrorCode =
  (typeof API_CLIENT_ERROR_CODES)[keyof typeof API_CLIENT_ERROR_CODES];

export interface ApiClientErrorOptions {
  code?: string;
  status?: number;
  statusText?: string;
  method?: string;
  url?: string;
  payload?: unknown;
  details?: unknown;
  issues?: ApiValidationIssue[];
  requestId?: string;
  retryAfterSeconds?: number;
  cause?: unknown;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  statusText: string;
  method: string;
  url: string;
  payload?: unknown;
  details?: unknown;
  issues?: ApiValidationIssue[];
  requestId?: string;
  retryAfterSeconds?: number;
  override cause?: unknown;

  constructor(message: string, options: ApiClientErrorOptions = {}) {
    super(message);
    this.name = "ApiClientError";
    this.code = options.code || API_ERROR_CODES.SERVER;
    this.status = Number(options.status || 0);
    this.statusText = options.statusText || "";
    this.method = String(options.method || "GET").toUpperCase();
    this.url = options.url || "";

    if (options.payload !== undefined) this.payload = options.payload;
    if (options.details !== undefined) this.details = options.details;
    if (options.issues?.length) this.issues = options.issues;
    if (options.requestId) this.requestId = options.requestId;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export const isApiClientError = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError;

interface ResponseErrorContext {
  response: Response;
  payload: unknown;
  fallbackMessage: string;
  method: string;
  url: string;
  sentRequestId?: string;
}

export const createResponseError = ({
  response,
  payload,
  fallbackMessage,
  method,
  url,
  sentRequestId,
}: ResponseErrorContext): ApiClientError => {
  const headerRequestId = readRequestId(response.headers);
  const retryAfterSeconds = readRetryAfterSeconds(response.headers);
  const normalized = normalizeApiResponse(payload, {
    status: response.status,
    requestId: headerRequestId || sentRequestId,
    retryAfterSeconds,
  });
  const error = normalized.ok
    ? {
        code: errorCodeForStatus(response.status),
        message: fallbackMessage,
      }
    : normalized.error;

  return new ApiClientError(error.message || fallbackMessage, {
    code: error.code || errorCodeForStatus(response.status),
    status: response.status,
    statusText: response.statusText,
    method,
    url,
    payload,
    details: error.details,
    issues: error.issues,
    requestId: normalized.meta?.requestId || headerRequestId || sentRequestId,
    retryAfterSeconds:
      normalized.meta?.retryAfterSeconds ?? retryAfterSeconds,
  });
};

interface LocalErrorContext {
  method: string;
  url: string;
  requestId?: string;
  cause?: unknown;
}

export const createAbortedError = ({
  method,
  url,
  requestId,
  cause,
}: LocalErrorContext): ApiClientError =>
  new ApiClientError("The request was cancelled.", {
    code: API_CLIENT_ERROR_CODES.ABORTED,
    method,
    url,
    requestId,
    cause,
  });

export const createNetworkError = ({
  method,
  url,
  requestId,
  cause,
}: LocalErrorContext): ApiClientError =>
  new ApiClientError("Unable to reach the service.", {
    code: API_CLIENT_ERROR_CODES.NETWORK,
    method,
    url,
    requestId,
    cause,
  });

export const createInvalidResponseError = (
  message: string,
  options: ApiClientErrorOptions,
): ApiClientError =>
  new ApiClientError(message, {
    ...options,
    code: API_CLIENT_ERROR_CODES.INVALID_RESPONSE,
  });

export const createSerializationError = (
  options: LocalErrorContext,
): ApiClientError =>
  new ApiClientError("The request body could not be serialized.", {
    ...options,
    code: API_CLIENT_ERROR_CODES.SERIALIZATION,
  });
