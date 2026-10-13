import { fingerprintPaymentRequest } from "../payments/paymentPersistence.js";
import { waterSettlementError } from "./settlement.js";
import { writeAuditLog } from "../../functions/_shared/auditLog.js";

const TABLES = Object.freeze({ sale: "waterSale", restock: "waterRestock", expense: "waterExpense", adjustment: "waterAdjustment" });
const auditState = (record) => Object.fromEntries([
  "quantity", "quantityDelta", "unitCost", "unitPrice", "totalAmount", "amount", "paymentStatus", "date", "archivedAt",
].filter((key) => Object.hasOwn(record || {}, key)).map((key) => [key, record[key]]));

const managedTransactions = new WeakSet();
export const runWaterTransaction = async (client, operation) => {
  if (managedTransactions.has(client)) return operation();
  await client.query("BEGIN");
  managedTransactions.add(client);
  try {
    const result = await operation();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    managedTransactions.delete(client);
  }
};

const CREATION_ACTIONS = new Set(["sale", "restock", "expense", "adjustment", "record_collection"]);

// One transaction covers validation, the write, audit and retry marker. A failed
// response must roll back, not cache a failed/partial business operation.
export const runWaterCommand = async (client, context, operation, replay) => {
  const { organizationId, productKey, actorId, action, payload } = context;
  const key = context.idempotencyKey;
  if ((CREATION_ACTIONS.has(action) || key) && !/^[A-Za-z0-9:_-]{12,128}$/.test(String(key || ""))) {
    throw waterSettlementError("A valid request key is required. Refresh and submit this Water action again.", "IDEMPOTENCY_KEY_REQUIRED", 400);
  }
  let rejectedResponse;
  try {
    return await runWaterTransaction(client, async () => {
      if (key) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`water-command:${organizationId}:${key}`]);
        const fingerprint = fingerprintPaymentRequest({ ...payload, action, productKey });
        const previous = await client.query(
          `SELECT "productKey", "actorId", "requestFingerprint" FROM "waterMutation"
           WHERE "organizationId" = $1 AND "idempotencyKey" = $2`, [organizationId, key]
        );
        if (previous.rows[0]) {
          const record = previous.rows[0];
          if (Number(record.actorId) !== Number(actorId) || record.productKey !== productKey || record.requestFingerprint !== fingerprint) {
            throw waterSettlementError("This request key was already used for a different Water action.", "IDEMPOTENCY_CONFLICT");
          }
          return replay();
        }
        await client.query(
          `INSERT INTO "waterMutation" ("organizationId", "productKey", "actorId", "idempotencyKey", "requestFingerprint", action)
           VALUES ($1,$2,$3,$4,$5,$6)`, [organizationId, productKey, actorId, key, fingerprint, action]
        );
      }
      const kind = action.replace(/^(update_|delete_)/, "");
      const table = TABLES[kind];
      const recordId = Number(payload[`${kind}Id`] ?? payload.id);
      let before;
      if (table && /^(update_|delete_)/.test(action) && Number.isSafeInteger(recordId) && recordId > 0) {
        const existing = await client.query(
          `SELECT * FROM "${table}" WHERE "organizationId" = $1 AND "productKey" = $2 AND id = $3`,
          [organizationId, productKey, recordId]
        );
        before = existing.rows[0];
      }
      const result = await operation(context);
      if (result?.statusCode >= 400) {
        rejectedResponse = result;
        throw waterSettlementError("Water command rejected.", "WATER_COMMAND_REJECTED");
      }
      const targetId = context.recordId || recordId;
      if (table && Number.isSafeInteger(targetId) && targetId > 0) {
        const after = await client.query(
          `UPDATE "${table}" SET "updatedAt" = GREATEST(clock_timestamp(), COALESCE("updatedAt", "createdAt") + INTERVAL '1 millisecond'),
             "updatedByUserId" = $4, "updatedByName" = $5
           WHERE "organizationId" = $1 AND "productKey" = $2 AND id = $3 RETURNING *`,
          [organizationId, productKey, targetId, actorId, context.actorName || null]
        );
        await writeAuditLog(client, {
          organizationId, userId: actorId, actorLabel: context.actorName, requestId: context.requestId,
          action: `WATER_${kind.toUpperCase()}_${action.startsWith("delete_") ? "ARCHIVED" : action.startsWith("update_") ? "CORRECTED" : "CREATED"}`,
          targetType: table, targetId: String(targetId), category: "finance", status: "ok",
          summary: `Water ${kind} ${action.startsWith("delete_") ? "archived" : action.startsWith("update_") ? "corrected" : "created"}.`,
          metadata: { businessUnit: "WATER", productKey, before: auditState(before), after: auditState(after.rows[0]) },
        });
      }
      return replay();
    });
  } catch (error) {
    if (rejectedResponse) return rejectedResponse;
    throw error;
  }
};
