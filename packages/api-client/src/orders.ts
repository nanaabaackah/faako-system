import type { ApiClient } from "./request.ts";
import { createResourceApi, resourceRoutes } from "./resource.ts";

export const createOrdersApi = <
  ListResponse = unknown,
  DetailResponse = unknown,
  CreateBody = unknown,
  CreateResponse = DetailResponse,
  UpdateBody = Partial<CreateBody>,
  UpdateResponse = DetailResponse,
  DeleteResponse = unknown,
>(
  client: ApiClient,
  basePath = "/api/orders",
) =>
  createResourceApi<
    ListResponse,
    DetailResponse,
    CreateBody,
    CreateResponse,
    UpdateBody,
    UpdateResponse,
    DeleteResponse
  >(client, resourceRoutes(basePath));
