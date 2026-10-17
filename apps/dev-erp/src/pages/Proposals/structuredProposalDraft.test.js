import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogueItemToProposalItem,
  applyProposalRules,
  createStructuredProposalDraft,
  itemMatches,
  mergePackageItems,
} from "./structuredProposalDraft.js";

test("structured proposal draft starts with configurable deposit and no real customer", () => {
  const draft = createStructuredProposalDraft();
  assert.equal(draft.depositPercent, 50);
  assert.equal(draft.customer.name, "");
  assert.deepEqual(draft.items, []);
});

test("catalogue selection snapshots pricing and package application avoids duplicates", () => {
  const item = { id: 4, kind: "SERVICE", name: "Website", defaultUnitPrice: 5000 };
  const selected = catalogueItemToProposalItem(item);
  assert.equal(selected.unitPrice, 5000);
  assert.equal(selected.catalogueItemId, 4);
  assert.equal(mergePackageItems([selected], { items: [{ catalogueItem: item }] }).length, 1);
});

test("reusable packages retain proposal-specific required and selection defaults", () => {
  const [item] = mergePackageItems([], {
    items: [{
      catalogueItem: { id: 9, kind: "SERVICE", name: "Support", defaultUnitPrice: 300 },
      configuration: { required: false, clientSelectable: true, quantity: 2 },
    }],
  });
  assert.equal(item.required, false);
  assert.equal(item.clientSelectable, true);
  assert.equal(item.quantity, 2);
  assert.equal(item.unitPrice, 300);
});

test("catalogue search combines name and category filters", () => {
  const item = { name: "Paystack", category: "Payments", description: "Card payments" };
  assert.equal(itemMatches(item, "card", "Payments"), true);
  assert.equal(itemMatches(item, "card", "Messaging"), false);
});

test("catalogue tier selection keeps provider charges separate from the Faako fee", () => {
  const selected = catalogueItemToProposalItem({
    id: 7, systemKey: "paystack", kind: "INTEGRATION", name: "Paystack",
    tiers: [{ id: 2, name: "Standard", isDefault: true, providerCurrency: "GHS", displayPrice: "1.95%", faakoSetupFee: 750 }],
  });
  assert.equal(selected.unitPrice, 750);
  assert.equal(selected.selectedTier.displayPrice, "1.95%");
});

test("draft website rules add and safely remove automatic CMS", () => {
  const website = catalogueItemToProposalItem({ kind: "SERVICE", name: "Website Development", systemKey: "website-development" });
  const withWebsite = applyProposalRules([website]);
  assert.equal(withWebsite.some((item) => item.systemKey === "cms-setup"), true);
  assert.match(withWebsite[0].deliverables.join(" "), /UI\/UX/);
  assert.deepEqual(applyProposalRules(withWebsite.filter((item) => item.key !== website.key)), []);
});
