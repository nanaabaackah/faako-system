// Only curated business-configuration messages may cross the 5xx boundary.
// Never expose arbitrary exception text (SQL, connection details, credentials).
const CONFIGURATION_MESSAGES = Object.freeze({
  MISSING_WATER_PRICE: "A current selling price is missing for this Water product and sale type. Ask an owner or admin to update the product's current prices.",
  MISSING_COMMERCIAL_CONFIGURATION: "A required Water discount rule is missing. Ask an owner or admin to review the commercial settings.",
  AMBIGUOUS_COMMERCIAL_CONFIGURATION: "Multiple Water discount rules apply. An owner or admin must review the commercial settings.",
  MISSING_WATER_COST_BASIS: "This Water product has no recorded purchase cost on or before the sale date. Ask an owner or admin to add or correct its restock cost and date before recording the sale.",
});

export const getWaterActionError = (error) => {
  const status = Number(error?.statusCode);
  const statusCode = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  const message = statusCode === 503 && Object.hasOwn(CONFIGURATION_MESSAGES, error?.code)
    ? CONFIGURATION_MESSAGES[error.code] : null;
  return {
    statusCode,
    payload: {
      error: message || (statusCode >= 500 ? "Failed to process water module request." : error.message),
      ...(error?.code ? { code: error.code } : {}),
    },
    options: { exposeServerMessage: Boolean(message) },
  };
};
