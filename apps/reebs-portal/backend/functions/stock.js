import { ensureAuditColumns, backfillAuditDefaults } from "./auditHelpers.js";
import { createDatabaseClient } from "./_shared/databaseClient.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { ensureInventoryVariantSchema } from "./_shared/inventoryExtensions.js";
import {
  INVENTORY_ERROR_CODES,
  normalizeInventoryAdjustment,
} from "../modules/inventory/inventoryDomain.js";
import { adjustInventoryStock } from "../modules/inventory/inventoryService.js";

const STOCK_METHODS = "POST,OPTIONS";

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return respond(event, 204, {}, { methods: STOCK_METHODS });
  }
  if (method !== "POST") {
    return respond(event, 405, {
      error: "Method not allowed. Use POST.",
      code: "METHOD_NOT_ALLOWED",
    }, { methods: STOCK_METHODS });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(event, 400, {
      error: "Invalid JSON format in request body.",
      code: INVENTORY_ERROR_CODES.INVALID_ADJUSTMENT,
    }, { methods: STOCK_METHODS });
  }

  const normalized = normalizeInventoryAdjustment(body);
  if (normalized.error) {
    return respond(event, 400, {
      error: normalized.error,
      code: INVENTORY_ERROR_CODES.INVALID_ADJUSTMENT,
    }, { methods: STOCK_METHODS });
  }

  const client = createDatabaseClient({ component: "inventory-stock" });
  try {
    await client.connect();
    await ensureAuditColumns(client);
    await ensureInventoryVariantSchema(client);
    const access = await requireInternalUser(client, event, {
      methods: STOCK_METHODS,
      roles: ["owner", "admin", "manager"],
      permission: "inventory:write",
      roleError: "Only owners, admins, and managers can adjust stock directly.",
      permissionError: "You do not have permission to adjust inventory stock.",
      body,
    });
    if (access.errorResponse) return access.errorResponse;

    const { authUser, organizationId } = access;
    const actor = {
      userId: authUser.id,
      userName: authUser.fullName || authUser.email || "Internal user",
      userEmail: authUser.email || null,
    };
    await backfillAuditDefaults(client, actor.userId, organizationId);

    const result = await adjustInventoryStock(client, {
      organizationId,
      adjustment: normalized.value,
      actor,
    });
    return respond(event, 200, result, { methods: STOCK_METHODS });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("Inventory stock adjustment failed:", error);
    }
    return respond(event, statusCode, {
      error: statusCode >= 500 ? "Failed to process stock movement." : error.message,
      code: error?.code || "INVENTORY_ERROR",
    }, { methods: STOCK_METHODS });
  } finally {
    await client.end().catch(() => {});
  }
}
