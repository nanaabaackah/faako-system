import {
  createRequestId,
  normalizeApiResponse,
  readRequestId,
  readRetryAfterSeconds,
} from "@faako/api-contracts";
import {
  ApiClientError,
  createAbortedError,
  createInvalidResponseError,
  createNetworkError,
  createResponseError,
  createSerializationError,
} from "./errors.ts";

export type ApiResponseMode =
  | "raw"
  | "data"
  | "text"
  | "blob"
  | "arrayBuffer"
  | "response";

export type ApiQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type ApiQuery = Record<
  string,
  ApiQueryValue | readonly ApiQueryValue[]
>;

export type HeaderSource =
  | HeadersInit
  | (() => HeadersInit | undefined | Promise<HeadersInit | undefined>);

export interface ApiClientConfig {
  baseUrl?: string;
  credentials?: RequestCredentials;
  defaultHeaders?: HeaderSource;
  fetch?: typeof globalThis.fetch;
  requestIdFactory?: () => string | undefined;
}

export interface ApiRequestOptions
  extends Omit<
    RequestInit,
    "body" | "credentials" | "headers" | "method" | "signal"
  > {
  method?: string;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  body?: BodyInit | null;
  json?: unknown;
  signal?: AbortSignal;
  requestId?: string;
  responseMode?: ApiResponseMode;
  fallbackMessage?: string;
}

export interface ApiDetailedResponse<Data> {
  data: Data;
  response: Response;
  requestId?: string;
}

export interface ApiClient {
  request<Data = unknown>(
    path: string | URL,
    options?: ApiRequestOptions,
  ): Promise<Data>;
  requestDetailed<Data = unknown>(
    path: string | URL,
    options?: ApiRequestOptions,
  ): Promise<ApiDetailedResponse<Data>>;
  get<Data = unknown>(
    path: string | URL,
    options?: ApiRequestOptions,
  ): Promise<Data>;
  post<Data = unknown>(
    path: string | URL,
    options?: ApiRequestOptions,
  ): Promise<Data>;
  put<Data = unknown>(
    path: string | URL,
    options?: ApiRequestOptions,
  ): Promise<Data>;
  patch<Data = unknown>(
    path: string | URL,
    options?: ApiRequestOptions,
  ): Promise<Data>;
  delete<Data = unknown>(
    path: string | URL,
    options?: ApiRequestOptions,
  ): Promise<Data>;
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

const cleanRequestId = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /[\r\n]/.test(trimmed)) return "";
  return trimmed;
};

const resolveDefaultHeaders = async (
  source: HeaderSource | undefined,
): Promise<HeadersInit | undefined> =>
  typeof source === "function" ? source() : source;

export const resolveRequestUrl = (
  baseUrl: string | undefined,
  path: string | URL,
): string => {
  const rawPath = String(path);
  if (ABSOLUTE_URL_PATTERN.test(rawPath)) return rawPath;

  const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!normalizedBase) return rawPath;

  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const appendQuery = (path: string, query: ApiQuery = {}): string => {
  const [base, existingQuery = ""] = path.split("?", 2);
  const params = new URLSearchParams(existingQuery);

  Object.entries(query).forEach(([key, rawValue]) => {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    values.forEach((value) => {
      if (value === undefined || value === null || value === "") return;
      params.append(key, String(value));
    });
  });

  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
};

const readText = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text.trim() ? text : "";
};

const parseJsonText = (
  text: string,
  response: Response,
  context: {
    method: string;
    url: string;
    requestId?: string;
  },
): unknown => {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (cause) {
    throw createInvalidResponseError(
      `API returned invalid JSON for ${context.url}.`,
      {
        status: response.status,
        statusText: response.statusText,
        method: context.method,
        url: context.url,
        requestId: context.requestId,
        cause,
      },
    );
  }
};

