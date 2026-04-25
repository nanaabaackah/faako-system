/* eslint-disable no-undef */
/**
 * Trial balance and account ledger.
 *
 * GET /.netlify/functions/accounting-trial-balance
 *   ?asOf=2025-12-31          — trial balance as at date (all posted journals up to and including this date)
 *   ?accountId=N&from=&to=    — ledger for a single account (all posted lines in date range)
 *   ?summary=true             — group by account type (balance sheet / P&L summary)
 */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const METHODS = "GET,OPTIONS";
const json = (event, code, payload) => respond(event, code, payload, { methods: METHODS });

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "GET") return json(event, 405, { error: "Method not allowed." });

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: resolvePgSslConfig() });
  try {
    await client.connect();
    const auth = await requireInternalUser(client, event, {
      methods: METHODS,
      roles: ["owner", "admin"],
      roleError: "Only owners and admins can view the trial balance.",
    });
    if (auth.errorResponse) return auth.errorResponse;
    const { organizationId } = auth;

    const qs = event.queryStringParameters || {};
    const asOf      = qs.asOf      || new Date().toISOString().slice(0, 10);
    const accountId = qs.accountId ? Number(qs.accountId) : null;
    const fromDate  = qs.from      || null;
    const toDate    = qs.to        || asOf;
    const summary   = qs.summary === "true";

    // ── Single account ledger ──────────────────────────────────────────────────
    if (accountId) {
      const acctRes = await client.query(
        `SELECT * FROM "chartOfAccount" WHERE id = $1 AND "organizationId" = $2`,
        [accountId, organizationId]
      );
      if (!acctRes.rowCount) return json(event, 404, { error: "Account not found." });
      const acct = acctRes.rows[0];

      const params = [accountId, toDate];
      let dateWhere = `je.date::date <= $2::date`;
      if (fromDate) { params.push(fromDate); dateWhere += ` AND je.date::date >= $${params.length}::date`; }

      const linesRes = await client.query(
        `SELECT jl.id, je.date, je.reference, jl.description, jl.debit, jl.credit,
                SUM(jl.debit - jl.credit) OVER (ORDER BY je.date, je.id, jl.id) AS "runningBalance"
         FROM "journalLine" jl
         JOIN "journalEntry" je ON je.id = jl."journalEntryId"
         WHERE jl."accountId" = $1
           AND je."isPosted" = TRUE
           AND ${dateWhere}
         ORDER BY je.date, je.id, jl.id`,
        params
      );

      const lines = linesRes.rows.map((r) => ({
        id: Number(r.id), date: r.date, reference: r.reference,
        description: r.description,
        debit: Number(r.debit), credit: Number(r.credit),
        runningBalance: Number(r.runningBalance),
      }));

      const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

      return json(event, 200, {
        account: {
          id: Number(acct.id), accountCode: acct.accountCode, accountName: acct.accountName,
          accountType: acct.accountType, normalBalance: acct.normalBalance,
        },
        from: fromDate, to: toDate,
        totalDebit, totalCredit,
        netBalance: totalDebit - totalCredit,
        lines,
      });
    }

    // ── Full trial balance ─────────────────────────────────────────────────────
    const tbRes = await client.query(
      `SELECT
         c.id,
         c."accountCode",
         c."accountName",
         c."accountType",
         c."normalBalance",
         c."isSystemAccount",
         COALESCE(b."totalDebit", 0) AS "totalDebit",
         COALESCE(b."totalCredit", 0) AS "totalCredit",
         COALESCE(b."netBalance", 0) AS "netBalance"
       FROM "chartOfAccount" c
       LEFT JOIN (
         SELECT
           jl."accountId",
           SUM(jl.debit) AS "totalDebit",
           SUM(jl.credit) AS "totalCredit",
           SUM(jl.debit - jl.credit) AS "netBalance"
         FROM "journalLine" jl
         JOIN "journalEntry" je ON je.id = jl."journalEntryId"
         WHERE je."organizationId" = $1
           AND je."isPosted" = TRUE
           AND je.date::date <= $2::date
         GROUP BY jl."accountId"
       ) b ON b."accountId" = c.id
       WHERE c."organizationId" = $1
         AND c."isActive" = TRUE
       ORDER BY c."accountCode"`,
      [organizationId, asOf]
    );

    const rows = tbRes.rows.map((r) => ({
      id:             Number(r.id),
      accountCode:    r.accountCode,
      accountName:    r.accountName,
      accountType:    r.accountType,
      normalBalance:  r.normalBalance,
      isSystemAccount: Boolean(r.isSystemAccount),
      totalDebit:     Number(r.totalDebit),
      totalCredit:    Number(r.totalCredit),
      netBalance:     Number(r.netBalance),
    }));

    const grandDebit  = rows.reduce((s, r) => s + r.totalDebit,  0);
    const grandCredit = rows.reduce((s, r) => s + r.totalCredit, 0);
    const isBalanced  = grandDebit === grandCredit;

    if (summary) {
      const byType = {};
      for (const r of rows) {
        if (!byType[r.accountType]) byType[r.accountType] = { totalDebit: 0, totalCredit: 0, netBalance: 0, accounts: [] };
        byType[r.accountType].totalDebit  += r.totalDebit;
        byType[r.accountType].totalCredit += r.totalCredit;
        byType[r.accountType].netBalance  += r.netBalance;
        byType[r.accountType].accounts.push(r);
      }
      return json(event, 200, { asOf, grandDebit, grandCredit, isBalanced, byType });
    }

    return json(event, 200, { asOf, grandDebit, grandCredit, isBalanced, accounts: rows });
  } catch (err) {
    console.error("accounting-trial-balance error", err);
    return json(event, err?.statusCode || 500, { error: err?.message || "Request failed." });
  } finally {
    await client.end().catch(() => {});
  }
}
