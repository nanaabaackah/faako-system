export const API_ERROR_CODES: Readonly<{
  BAD_REQUEST: "bad_request";
  VALIDATION: "validation_error";
  AUTHENTICATION: "authentication_error";
  PERMISSION: "permission_error";
  NOT_FOUND: "not_found";
  CONFLICT: "conflict";
  RATE_LIMITED: "rate_limited";
  SERVER: "server_error";
  SERVICE_UNAVAILABLE: "service_unavailable";
  UPSTREAM: "upstream_error";
}>;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>>;
export const API_ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>>;
export const REQUEST_ID_HEADER: "X-Request-Id";

export interface ApiValidationIssue {
  field?: string;
  code?: string;
  message: string;
}

export interface ApiPagination {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  cursor?: string | null;
  nextCursor?: string | null;
  previousCursor?: string | null;
}

export interface ApiResponseMeta {
  requestId?: string;
  pagination?: ApiPagination;
  retryAfterSeconds?: number;
}

export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
  details?: unknown;
  issues?: ApiValidationIssue[];
}

export interface ApiSuccessResponse<Data> {
  ok: true;
  data: Data;
  meta?: ApiResponseMeta;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiError;
  meta?: ApiResponseMeta;
}

export type ApiResponse<Data> = ApiSuccessResponse<Data> | ApiErrorResponse;

export type CompatibleApiSuccessResponse<
  Data,
  Legacy extends Record<string, unknown> = Record<string, unknown>,
> = ApiSuccessResponse<Data> & Legacy;

export type CompatibleApiErrorResponse<
  Legacy extends Record<string, unknown> = Record<string, unknown>,
> = Omit<ApiErrorResponse, "error"> &
  Legacy & {
    error: string;
    apiError: ApiError;
  };

export interface ApiSuccessOptions<Legacy extends Record<string, unknown>> {
  requestId?: string;
  pagination?: ApiPagination;
  retryAfterSeconds?: number;
  legacy?: Legacy;
}

export interface ApiErrorInput {
  code: ApiErrorCode | string;
  message: string;
  details?: unknown;
  issues?: ApiValidationIssue[];
}

export interface ApiErrorOptions<Legacy extends Record<string, unknown>> {
  requestId?: string;
  retryAfterSeconds?: number;
  legacy?: Legacy;
}

export interface NormalizeApiResponseOptions {
  status?: number;
  requestId?: string;
  retryAfterSeconds?: number;
}

export class ApiContractError extends Error {
  code: string;
  status: number;
  details?: unknown;
  issues?: ApiValidationIssue[];
  requestId?: string;
  retryAfterSeconds?: number;

  constructor(
    error: ApiError,
    options?: {
      status?: number;
      requestId?: string;
      retryAfterSeconds?: number;
    },
  );
}

export function errorCodeForStatus(status: number): ApiErrorCode;
export function statusForErrorCode(code: unknown, fallback?: number): number;
export function safeMessageForErrorCode(
  code: unknown,
  fallback?: string,
): string;
export function isValidRequestId(value: unknown): boolean;
export function createRequestId(): string;
export function resolveRequestId(
  value: unknown,
  factory?: () => string,
): string;

export function createSuccessResponse<Data>(
  data: Data,
  options?: ApiSuccessOptions<Record<string, never>>,
): ApiSuccessResponse<Data>;

export function createCompatibleSuccessResponse<
  Data,
  Legacy extends Record<string, unknown> = Data extends Record<string, unknown>
    ? Data
    : Record<string, never>,
>(
  data: Data,
  options?: ApiSuccessOptions<Legacy>,
): CompatibleApiSuccessResponse<Data, Legacy>;

export function createErrorResponse(
  input: ApiErrorInput,
  options?: ApiErrorOptions<Record<string, never>>,
): ApiErrorResponse;

export function createCompatibleErrorResponse<
  Legacy extends Record<string, unknown> = Record<string, never>,
>(
  input: ApiErrorInput,
  options?: ApiErrorOptions<Legacy>,
): CompatibleApiErrorResponse<Legacy>;

export function normalizeApiResponse<Data = unknown>(
  payload: unknown,
  options?: NormalizeApiResponseOptions,
): ApiResponse<Data>;

export function getApiErrorMessage(payload: unknown, fallback?: string): string;

export function getApiResponseData<Data = unknown>(
  payload: unknown,
  options?: NormalizeApiResponseOptions,
): Data;

export function readRequestId(
  headers: Headers | Record<string, unknown> | null | undefined,
): string;

export function readRetryAfterSeconds(
  headers: Headers | Record<string, unknown> | null | undefined,
): number | undefined;
