import type { ApiClient, ApiQuery, ApiRequestOptions } from "./request.ts";
import { appendQuery } from "./request.ts";

export interface ReebsApiOptions {
  pathPrefix?: string;
}

const joinPath = (prefix: string, path: string): string =>
  `${prefix.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

export const createReebsApi = (
  client: ApiClient,
  options: ReebsApiOptions = {},
) => {
  const prefix = options.pathPrefix || "/api/v1";
  const route = (path: string) => joinPath(prefix, path);

  return {
    client,
    auth: {
      login: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.post<Response>(route("auth/login"), { ...requestOptions, json: body }),
      session: <Response = unknown>(requestOptions: ApiRequestOptions = {}) =>
        client.get<Response>(route("auth/session"), requestOptions),
      logout: <Response = unknown>(requestOptions: ApiRequestOptions = {}) =>
        client.post<Response>(route("auth/logout"), requestOptions),
      forgotPassword: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.post<Response>(route("auth/forgot-password"), { ...requestOptions, json: body }),
      resetPassword: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.post<Response>(route("auth/reset-password"), { ...requestOptions, json: body }),
    },
    catalogue: {
      list: <Response = unknown>(query: ApiQuery = {}, requestOptions: ApiRequestOptions = {}) =>
        client.get<Response>(appendQuery(route("catalogue/products"), query), requestOptions),
    },
    bookings: {
      list: <Response = unknown>(query: ApiQuery = {}, requestOptions: ApiRequestOptions = {}) =>
        client.get<Response>(appendQuery(route("bookings"), query), requestOptions),
      create: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.post<Response>(route("bookings"), { ...requestOptions, json: body }),
      update: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.put<Response>(route("bookings"), { ...requestOptions, json: body }),
      availability: <Response = unknown>(query: ApiQuery = {}, requestOptions: ApiRequestOptions = {}) =>
        client.get<Response>(appendQuery(route("bookings/availability"), query), requestOptions),
    },
    customers: {
      list: <Response = unknown>(query: ApiQuery = {}, requestOptions: ApiRequestOptions = {}) =>
        client.get<Response>(appendQuery(route("customers"), query), requestOptions),
      create: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.post<Response>(route("customers"), { ...requestOptions, json: body }),
      update: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.put<Response>(route("customers"), { ...requestOptions, json: body }),
    },
    checkout: {
      createOrder: <Response = unknown>(body: unknown, requestOptions: ApiRequestOptions = {}) =>
        client.post<Response>(route("checkout/orders"), { ...requestOptions, json: body }),
    },
  };
};

export type ReebsApi = ReturnType<typeof createReebsApi>;