const readErrorPayload = async (response: Response): Promise<unknown> => {
  const text = await readText(response);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isAbortFailure = (error: unknown, signal?: AbortSignal): boolean =>
  Boolean(signal?.aborted) ||
  (error !== null &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "AbortError");

const parseSuccessfulResponse = async <Data>(
  response: Response,
  mode: ApiResponseMode,
  context: {
    method: string;
    url: string;
    requestId?: string;
    fallbackMessage: string;
  },
): Promise<Data> => {
  if (mode === "response") return response as Data;
  if (mode === "text") return (await response.text()) as Data;
  if (mode === "blob") return (await response.blob()) as Data;
  if (mode === "arrayBuffer") return (await response.arrayBuffer()) as Data;

  const payload = parseJsonText(await readText(response), response, context);
  if (mode === "raw") return payload as Data;

  const normalized = normalizeApiResponse<Data>(payload, {
    status: response.status,
    requestId: readRequestId(response.headers) || context.requestId,
    retryAfterSeconds: readRetryAfterSeconds(response.headers),
  });

  if (!normalized.ok) {
    throw createResponseError({
      response,
      payload,
      fallbackMessage: context.fallbackMessage,
      method: context.method,
      url: context.url,
      sentRequestId: context.requestId,
    });
  }

  return normalized.data;
};

export const createApiClient = (
  config: ApiClientConfig = {},
): ApiClient => {
  const requestDetailed = async <Data = unknown>(
    path: string | URL,
    options: ApiRequestOptions = {},
  ): Promise<ApiDetailedResponse<Data>> => {
    const url = resolveRequestUrl(config.baseUrl, path);
    const method = String(options.method || "GET").toUpperCase();
    const fallbackMessage = options.fallbackMessage || "Request failed.";
    const headers = new Headers(await resolveDefaultHeaders(config.defaultHeaders));

    new Headers(options.headers).forEach((value, name) => {
      headers.set(name, value);
    });

    if (!headers.has("Accept")) headers.set("Accept", "application/json");

    const hasJson = Object.prototype.hasOwnProperty.call(options, "json");
    if (hasJson && options.body !== undefined) {
      throw new TypeError("Use either json or body, not both.");
    }

    let body = options.body;
    if (hasJson) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      try {
        body = options.json === undefined
          ? undefined
          : JSON.stringify(options.json);
      } catch (cause) {
        throw createSerializationError({
          method,
          url,
          requestId: cleanRequestId(options.requestId),
          cause,
        });
      }
    }

    const existingRequestId = cleanRequestId(headers.get("x-request-id"));
    const requestId =
      cleanRequestId(options.requestId) ||
      existingRequestId ||
      cleanRequestId(config.requestIdFactory?.()) ||
      cleanRequestId(createRequestId());
    if (requestId && !existingRequestId) {
      headers.set("X-Request-Id", requestId);
    }

    const fetcher = config.fetch || globalThis.fetch;
    if (typeof fetcher !== "function") {
      throw createNetworkError({ method, url, requestId });
    }

    let response: Response;
    const {
      body: _body,
      credentials: _credentials,
      fallbackMessage: _fallbackMessage,
      headers: _headers,
      json: _json,
      method: _method,
      requestId: _requestId,
      responseMode: _responseMode,
      signal: _signal,
      ...fetchOptions
    } = options;
    try {
      response = await fetcher(url, {
        ...fetchOptions,
        method,
        headers,
        body,
        credentials: options.credentials || config.credentials || "same-origin",
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (isAbortFailure(error, options.signal)) {
        throw createAbortedError({ method, url, requestId, cause: error });
      }
      throw createNetworkError({ method, url, requestId, cause: error });
    }

    if (!response.ok) {
      const payload = await readErrorPayload(response);
      throw createResponseError({
        response,
        payload,
        fallbackMessage,
        method,
        url,
        sentRequestId: requestId,
      });
    }

    const data = await parseSuccessfulResponse<Data>(
      response,
      options.responseMode || "raw",
      { method, url, requestId, fallbackMessage },
    );

    return {
      data,
      response,
      requestId: readRequestId(response.headers) || requestId || undefined,
    };
  };

  const request = async <Data = unknown>(
    path: string | URL,
    options: ApiRequestOptions = {},
  ): Promise<Data> => (await requestDetailed<Data>(path, options)).data;

  const withMethod =
    (method: string) =>
    <Data = unknown>(
      path: string | URL,
      options: ApiRequestOptions = {},
    ): Promise<Data> =>
      request<Data>(path, { ...options, method });

  return {
    request,
    requestDetailed,
    get: withMethod("GET"),
    post: withMethod("POST"),
    put: withMethod("PUT"),
    patch: withMethod("PATCH"),
    delete: withMethod("DELETE"),
  };
};
