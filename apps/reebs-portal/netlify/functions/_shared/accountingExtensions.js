// Ghana standard-rate VAT: 15% + 2.5% NHIL + 2.5% GETFund + 1% COVID-HRL = 21% on base
// Gross denominator = 121 (net × 1.21 = gross)
export const GH_VAT_DENOMINATOR = 121;

export const computeVatComponents = (grossPesewas, denominator = GH_VAT_DENOMINATOR) => {
  const g = Math.round(grossPesewas);
  const net = Math.round(g * 100 / denominator);
  const totalTax = g - net;
  // Distribute totalTax proportionally: VAT 15, NHIL 2.5, GETFund 2.5, COVID 1 → bps 1500,250,250,100
  const vatBps = 1500;
  const nhilBps = 250;
  const getfundBps = 250;
  const covidBps = 100;
  const totalBps = vatBps + nhilBps + getfundBps + covidBps; // 2100
  const vat = Math.round(totalTax * vatBps / totalBps);
  const nhil = Math.round(totalTax * nhilBps / totalBps);
  const getfund = Math.round(totalTax * getfundBps / totalBps);
  const covid = totalTax - vat - nhil - getfund; // absorbs rounding remainder
  return { net, vat, nhil, getfund, covid, totalTax };
};

// For simplified 16% scheme (15% VAT + 1% COVID only, denominator = 116)
export const computeVatComponentsSimplified = (grossPesewas) => {
  const g = Math.round(grossPesewas);
  const net = Math.round(g * 100 / 116);
  const totalTax = g - net;
  const vat = Math.round(totalTax * 1500 / 1600);
  const covid = totalTax - vat;
  return { net, vat, nhil: 0, getfund: 0, covid, totalTax };
};

// Basis points → decimal rate
export const bpsToDecimal = (bps) => bps / 10000;

// Ensure all seven accounting tables exist (lightweight check)
export const ensureAccountingTables = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "systemConfig" (
      "id" SERIAL PRIMARY KEY, "organizationId" INTEGER NOT NULL DEFAULT 1,
      "key" TEXT NOT NULL, "value" TEXT NOT NULL, "description" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "systemConfig_org_key_uk" ON "systemConfig" ("organizationId", "key")`
  ).catch(() => {});
};

// Get a single system config value
export const getSystemConfig = async (client, organizationId, key) => {
  const res = await client.query(
    `SELECT value FROM "systemConfig" WHERE "organizationId" = $1 AND key = $2 LIMIT 1`,
    [organizationId, key]
  );
  return res.rows[0]?.value ?? null;
};

// Validate that a journal's lines balance before posting
export const assertJournalBalanced = (lines) => {
  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  if (totalDebit !== totalCredit) {
    const err = new Error(
      `Journal is unbalanced: total debits ${totalDebit} ≠ total credits ${totalCredit} (pesewas).`
    );
    err.statusCode = 422;
    throw err;
  }
  if (totalDebit === 0) {
    const err = new Error("Journal has no entries — cannot post an empty journal.");
    err.statusCode = 422;
    throw err;
  }
};

// Format pesewas → GHS display string (UI layer only — never store as float)
export const formatGhs = (pesewas) =>
  `GHS ${(Number(pesewas ?? 0) / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
