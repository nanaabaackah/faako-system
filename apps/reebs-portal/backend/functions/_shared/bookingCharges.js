export const getAttendantRateCents = (rateCents) => {
  const parsed = Number(rateCents);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new TypeError("An explicit non-negative attendant rate in cents is required.");
  }
  return Math.round(parsed);
};

export const countRequiredAttendants = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const attendantsPerUnit = Math.max(0, Number(item?.attendantsNeeded || 0));
    if (!attendantsPerUnit) return sum;
    const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
    return sum + attendantsPerUnit * quantity;
  }, 0);

export const calculateAttendantChargeCents = (items = [], rateCents) => {
  const attendants = countRequiredAttendants(items);
  const normalizedRateCents = getAttendantRateCents(rateCents);
  return {
    attendants,
    rateCents: normalizedRateCents,
    totalCents: attendants * normalizedRateCents,
  };
};

export const buildAttendantChargeExpenseRow = (items = [], options = {}) => {
  const charge = calculateAttendantChargeCents(items, options.rateCents);
  if (charge.attendants <= 0 || charge.totalCents <= 0) return null;
  const attendeeLabel = charge.attendants === 1 ? "attendant" : "attendants";
  const rateLabel = (charge.rateCents / 100).toFixed(2);
  return {
    id: options.id || "auto-attendant-charge",
    category: options.category || "Attendant fee",
    amount: charge.totalCents,
    description:
      options.description
      || `Attendant fee (${charge.attendants} ${attendeeLabel} @ GHS ${rateLabel})`,
    date: options.date || new Date().toISOString(),
    isClientCharge: true,
    source: "auto-attendant",
  };
};

export const buildAttendantChargeLine = (items = [], options = {}) => {
  const charge = calculateAttendantChargeCents(items, options.rateCents);
  if (charge.attendants <= 0 || charge.totalCents <= 0) return null;
  const attendeeLabel = charge.attendants === 1 ? "attendant" : "attendants";
  const rateLabel = (charge.rateCents / 100).toFixed(2);
  return {
    id: options.id || "attendant-fee",
    productId: null,
    variantId: null,
    name:
      options.name
      || `Attendant fee (${charge.attendants} ${attendeeLabel} @ GHS ${rateLabel})`,
    sku: null,
    rate: "Per event",
    attendantsNeeded: 0,
    sourceCategoryCode: "SERVICE",
    motorsToPump: 0,
    quantity: charge.attendants,
    unitPriceCents: charge.rateCents,
    totalCents: charge.totalCents,
    unitPrice: charge.rateCents / 100,
    total: charge.totalCents / 100,
    isClientCharge: true,
    chargeType: "attendant",
  };
};
