/* eslint-disable no-undef */
/**
 * Double-entry journal management.
 *
 * GET  /api/accounting-journals               — list journals
 * GET  /api/accounting-journals?id=N          — single journal with lines
 * POST /api/accounting-journals               — create draft journal + lines
 * PATCH /api/accounting-journals              — post (action:"post") or reverse (action:"reverse")
 */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { assertJournalBalanced } from "./_shared/accountingExtensions.js";

const METHODS = "GET,POST,PATCH,OPTIONS";
const json = (event, code, payload) => respond(event, code, payload, { methods: METHODS });

const clean = (v, max = 255) => String(v || "").trim().slice(0, max);

const serializeLine = (row) => ({
  id:            Number(row.id),
  accountId:     Number(row.accountId),
  accountCode:   row.accountCode   ?? undefined,
  accountName:   row.accountName   ?? undefined,
  debit:         Number(row.debit  ?? 0),
  credit:        Number(row.credit ?? 0),
  description:   row.description   ?? null,
});

const serializeJournal = (row, lines = []) => ({
  id:              Number(row.id),
  date:            row.date,
  reference:       row.reference,
  description:     row.description     ?? null,
  isPosted:        Boolean(row.isPosted),
  postedAt:        row.postedAt        ?? null,
  isReversed:      Boolean(row.isReversed),
  reversalOfId:    row.reversalOfId    ? Number(row.reversalOfId) : null,
  importBatchId:   row.importBatchId   ? Number(row.importBatchId) : null,
  createdByUserId: row.createdByUserId ? Number(row.createdByUserId) : null,
  createdAt:       row.createdAt,
  lines,
});

