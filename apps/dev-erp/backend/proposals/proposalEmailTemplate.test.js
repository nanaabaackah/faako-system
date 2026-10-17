import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProposalAcceptanceEmailContent,
  buildProposalDeliveryEmailContent,
} from "./proposalEmailTemplate.js";

test("proposal delivery email is branded, responsive, escaped, and commercially clear", () => {
  const content = buildProposalDeliveryEmailContent({
    recipientName: "Ama <script>",
    proposalTitle: "Website & CRM",
    versionNumber: 3,
    reviewUrl: "https://erp.example.com/proposal/interactive/token",
    validUntil: "2026-12-01",
    linkExpiresAt: "2026-11-01",
    currency: "GHS",
    oneTimeTotal: 4200,
    recurringMonthlyTotal: 200,
    depositAmount: 2100,
    providerCharges: ["Resend Pro: USD 20/month"],
    personalMessage: "Please review <b>carefully</b>.",
  });
  assert.match(content.subject, /Website & CRM/);
  assert.match(content.html, /Review proposal/);
  assert.match(content.html, /email-mobile/);
  assert.match(content.html, /Paid directly to providers/);
  assert.match(content.html, /Ama &lt;script&gt;/);
  assert.doesNotMatch(content.html, /<script>/);
  assert.doesNotMatch(content.html, /<b>carefully<\/b>/);
  assert.match(content.text, /https:\/\/erp\.example\.com/);
});

test("proposal acceptance email confirms terms without claiming payment", () => {
  const content = buildProposalAcceptanceEmailContent({
    recipientName: "Kojo",
    proposalTitle: "Commerce build",
    proposalId: 12,
    versionNumber: 2,
    acceptedAt: "2026-10-20T10:00:00.000Z",
    currency: "GHS",
    oneTimeTotal: 8000,
    billingSchedule: [{ label: "Deposit", amount: 4000 }],
  });
  assert.match(content.html, /Acceptance confirmed/);
  assert.match(content.html, /Any invoice will be issued separately/);
  assert.match(content.text, /does not record a payment/i);
});
