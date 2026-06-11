/* eslint-disable no-undef */
/**
 * Historical import batch management.
 *
 * GET   /api/accounting-import              — list all batches with status
 * GET   /api/accounting-import?id=N         — single batch with journals
 * POST  /api/accounting-import              — create batch + auto-generate journals from monthly summary
 * PATCH /api/accounting-import              — post all journals in a batch (action:"post")
 *                                                           or delete a draft batch (action:"delete")
 *
 * Monthly summary payload (POST body):
 * {
 *   "batchName":       "2024-01-HISTORICAL",
 *   "periodStart":     "2024-01-01",
 *   "periodEnd":       "2024-01-31",
 *   "source":          "VAT_RETURN + BANK_STATEMENT",
 *   "grossSales":      1234567,     // total gross receipts in pesewas (inc. all taxes)
 *   "retailSplit":     800000,      // portion of grossSales from retail
 *   "rentalSplit":     434567,      // portion from rental (retailSplit + rentalSplit must == grossSales)
 *   "cashReceived":    1100000,     // DR bank
 *   "arOutstanding":   134567,      // DR accounts receivable
 *   "vatRemitted":     152341,      // GRA payment VAT line (from filed return)
 *   "nhilRemitted":    0,           // GRA payment NHIL (0 if not separately tracked)
 *   "getfundRemitted": 0,           // GRA payment GETFund
 *   "covidRemitted":   0,           // GRA payment COVID-HRL
 *   "graPaymentDate":  "2024-02-15",// date cash left bank for GRA
 *   "cogs":            400000,      // cost of goods sold (null = use estimate)
 *   "cogsEstimated":   true,        // true if COGS was not from records
 *   "expenses": [                   // array of operating expense lines
 *     { "accountCode": "6000", "amount": 50000, "description": "Salaries Jan 2024" }
 *   ],
 *   "notes": "..."
 * }
 */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { assertJournalBalanced, computeVatComponents, computeVatComponentsSimplified } from "./_shared/accountingExtensions.js";

const METHODS = "GET,POST,PATCH,OPTIONS";
const json = (event, code, payload) => respond(event, code, payload, { methods: METHODS });
const IMPORT_SCHEMA_NOT_READY_ERROR = "Historical import tables are not ready yet. Run the latest database migrations first.";

const GH_VAT_SCHEME_STANDARD   = "STANDARD";   // 21% total
const GH_VAT_SCHEME_SIMPLIFIED = "SIMPLIFIED"; // 16% total

// Resolve account ID by code for this org
const getAccountId = async (client, organizationId, code) => {
  const res = await client.query(
    `SELECT id FROM "chartOfAccount" WHERE "organizationId" = $1 AND "accountCode" = $2 AND "isActive" = TRUE LIMIT 1`,
    [organizationId, code]
  );
  if (!res.rowCount) {
    const err = new Error(`Chart of accounts account ${code} not found. Run accounting-seed first.`);
    err.statusCode = 412;
    throw err;
  }
  return res.rows[0].id;
};

const getSystemConfig = async (client, organizationId, key) => {
  const res = await client.query(
    `SELECT value FROM "systemConfig" WHERE "organizationId" = $1 AND key = $2 LIMIT 1`,
    [organizationId, key]
  );
  return res.rows[0]?.value ?? null;
};

const hasTable = async (client, tableName) => {
  const res = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = $1
     ) AS "exists"`,
    [tableName]
  );
  return Boolean(res.rows[0]?.exists);
};

const ensureImportBatchSummaryColumn = async (client) => {
  try {
    await client.query(
      `ALTER TABLE "historicalImportBatch" ADD COLUMN IF NOT EXISTS "summary" JSONB`
    );
  } catch (err) {
    console.warn("Historical import summary column check failed:", err?.message || err);
  }
};

const insertJournalWithLines = async (client, organizationId, { date, reference, description, importBatchId, lines, createdByUserId }) => {
  assertJournalBalanced(lines);
  const jeRes = await client.query(
    `INSERT INTO "journalEntry" ("organizationId","date","reference","description","createdByUserId","importBatchId")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [organizationId, date, reference, description, createdByUserId, importBatchId]
  );
  const jeId = jeRes.rows[0].id;
  for (const l of lines) {
    await client.query(
      `INSERT INTO "journalLine" ("journalEntryId","accountId","debit","credit","description")
       VALUES ($1,$2,$3,$4,$5)`,
      [jeId, l.accountId, Math.round(l.debit || 0), Math.round(l.credit || 0), l.description || null]
    );
  }
  return jeId;
};

