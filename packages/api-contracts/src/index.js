export const API_ERROR_CODES = Object.freeze({
  BAD_REQUEST: "bad_request",
  VALIDATION: "validation_error",
  AUTHENTICATION: "authentication_error",
  PERMISSION: "permission_error",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  RATE_LIMITED: "rate_limited",
  SERVER: "server_error",
  SERVICE_UNAVAILABLE: "service_unavailable",
  UPSTREAM: "upstream_error",
});

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanString = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const cleanPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const buildMeta = ({ requestId, pagination, retryAfterSeconds } = {}) => {
  const meta = {};
  const normalizedRequestId = cleanString(requestId);
  const normalizedRetryAfter = cleanPositiveNumber(retryAfterSeconds);

  if (normalizedRequestId) meta.requestId = normalizedRequestId;
  if (isObject(pagination)) meta.pagination = pagination;
  if (normalizedRetryAfter !== undefined) {
    meta.retryAfterSeconds = normalizedRetryAfter;
  }

  return Object.keys(meta).length ? meta : undefined;
};

const normalizeIssues = (value) => {
  if (!Array.isArray(value)) return undefined;

  const issues = value
    .map((issue) => {
      if (typeof issue === "string" && issue.trim()) {
        return { message: issue.trim() };
      }
      if (!isObject(issue)) return null;

      const message = cleanString(issue.message || issue.msg || issue.error);
      if (!message) return null;

      const path = Array.isArray(issue.loc)
        ? issue.loc.filter((part) => part !== "body").join(".")
        : "";
      const field = cleanString(issue.field || issue.path || path);
      const code = cleanString(issue.code || issue.type);

      return {
        ...(field ? { field } : {}),
        ...(code ? { code } : {}),
        message,
      };
    })
    .filter(Boolean);

  return issues.length ? issues : undefined;
};

export const errorCodeForStatus = (status) => {
  const normalizedStatus = Number(status);
  if (normalizedStatus === 400 || normalizedStatus === 413 || normalizedStatus === 422) {
    return API_ERROR_CODES.VALIDATION;
  }
  if (normalizedStatus === 401) return API_ERROR_CODES.AUTHENTICATION;
  if (normalizedStatus === 403) return API_ERROR_CODES.PERMISSION;
  if (normalizedStatus === 404) return API_ERROR_CODES.NOT_FOUND;
  if (normalizedStatus === 409) return API_ERROR_CODES.CONFLICT;
  if (normalizedStatus === 429) return API_ERROR_CODES.RATE_LIMITED;
  if (normalizedStatus === 502) return API_ERROR_CODES.UPSTREAM;
  if (normalizedStatus === 503 || normalizedStatus === 504) {
    return API_ERROR_CODES.SERVICE_UNAVAILABLE;
  }
  if (normalizedStatus >= 500) return API_ERROR_CODES.SERVER;
  return API_ERROR_CODES.BAD_REQUEST;
};

export const createSuccessResponse = (data, options = {}) => {
  const meta = buildMeta(options);
  return {
    ok: true,
    data,
    ...(meta ? { meta } : {}),
  };
};

export const createCompatibleSuccessResponse = (data, options = {}) => {
  const legacy = isObject(options.legacy)
    ? options.legacy
    : isObject(data)
      ? data
      : {};
  return {
    ...legacy,
    ...createSuccessResponse(data, options),
  };
};

export const createErrorResponse = (input, options = {}) => {
  const error = {
    code: cleanString(input?.code) || API_ERROR_CODES.SERVER,
    message: cleanString(input?.message) || "Request failed.",
  };
  const issues = normalizeIssues(input?.issues);
  const meta = buildMeta(options);

  if (input?.details !== undefined) error.details = input.details;
  if (issues) error.issues = issues;

  return {
    ok: false,
    error,
    ...(meta ? { meta } : {}),
  };
};

export const createCompatibleErrorResponse = (input, options = {}) => {
  const canonical = createErrorResponse(input, options);
  const legacy = isObject(options.legacy) ? options.legacy : {};

  return {
    ...legacy,
    ok: false,
    error: canonical.error.message,
    apiError: canonical.error,
    ...(canonical.meta ? { meta: canonical.meta } : {}),
  };
};

