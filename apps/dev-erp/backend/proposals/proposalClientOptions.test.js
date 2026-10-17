import assert from "node:assert/strict";
import test from "node:test";

import { deduplicateProposalClientOptions, loadProposalClientOptions } from "./proposalClientOptions.js";

test("proposal client options expose only proposal-safe fields and deduplicate newest email", () => {
  const [option] = deduplicateProposalClientOptions([
    { id: 2, companyName: "Acme", contactName: "New", email: "HELLO@ACME.COM", phone: "2", projectDetails: "New brief", updatedAt: "2026-10-16" },
    { id: 1, companyName: "Acme old", contactName: "Old", email: "hello@acme.com", internalNotes: "secret", updatedAt: "2026-10-15" },
  ]);
  assert.equal(option.reference, "2");
  assert.equal(option.contactName, "New");
  assert.equal(Object.hasOwn(option, "internalNotes"), false);
});

test("proposal client options fail safely when the Faako database is unavailable", async () => {
  await assert.rejects(loadProposalClientOptions({ faakoPool: null }), (error) => error.status === 503);
});
