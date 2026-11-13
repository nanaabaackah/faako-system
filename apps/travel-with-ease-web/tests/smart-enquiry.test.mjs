import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applicableQuestionIds, questionnaireRoute, questionnaireSteps, questions,
} from "../../travel-with-ease-api/src/enquiries/questionnaires/index.js";

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("general, readiness, planning and package routes reach contact without deferred fields", () => {
  const choices = {
    readiness: "I need general travel advice to get ready (documents, budget, airport flow)",
    planning: "I want full trip planning (itinerary, accommodation, activities, bookings)",
  };
  for (const [expected, answer] of Object.entries(choices)) {
    const answers = { "1428564940": answer, "502234433": "No" };
    assert.equal(questionnaireRoute({}, answers), expected === "planning" ? "planning" : "safe_general");
    const ids = applicableQuestionIds({}, answers);
    assert.ok(ids.includes("476632894"));
    assert.equal(ids.includes("1811901185"), false);
    assert.equal(ids.includes("180737542"), false);
  }
  const packageIds = applicableQuestionIds({ packageId: "package-id" }, {});
  assert.ok(packageIds.includes("476632894"));
  assert.equal(packageIds.includes("1428564940"), false);
  assert.ok(questionnaireSteps.some((step) => step.id === "contact"));
  assert.equal(questions["1444304495"].maxSelections, 3);
});

test("public form deep links validate catalogue entries and preserve browser navigation", () => {
  const form = source("components/EnquiryForm.jsx");
  const service = source("pages/services/[slug].astro");
  const packageDetail = source("components/PackageDetail.astro");
  assert.match(form, /catalogue\.packages\.find/);
  assert.match(form, /catalogue\.services\.find/);
  assert.match(form, /opened a general enquiry instead/);
  assert.match(form, /window\.history\.pushState/);
  assert.match(form, /popstate/);
  assert.doesNotMatch(form, /localStorage|sessionStorage/);
  assert.match(service, /\?service=\$\{service\.slug\}#plan/);
  assert.match(packageDetail, /\?package=\$\{encodeURIComponent\(item\.slug\)\}#plan/);
});
