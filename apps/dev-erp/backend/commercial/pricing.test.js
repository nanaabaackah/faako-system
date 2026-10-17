import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCommercialTotals,
  calculateStructuredProposalPricing,
  parseCommercialLineItems,
  roundCommercialAmount,
} from "./pricing.js";

test("roundCommercialAmount rounds monetary values to minor units", () => {
  assert.equal(roundCommercialAmount("12.345"), 12.35);
  assert.equal(roundCommercialAmount("invalid"), Number.NaN);
});
test("parseCommercialLineItems validates and snapshots calculated amounts", () => {
  assert.deepEqual(
    parseCommercialLineItems([
      { description: "Implementation", quantity: "1.25", unitPrice: "100.10" },
      { description: "Support", quantity: 2, rate: 25 },
    ]),
    {
      lineItems: [
        {
          description: "Implementation",
          quantity: 1.25,
          unitPrice: 100.1,
          amount: 125.13,
          sortOrder: 0,
        },
        {
          description: "Support",
          quantity: 2,
          unitPrice: 25,
          amount: 50,
          sortOrder: 1,
        },
      ],
    }
  );
});

test("parseCommercialLineItems rejects missing descriptions and invalid amounts", () => {
  assert.deepEqual(parseCommercialLineItems([]), {
    error: "lineItems must include at least one item.",
  });
  assert.deepEqual(parseCommercialLineItems([{ description: "", quantity: 1, unitPrice: 5 }]), {
    error: "lineItems[0] description is required.",
  });
  assert.deepEqual(parseCommercialLineItems([{ description: "Work", quantity: 0, unitPrice: 5 }]), {
    error: "lineItems[0] quantity must be greater than 0.",
  });
  assert.deepEqual(parseCommercialLineItems([{ description: "Work", quantity: 1, unitPrice: -1 }]), {
    error: "lineItems[0] unitPrice must be 0 or greater.",
  });
});

test("calculateCommercialTotals applies tax and fixed discount with minor-unit precision", () => {
  assert.deepEqual(
    calculateCommercialTotals({
      lineItems: [{ amount: 125.13 }, { amount: 50 }],
      taxRate: 15,
      discount: 10.12,
    }),
    {
      subtotal: 175.13,
      taxRate: 15,
      taxAmount: 26.27,
      discount: 10.12,
      total: 191.28,
    }
  );
});

test("calculateCommercialTotals rejects unsafe commercial totals", () => {
  assert.deepEqual(
    calculateCommercialTotals({ lineItems: [{ amount: 10 }], taxRate: 101 }),
    { error: "taxRate must be between 0 and 100." }
  );
  assert.deepEqual(
    calculateCommercialTotals({ lineItems: [{ amount: 10 }], discount: 11 }),
    { error: "Commercial total cannot be negative." }
  );
});

test("structured proposal pricing separates one-time, recurring, included, and client-direct costs", () => {
  const result = calculateStructuredProposalPricing({
    items: [
      { key: "build", name: "Build", quantity: 1, unitPrice: 1000, billingType: "ONE_TIME" },
      { key: "support", name: "Support", quantity: 1, unitPrice: 100, billingType: "RECURRING", billingFrequency: "MONTHLY" },
      { key: "domain", name: "Domain", quantity: 1, unitPrice: 20, billingType: "ONE_TIME", costOwnership: "CLIENT_DIRECT" },
      { key: "training", name: "Training", quantity: 1, unitPrice: 250, billingType: "INCLUDED" },
    ],
    taxRate: 15,
    discount: 100,
    depositPercent: 50,
  });

  assert.equal(result.totals.oneTimeTotal, 1050);
  assert.equal(result.totals.recurringMonthlyTotal, 115);
  assert.equal(result.totals.clientDirectTotal, 20);
  assert.equal(result.totals.depositAmount, 525);
  assert.deepEqual(result.billingSchedule.map((entry) => entry.type), [
    "DEPOSIT",
    "BALANCE",
    "RECURRING",
  ]);
});

test("structured proposal pricing validates milestone allocation", () => {
  const result = calculateStructuredProposalPricing({
    items: [{ name: "Build", quantity: 1, unitPrice: 1000, billingType: "ONE_TIME" }],
    depositPercent: 50,
    milestones: [{ label: "Launch", percentage: 60 }],
  });
  assert.deepEqual(result, {
    error: "Deposit and milestone amounts cannot exceed the one-time total.",
  });
});

test("structured proposal pricing supports a fixed deposit without duplicating the balance", () => {
  const result = calculateStructuredProposalPricing({
    items: [{ name: "Build", quantity: 1, unitPrice: 1000, billingType: "ONE_TIME" }],
    depositPercent: 50,
    fixedDepositAmount: 300,
  });
  assert.equal(result.totals.depositType, "FIXED");
  assert.equal(result.totals.depositAmount, 300);
  assert.deepEqual(result.billingSchedule.map((entry) => entry.amount), [300, 700]);
});

test("interactive proposal example keeps one-time, deposit, balance, and maintenance totals separate", () => {
  const result = calculateStructuredProposalPricing({
    items: [
      { name: "Website Development", quantity: 1, unitPrice: 5000, billingType: "ONE_TIME" },
      { name: "CMS Setup", quantity: 1, unitPrice: 2000, billingType: "ONE_TIME" },
      { name: "Maintenance", quantity: 1, unitPrice: 250, billingType: "RECURRING", billingFrequency: "MONTHLY" },
    ],
    depositPercent: 50,
  });
  assert.equal(result.totals.oneTimeTotal, 7000);
  assert.equal(result.totals.recurringMonthlyTotal, 250);
  assert.equal(result.totals.depositAmount, 3500);
  assert.equal(result.billingSchedule.find((entry) => entry.type === "BALANCE")?.amount, 3500);
});
