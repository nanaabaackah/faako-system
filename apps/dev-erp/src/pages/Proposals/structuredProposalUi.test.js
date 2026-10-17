import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.resolve(directory, "../../App.jsx"), "utf8");
const builderSource = fs.readFileSync(path.resolve(directory, "StructuredProposalWorkspace.jsx"), "utf8");
const clientSource = fs.readFileSync(path.resolve(directory, "InteractiveProposalClient.jsx"), "utf8");
const styles = fs.readFileSync(path.resolve(directory, "StructuredProposal.css"), "utf8");

test("structured proposal routes retain legacy preview while adding builder and token review", () => {
  assert.match(appSource, /path="\/proposals\/new"/);
  assert.match(appSource, /path="\/proposals\/catalogue"/);
  assert.match(appSource, /path="\/proposals\/:proposalId\/edit"/);
  assert.match(appSource, /path="\/proposals\/:proposalId\/preview"/);
  assert.match(appSource, /path="\/proposal\/interactive\/:token"/);
  assert.match(appSource, /path="\/proposal\/view\/:token"/);
});

test("proposal controls use Faako dropdowns and expose selected and AI states", () => {
  assert.doesNotMatch(builderSource, /<select\b/);
  assert.doesNotMatch(builderSource, /<datalist\b/);
  assert.match(builderSource, /ComboboxField/);
  assert.match(builderSource, /Refine with AI/);
  assert.match(builderSource, /AI-assisted Scope & Delivery/);
  assert.match(builderSource, /is-selected/);
  assert.match(builderSource, /Catalogue pricing/);
});

test("builder and public review expose guarded Phase 4 acceptance and billing actions", () => {
  assert.match(builderSource, /Publish immutable version/);
  assert.match(builderSource, /Revoke link/);
  assert.match(builderSource, /Client questions and requests/);
  assert.match(builderSource, /Withdraw version/);
  assert.match(builderSource, /Generate draft invoice/);
  assert.match(builderSource, /Create project and import deliverables/);
  assert.match(clientSource, /Save my configuration/);
  assert.match(clientSource, /Ask a question/);
  assert.match(clientSource, /Decline proposal/);
  assert.match(clientSource, /Accept proposal/);
  assert.match(clientSource, /consentConfirmed/);
  assert.match(clientSource, /invoice readiness is separate/i);
  assert.doesNotMatch(clientSource, /internalNotes/);
  assert.match(builderSource, /Send proposal/);
  assert.match(builderSource, /Resend proposal/);
  assert.match(builderSource, /Idempotency-Key/);
  assert.match(builderSource, /Optional personal message/);
});

test("proposal layouts include desktop, tablet, and mobile responsive rules", () => {
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) 21rem/);
  assert.match(styles, /@media \(max-width: 980px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /\.structured-builder-layout, \.interactive-proposal-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.structured-send-panel__fields/);
});
