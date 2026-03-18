const EXPENSE_CATEGORY_DEFINITIONS = [
  "Utilities",
  "Logistics",
  "Operational",
  "Staff Salary",
  "Maintenance",
  "Marketing",
];

const EXPENSE_CATEGORY_ALIASES = {
  Utilities: "Utilities",
  Utility: "Utilities",
  "Rent & Utilities": "Utilities",
  "Communication & Internet": "Utilities",
  Logistics: "Logistics",
  Transport: "Logistics",
  "Transport & Fuel": "Logistics",
  Operational: "Operational",
  "Office & Admin": "Operational",
  "Professional & Legal Fees": "Operational",
  "Bank Charges & Mobile Money Fees": "Operational",
  "Taxes, Levies & Licences": "Operational",
  Insurance: "Operational",
  Miscellaneous: "Operational",
  Payroll: "Staff Salary",
  Salary: "Staff Salary",
  "Payroll & Staff Costs": "Staff Salary",
  "Staff Salary": "Staff Salary",
  "Staff Salaries": "Staff Salary",
  Maintenance: "Maintenance",
  "Repairs & Maintenance": "Maintenance",
  Repairs: "Maintenance",
  Marketing: "Marketing",
  "Marketing & Advertising": "Marketing",
};

const EXPENSE_CATEGORY_RULES = [
  {
    category: "Utilities",
    keywords: [
      "rent",
      "lease",
      "water",
      "electricity",
      "ecg",
      "utility",
      "internet",
      "wifi",
      "airtime",
      "data",
      "phone",
      "telecom",
      "power",
      "generator",
      "fuel for gen",
    ],
  },
  {
    category: "Staff Salary",
    keywords: ["salary", "payroll", "wage", "staff", "allowance", "ssnit", "bonus"],
  },
  {
    category: "Logistics",
    keywords: ["fuel", "transport", "uber", "bolt", "delivery", "toll", "trip", "driver"],
  },
  {
    category: "Marketing",
    keywords: ["marketing", "promo", "advert", "ad", "campaign", "facebook", "instagram", "tiktok", "seo"],
  },
  {
    category: "Maintenance",
    keywords: ["maintenance", "repair", "service", "fix", "spare", "technician"],
  },
  {
    category: "Operational",
    keywords: [
      "office",
      "stationery",
      "printer",
      "supplies",
      "admin",
      "cleaning",
      "legal",
      "lawyer",
      "consultant",
      "professional",
      "audit",
      "accountant",
      "advisory",
      "bank",
      "momo",
      "mobile money",
      "transfer",
      "merchant fee",
      "tax",
      "vat",
      "gra",
      "permit",
      "license",
      "licence",
      "levy",
      "insurance",
      "premium",
      "policy",
      "cover",
    ],
  },
];

const toLookupKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const EXPENSE_CATEGORY_LOOKUP = new Map(
  EXPENSE_CATEGORY_DEFINITIONS.map((category) => [toLookupKey(category), category])
);

Object.entries(EXPENSE_CATEGORY_ALIASES).forEach(([alias, canonical]) => {
  EXPENSE_CATEGORY_LOOKUP.set(toLookupKey(alias), canonical);
});

export const EXPENSE_CATEGORIES = Object.freeze([...EXPENSE_CATEGORY_DEFINITIONS]);

export const normalizeExpenseCategory = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return EXPENSE_CATEGORY_LOOKUP.get(toLookupKey(raw)) || "";
};

export const isSupportedExpenseCategory = (value) => {
  const normalized = normalizeExpenseCategory(value);
  return Boolean(normalized) && EXPENSE_CATEGORIES.includes(normalized);
};

export const inferExpenseCategory = ({ category = "", description = "" } = {}) => {
  const direct = normalizeExpenseCategory(category);
  if (EXPENSE_CATEGORIES.includes(direct)) return direct;

  const text = `${category || ""} ${description || ""}`.toLowerCase();
  const match = EXPENSE_CATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword))
  );
  return match?.category || "Operational";
};

export const resolveExpenseTable = async (client) => {
  const candidatesRes = await client.query(
    `SELECT table_schema, table_name
     FROM information_schema.columns
     WHERE column_name IN ('category', 'amount', 'description', 'date')
       AND table_schema NOT IN ('pg_catalog', 'information_schema')
     GROUP BY table_schema, table_name
     HAVING COUNT(DISTINCT column_name) >= 4`
  );

  const candidates = candidatesRes.rows.map((row) => ({
    label: `${row.table_schema}.${row.table_name}`,
    schema: row.table_schema,
    tableName: row.table_name,
    queryRef: `"${row.table_schema}"."${row.table_name}"`,
  }));

  if (!candidates.length) {
    candidates.push(
      { label: "public.expense", schema: "public", tableName: "expense", queryRef: "\"public\".\"expense\"" },
      { label: "public.Expense", schema: "public", tableName: "Expense", queryRef: "\"public\".\"Expense\"" },
      { label: "public.expenses", schema: "public", tableName: "expenses", queryRef: "\"public\".\"expenses\"" }
    );
  }

  const available = [];
  for (const table of candidates) {
    try {
      const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM ${table.queryRef}`);
      available.push({ ...table, count: countRes.rows[0]?.count || 0 });
    } catch {
      // ignore missing tables
    }
  }

  if (!available.length) return null;
  available.sort((a, b) => b.count - a.count);
  return available[0];
};

export const resolveExpenseColumns = async (client, table) => {
  if (!table?.schema || !table?.tableName) return [];
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2`,
    [table.schema, table.tableName]
  );
  return result.rows.map((row) => row.column_name);
};

export const buildExpenseFilter = ({
  hasOrganizationId = false,
  organizationId = null,
  startDate = null,
  endDate = null,
  dateExpression = "\"date\"",
} = {}) => {
  const params = [];
  const whereClauses = [];

  if (hasOrganizationId && Number.isFinite(Number(organizationId))) {
    params.push(Number(organizationId));
    whereClauses.push(`"organizationId" = $${params.length}`);
  }

  const start = startDate instanceof Date ? startDate : startDate ? new Date(startDate) : null;
  const end = endDate instanceof Date ? endDate : endDate ? new Date(endDate) : null;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    params.push(start.toISOString(), end.toISOString());
    whereClauses.push(`${dateExpression} >= $${params.length - 1} AND ${dateExpression} < $${params.length}`);
  }

  return {
    params,
    whereClause: whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
  };
};