const getLegacySuccessData = (payload) => {
  if (!isObject(payload)) return payload;
  const {
    ok: _ok,
    meta: _meta,
    apiError: _apiError,
    error: _error,
    ...data
  } = payload;
  return data;
};

const getErrorFromPayload = (payload, status) => {
  if (!isObject(payload)) {
    return {
      code: errorCodeForStatus(status),
      message: cleanString(payload) || "Request failed.",
    };
  }

  const structuredError = isObject(payload.apiError)
    ? payload.apiError
    : isObject(payload.error)
      ? payload.error
      : null;
  const detailIssues = Array.isArray(payload.detail) ? payload.detail : undefined;
  const issues = normalizeIssues(
    structuredError?.issues || payload.issues || payload.errors || detailIssues,
  );
  const message =
    cleanString(structuredError?.message) ||
    cleanString(payload.error) ||
    cleanString(payload.message) ||
    cleanString(payload.detail) ||
    (issues ? "Validation failed." : "Request failed.");
  const error = {
    code:
      cleanString(structuredError?.code || payload.errorCode || payload.code) ||
      errorCodeForStatus(status),
    message,
  };

  const details = structuredError?.details ?? payload.details;
  if (details !== undefined) error.details = details;
  if (issues) error.issues = issues;
  return error;
};

export const normalizeApiResponse = (payload, options = {}) => {
  const status = Number(options.status || 0);
  const payloadMeta = isObject(payload?.meta) ? payload.meta : {};
  const meta = buildMeta({
    requestId: options.requestId || payloadMeta.requestId || payload?.requestId,
    pagination: payloadMeta.pagination || payload?.pagination,
    retryAfterSeconds:
      options.retryAfterSeconds ??
      payloadMeta.retryAfterSeconds ??
      payload?.retryAfterSeconds,
  });
  const isError =
    status >= 400 ||
    payload?.ok === false ||
    Boolean(payload?.apiError) ||
    Boolean(payload?.error && payload?.ok !== true);

  if (isError) {
    return {
      ok: false,
      error: getErrorFromPayload(payload, status),
      ...(meta ? { meta } : {}),
    };
  }

  return {
    ok: true,
    data:
      isObject(payload) && Object.prototype.hasOwnProperty.call(payload, "data")
        ? payload.data
        : getLegacySuccessData(payload),
    ...(meta ? { meta } : {}),
  };
};

export class ApiContractError extends Error {
  constructor(error, options = {}) {
    super(cleanString(error?.message) || "Request failed.");
    this.name = "ApiContractError";
    this.code = cleanString(error?.code) || API_ERROR_CODES.SERVER;
    this.status = Number(options.status || 0);
    if (error?.details !== undefined) this.details = error.details;
    if (Array.isArray(error?.issues)) this.issues = error.issues;
    if (cleanString(options.requestId)) this.requestId = options.requestId.trim();
    const retryAfterSeconds = cleanPositiveNumber(options.retryAfterSeconds);
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const getApiErrorMessage = (payload, fallback = "Request failed.") => {
  const normalized = normalizeApiResponse(payload, { status: 500 });
  return normalized.ok ? fallback : normalized.error.message || fallback;
};

export const getApiResponseData = (payload, options = {}) => {
  const normalized = normalizeApiResponse(payload, options);
  if (!normalized.ok) {
    throw new ApiContractError(normalized.error, {
      status: options.status,
      requestId: normalized.meta?.requestId,
      retryAfterSeconds: normalized.meta?.retryAfterSeconds,
    });
  }
  return normalized.data;
};

const readHeader = (headers, name) => {
  if (!headers) return "";
  if (typeof headers.get === "function") {
    return cleanString(headers.get(name));
  }
  if (!isObject(headers)) return "";

  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return cleanString(entry?.[1]);
};

export const readRequestId = (headers) =>
  readHeader(headers, "x-request-id") || readHeader(headers, "request-id");

export const readRetryAfterSeconds = (headers) =>
  cleanPositiveNumber(readHeader(headers, "retry-after"));
