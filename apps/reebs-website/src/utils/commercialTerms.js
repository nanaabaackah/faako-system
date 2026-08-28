const exactInteger = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const normalizePublicCommercialTerms = (payload = {}) => {
  if (payload?.scope !== "reebs-core" || payload?.businessUnit !== "REEBS_CORE") {
    throw new TypeError("Booking terms returned an unexpected business scope.");
  }

  const bundleMinimumItems = exactInteger(payload?.booking?.bundleMinimumItems);
  const bundleDiscountBps = exactInteger(payload?.booking?.bundleDiscountBps);
  const attendantUnitFeeCents = exactInteger(payload?.booking?.attendantUnitFeeCents);
  const serviceDepositBps = exactInteger(payload?.paymentTerms?.serviceDepositBps);
  const serviceDepositDueDays = exactInteger(payload?.paymentTerms?.serviceDepositDueDays);

  if (
    bundleMinimumItems === null
    || bundleMinimumItems < 1
    || bundleDiscountBps === null
    || bundleDiscountBps < 0
    || bundleDiscountBps > 10000
    || attendantUnitFeeCents === null
    || attendantUnitFeeCents < 0
    || serviceDepositBps === null
    || serviceDepositBps < 0
    || serviceDepositBps > 10000
    || serviceDepositDueDays === null
    || serviceDepositDueDays < 0
  ) {
    throw new TypeError("Booking terms are incomplete or invalid.");
  }

  return {
    scope: "reebs-core",
    businessUnit: "REEBS_CORE",
    currency: String(payload.currency || "GHS").toUpperCase(),
    effectiveAt: String(payload.effectiveAt || ""),
    booking: {
      bundleMinimumItems,
      bundleDiscountBps,
      attendantUnitFeeCents,
    },
    paymentTerms: {
      serviceDepositBps,
      serviceDepositDueDays,
    },
  };
};
