import { createHash, randomUUID } from "node:crypto";

export function submissionRecord(data, clock = () => new Date().toISOString()) {
  const { submissionId, name, email, phone } = data;
  const details = { ...data };
  for (const field of ["submissionId", "name", "email", "phone", "consent", "website", "turnstileToken"]) delete details[field];
  const contact = { name, email, phone };
  const fingerprint = createHash("sha256").update(JSON.stringify({ contact, details })).digest("hex");
  return {
    id: randomUUID(),
    submissionId,
    fingerprint,
    contact,
    details: { ...details, source: "website_intake", submissionId, submissionFingerprint: fingerprint },
    noticeAt: clock(),
  };
}

export function replaySubmission(prior, fingerprint) {
  if (prior.fingerprint !== fingerprint) {
    const error = new Error("Enquiry submission reference conflict.");
    error.code = "enquiry_submission_conflict";
    throw error;
  }
  return { inquiryId: prior.id, status: "received", replayed: true };
}
