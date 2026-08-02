import {
  createApiClient,
  type ApiClient,
  type ApiClientConfig,
  type HeaderSource,
} from "./request.ts";

export interface ServerApiClientConfig
  extends Omit<ApiClientConfig, "credentials" | "defaultHeaders"> {
  baseUrl: string;
  defaultHeaders?: HeaderSource;
  getBearerToken?: () =>
    | string
    | undefined
    | Promise<string | undefined>;
  userAgent?: string;
}

const resolveHeaders = async (
  source: HeaderSource | undefined,
): Promise<Headers> => {
  const value = typeof source === "function" ? await source() : source;
  return new Headers(value);
};

export const createServerApiClient = (
  config: ServerApiClientConfig,
): ApiClient => {
  const { defaultHeaders, getBearerToken, userAgent, ...clientConfig } = config;

  return createApiClient({
    ...clientConfig,
    credentials: "omit",
    defaultHeaders: async () => {
      const headers = await resolveHeaders(defaultHeaders);
      const token = String((await getBearerToken?.()) || "").trim();

      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (userAgent && !headers.has("User-Agent")) {
        headers.set("User-Agent", userAgent);
      }

      return headers;
    },
  });
};
