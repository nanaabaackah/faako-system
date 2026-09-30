import { hasPermission } from "../../functions/_shared/accessControl.js";

export const PAYMENT_PERMISSIONS = Object.freeze({
  VIEW: "payments:read",
  RECORD_MANUAL: "payments:record_manual",
  VERIFY: "payments:verify",
  REFUND: "payments:refund",
  RECONCILE: "payments:reconcile",
  EXPORT: "payments:export",
  PROVIDER_DETAILS_VIEW: "payments:provider_details_view",
});

export const canRecordManualPayment = (user) =>
  hasPermission(user, PAYMENT_PERMISSIONS.RECORD_MANUAL);
