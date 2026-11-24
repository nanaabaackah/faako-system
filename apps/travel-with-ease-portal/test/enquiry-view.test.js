import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enquiryAnswerSections, initialEnquiryFields, legacyEnquiryFields } from "../src/lib/enquiryView.js";

test("versioned enquiry answers render by stored section and never expose contact duplicates", () => {
  const details = {
    applicableQuestionIds: ["541981576", "1444304495", "214964047"],
    questionSnapshots: {
      "541981576": { label: "Destination(s) you are considering", sectionTitle: "Section B: Travel Details" },
      "1444304495": { label: "What matters most to you when choosing accommodation?", sectionTitle: "Section G: Travel Preferences & Style" },
      "214964047": { label: "Email address", sectionTitle: "Introduction" },
    },
    answers: {
      "541981576": "Nairobi", "1444304495": ["Safety", "Location (close to attractions)"],
      "214964047": "synthetic@example.invalid",
    },
  };
  const sections = enquiryAnswerSections(details);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].items[0].label, "Destination(s) you are considering");
  assert.equal(sections.some((section) => section.items.some((item) => item.id === "214964047")), false);
});

test("legacy enquiries stay readable while private idempotency metadata stays hidden", () => {
  const fields = legacyEnquiryFields({ destination: "Accra", travellers: 2, submissionId: "private", submissionFingerprint: "private", nested: { hidden: true } });
  assert.deepEqual(fields, [["destination", "Accra"], ["travellers", 2]]);
});

test("progressive enquiries retain the initial intake while hiding continuation credentials", () => {
  const details = {
    enquiryType: "trip", destination: "Nairobi", travellers: 2,
    continuationSubmissionId: "private", continuationSubmissionFingerprint: "private",
    questionnaireCompletedAt: "2026-11-13T10:00:00.000Z",
  };
  assert.deepEqual(initialEnquiryFields(details), [
    ["enquiryType", "trip"], ["destination", "Nairobi"], ["travellers", 2],
  ]);
  assert.equal(legacyEnquiryFields(details).some(([key]) => key.startsWith("continuationSubmission")), false);
});

test("group-trip questionnaire answers remain grouped on the original enquiry", () => {
  const details = {
    questionnaireCompletedAt: "2026-11-21T12:00:00.000Z",
    applicableQuestionIds: ["300000015", "300000023"],
    questionSnapshots: {
      "300000015": { label: "How many travellers, including you?", sectionTitle: "The group" },
      "300000023": { label: "What is the approximate budget per person for the whole trip?", sectionTitle: "Budget and costs" },
    },
    answers: { "300000015": "8", "300000023": "GHS 10,000" },
  };
  const sections = enquiryAnswerSections(details);
  assert.deepEqual(sections.map((section) => section.title), ["The group", "Budget and costs"]);
  assert.equal(sections[1].items[0].value, "GHS 10,000");
});

test("Traveller inbox provides tenant API filters and no raw JSON presentation", () => {
  const source = readFileSync(new URL("../src/components/Enquiries.jsx", import.meta.url), "utf8");
  for (const filter of ["category", "service", "package", "search", "status"]) assert.ok(source.includes(filter));
  assert.match(source, /enquiryAnswerSections/);
  assert.doesNotMatch(source, /JSON\.stringify\(value/);
  assert.match(source, /enquiries\.write/);
});
