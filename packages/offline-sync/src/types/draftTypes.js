export const LOCAL_DRAFT_TYPES = Object.freeze({
  POS_CART: "pos-cart",
  MANUAL_PAYMENT: "manual-payment",
  ORDER_PAYMENT_ACTION: "order-payment-action",
});

export const LOCAL_DRAFT_SECURITY_ASSUMPTIONS = Object.freeze({
  authenticatedBeforeUse: true,
  serverValidatesFinalSubmit: true,
  syncsToProduction: false,
  storesSecrets: false,
});

export const LOCAL_DRAFT_METADATA_SHAPE = Object.freeze({
  sourceApp: "string",
  organizationId: "string | number",
  actorId: "string | number",
  draftType: "string",
  recordId: "string | number",
  savedAt: "ISO timestamp",
  lastRestoredAt: "ISO timestamp | empty string",
  syncEnabled: false,
});
