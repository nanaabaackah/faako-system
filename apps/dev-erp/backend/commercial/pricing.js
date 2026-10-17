const MONEY_SCALE = 100;
const QUANTITY_SCALE = 100;
const RATE_SCALE = 100;

const parseFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};
const toScaledInteger = (value, scale) => {
  const parsed = parseFiniteNumber(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round((parsed + Number.EPSILON) * scale);
};

const fromScaledInteger = (value, scale) => value / scale;

export const roundCommercialAmount = (value) => {
  const minorUnits = toScaledInteger(value, MONEY_SCALE);
  return minorUnits === null ? NaN : fromScaledInteger(minorUnits, MONEY_SCALE);
};

export const parseCommercialLineItems = (value, { fieldName = "lineItems" } = {}) => {
  if (!Array.isArray(value) || !value.length) {
    return { error: `${fieldName} must include at least one item.` };
  }

  const lineItems = [];
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index] || {};
    const rawDescription = typeof row.description === "string" ? row.description : "";
    if (!rawDescription.trim()) {
      return { error: `${fieldName}[${index}] description is required.` };
    }

    const quantityUnits = toScaledInteger(row.quantity, QUANTITY_SCALE);
    if (quantityUnits === null || quantityUnits <= 0) {
      return { error: `${fieldName}[${index}] quantity must be greater than 0.` };
    }

    const unitPriceMinor = toScaledInteger(row.unitPrice ?? row.rate, MONEY_SCALE);
    if (unitPriceMinor === null || unitPriceMinor < 0) {
      return { error: `${fieldName}[${index}] unitPrice must be 0 or greater.` };
    }

    const amountMinor = Math.round((quantityUnits * unitPriceMinor) / QUANTITY_SCALE);
    if (!Number.isSafeInteger(amountMinor)) {
      return { error: `${fieldName}[${index}] contains an invalid number.` };
    }

    lineItems.push({
      description: rawDescription,
      quantity: fromScaledInteger(quantityUnits, QUANTITY_SCALE),
      unitPrice: fromScaledInteger(unitPriceMinor, MONEY_SCALE),
      amount: fromScaledInteger(amountMinor, MONEY_SCALE),
      sortOrder: index,
    });
  }

  return { lineItems };
};

export const calculateCommercialTotals = ({ lineItems, taxRate = 0, discount = 0 }) => {
  if (!Array.isArray(lineItems)) {
    return { error: "Unable to calculate commercial subtotal." };
  }

  const amountMinors = lineItems.map((item) => toScaledInteger(item?.amount ?? 0, MONEY_SCALE));
  if (amountMinors.some((amount) => amount === null)) {
    return { error: "Unable to calculate commercial subtotal." };
  }
  const subtotalMinor = amountMinors.reduce((total, amount) => total + amount, 0);
  if (!Number.isSafeInteger(subtotalMinor)) {
    return { error: "Unable to calculate commercial subtotal." };
  }

  const taxRateUnits = toScaledInteger(taxRate ?? 0, RATE_SCALE);
  if (taxRateUnits === null || taxRateUnits < 0 || taxRateUnits > 100 * RATE_SCALE) {
    return { error: "taxRate must be between 0 and 100." };
  }

  const discountMinor = toScaledInteger(discount ?? 0, MONEY_SCALE);
  if (discountMinor === null || discountMinor < 0) {
    return { error: "discount must be 0 or greater." };
  }

  const taxAmountMinor = Math.round((subtotalMinor * taxRateUnits) / (100 * RATE_SCALE));
  const totalMinor = subtotalMinor + taxAmountMinor - discountMinor;
  if (totalMinor < 0) {
    return { error: "Commercial total cannot be negative." };
  }
  if (!Number.isSafeInteger(taxAmountMinor) || !Number.isSafeInteger(totalMinor)) {
    return { error: "Unable to calculate commercial total." };
  }

  return {
    subtotal: fromScaledInteger(subtotalMinor, MONEY_SCALE),
    taxRate: fromScaledInteger(taxRateUnits, RATE_SCALE),
    taxAmount: fromScaledInteger(taxAmountMinor, MONEY_SCALE),
    discount: fromScaledInteger(discountMinor, MONEY_SCALE),
    total: fromScaledInteger(totalMinor, MONEY_SCALE),
  };
};

const BILLING_TYPES = new Set(["ONE_TIME", "RECURRING", "USAGE_BASED", "INCLUDED"]);
const BILLING_FREQUENCIES = new Set(["NONE", "MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"]);
const COST_OWNERS = new Set(["FAAKO_BILLED", "CLIENT_DIRECT", "INCLUDED", "PASS_THROUGH"]);

const normalizeCommercialEnum = (value, allowed, fallback) => {
  const normalized = String(value || "").trim().toUpperCase();
  return allowed.has(normalized) ? normalized : fallback;
};

