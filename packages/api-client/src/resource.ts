import {
  appendQuery,
  type ApiClient,
  type ApiQuery,
  type ApiRequestOptions,
} from "./request.ts";

export interface ResourceRoutes {
  list: string;
  detail: (id: string | number) => string;
  create?: string;
}

export interface ResourceApi<
  ListResponse = unknown,
  DetailResponse = unknown,
  CreateBody = unknown,
  CreateResponse = DetailResponse,
  UpdateBody = Partial<CreateBody>,
  UpdateResponse = DetailResponse,
  DeleteResponse = unknown,
> {
  list(
    query?: ApiQuery,
    options?: ApiRequestOptions,
  ): Promise<ListResponse>;
  get(
    id: string | number,
    options?: ApiRequestOptions,
  ): Promise<DetailResponse>;
  create(
    body: CreateBody,
    options?: ApiRequestOptions,
  ): Promise<CreateResponse>;
  update(
    id: string | number,
    body: UpdateBody,
    options?: ApiRequestOptions,
  ): Promise<UpdateResponse>;
  remove(
    id: string | number,
    options?: ApiRequestOptions,
  ): Promise<DeleteResponse>;
}

export const resourceRoutes = (basePath: string): ResourceRoutes => ({
  list: basePath,
  detail: (id) => `${basePath}/${encodeURIComponent(String(id))}`,
  create: basePath,
});

export const createResourceApi = <
  ListResponse = unknown,
  DetailResponse = unknown,
  CreateBody = unknown,
  CreateResponse = DetailResponse,
  UpdateBody = Partial<CreateBody>,
  UpdateResponse = DetailResponse,
  DeleteResponse = unknown,
>(
  client: ApiClient,
  routes: ResourceRoutes,
): ResourceApi<
  ListResponse,
  DetailResponse,
  CreateBody,
  CreateResponse,
  UpdateBody,
  UpdateResponse,
  DeleteResponse
> => ({
  list: (query = {}, options = {}) =>
    client.get<ListResponse>(appendQuery(routes.list, query), options),
  get: (id, options = {}) =>
    client.get<DetailResponse>(routes.detail(id), options),
  create: (body, options = {}) =>
    client.post<CreateResponse>(routes.create || routes.list, {
      ...options,
      json: body,
    }),
  update: (id, body, options = {}) =>
    client.patch<UpdateResponse>(routes.detail(id), {
      ...options,
      json: body,
    }),
  remove: (id, options = {}) =>
    client.delete<DeleteResponse>(routes.detail(id), options),
});
