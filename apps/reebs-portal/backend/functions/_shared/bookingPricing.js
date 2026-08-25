import {
  COMMERCIAL_BUSINESS_UNITS,
  COMMERCIAL_CONFIG_KEYS,
  resolveCommercialConfiguration,
} from "./commercialConfig.js";

const normalizedItemMap = (items = []) => {
  const totals = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const productId = Number(item?.productId);
    const variantId = Number(item?.variantId);
    const quantity = Math.max(1, Number.parseInt(item?.quantity, 10) || 1);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    const key = `${productId}:${Number.isInteger(variantId) && variantId > 0 ? variantId : ""}`;
    totals.set(key, (totals.get(key) || 0) + quantity);
  }
  return totals;
};

export const bookingItemsMatchPriceSnapshot = (requestedItems, persistedItems) => {
  const requested = normalizedItemMap(requestedItems);
  const persisted = normalizedItemMap(persistedItems);
  if (requested.size !== persisted.size) return false;
  for (const [key, quantity] of requested.entries()) {
    if (persisted.get(key) !== quantity) return false;
  }
  return true;
};

export const shouldPreserveBookingPriceSnapshot = ({
  method,
  hasItemsPayload,
  requestedItems,
  persistedItems,
} = {}) => {
  if (String(method || "").toUpperCase() !== "PUT") return false;
  if (!hasItemsPayload) return true;
  return bookingItemsMatchPriceSnapshot(requestedItems, persistedItems);
};

// Booking commercial rules are resolved together so a new booking or explicit
// repricing cannot accidentally mix database rules from different instants.
// Historical metadata/status updates bypass this resolver and retain their
// persisted Booking/BookingItem price snapshots.
export const resolveBookingCommercialPricing = async (
  client,
  { organizationId, at = new Date() } = {}
) => {
  const common = {
    organizationId,
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    at,
  };
  const records = [];
  for (const key of [
    COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_MIN_ITEMS,
    COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_DISCOUNT_BPS,
    COMMERCIAL_CONFIG_KEYS.BOOKING_ATTENDANT_UNIT_FEE_CENTS,
  ]) {
    records.push(await resolveCommercialConfiguration(client, { ...common, key }));
  }

  const [bundleMinimumItems, bundleDiscount, attendantUnitFee] = records;
  return {
    bundleMinimumItems: bundleMinimumItems.value,
    bundleDiscountBps: bundleDiscount.value,
    attendantUnitFeeCents: attendantUnitFee.value,
    configurationIds: {
      bundleMinimumItems: bundleMinimumItems.id,
      bundleDiscountBps: bundleDiscount.id,
      attendantUnitFeeCents: attendantUnitFee.id,
    },
    effectiveAt: new Date(at).toISOString(),
  };
};

export const resolveBookingCommercialPricingForMutation = async (
  client,
  { preservePriceSnapshot = false, ...options } = {}
) => (
  preservePriceSnapshot
    ? null
    : resolveBookingCommercialPricing(client, options)
);

export const calculateBundleDiscountCents = ({
  subtotalCents,
  itemCount,
  applyBundleDiscount,
  bundleMinimumItems,
  bundleDiscountBps,
} = {}) => {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const count = Math.max(0, Math.trunc(Number(itemCount) || 0));
  const minimum = Math.max(1, Math.trunc(Number(bundleMinimumItems) || 0));
  const rateBps = Math.min(10000, Math.max(0, Math.trunc(Number(bundleDiscountBps) || 0)));
  if (!applyBundleDiscount || count < minimum || subtotal <= 0) return 0;
  return Math.round((subtotal * rateBps) / 10000);
};
