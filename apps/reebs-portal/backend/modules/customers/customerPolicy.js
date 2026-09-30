export const CUSTOMER_SCOPES = Object.freeze({
  CORE: "core",
  WATER: "water",
});

export const parseCustomerScope = (value) =>
  String(value || "").trim().toLowerCase() === CUSTOMER_SCOPES.WATER
    ? CUSTOMER_SCOPES.WATER
    : CUSTOMER_SCOPES.CORE;

export const parseCustomerPage = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize || query.limit, 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

export const CUSTOMER_ERROR_CODES = Object.freeze({
  NOT_FOUND: "CUSTOMER_NOT_FOUND",
  ALREADY_EXISTS: "CUSTOMER_ALREADY_EXISTS",
  DUPLICATE_WARNING: "CUSTOMER_DUPLICATE_WARNING",
  INVALID_TYPE: "INVALID_CUSTOMER_TYPE",
  INVALID_PHONE: "INVALID_PHONE",
  INVALID_EMAIL: "INVALID_EMAIL",
  CONTACT_REQUIRED: "CUSTOMER_CONTACT_REQUIRED",
  HAS_HISTORY: "CUSTOMER_HAS_HISTORY",
  PERMISSION_DENIED: "PERMISSION_DENIED",
});

export const toCustomerValidationError = (errors = []) => {
  const first = errors[0] || {};
  const messages = {
    REQUIRED: "Customer name is required.",
    INVALID_PHONE: "Enter a valid Ghana or international phone number.",
    INVALID_EMAIL: "Enter a valid email address.",
    CONTACT_REQUIRED: "Add at least a phone number or email address.",
  };
  return {
    code: CUSTOMER_ERROR_CODES[first.code] || first.code || "INVALID_CUSTOMER",
    error: messages[first.code] || "Check the customer details and try again.",
    fieldErrors: Object.fromEntries(errors.map((entry) => [entry.field, messages[entry.code] || entry.code])),
  };
};
