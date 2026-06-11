/* eslint-disable no-undef */
/**
 * Chart of Accounts management.
 * GET    /api/accounting-coa              — list all accounts
 * GET    /api/accounting-coa?id=N         — single account with balances
 * POST   /api/accounting-coa              — create account (non-system only)
 * PATCH  /api/accounting-coa              — update account (name/active only; code/type locked after use)
 */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const METHODS = "GET,POST,PATCH,OPTIONS";
const json = (event, code, payload) => respond(event, code, payload, { methods: METHODS });

const VALID_TYPES = new Set(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]);
const VALID_NB    = new Set(["DEBIT", "CREDIT"]);

const clean = (v, max = 255) => String(v || "").trim().slice(0, max);

const serializeAccount = (row) => ({
  id:              Number(row.id),
  accountCode:     row.accountCode,
  accountName:     row.accountName,
  accountType:     row.accountType,
  normalBalance:   row.normalBalance,
  parentAccountId: row.parentAccountId ? Number(row.parentAccountId) : null,
  isSystemAccount: Boolean(row.isSystemAccount),
  isActive:        Boolean(row.isActive),
  balance:         row.balance !== undefined ? Number(row.balance ?? 0) : undefined,
});

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (!["GET", "POST", "PATCH"].includes(method)) return json(event, 405, { error: "Method not allowed." });

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: resolvePgSslConfig() });
  try {
    await client.connect();
    const auth = await requireInternalUser(client, event, {
      methods: METHODS,
      roles: method === "GET" ? [] : ["owner", "admin"],
      roleError: "Only owners and admins can manage the chart of accounts.",
    });
    if (auth.errorResponse) return auth.errorResponse;
    const { organizationId } = auth;

    // ── GET ────────────────────────────────────────────────────────────────────
    if (method === "GET") {
      const id = event.queryStringParameters?.id;
      if (id) {
        // Single account with net balance from posted journal lines
        const res = await client.query(
          `SELECT
             c.*,
             COALESCE(b.balance, 0) AS balance
           FROM "chartOfAccount" c
           LEFT JOIN (
             SELECT
               l."accountId",
               SUM(l.debit - l.credit) AS balance
             FROM "journalLine" l
             JOIN "journalEntry" je ON je.id = l."journalEntryId"
             WHERE je."organizationId" = $2
               AND je."isPosted" = TRUE
             GROUP BY l."accountId"
           ) b ON b."accountId" = c.id
           WHERE c.id = $1
             AND c."organizationId" = $2`,
          [Number(id), organizationId]
        );
        if (!res.rowCount) return json(event, 404, { error: "Account not found." });
        return json(event, 200, serializeAccount(res.rows[0]));
      }

      const typeFilter = event.queryStringParameters?.type;
      const params = [organizationId];
      let where = `"organizationId" = $1`;
      if (typeFilter && VALID_TYPES.has(typeFilter.toUpperCase())) {
        params.push(typeFilter.toUpperCase());
        where += ` AND "accountType" = $${params.length}`;
      }
      if (event.queryStringParameters?.activeOnly === "true") {
        where += ` AND "isActive" = TRUE`;
      }
      const res = await client.query(
        `SELECT * FROM "chartOfAccount" WHERE ${where} ORDER BY "accountCode"`,
        params
      );
      return json(event, 200, res.rows.map(serializeAccount));
    }

    // ── POST ───────────────────────────────────────────────────────────────────
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return json(event, 400, { error: "Invalid JSON." }); }

    if (method === "POST") {
      const accountCode   = clean(body.accountCode, 20);
      const accountName   = clean(body.accountName, 255);
      const accountType   = clean(body.accountType, 20).toUpperCase();
      const normalBalance = clean(body.normalBalance || (["ASSET","EXPENSE"].includes(accountType) ? "DEBIT" : "CREDIT"), 10).toUpperCase();
      const parentId      = body.parentAccountId ? Number(body.parentAccountId) : null;

      if (!accountCode) return json(event, 400, { error: "accountCode is required." });
      if (!accountName) return json(event, 400, { error: "accountName is required." });
      if (!VALID_TYPES.has(accountType)) return json(event, 400, { error: `accountType must be one of: ${[...VALID_TYPES].join(", ")}.` });
      if (!VALID_NB.has(normalBalance)) return json(event, 400, { error: "normalBalance must be DEBIT or CREDIT." });

      const res = await client.query(
        `INSERT INTO "chartOfAccount"
           ("organizationId","accountCode","accountName","accountType","normalBalance","parentAccountId","isSystemAccount","isActive")
         VALUES ($1,$2,$3,$4,$5,$6,FALSE,TRUE)
         RETURNING *`,
        [organizationId, accountCode, accountName, accountType, normalBalance, parentId]
      );
      return json(event, 201, serializeAccount(res.rows[0]));
    }

    // ── PATCH ──────────────────────────────────────────────────────────────────
    if (method === "PATCH") {
      const id = Number(body.id);
      if (!id) return json(event, 400, { error: "id is required." });

      const current = await client.query(
        `SELECT * FROM "chartOfAccount" WHERE id = $1 AND "organizationId" = $2`,
        [id, organizationId]
      );
      if (!current.rowCount) return json(event, 404, { error: "Account not found." });
      const acct = current.rows[0];

      // Check if account has been used in any journal line — if so, code and type are locked
      const usageRes = await client.query(
        `SELECT 1 FROM "journalLine" WHERE "accountId" = $1 LIMIT 1`, [id]
      );
      const hasBeenUsed = usageRes.rowCount > 0;

      if (hasBeenUsed && body.accountCode && body.accountCode !== acct.accountCode) {
        return json(event, 409, { error: "Account code cannot be changed after the account has been used in a journal." });
      }
      if (hasBeenUsed && body.accountType && body.accountType !== acct.accountType) {
        return json(event, 409, { error: "Account type cannot be changed after the account has been used in a journal." });
      }

      const updates = [];
      const params  = [];
      const set = (col, val) => { params.push(val); updates.push(`"${col}" = $${params.length}`); };

      if (body.accountName)  set("accountName",  clean(body.accountName, 255));
      if (body.accountCode && !hasBeenUsed) set("accountCode", clean(body.accountCode, 20));
      if (body.accountType && !hasBeenUsed) set("accountType", clean(body.accountType, 20).toUpperCase());
      if (body.isActive !== undefined) set("isActive", Boolean(body.isActive));
      set("updatedAt", new Date());

      if (!updates.length) return json(event, 400, { error: "No valid fields to update." });
      params.push(id, organizationId);

      const res = await client.query(
        `UPDATE "chartOfAccount" SET ${updates.join(", ")}
         WHERE id = $${params.length - 1} AND "organizationId" = $${params.length}
         RETURNING *`,
        params
      );
      return json(event, 200, serializeAccount(res.rows[0]));
    }
  } catch (err) {
    console.error("accounting-coa error", err);
    const code = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, code, { error: err?.code === "23505" ? "An account with that code already exists." : (err?.message || "Request failed.") });
  } finally {
    await client.end().catch(() => {});
  }
}
