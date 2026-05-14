export * from "./constants/index.js";
export * from "./helpers/index.js";
export * from "./templates/index.js";

// TODO(resend-email-sender): connect backend email senders only after app-specific consent, preference, and audit requirements are defined.
// TODO(whatsapp-business-api): add provider contracts without auto-sending customer messages from frontend code.
// TODO(sms-provider): add SMS adapters only after opt-in, quiet-hours, and cost controls are documented.
// TODO(notification-audit-log): design append-only audit records before automated notification delivery.
// TODO(notification-preferences): add user/customer/org preferences before automated reminders.
// TODO(notification-retry-handling): share retry metadata only after idempotency and provider response handling are defined.
// TODO(org-settings-branding): use getOrganizationDisplayName and getOrganizationContactInfo from
//   @faako/org-settings to brand customer-facing templates (WhatsApp, email, SMS) with live org
//   name and contact details. Wire only after an auth-scoped org settings API endpoint exists and
//   per-app consent/preference review is complete.
