import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptLegacyProposal,
  normalizeCatalogueName,
  normalizeStructuredProposal,
  validateClientSelections,
  validateVersionTransition,
} from "./proposalContract.js";

test("legacy proposals remain readable through a structured compatibility view", () => {
  const result = adaptLegacyProposal({
    title: "Legacy website",
    clientName: "Acme",
    content: {
      blocks: [{
        type: "pricing",
        enabled: true,
        pricingItems: [
          { label: "Website build", amount: "GHS 12,500", note: "One-time" },
          { label: "Discovery", amount: "TBD" },
        ],
      }],
    },
  });

  assert.equal(result.mode, "legacy");
  assert.equal(result.commercial.schemaVersion, 2);
  assert.equal(result.commercial.currency, "GHS");
  assert.equal(result.commercial.items[0].unitPrice, 12500);
  assert.equal(result.commercial.items[1].unitPrice, 0);
  assert.equal(result.commercial.customer.name, "Acme");
});
test("structured proposal normalization calculates totals and protects required items", () => {
  const result = normalizeStructuredProposal({
    title: "ERP rollout",
    currency: "GHS",
    taxRate: 15,
    depositPercent: 50,
    items: [
      { kind: "SERVICE", name: "Implementation", quantity: 1, unitPrice: 1000, required: true, clientSelectable: true },
      { kind: "INTEGRATION", name: "Paystack", quantity: 1, unitPrice: 100, required: false, clientSelectable: true, selected: false },
    ],
  });

  assert.equal(result.commercial.items[0].clientSelectable, false);
  assert.equal(result.commercial.items[0].selected, true);
  assert.equal(result.commercial.items[1].amount, 0);
  assert.equal(result.commercial.totals.oneTimeTotal, 1150);
  assert.equal(result.commercial.totals.depositAmount, 575);
});

test("website proposals enforce CMS inclusion and snapshot UI/UX as a deliverable", () => {
  const result = normalizeStructuredProposal({
    title: "Website",
    items: [{
      key: "web", systemKey: "website-development", kind: "SERVICE",
      name: "Website Development", unitPrice: 2500, deliverables: ["Responsive website"],
      selectedTier: { name: "Website + Leads", faakoSetupFee: 2500, sourceUrl: "https://faako.com/pricing", lastVerifiedAt: "2026-10-16" },
    }],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.commercial.items.length, 2);
  assert.match(result.commercial.items[0].deliverables.join(" "), /UI\/UX/);
  const cms = result.commercial.items.find((item) => item.systemKey === "cms-setup");
  assert.equal(cms.billingType, "INCLUDED");
  assert.equal(cms.amount, 0);
  assert.equal(cms.clientSelectable, false);
  assert.equal(result.commercial.items[0].selectedTier.name, "Website + Leads");
});

test("removing a website removes only rule-created CMS rows", () => {
  const result = normalizeStructuredProposal({
    items: [
      { key: "auto", systemKey: "cms-setup", kind: "SERVICE", name: "CMS Setup", billingType: "INCLUDED", configuration: { autoIncludedBy: "website-development" } },
      { key: "manual", kind: "SERVICE", name: "CMS Setup", unitPrice: 400, configuration: { manuallyConfigured: true } },
    ],
  });
  assert.equal(result.commercial.items.length, 1);
  assert.equal(result.commercial.items[0].key, "manual");
});

test("structured proposal normalization rejects invalid commercial enums and dates", () => {
  assert.match(
    normalizeStructuredProposal({
      items: [{ kind: "SERVICE", name: "Build", billingType: "SOMETIMES" }],
    }).error,
    /billingType/
  );
  assert.match(
    normalizeStructuredProposal({
      validUntil: "2026-13-40",
      items: [{ kind: "SERVICE", name: "Build" }],
    }).error,
    /validUntil/
  );
});

test("catalogue names normalize consistently for duplicate prevention", () => {
  assert.equal(normalizeCatalogueName("  Website   Development "), "website development");
});

test("published versions cannot return to draft or publish twice", () => {
  assert.equal(validateVersionTransition("DRAFT", "PUBLISHED"), true);
  assert.equal(validateVersionTransition("PUBLISHED", "SUPERSEDED"), true);
  assert.equal(validateVersionTransition("PUBLISHED", "DRAFT"), false);
  assert.equal(validateVersionTransition("PUBLISHED", "PUBLISHED"), false);
  assert.equal(validateVersionTransition("PUBLISHED", "ACCEPTED"), true);
  assert.equal(validateVersionTransition("PUBLISHED", "DECLINED"), true);
  assert.equal(validateVersionTransition("ACCEPTED", "PUBLISHED"), false);
});

test("client selections reject required, fixed, unknown, and draft changes", () => {
  const items = [
    { id: 1, name: "Core", required: true, clientSelectable: false },
    { id: 2, name: "Optional", required: false, clientSelectable: true },
    { id: 3, name: "Fixed", required: false, clientSelectable: false },
  ];
  assert.match(
    validateClientSelections({ versionStatus: "DRAFT", items, selections: [] }).error,
    /published/
  );
  assert.match(
    validateClientSelections({
      versionStatus: "PUBLISHED", items, selections: [{ itemId: 1, selected: false }],
    }).error,
    /required/
  );
  assert.match(
    validateClientSelections({
      versionStatus: "PUBLISHED", items, selections: [{ itemId: 3, selected: false }],
    }).error,
    /cannot be changed/
  );
  assert.match(
    validateClientSelections({
      versionStatus: "PUBLISHED", items, selections: [{ itemId: 99, selected: true }],
    }).error,
    /unknown item/
  );
  assert.match(
    validateClientSelections({
      versionStatus: "PUBLISHED",
      items,
      selections: [
        { itemId: 2, selected: true },
        { itemId: 2, selected: false },
      ],
    }).error,
    /duplicates/
  );
  assert.deepEqual(
    validateClientSelections({
      versionStatus: "PUBLISHED",
      items,
      selections: [{ itemId: 2, selected: true, quantity: 2 }],
    }).selections,
    [{ itemId: 2, selected: true, quantity: 2, configuration: null }]
  );
});
