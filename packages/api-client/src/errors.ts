import {
  API_ERROR_MESSAGES,
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
  cause?: unknown;

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

export type ApiErrorStateId =
  | "error"
  | "offline"
  | "permission-denied"
  | "rate-limited"
  | "session-expired"
  | "validation";

export interface ApiErrorPresentation {
  stateId: ApiErrorStateId;
  title: string;
  message: string;
  canRetry: boolean;
  retryLabel?: string;
  requestId?: string;
}

export const getApiErrorPresentation = (
  error: unknown,
  {
    fallbackMessage = API_ERROR_MESSAGES[API_ERROR_CODES.SERVER],
  }: { fallbackMessage?: string } = {},
): ApiErrorPresentation => {
  const apiError = isApiClientError(error) ? error : null;
  const code = apiError?.code || API_ERROR_CODES.SERVER;
  const requestId = apiError?.requestId;
  const withRequestId = (presentation: Omit<ApiErrorPresentation, "requestId">) => ({
    ...presentation,
    ...(requestId ? { requestId } : {}),
  });

  if (code === API_ERROR_CODES.AUTHENTICATION || apiError?.status === 401) {
    return withRequestId({
      stateId: "session-expired",
      title: "Sign in again",
      message: API_ERROR_MESSAGES[API_ERROR_CODES.AUTHENTICATION],
      canRetry: false,
    });
  }
  if (code === API_ERROR_CODES.PERMISSION || apiError?.status === 403) {
    return withRequestId({
      stateId: "permission-denied",
      title: "Access unavailable",
      message: API_ERROR_MESSAGES[API_ERROR_CODES.PERMISSION],
      canRetry: false,
    });
  }
  if (code === API_ERROR_CODES.VALIDATION) {
    return withRequestId({
      stateId: "validation",
      title: "Check the form",
      message: API_ERROR_MESSAGES[API_ERROR_CODES.VALIDATION],
      canRetry: false,
    });
  }
  if (code === API_ERROR_CODES.RATE_LIMITED || apiError?.status === 429) {
    return withRequestId({
      stateId: "rate-limited",
      title: "Try again later",
      message: apiError?.retryAfterSeconds
        ? `Too many requests. Try again in ${apiError.retryAfterSeconds} seconds.`
        : API_ERROR_MESSAGES[API_ERROR_CODES.RATE_LIMITED],
      canRetry: true,
      retryLabel: "Try again",
    });
  }
  if (code === API_CLIENT_ERROR_CODES.NETWORK) {
    return withRequestId({
      stateId: "offline",
      title: "Service unavailable",
      message: "Check your connection and try again.",
      canRetry: true,
      retryLabel: "Retry request",
    });
  }

  return withRequestId({
    stateId: "error",
    title: "Request not completed",
    message:
      code === API_ERROR_CODES.SERVICE_UNAVAILABLE
        ? API_ERROR_MESSAGES[API_ERROR_CODES.SERVICE_UNAVAILABLE]
        : fallbackMessage,
    canRetry:
      code !== API_CLIENT_ERROR_CODES.ABORTED &&
      code !== API_CLIENT_ERROR_CODES.SERIALIZATION,
    retryLabel: "Try again",
  });
};

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
  const error = normalized.ok === true
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
  _message: string,
  options: ApiClientErrorOptions,
): ApiClientError =>
  new ApiClientError("The service returned an invalid response.", {
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