const normalizeExpenseLines = (value) =>
  (Array.isArray(value) ? value : [])
    .map((line) => ({
      accountCode: String(line?.accountCode || "").trim(),
      description: String(line?.description || "").trim(),
      amount: Math.max(0, Math.round(Number(line?.amount || 0))),
    }))
    .filter((line) => line.accountCode && line.amount > 0);

const parseSummaryValue = (value) => {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeBatchSummary = (row) => {
  const summary = parseSummaryValue(row?.summary);
  const grossSales = Math.max(0, Math.round(Number(summary.grossSales ?? row?.derivedGrossSales ?? 0)));
  const retailSplit = Math.max(0, Math.round(Number(summary.retailSplit ?? grossSales)));
  const rentalSplit = Math.max(0, Math.round(Number(summary.rentalSplit ?? 0)));
  const cogs = summary.cogs == null
    ? Math.max(0, Math.round(Number(row?.derivedCogs ?? 0)))
    : Math.max(0, Math.round(Number(summary.cogs || 0)));
  const expenseTotal = Math.max(0, Math.round(Number(summary.expenseTotal ?? row?.derivedExpenseTotal ?? 0)));
  return {
    grossSales,
    retailSplit,
    rentalSplit,
    cashReceived: Math.max(0, Math.round(Number(summary.cashReceived || 0))),
    arOutstanding: Math.max(0, Math.round(Number(summary.arOutstanding || 0))),
    vatRemitted: Math.max(0, Math.round(Number(summary.vatRemitted || 0))),
    nhilRemitted: Math.max(0, Math.round(Number(summary.nhilRemitted || 0))),
    getfundRemitted: Math.max(0, Math.round(Number(summary.getfundRemitted || 0))),
    covidRemitted: Math.max(0, Math.round(Number(summary.covidRemitted || 0))),
    graPaymentDate: summary.graPaymentDate || null,
    cogs,
    cogsEstimated: Boolean(summary.cogsEstimated),
    expenseTotal,
    expenseLines: normalizeExpenseLines(summary.expenseLines),
  };
};

const serializeBatch = (row) => ({
  id:            Number(row.id),
  batchName:     row.batchName,
  periodStart:   row.periodStart,
  periodEnd:     row.periodEnd,
  source:        row.source,
  isPosted:      Boolean(row.isPosted),
  postedAt:      row.postedAt ?? null,
  notes:         row.notes ?? null,
  journalCount:  row.journalCount !== undefined ? Number(row.journalCount) : undefined,
  summary:       normalizeBatchSummary(row),
  createdAt:     row.createdAt,
});

const normalizeDateInput = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed.slice(0, 10);
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
      roles: ["owner", "admin"],
      roleError: "Only owners and admins can manage historical imports.",
    });
    if (auth.errorResponse) return auth.errorResponse;
    const { organizationId, authUser } = auth;

    const importBatchTableExists = await hasTable(client, "historicalImportBatch");
    if (!importBatchTableExists) {
      if (method === "GET") {
        const requestedId = Number(event.queryStringParameters?.id);
        if (Number.isFinite(requestedId) && requestedId > 0) {
          return json(event, 404, { error: "Batch not found." });
        }
        return json(event, 200, []);
      }
      return json(event, 412, { error: IMPORT_SCHEMA_NOT_READY_ERROR });
    }

    await ensureImportBatchSummaryColumn(client);

    // ── GET ────────────────────────────────────────────────────────────────────
    if (method === "GET") {
      const id = event.queryStringParameters?.id;
      if (id) {
        const batchRes = await client.query(
          `SELECT
             b.*,
             COUNT(j.id) AS "journalCount",
             COALESCE((
               SELECT SUM(jl.debit)
               FROM "journalEntry" je2
               JOIN "journalLine" jl ON jl."journalEntryId" = je2.id
               WHERE je2."importBatchId" = b.id
                 AND je2.reference LIKE 'HIST-%-REV'
             ), 0) AS "derivedGrossSales",
             COALESCE((
               SELECT SUM(jl.debit)
               FROM "journalEntry" je2
               JOIN "journalLine" jl ON jl."journalEntryId" = je2.id
               WHERE je2."importBatchId" = b.id
                 AND je2.reference LIKE 'HIST-%-COS'
             ), 0) AS "derivedCogs",
             COALESCE((
               SELECT SUM(jl.debit)
               FROM "journalEntry" je2
               JOIN "journalLine" jl ON jl."journalEntryId" = je2.id
               WHERE je2."importBatchId" = b.id
                 AND je2.reference LIKE 'HIST-%-EXP'
             ), 0) AS "derivedExpenseTotal"
           FROM "historicalImportBatch" b
           LEFT JOIN "journalEntry" j ON j."importBatchId" = b.id
           WHERE b.id = $1 AND b."organizationId" = $2
           GROUP BY b.id`,
          [Number(id), organizationId]
        );
        if (!batchRes.rowCount) return json(event, 404, { error: "Batch not found." });
        const journals = await client.query(
          `SELECT je.*, COALESCE(SUM(jl.debit),0) AS "totalDebit", COALESCE(SUM(jl.credit),0) AS "totalCredit"
           FROM "journalEntry" je
           LEFT JOIN "journalLine" jl ON jl."journalEntryId" = je.id
           WHERE je."importBatchId" = $1
           GROUP BY je.id
           ORDER BY je.date, je.id`,
          [Number(id)]
        );
        return json(event, 200, {
          ...serializeBatch(batchRes.rows[0]),
          journals: journals.rows.map((j) => ({
            id: Number(j.id), reference: j.reference, date: j.date,
            description: j.description, isPosted: j.isPosted,
            totalDebit: Number(j.totalDebit), totalCredit: Number(j.totalCredit),
            isBalanced: Number(j.totalDebit) === Number(j.totalCredit),
          })),
        });
      }

      const res = await client.query(
        `SELECT
           b.*,
           COUNT(j.id) AS "journalCount",
           COALESCE((
             SELECT SUM(jl.debit)
             FROM "journalEntry" je2
             JOIN "journalLine" jl ON jl."journalEntryId" = je2.id
             WHERE je2."importBatchId" = b.id
               AND je2.reference LIKE 'HIST-%-REV'
           ), 0) AS "derivedGrossSales",
           COALESCE((
             SELECT SUM(jl.debit)
             FROM "journalEntry" je2
             JOIN "journalLine" jl ON jl."journalEntryId" = je2.id
             WHERE je2."importBatchId" = b.id
               AND je2.reference LIKE 'HIST-%-COS'
           ), 0) AS "derivedCogs",
           COALESCE((
             SELECT SUM(jl.debit)
             FROM "journalEntry" je2
             JOIN "journalLine" jl ON jl."journalEntryId" = je2.id
             WHERE je2."importBatchId" = b.id
               AND je2.reference LIKE 'HIST-%-EXP'
           ), 0) AS "derivedExpenseTotal"
         FROM "historicalImportBatch" b
         LEFT JOIN "journalEntry" j ON j."importBatchId" = b.id
         WHERE b."organizationId" = $1
         GROUP BY b.id
         ORDER BY b."periodStart"`,
        [organizationId]
      );
      return json(event, 200, res.rows.map(serializeBatch));
    }

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return json(event, 400, { error: "Invalid JSON." }); }

    // ── POST — create batch + generate journals ────────────────────────────────
    if (method === "POST") {
      const {
        batchName, periodStart, periodEnd, source = "VAT_RETURN + BANK_STATEMENT",
        grossSales, retailSplit, rentalSplit,
        cashReceived, arOutstanding = 0,
        vatRemitted = 0, nhilRemitted = 0, getfundRemitted = 0, covidRemitted = 0,
        graPaymentDate,
        cogs = null, cogsEstimated = false,
        expenses = [],
        notes,
      } = body;

      if (!batchName)   return json(event, 400, { error: "batchName is required." });
      if (!periodStart) return json(event, 400, { error: "periodStart is required." });
      if (!periodEnd)   return json(event, 400, { error: "periodEnd is required." });
      if (grossSales == null) return json(event, 400, { error: "grossSales is required (in pesewas)." });

      const gross   = Math.round(Number(grossSales));
      const retail  = Math.round(Number(retailSplit || 0));
      const rental  = Math.round(Number(rentalSplit || 0));
      const cash    = Math.round(Number(cashReceived || 0));
      const ar      = Math.round(Number(arOutstanding || 0));
      const totalRemitted = Math.round(
        Number(vatRemitted || 0)
        + Number(nhilRemitted || 0)
        + Number(getfundRemitted || 0)
        + Number(covidRemitted || 0)
      );
      const expenseLines = normalizeExpenseLines(expenses);
      const expenseTotal = expenseLines.reduce((sum, expenseLine) => sum + expenseLine.amount, 0);
      const graPaymentDateValue = normalizeDateInput(graPaymentDate);

      if (graPaymentDate && !graPaymentDateValue) {
        return json(event, 400, { error: "graPaymentDate must be a valid date." });
      }
      if (totalRemitted > 0 && !graPaymentDateValue) {
        return json(event, 400, {
          error: "graPaymentDate is required when any VAT, NHIL, GETFund, or COVID remittance amount is provided.",
        });
      }

      if (retail + rental !== gross) {
        return json(event, 400, {
          error: `retailSplit (${retail}) + rentalSplit (${rental}) must equal grossSales (${gross}).`,
        });
      }
      if (cash + ar !== gross) {
        return json(event, 400, {
          error: `cashReceived (${cash}) + arOutstanding (${ar}) must equal grossSales (${gross}).`,
        });
      }

      // Determine VAT scheme
      const scheme = (await getSystemConfig(client, organizationId, "VAT_SCHEME")) || GH_VAT_SCHEME_STANDARD;
      const vatCalc = scheme === GH_VAT_SCHEME_SIMPLIFIED
        ? computeVatComponentsSimplified(gross)
        : computeVatComponents(gross);

      const YYYY_MM = periodStart.slice(0, 7);
      const endDate  = periodEnd;

      // Resolve account IDs
      const A = {
        bank:      await getAccountId(client, organizationId, "1030"),
        ar:        await getAccountId(client, organizationId, "1100"),
        retail:    await getAccountId(client, organizationId, "4000"),
        rental:    await getAccountId(client, organizationId, "4100"),
        vat:       await getAccountId(client, organizationId, "2100"),
        covid:     await getAccountId(client, organizationId, "2110"),
        nhil:      await getAccountId(client, organizationId, "2115"),
        getfund:   await getAccountId(client, organizationId, "2116"),
        inventory: await getAccountId(client, organizationId, "1200"),
        cogs:      await getAccountId(client, organizationId, "5000"),
      };

      await client.query("BEGIN");
      try {
        // Create the batch
        const batchRes = await client.query(
          `INSERT INTO "historicalImportBatch"
             ("organizationId","batchName","periodStart","periodEnd","source","notes","summary")
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
           RETURNING *`,
          [
            organizationId,
            batchName,
            periodStart,
            periodEnd,
            source,
            notes || null,
            JSON.stringify({
              grossSales: gross,
              retailSplit: retail,
              rentalSplit: rental,
              cashReceived: cash,
              arOutstanding: ar,
              vatRemitted: Math.max(0, Math.round(Number(vatRemitted || 0))),
              nhilRemitted: Math.max(0, Math.round(Number(nhilRemitted || 0))),
              getfundRemitted: Math.max(0, Math.round(Number(getfundRemitted || 0))),
              covidRemitted: Math.max(0, Math.round(Number(covidRemitted || 0))),
              graPaymentDate: graPaymentDateValue || null,
              cogs: cogs == null ? null : Math.max(0, Math.round(Number(cogs || 0))),
              cogsEstimated: Boolean(cogsEstimated),
              expenseTotal,
              expenseLines,
            }),
          ]
        );
        const batchId = batchRes.rows[0].id;

        const createdJournals = [];

        // JOURNAL 1 — Revenue summary
        const retailNet = retail > 0 ? Math.round(retail * 100 / (scheme === GH_VAT_SCHEME_SIMPLIFIED ? 116 : 121)) : 0;
        const rentalNet = rental > 0 ? Math.round(rental * 100 / (scheme === GH_VAT_SCHEME_SIMPLIFIED ? 116 : 121)) : 0;

        const revLines = [
          { accountId: A.bank,    debit: cash,              credit: 0,                description: "Cash received" },
          { accountId: A.ar,      debit: ar,                credit: 0,                description: "AR outstanding" },
          { accountId: A.retail,  debit: 0,                 credit: retailNet,         description: `Retail sales net` },
          { accountId: A.rental,  debit: 0,                 credit: rentalNet,         description: `Rental income net` },
          { accountId: A.vat,     debit: 0,                 credit: vatCalc.vat,       description: "Output VAT 15%" },
          ...(vatCalc.nhil    > 0 ? [{ accountId: A.nhil,    debit: 0, credit: vatCalc.nhil,    description: "NHIL 2.5%" }] : []),
          ...(vatCalc.getfund > 0 ? [{ accountId: A.getfund, debit: 0, credit: vatCalc.getfund, description: "GETFund 2.5%" }] : []),
          { accountId: A.covid,   debit: 0,                 credit: vatCalc.covid,     description: "COVID-19 HRL 1%" },
        ];

        const revId = await insertJournalWithLines(client, organizationId, {
          date: endDate, reference: `HIST-${YYYY_MM}-REV`,
          description: `Monthly revenue summary — ${batchName}`,
          importBatchId: batchId, lines: revLines, createdByUserId: authUser.id,
        });
        createdJournals.push({ reference: `HIST-${YYYY_MM}-REV`, id: revId });

        // JOURNAL 2 — VAT remittance (only if amounts provided)
        if (totalRemitted > 0) {
          const vatRemLines = [
            { accountId: A.vat,     debit: Math.round(Number(vatRemitted)),     credit: 0, description: "VAT remitted to GRA" },
            ...(nhilRemitted    > 0 ? [{ accountId: A.nhil,    debit: Math.round(Number(nhilRemitted)),    credit: 0, description: "NHIL remitted" }] : []),
            ...(getfundRemitted > 0 ? [{ accountId: A.getfund, debit: Math.round(Number(getfundRemitted)), credit: 0, description: "GETFund remitted" }] : []),
            ...(covidRemitted   > 0 ? [{ accountId: A.covid,   debit: Math.round(Number(covidRemitted)),   credit: 0, description: "COVID HRL remitted" }] : []),
            { accountId: A.bank,    debit: 0,  credit: totalRemitted,               description: "GRA payment from bank" },
          ];
          const vatId = await insertJournalWithLines(client, organizationId, {
            date: graPaymentDateValue, reference: `HIST-${YYYY_MM}-VAT`,
            description: `VAT remittance to GRA — ${batchName}`,
            importBatchId: batchId, lines: vatRemLines, createdByUserId: authUser.id,
          });
          createdJournals.push({ reference: `HIST-${YYYY_MM}-VAT`, id: vatId });
        }

        // JOURNAL 3 — Cost of Sales
        if (cogs !== null && cogs !== undefined) {
          const cogsAmt = Math.round(Number(cogs));
          if (cogsAmt > 0) {
            const desc = cogsEstimated
              ? `Estimated COGS (50% margin) — ${batchName} — NEEDS RECONCILIATION`
              : `Cost of goods sold — ${batchName}`;
            const cosId = await insertJournalWithLines(client, organizationId, {
              date: endDate, reference: `HIST-${YYYY_MM}-COS`,
              description: desc, importBatchId: batchId,
              lines: [
                { accountId: A.cogs,      debit: cogsAmt, credit: 0,       description: desc },
                { accountId: A.inventory, debit: 0,        credit: cogsAmt, description: "Inventory reduction" },
              ],
              createdByUserId: authUser.id,
            });
            createdJournals.push({ reference: `HIST-${YYYY_MM}-COS`, id: cosId });
          }
        }

        // JOURNAL 4 — Operating Expenses
        if (expenseLines.length > 0) {
          const expLines = [];
          let totalExp = 0;
          for (const exp of expenseLines) {
            const expAcctId = await getAccountId(client, organizationId, String(exp.accountCode));
            const amt = Math.round(Number(exp.amount || 0));
            if (amt > 0) {
              expLines.push({ accountId: expAcctId, debit: amt, credit: 0, description: exp.description || null });
              totalExp += amt;
            }
          }
          if (totalExp > 0) {
            expLines.push({ accountId: A.bank, debit: 0, credit: totalExp, description: "Expenses paid from bank" });
            const expId = await insertJournalWithLines(client, organizationId, {
              date: endDate, reference: `HIST-${YYYY_MM}-EXP`,
              description: `Operating expenses — ${batchName}`,
              importBatchId: batchId, lines: expLines, createdByUserId: authUser.id,
            });
            createdJournals.push({ reference: `HIST-${YYYY_MM}-EXP`, id: expId });
          }
        }

        await client.query("COMMIT");

        return json(event, 201, {
          batch: serializeBatch(batchRes.rows[0]),
          journalsCreated: createdJournals,
          vatCalculated: vatCalc,
          scheme,
          warning: cogsEstimated
            ? "COGS was estimated at 50% gross margin. Reconcile against actual stock records before posting."
            : null,
        });
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      }
    }

    // ── PATCH — post batch or delete draft ─────────────────────────────────────
    if (method === "PATCH") {
      const { id, action } = body;
      const batchId = Number(id);
      if (!batchId) return json(event, 400, { error: "id is required." });

      const batchRes = await client.query(
        `SELECT * FROM "historicalImportBatch" WHERE id = $1 AND "organizationId" = $2`,
        [batchId, organizationId]
      );
      if (!batchRes.rowCount) return json(event, 404, { error: "Batch not found." });
      const batch = batchRes.rows[0];

      if (action === "post") {
        if (batch.isPosted) return json(event, 409, { error: "Batch is already posted." });

        // Validate all journals in batch are balanced before posting
        const unbalanced = await client.query(
          `SELECT je.reference, SUM(jl.debit) AS td, SUM(jl.credit) AS tc
           FROM "journalEntry" je
           JOIN "journalLine" jl ON jl."journalEntryId" = je.id
           WHERE je."importBatchId" = $1
           GROUP BY je.id, je.reference
           HAVING SUM(jl.debit) != SUM(jl.credit)`,
          [batchId]
        );
        if (unbalanced.rowCount) {
          return json(event, 422, {
            error: "Cannot post: some journals are unbalanced.",
            unbalanced: unbalanced.rows.map((r) => ({ reference: r.reference, debit: Number(r.td), credit: Number(r.tc) })),
          });
        }

        await client.query("BEGIN");
        try {
          await client.query(
            `UPDATE "journalEntry"
             SET "isPosted" = TRUE, "postedAt" = NOW(), "postedByUserId" = $2, "updatedAt" = NOW()
             WHERE "importBatchId" = $1 AND "isPosted" = FALSE`,
            [batchId, authUser.id]
          );
          const updated = await client.query(
            `UPDATE "historicalImportBatch"
             SET "isPosted" = TRUE, "postedAt" = NOW(), "postedByUserId" = $2, "updatedAt" = NOW()
             WHERE id = $1 RETURNING *`,
            [batchId, authUser.id]
          );
          await client.query("COMMIT");
          return json(event, 200, { batch: serializeBatch(updated.rows[0]), message: "Batch posted successfully." });
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          throw err;
        }
      }

      if (action === "delete") {
        if (batch.isPosted) return json(event, 409, { error: "Cannot delete a posted batch. Use reversals instead." });
        await client.query("BEGIN");
        try {
          await client.query(`DELETE FROM "journalLine" WHERE "journalEntryId" IN (SELECT id FROM "journalEntry" WHERE "importBatchId" = $1)`, [batchId]);
          await client.query(`DELETE FROM "journalEntry" WHERE "importBatchId" = $1`, [batchId]);
          await client.query(`DELETE FROM "historicalImportBatch" WHERE id = $1`, [batchId]);
          await client.query("COMMIT");
          return json(event, 200, { deleted: true, id: batchId });
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          throw err;
        }
      }

      return json(event, 400, { error: `Unknown action "${action}". Use "post" or "delete".` });
    }
  } catch (err) {
    console.error("accounting-import error", err);
    const code = err?.statusCode || (err?.code === "23505" ? 409 : 500);
    return json(event, code, {
      error: err?.code === "23505"
        ? "A batch or journal with that reference already exists."
        : (err?.message || "Request failed."),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
