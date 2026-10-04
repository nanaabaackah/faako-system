// Only curated business-configuration messages may cross the 5xx boundary.
// Never expose arbitrary exception text (SQL, connection details, credentials).
const CONFIGURATION_MESSAGES = Object.freeze({
  MISSING_WATER_PRICE: "There is no Water price configured for this product, quantity and sale date. Ask an owner or admin to add a price for that period in Settings → Commercial. For a backdated sale, add the historical price; today's price is not used instead.",
  MISSING_COMMERCIAL_CONFIGURATION: "A required Water price or discount rule is missing for the selected date. Ask an owner or admin to review Settings → Commercial.",
  AMBIGUOUS_WATER_PRICE: "More than one Water selling price applies to this date. An owner or admin must reconcile the overlapping prices in Settings → Commercial.",
  AMBIGUOUS_COMMERCIAL_CONFIGURATION: "Overlapping Water commercial rules apply to this date. An owner or admin must reconcile them in Settings → Commercial.",
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
