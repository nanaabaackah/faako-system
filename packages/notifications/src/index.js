export * from "./constants/index.js";
export * from "./helpers/index.js";
export * from "./templates/index.js";

// TODO(resend-email-sender): connect backend email senders only after app-specific consent, preference, and audit requirements are defined.
// TODO(whatsapp-business-api): add provider contracts without auto-sending customer messages from frontend code.
// TODO(sms-provider): add SMS adapters only after opt-in, quiet-hours, and cost controls are documented.
// TODO(notification-audit-log): design append-only audit records before automated notification delivery.
// TODO(notification-preferences): add user/customer/org preferences before automated reminders.
// TODO(notification-retry-handling): share retry metadata only after idempotency and provider response handling are defined.
