const DEFAULT_ATTENDANT_RATE_CENTS = 10000;

const normalizeCents = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};

export const getAttendantRateCents = () =>
  normalizeCents(
    process.env.REEBS_ATTENDANT_RATE_CENTS
      || process.env.ATTENDANT_RATE_CENTS
      || process.env.REEBS_ATTENDANT_FEE_CENTS,
    DEFAULT_ATTENDANT_RATE_CENTS
  );

export const countRequiredAttendants = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const attendantsPerUnit = Math.max(0, Number(item?.attendantsNeeded || 0));
    if (!attendantsPerUnit) return sum;
    const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
    return sum + attendantsPerUnit * quantity;
  }, 0);

export const calculateAttendantChargeCents = (items = [], rateCents = getAttendantRateCents()) => {
  const attendants = countRequiredAttendants(items);
  return {
    attendants,
    rateCents: normalizeCents(rateCents, 0),
    totalCents: attendants * normalizeCents(rateCents, 0),
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
