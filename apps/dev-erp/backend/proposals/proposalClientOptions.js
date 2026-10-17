const CLIENT_COLUMNS = [
  "id", "companyName", "contactName", "email", "phone", "projectDetails",
  "currentWorkflow", "painPoints", "additionalNotes", "onboardingIntake", "updatedAt",
  "createdAt", "archivedAt",
];

const clean = (value, max = 2000) => {
  const result = typeof value === "string" ? value.trim() : "";
  return result ? result.slice(0, max) : null;
};

const normalizeIdentity = (value) => clean(value, 320)?.toLocaleLowerCase("en") || null;

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
};

export const mapProposalClientOption = (row) => {
  const intake = parseJson(row.onboardingIntake);
  return {
    reference: String(row.id),
    companyName: clean(row.companyName, 240),
    contactName: clean(row.contactName, 180),
    email: clean(row.email, 320),
    phone: clean(row.phone, 80),
    formType: clean(intake?.meta?.formType, 80) || "client-onboarding",
    projectContext: {
      projectDetails: clean(row.projectDetails, 4000),
      currentWorkflow: clean(row.currentWorkflow, 4000),
      painPoints: clean(row.painPoints, 4000),
      additionalNotes: clean(row.additionalNotes, 4000),
      serviceReason: clean(intake?.service?.projectReason, 2000),
      desiredOutcome: clean(intake?.service?.desiredOutcome, 2000),
    },
    updatedAt: new Date(row.updatedAt || row.createdAt || 0).toISOString(),
  };
};

export const deduplicateProposalClientOptions = (rows) => {
  const seenEmails = new Set();
  const seenCompanies = new Set();
  const options = [];
  for (const row of rows) {
    const option = mapProposalClientOption(row);
    const emailKey = normalizeIdentity(option.email);
    const companyKey = normalizeIdentity(option.companyName);
    if ((emailKey && seenEmails.has(emailKey)) || (companyKey && seenCompanies.has(companyKey))) {
      continue;
    }
    if (emailKey) seenEmails.add(emailKey);
    if (companyKey) seenCompanies.add(companyKey);
    options.push(option);
  }
  return options;
};

const resolveTable = async (pool) => {
  if (!pool) return null;
  const result = await pool.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE' AND table_name = 'SignupRequest'
    ORDER BY CASE WHEN table_schema = 'public' THEN 0 ELSE 1 END, table_schema
    LIMIT 1
  `);
  if (!result.rows[0]) return null;
  const columns = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `, [result.rows[0].table_schema, result.rows[0].table_name]);
  return { ...result.rows[0], columns: new Set(columns.rows.map((entry) => entry.column_name)) };
};

export const loadProposalClientOptions = async ({ faakoPool, search = "", limit = 30 }) => {
  const table = await resolveTable(faakoPool);
  if (!table) {
    const error = new Error("Faako form submissions are temporarily unavailable.");
    error.status = 503;
    throw error;
  }
  const selected = CLIENT_COLUMNS.filter((column) => table.columns.has(column));
  if (!selected.includes("id") || !selected.includes("companyName") || !selected.includes("email")) {
    const error = new Error("Faako form submissions are missing required client fields.");
    error.status = 503;
    throw error;
  }
  const where = [];
  const values = [];
  if (table.columns.has("archivedAt")) where.push('"archivedAt" IS NULL');
  const term = clean(search, 120);
  if (term) {
    values.push(`%${term}%`);
    const searchable = ["companyName", "contactName", "email", "phone"].filter((column) => table.columns.has(column));
    where.push(`(${searchable.map((column) => `COALESCE("${column}"::text, '') ILIKE $1`).join(" OR ")})`);
  }
  values.push(Math.min(Math.max(Number(limit) || 30, 1), 50) * 5);
  const qualifiedName = `"${table.table_schema}"."${table.table_name}"`;
  const order = table.columns.has("updatedAt") ? '"updatedAt" DESC NULLS LAST' : '"createdAt" DESC NULLS LAST';
  const result = await faakoPool.query(
    `SELECT ${selected.map((column) => `"${column}"`).join(", ")} FROM ${qualifiedName}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${order} LIMIT $${values.length}`,
    values,
  );
  return deduplicateProposalClientOptions(result.rows).slice(0, Math.min(Math.max(Number(limit) || 30, 1), 50));
};
