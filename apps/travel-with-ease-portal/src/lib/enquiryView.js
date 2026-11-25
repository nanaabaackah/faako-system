const privateMetadata = new Set([
  "submissionId", "submissionFingerprint", "continuationSubmissionId",
  "continuationSubmissionFingerprint", "source", "intakeVersion", "intakeSnapshot",
]);
const initialFields = new Set(["enquiryType", "service", "destination", "travelTimeframe", "travellers", "budget", "notes"]);

export const formatEnquiryAnswer = (value) => Array.isArray(value) ? value.join(" · ") : String(value ?? "");

export function enquiryAnswerSections(details = {}) {
  const snapshots = details.questionSnapshots || {};
  const answers = details.answers || {};
  const groups = new Map();
  for (const id of details.applicableQuestionIds || Object.keys(answers)) {
    if (answers[id] === undefined || ["476632894", "1078451195", "214964047"].includes(id)) continue;
    const snapshot = snapshots[id] || { label: `Question ${id}`, sectionTitle: "Questionnaire answers" };
    const title = snapshot.sectionTitle || "Questionnaire answers";
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push({ id, label: snapshot.label, value: answers[id] });
  }
  return [...groups.entries()].map(([title, items]) => ({ title, items }));
}

export function legacyEnquiryFields(details = {}) {
  return Object.entries(details).filter(([key, value]) => !privateMetadata.has(key) && value !== null && typeof value !== "object");
}

export function initialEnquiryFields(details = {}) {
  return Object.entries(details).filter(([key, value]) => initialFields.has(key) && value !== null && value !== "");
}

export function versionedIntakeFields(details = {}) {
  const snapshot = details.intakeSnapshot;
  if (!snapshot) return [];
  return [
    ...(snapshot.core || []).filter(field => initialFields.has(field.id) && details[field.id] != null && details[field.id] !== "")
      .map(field => ({ id: field.id, label: field.label, value: field.selectedOption?.label || details[field.id] })),
    ...(snapshot.additional || []).map(field => ({
      id: field.id, label: field.label, value: Array.isArray(field.options) && field.options.length ? field.options.map(option => option.label) : field.answer,
    })),
  ];
}
