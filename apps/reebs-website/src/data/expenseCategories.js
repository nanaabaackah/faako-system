export const EXPENSE_CATEGORIES = Object.freeze([
  { label: "Utilities", chipBg: "rgba(255, 122, 89, 0.2)", chipColor: "#7a2f1d" },
  { label: "Logistics", chipBg: "rgba(99, 231, 198, 0.22)", chipColor: "#0f6f56" },
  { label: "Operational", chipBg: "rgba(121, 143, 255, 0.2)", chipColor: "#2b3c86" },
  { label: "Staff Salary", chipBg: "rgba(74, 180, 255, 0.2)", chipColor: "#1f5c8e" },
  { label: "Maintenance", chipBg: "rgba(160, 113, 255, 0.24)", chipColor: "#50308a" },
  { label: "Marketing", chipBg: "rgba(255, 215, 96, 0.3)", chipColor: "#8f6500" },
]);

export const EXPENSE_SPECIFIC_OPTIONS_BY_CATEGORY = Object.freeze({
  Utilities: Object.freeze([
    "Electricity (ECG)",
    "Water",
    "Internet",
    "Airtime / Phone",
    "Rent",
    "Generator Fuel",
    "Other Utility",
  ]),
  Logistics: Object.freeze([
    "Delivery Fuel",
    "Vehicle Fuel",
    "Driver Payment",
    "Transport Fare",
    "Tolls",
    "Loading / Offloading",
    "Courier",
    "Other Logistics",
  ]),
  Operational: Object.freeze([
    "Office Supplies",
    "Cleaning Supplies",
    "Bank Charges",
    "Taxes / Levies",
    "Licences / Permits",
    "Professional Fees",
    "Insurance",
    "Other Operational",
  ]),
  "Staff Salary": Object.freeze([
    "Salary",
    "Wages",
    "Overtime",
    "Bonus",
    "Allowance",
    "SSNIT / Payroll Deductions",
    "Other Staff Cost",
  ]),
  Maintenance: Object.freeze([
    "Vehicle Repair",
    "Generator Service",
    "Equipment Repair",
    "Spare Parts",
    "Technician Fee",
    "Facility Repair",
    "Other Maintenance",
  ]),
  Marketing: Object.freeze([
    "Social Media Ads",
    "Flyers / Printing",
    "Content Production",
    "Influencer / Promo",
    "Discount Campaign",
    "Event Promotion",
    "Other Marketing",
  ]),
});

const CATEGORY_ALIASES = {
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

const CATEGORY_RULES = [
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

const normalizeKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const CATEGORY_LOOKUP = new Map(EXPENSE_CATEGORIES.map((item) => [normalizeKey(item.label), item.label]));
Object.entries(CATEGORY_ALIASES).forEach(([alias, canonical]) => {
  CATEGORY_LOOKUP.set(normalizeKey(alias), canonical);
});

const STYLE_LOOKUP = new Map(EXPENSE_CATEGORIES.map((item) => [item.label, {
  background: item.chipBg,
  color: item.chipColor,
}]));

export const EXPENSE_CATEGORY_LABELS = Object.freeze(EXPENSE_CATEGORIES.map((item) => item.label));

export const normalizeExpenseCategory = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return CATEGORY_LOOKUP.get(normalizeKey(raw)) || "";
};

export const getExpenseSpecificOptions = (category) => {
  const normalized = normalizeExpenseCategory(category);
  return EXPENSE_SPECIFIC_OPTIONS_BY_CATEGORY[normalized] || [];
};

export const inferExpenseCategory = ({ category = "", description = "" } = {}) => {
  const normalized = normalizeExpenseCategory(category);
  if (EXPENSE_CATEGORY_LABELS.includes(normalized)) return normalized;
  const text = `${category || ""} ${description || ""}`.toLowerCase();
  const matched = CATEGORY_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
  return matched?.category || "Operational";
};

export const getExpenseCategoryStyle = (category) => {
  const normalized = normalizeExpenseCategory(category);
  return STYLE_LOOKUP.get(normalized || "Operational") || {
    background: "rgba(121, 143, 255, 0.2)",
    color: "#2b3c86",
  };
};
