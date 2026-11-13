const privateMetadata = new Set(["submissionId", "submissionFingerprint", "source"]);

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
