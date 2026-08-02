import type { ApiClient, ApiRequestOptions } from "./request.ts";
import { createResourceApi, resourceRoutes } from "./resource.ts";

export const createInventoryApi = <
  ListResponse = unknown,
  DetailResponse = unknown,
  CreateBody = unknown,
  CreateResponse = DetailResponse,
  UpdateBody = Partial<CreateBody>,
  UpdateResponse = DetailResponse,
  DeleteResponse = unknown,
  AdjustmentBody = unknown,
  AdjustmentResponse = unknown,
>(
  client: ApiClient,
  basePath = "/api/inventory",
  adjustmentPath = "/api/inventory/adjustments",
) => ({
  ...createResourceApi<
    ListResponse,
    DetailResponse,
    CreateBody,
    CreateResponse,
    UpdateBody,
    UpdateResponse,
    DeleteResponse
  >(client, resourceRoutes(basePath)),
  adjust: (body: AdjustmentBody, options: ApiRequestOptions = {}) =>
    client.post<AdjustmentResponse>(adjustmentPath, {
      ...options,
      json: body,
    }),
});
