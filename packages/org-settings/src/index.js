export * from "./constants/index.js";
export * from "./helpers/index.js";
export * from "./types/index.js";

// TODO(org-settings-api): design a read-only server-side /api/org/settings endpoint
//   after per-organization database fields (currency, timezone, branding) are added via
//   a safe additive migration. Scope the endpoint by authenticated session organizationId.
//   Never expose API keys, webhook secrets, payment provider credentials, or signing keys.

// TODO(org-settings-write): design a settings-update endpoint and form flow after the
//   read endpoint is proven and the field set is reviewed per app. Keep write operations
//   scoped to org-admin roles only; do not expose to staff or unauthenticated users.

// TODO(org-settings-dev-erp): wire normalizeOrganizationSettings into the Dev ERP Settings
//   page after a safe /api/org/settings endpoint exists. Display businessName, currency,
//   and timezone. Keep auth, alert preferences, and rent/payment behavior unchanged.

// TODO(org-settings-reebs): wire normalizeOrganizationSettings into REEBS Portal admin
//   settings after a safe /api/org/settings endpoint exists. Display businessName, currency,
//   and timezone in the org settings panel. Keep POS, payments, bookings, inventory,
//   receipts, and offline sync behavior unchanged.

// TODO(org-settings-shell): pass getOrganizationDisplayName result into the shared ERP
//   shell sidebar title and topbar org indicator after org settings API is available.
//   Wire only after the shell context pattern (SystemProvider or similar) is reviewed.

// TODO(org-settings-notifications): pass getOrganizationDisplayName and
//   getOrganizationContactInfo into @faako/notifications customer templates so org
//   branding appears in WhatsApp/email share messages. Wire only after org settings
//   API is available and consent/preferences are reviewed per app.

// TODO(org-settings-receipts): use getOrganizationCurrencySymbol and
//   getOrganizationContactInfo in @faako/finance receipt presentation helpers
//   to brand receipts with live org data. Wire only after org settings API is available
//   and receipt format changes are reviewed per app.

// TODO(org-settings-modules): implement module enable/disable persistence after the
//   field registry (ORG_SETTINGS_FIELDS.ENABLED_MODULES) is mapped to a safe
//   backend column and the module registry contract is finalized per app.

// TODO(org-settings-audit): emit SETTINGS_UPDATED audit events from @faako/audit
//   when org settings are saved, after the audit backend writer is designed.
