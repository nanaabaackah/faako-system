import { createHash, randomUUID } from "node:crypto";
import { validatedQuestionnaireSnapshot } from "./questionnaire-validation.js";
import { SERVICE_OPTIONS, selectedServiceFromAnswers } from "./questionnaires/index.js";

export function submissionRecord(data, clock = () => new Date().toISOString()) {
  const submittedAt = clock();
  const smart = Boolean(data.questionnaireId);
  const { submissionId } = data;
  const contact = smart ? data.contact : { name: data.name, email: data.email, phone: data.phone };
  const routedServiceId = smart ? selectedServiceFromAnswers(data.answers, data.context.serviceId) : "";
  const routedService = SERVICE_OPTIONS.find((service) => service.id === routedServiceId);
  const details = smart ? {
    source: "website_smart_enquiry",
    entryType: data.entryType,
    sourcePath: data.sourcePath,
    selectedServiceId: data.context.serviceId || routedService?.id || null,
    selectedServiceTitle: data.context.serviceTitle || routedService?.title || null,
    selectedPackageId: data.context.packageId || null,
    selectedPackageTitle: data.context.packageTitle || null,
    consentAcknowledgedAt: submittedAt,
    submittedAt,
    ...validatedQuestionnaireSnapshot(data),
  } : { ...data };
  if (!smart) for (const field of ["submissionId", "name", "email", "phone", "consent", "website", "turnstileToken"]) delete details[field];
  const fingerprint = createHash("sha256").update(JSON.stringify({ contact, details })).digest("hex");
  return {
    id: randomUUID(),
    kind: smart && data.entryType === "package" ? "package" : "personalised",
    submissionId,
    fingerprint,
    contact,
    details: { ...details, source: smart ? details.source : "website_intake", submissionId, submissionFingerprint: fingerprint },
    noticeAt: submittedAt,
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
