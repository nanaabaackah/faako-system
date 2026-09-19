const DEFAULT_BOOKING_COMMERCIAL_RULES = Object.freeze({
  currency: "GHS",
  bundleMinItems: 3,
  bundleDiscountBps: 1000,
  attendantUnitFeeCents: 10000,
  serviceDepositBps: 7000,
});

const INTEGER_RULES = Object.freeze({
  booking_bundle_min_items: "bundleMinItems",
  booking_bundle_discount_bps: "bundleDiscountBps",
  booking_attendant_unit_fee_cents: "attendantUnitFeeCents",
  service_deposit_bps: "serviceDepositBps",
});

const clampRule = (key, value) => {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) return null;
  if (key === "bundleMinItems") return Math.min(Math.max(numeric, 1), 100);
  if (key === "bundleDiscountBps" || key === "serviceDepositBps") {
    return Math.min(Math.max(numeric, 0), 10000);
  }
  return Math.min(Math.max(numeric, 0), 100_000_000);
};

const loadBookingCommercialRules = async (client, organizationId, effectiveAt = new Date()) => {
  const rules = { ...DEFAULT_BOOKING_COMMERCIAL_RULES };
  try {
    const result = await client.query(
      `SELECT DISTINCT ON (key) key, value
       FROM "commercialConfiguration"
       WHERE "organizationId" = $1
         AND "businessUnit" = 'REEBS_CORE'
         AND active = true
         AND "effectiveFrom" <= $2
         AND ("effectiveTo" IS NULL OR "effectiveTo" > $2)
         AND key = ANY($3::text[])
       ORDER BY key, "effectiveFrom" DESC`,
      [organizationId, effectiveAt, Object.keys(INTEGER_RULES)]
    );
    for (const row of result.rows || []) {
      const ruleKey = INTEGER_RULES[row.key];
      const value = clampRule(ruleKey, row.value);
      if (ruleKey && value !== null) rules[ruleKey] = value;
    }
  } catch (error) {
    // Preserve the values seeded by the Phase 6 migration while an older local
    // database is being upgraded. Production deploy order remains migration first.
    if (error?.code !== "42P01") throw error;
  }
  return rules;
};

export { DEFAULT_BOOKING_COMMERCIAL_RULES, loadBookingCommercialRules };