const fetchLines = async (client, journalEntryId) => {
  const res = await client.query(
    `SELECT l.*, c."accountCode", c."accountName"
     FROM "journalLine" l
     JOIN "chartOfAccount" c ON c.id = l."accountId"
     WHERE l."journalEntryId" = $1
     ORDER BY l.id`,
    [journalEntryId]
  );
  return res.rows.map(serializeLine);
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (!["GET", "POST", "PATCH"].includes(method)) return json(event, 405, { error: "Method not allowed." });

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: resolvePgSslConfig() });
  try {
    await client.connect();
    const auth = await requireInternalUser(client, event, {
      methods: METHODS,
      roles: method === "GET" ? ["owner", "admin"] : ["owner", "admin"],
      roleError: "Only owners and admins can manage journals.",
    });
    if (auth.errorResponse) return auth.errorResponse;
    const { organizationId, authUser } = auth;

    // ── GET ────────────────────────────────────────────────────────────────────
    if (method === "GET") {
      const id = event.queryStringParameters?.id;
      if (id) {
        const res = await client.query(
          `SELECT * FROM "journalEntry" WHERE id = $1 AND "organizationId" = $2`,
          [Number(id), organizationId]
        );
        if (!res.rowCount) return json(event, 404, { error: "Journal not found." });
        const lines = await fetchLines(client, Number(id));
        return json(event, 200, serializeJournal(res.rows[0], lines));
      }

      const qs = event.queryStringParameters || {};
      const params = [organizationId];
      const conditions = [`"organizationId" = $1`];

      if (qs.batchId) { params.push(Number(qs.batchId)); conditions.push(`"importBatchId" = $${params.length}`); }
      if (qs.isPosted !== undefined) { params.push(qs.isPosted === "true"); conditions.push(`"isPosted" = $${params.length}`); }
      if (qs.from) { params.push(qs.from); conditions.push(`date >= $${params.length}::date`); }
      if (qs.to)   { params.push(qs.to);   conditions.push(`date <= $${params.length}::date`); }

      const limit  = Math.min(Number(qs.limit  || 100), 500);
      const offset = Number(qs.offset || 0);

      const res = await client.query(
        `SELECT * FROM "journalEntry" WHERE ${conditions.join(" AND ")}
         ORDER BY date DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
      return json(event, 200, res.rows.map((r) => serializeJournal(r)));
    }

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return json(event, 400, { error: "Invalid JSON." }); }

    // ── POST — create draft journal ────────────────────────────────────────────
    if (method === "POST") {
      const { date, reference, description, importBatchId, lines } = body;

      if (!date)      return json(event, 400, { error: "date is required (ISO 8601)." });
      if (!reference) return json(event, 400, { error: "reference is required." });
      if (!Array.isArray(lines) || lines.length < 2)
        return json(event, 400, { error: "A journal must have at least 2 lines." });

      const normalizedLines = lines.map((l, i) => ({
        accountId:   Number(l.accountId),
        debit:       Math.round(Number(l.debit  ?? 0)),
        credit:      Math.round(Number(l.credit ?? 0)),
        description: clean(l.description || "", 255) || null,
        _index: i + 1,
      }));

      for (const l of normalizedLines) {
        if (!l.accountId || l.accountId <= 0)
          return json(event, 400, { error: `Line ${l._index}: accountId is required.` });
        if (l.debit < 0 || l.credit < 0)
          return json(event, 400, { error: `Line ${l._index}: debit and credit must be ≥ 0.` });
        if (l.debit === 0 && l.credit === 0)
          return json(event, 400, { error: `Line ${l._index}: a line cannot have both debit and credit at zero.` });
      }

      assertJournalBalanced(normalizedLines);

      // Verify all account IDs belong to this org
      const accountIds = [...new Set(normalizedLines.map((l) => l.accountId))];
      const acctRes = await client.query(
        `SELECT id FROM "chartOfAccount" WHERE id = ANY($1::int[]) AND "organizationId" = $2 AND "isActive" = TRUE`,
        [accountIds, organizationId]
      );
      const validIds = new Set(acctRes.rows.map((r) => Number(r.id)));
      for (const l of normalizedLines) {
        if (!validIds.has(l.accountId))
          return json(event, 400, { error: `Line ${l._index}: account ${l.accountId} not found or inactive.` });
      }

      await client.query("BEGIN");
      try {
        const jeRes = await client.query(
          `INSERT INTO "journalEntry" ("organizationId","date","reference","description","createdByUserId","importBatchId")
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [organizationId, date, reference, clean(description || "", 500) || null, authUser.id, importBatchId || null]
        );
        const je = jeRes.rows[0];

        for (const l of normalizedLines) {
          await client.query(
            `INSERT INTO "journalLine" ("journalEntryId","accountId","debit","credit","description")
             VALUES ($1,$2,$3,$4,$5)`,
            [je.id, l.accountId, l.debit, l.credit, l.description]
          );
        }
        await client.query("COMMIT");

        const savedLines = await fetchLines(client, je.id);
        return json(event, 201, serializeJournal(je, savedLines));
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      }
    }

    // ── PATCH — post or reverse ────────────────────────────────────────────────
    if (method === "PATCH") {
      const { id, action } = body;
      const journalId = Number(id);
      if (!journalId) return json(event, 400, { error: "id is required." });

      const jeRes = await client.query(
        `SELECT * FROM "journalEntry" WHERE id = $1 AND "organizationId" = $2`,
        [journalId, organizationId]
      );
      if (!jeRes.rowCount) return json(event, 404, { error: "Journal not found." });
      const je = jeRes.rows[0];

      if (action === "post") {
        if (je.isPosted) return json(event, 409, { error: "Journal is already posted." });

        // Re-validate balance from DB (source of truth)
        const lineRes = await client.query(
          `SELECT debit, credit FROM "journalLine" WHERE "journalEntryId" = $1`, [journalId]
        );
        assertJournalBalanced(lineRes.rows);

        const updated = await client.query(
          `UPDATE "journalEntry"
           SET "isPosted" = TRUE, "postedAt" = NOW(), "postedByUserId" = $2, "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $3
           RETURNING *`,
          [journalId, authUser.id, organizationId]
        );
        const lines = await fetchLines(client, journalId);
        return json(event, 200, serializeJournal(updated.rows[0], lines));
      }

      if (action === "reverse") {
        if (!je.isPosted)   return json(event, 409, { error: "Only posted journals can be reversed." });
        if (je.isReversed)  return json(event, 409, { error: "Journal has already been reversed." });

        const reversalRef = `REV-${je.reference}`.slice(0, 200);

        // Check reversal reference doesn't already exist
        const refCheck = await client.query(
          `SELECT 1 FROM "journalEntry" WHERE "organizationId" = $1 AND reference = $2 LIMIT 1`,
          [organizationId, reversalRef]
        );
        if (refCheck.rowCount)
          return json(event, 409, { error: "A reversal for this journal already exists." });

        const originalLines = await fetchLines(client, journalId);
        const reversalDate  = body.date || new Date().toISOString().slice(0, 10);
        const reversalDesc  = `Reversal of ${je.reference}: ${je.description || ""}`.trim();

        await client.query("BEGIN");
        try {
          const revJe = await client.query(
            `INSERT INTO "journalEntry"
               ("organizationId","date","reference","description","createdByUserId","reversalOfId","isPosted","postedAt","postedByUserId")
             VALUES ($1,$2,$3,$4,$5,$6,TRUE,NOW(),$5)
             RETURNING *`,
            [organizationId, reversalDate, reversalRef, reversalDesc, authUser.id, journalId]
          );

          for (const l of originalLines) {
            await client.query(
              `INSERT INTO "journalLine" ("journalEntryId","accountId","debit","credit","description")
               VALUES ($1,$2,$3,$4,$5)`,
              [revJe.rows[0].id, l.accountId, l.credit, l.debit, `Reversal: ${l.description || ""}`]
            );
          }

          await client.query(
            `UPDATE "journalEntry" SET "isReversed" = TRUE, "updatedAt" = NOW() WHERE id = $1`,
            [journalId]
          );
          await client.query("COMMIT");

          const savedLines = await fetchLines(client, revJe.rows[0].id);
          return json(event, 201, serializeJournal(revJe.rows[0], savedLines));
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          throw err;
        }
      }

      return json(event, 400, { error: `Unknown action "${action}". Use "post" or "reverse".` });
    }
  } catch (err) {
    console.error("accounting-journals error", err);
    const code = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, code, {
      error: err?.code === "23505"
        ? "A journal with that reference already exists."
        : (err?.message || "Request failed."),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