const addMinor = (current, amount) => current + toScaledInteger(amount, MONEY_SCALE);

export const calculateStructuredProposalPricing = ({
  items,
  taxRate = 0,
  discount = 0,
  depositPercent = 0,
  fixedDepositAmount = null,
  milestones = [],
} = {}) => {
  if (!Array.isArray(items) || !items.length) {
    return { error: "items must include at least one item." };
  }

  const normalizedItems = [];
  const buckets = {
    oneTime: 0,
    monthly: 0,
    quarterly: 0,
    annual: 0,
    usageBased: 0,
    clientDirect: 0,
    passThrough: 0,
  };

  for (let index = 0; index < items.length; index += 1) {
    const source = items[index] || {};
    const parsed = parseCommercialLineItems(
      [{
        description: source.name || source.description,
        quantity: source.quantity ?? 1,
        unitPrice: source.unitPrice ?? 0,
      }],
      { fieldName: "items" }
    );
    if (parsed.error) return { error: parsed.error.replace("items[0]", `items[${index}]`) };

    const billingType = normalizeCommercialEnum(
      source.billingType,
      BILLING_TYPES,
      "ONE_TIME"
    );
    const billingFrequency = normalizeCommercialEnum(
      source.billingFrequency,
      BILLING_FREQUENCIES,
      billingType === "RECURRING" ? "MONTHLY" : "NONE"
    );
    const costOwnership = normalizeCommercialEnum(
      source.costOwnership,
      COST_OWNERS,
      billingType === "INCLUDED" ? "INCLUDED" : "FAAKO_BILLED"
    );
    const lineDiscountMinor = toScaledInteger(source.discount ?? 0, MONEY_SCALE);
    if (lineDiscountMinor === null || lineDiscountMinor < 0) {
      return { error: `items[${index}] discount must be 0 or greater.` };
    }

    const baseAmountMinor = toScaledInteger(parsed.lineItems[0].amount, MONEY_SCALE);
    if (lineDiscountMinor > baseAmountMinor) {
      return { error: `items[${index}] discount cannot exceed its amount.` };
    }
    const included = billingType === "INCLUDED" || costOwnership === "INCLUDED";
    const amountMinor = included ? 0 : baseAmountMinor - lineDiscountMinor;
    const amount = fromScaledInteger(amountMinor, MONEY_SCALE);

    if (costOwnership === "CLIENT_DIRECT") {
      buckets.clientDirect = addMinor(buckets.clientDirect, amount);
    } else {
      if (billingType === "ONE_TIME") buckets.oneTime = addMinor(buckets.oneTime, amount);
      if (billingType === "USAGE_BASED") buckets.usageBased = addMinor(buckets.usageBased, amount);
      if (billingType === "RECURRING") {
        if (billingFrequency === "MONTHLY") buckets.monthly = addMinor(buckets.monthly, amount);
        if (billingFrequency === "QUARTERLY") buckets.quarterly = addMinor(buckets.quarterly, amount);
        if (billingFrequency === "ANNUAL") buckets.annual = addMinor(buckets.annual, amount);
      }
      if (costOwnership === "PASS_THROUGH") {
        buckets.passThrough = addMinor(buckets.passThrough, amount);
      }
    }

    normalizedItems.push({
      ...source,
      name: String(source.name || source.description || "").trim(),
      quantity: parsed.lineItems[0].quantity,
      unitPrice: parsed.lineItems[0].unitPrice,
      discount: fromScaledInteger(lineDiscountMinor, MONEY_SCALE),
      amount,
      billingType,
      billingFrequency,
      costOwnership,
      sortOrder: index,
    });
  }

  const oneTimeTotals = calculateCommercialTotals({
    lineItems: [{ amount: fromScaledInteger(buckets.oneTime, MONEY_SCALE) }],
    taxRate,
    discount,
  });
  if (oneTimeTotals.error) return oneTimeTotals;

  const recurringMonthly = calculateCommercialTotals({
    lineItems: [{ amount: fromScaledInteger(buckets.monthly, MONEY_SCALE) }],
    taxRate,
  });
  if (recurringMonthly.error) return recurringMonthly;
  const recurringAnnualBaseMinor = buckets.annual + buckets.quarterly * 4;
  const recurringAnnual = calculateCommercialTotals({
    lineItems: [{ amount: fromScaledInteger(recurringAnnualBaseMinor, MONEY_SCALE) }],
    taxRate,
  });
  if (recurringAnnual.error) return recurringAnnual;

  const oneTimeTotalMinor = toScaledInteger(oneTimeTotals.total, MONEY_SCALE);
  const usesFixedDeposit = fixedDepositAmount !== null && fixedDepositAmount !== undefined;
  let depositRateUnits;
  let depositAmountMinor;
  if (usesFixedDeposit) {
    depositAmountMinor = toScaledInteger(fixedDepositAmount, MONEY_SCALE);
    if (depositAmountMinor === null || depositAmountMinor < 0) {
      return { error: "fixedDepositAmount must be 0 or greater." };
    }
    if (depositAmountMinor > oneTimeTotalMinor) {
      return { error: "fixedDepositAmount cannot exceed the one-time total." };
    }
    depositRateUnits = oneTimeTotalMinor
      ? Math.round((depositAmountMinor * 100 * RATE_SCALE) / oneTimeTotalMinor)
      : 0;
  } else {
    depositRateUnits = toScaledInteger(depositPercent ?? 0, RATE_SCALE);
    if (depositRateUnits === null || depositRateUnits < 0 || depositRateUnits > 100 * RATE_SCALE) {
      return { error: "depositPercent must be between 0 and 100." };
    }
    depositAmountMinor = Math.round(
      (oneTimeTotalMinor * depositRateUnits) / (100 * RATE_SCALE)
    );
  }

  const schedule = [];
  let allocatedMinor = 0;
  if (depositAmountMinor > 0) {
    schedule.push({
      type: "DEPOSIT",
      label: "Deposit",
      percentage: fromScaledInteger(depositRateUnits, RATE_SCALE),
      amount: fromScaledInteger(depositAmountMinor, MONEY_SCALE),
      dueRule: "On acceptance",
      billingFrequency: "NONE",
      sortOrder: schedule.length,
    });
    allocatedMinor += depositAmountMinor;
  }

  for (let index = 0; index < (Array.isArray(milestones) ? milestones.length : 0); index += 1) {
    const milestone = milestones[index] || {};
    const percentageUnits = toScaledInteger(milestone.percentage, RATE_SCALE);
    if (percentageUnits === null || percentageUnits <= 0 || percentageUnits > 100 * RATE_SCALE) {
      return { error: `milestones[${index}] percentage must be greater than 0 and at most 100.` };
    }
    const amountMinor = Math.round((oneTimeTotalMinor * percentageUnits) / (100 * RATE_SCALE));
    allocatedMinor += amountMinor;
    if (allocatedMinor > oneTimeTotalMinor) {
      return { error: "Deposit and milestone amounts cannot exceed the one-time total." };
    }
    schedule.push({
      type: "MILESTONE",
      label: String(milestone.label || `Milestone ${index + 1}`).trim(),
      percentage: fromScaledInteger(percentageUnits, RATE_SCALE),
      amount: fromScaledInteger(amountMinor, MONEY_SCALE),
      dueRule: String(milestone.dueRule || "").trim() || null,
      billingFrequency: "NONE",
      sortOrder: schedule.length,
    });
  }

  const balanceMinor = oneTimeTotalMinor - allocatedMinor;
  if (balanceMinor > 0) {
    schedule.push({
      type: allocatedMinor > 0 ? "BALANCE" : "FULL",
      label: allocatedMinor > 0 ? "Remaining balance" : "Full payment",
      percentage: oneTimeTotalMinor
        ? fromScaledInteger(
            Math.round((balanceMinor * 100 * RATE_SCALE) / oneTimeTotalMinor),
            RATE_SCALE
          )
        : 0,
      amount: fromScaledInteger(balanceMinor, MONEY_SCALE),
      dueRule: allocatedMinor > 0 ? "On completion" : "On acceptance",
      billingFrequency: "NONE",
      sortOrder: schedule.length,
    });
  }

  if (recurringMonthly.total > 0) {
    schedule.push({
      type: "RECURRING",
      label: "Monthly recurring charges",
      percentage: null,
      amount: recurringMonthly.total,
      dueRule: "Monthly",
      billingFrequency: "MONTHLY",
      sortOrder: schedule.length,
    });
  }
  if (recurringAnnual.total > 0) {
    schedule.push({
      type: "RECURRING",
      label: "Annual recurring charges",
      percentage: null,
      amount: recurringAnnual.total,
      dueRule: "Annually",
      billingFrequency: "ANNUAL",
      sortOrder: schedule.length,
    });
  }

  return {
    items: normalizedItems,
    totals: {
      ...oneTimeTotals,
      oneTimeTotal: oneTimeTotals.total,
      recurringMonthlyTotal: recurringMonthly.total,
      recurringAnnualTotal: recurringAnnual.total,
      usageBasedEstimate: fromScaledInteger(buckets.usageBased, MONEY_SCALE),
      clientDirectTotal: fromScaledInteger(buckets.clientDirect, MONEY_SCALE),
      passThroughTotal: fromScaledInteger(buckets.passThrough, MONEY_SCALE),
      depositPercent: fromScaledInteger(depositRateUnits, RATE_SCALE),
      depositAmount: fromScaledInteger(depositAmountMinor, MONEY_SCALE),
      depositType: usesFixedDeposit ? "FIXED" : "PERCENTAGE",
    },
    billingSchedule: schedule,
  };
};
