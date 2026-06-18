const RENT_MODULE_KEY = "rent";

export const ACCESS_MODULE_KEYS = [
  "dashboard",
  "proposals",
  "faako-onboarding",
  "rent",
  "accounting",
  "invoicing",
  "bookings",
  "organizations",
  "system-health",
  "reports",
  "audit-logs",
  "profile",
  "settings",
  "user-control",
];

export const ACCESS_MODULE_SET = new Set(ACCESS_MODULE_KEYS);

export const SUPPORTED_USER_ROLE_NAMES = ["Admin", "Landlord", "Tenant"];

export const SUPPORTED_ACCESS_ROLE_DEFINITIONS = [
  { name: "Admin", description: "Full access to every endpoint", permissions: null },
  {
    name: "Landlord",
    description: "Rent manager with access to all tenant records in the organization",
    permissions: { modules: [RENT_MODULE_KEY] },
  },
  {
    name: "Tenant",
    description: "External user with rent module access only",
    permissions: { modules: [RENT_MODULE_KEY] },
  },
];

export const AUTHENTICATED_MODULE_CAPABILITY_ROUTES = [
  { pattern: /^\/api\/dashboard(?:\/|$)/, modules: ["dashboard"] },
  { pattern: /^\/api\/jobs(?:\/|$)/, modules: ["dashboard"] },
  { pattern: /^\/api\/ai\/productivity-coach(?:\/|$)/, modules: ["dashboard"] },
  { pattern: /^\/api\/productivity(?:\/|$)/, modules: ["dashboard"] },
  { pattern: /^\/api\/proposals(?:\/|$)/, modules: ["proposals"] },
  { pattern: /^\/api\/faako-onboarding(?:\/|$)/, modules: ["faako-onboarding"] },
  { pattern: /^\/api\/rent(?:\/|$)/, modules: ["rent"] },
  { pattern: /^\/api\/accounting(?:\/|$)/, modules: ["accounting"] },
  { pattern: /^\/api\/invoices(?:\/|$)/, modules: ["invoicing"] },
  { pattern: /^\/api\/bookings(?:\/|$)/, modules: ["bookings"] },
  { pattern: /^\/api\/integrations\/google(?:\/|$)/, modules: ["bookings"] },
  { pattern: /^\/api\/organizations(?:\/|$)/, modules: ["organizations"] },
  { pattern: /^\/api\/debug(?:\/|$)/, modules: ["system-health"] },
  { pattern: /^\/api\/reports\/summary(?:\/|$)/, modules: ["audit-logs"] },
  { pattern: /^\/api\/reports(?:\/|$)/, modules: ["reports"] },
  { pattern: /^\/api\/audit-logs(?:\/|$)/, modules: ["audit-logs"] },
  { pattern: /^\/api\/alerts(?:\/|$)/, modules: ["settings"] },
  { pattern: /^\/api\/roles(?:\/|$)/, modules: ["user-control"] },
  { pattern: /^\/api\/access(?:\/|$)/, modules: ["user-control"] },
];

export const MODULE_CAPABILITY_PUBLIC_PATHS = [
  /^\/api\/auth(?:\/|$)/,
  /^\/api\/public(?:\/|$)/,
  /^\/api\/webhooks(?:\/|$)/,
  /^\/api\/users\/me(?:\/|$)/,
];
