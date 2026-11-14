import { createHash, randomUUID } from "node:crypto";
import { validatedQuestionnaireSnapshot } from "./questionnaire-validation.js";
import { SERVICE_OPTIONS, selectedServiceFromAnswers } from "./questionnaires/index.js";

export function submissionRecord(data, clock = () => new Date().toISOString()) {
  const submittedAt = clock();
  const smart = Boolean(data.questionnaireId);
  const { submissionId } = data;
  const context = data.context || {};
  const contact = smart ? data.contact : { name: data.name, email: data.email, phone: data.phone };
  const routedServiceId = smart ? selectedServiceFromAnswers(data.answers, context.serviceId) : "";
  const routedService = SERVICE_OPTIONS.find((service) => service.id === routedServiceId);
  const details = smart ? {
    source: "website_smart_enquiry",
    entryType: data.entryType,
    sourcePath: data.sourcePath,
    selectedServiceId: context.serviceId || routedService?.id || null,
    selectedServiceTitle: context.serviceTitle || routedService?.title || null,
    selectedPackageId: context.packageId || null,
    selectedPackageTitle: context.packageTitle || null,
    consentAcknowledgedAt: submittedAt,
    submittedAt,
    ...validatedQuestionnaireSnapshot(data),
  } : {
    ...data,
    source: "website_intake",
    entryType: data.entryType,
    sourcePath: data.sourcePath,
    selectedServiceId: context.serviceId || (data.service !== "not_sure" ? data.service : null),
    selectedServiceTitle: context.serviceTitle || SERVICE_OPTIONS.find((service) => service.id === data.service)?.title || null,
    selectedPackageId: context.packageId || null,
    selectedPackageTitle: context.packageTitle || null,
    submittedAt,
  };
  if (!smart) for (const field of ["submissionId", "name", "email", "phone", "consent", "website", "turnstileToken"]) delete details[field];
  const fingerprintDetails = { ...details };
  for (const field of ["submittedAt", "consentAcknowledgedAt"]) delete fingerprintDetails[field];
  const fingerprint = createHash("sha256").update(JSON.stringify({ contact, details: fingerprintDetails })).digest("hex");
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

export function continuationRecord(priorDetails, data, clock = () => new Date().toISOString()) {
  const completedAt = clock();
  const record = submissionRecord(data, () => completedAt);
  const intakeSubmissionId = priorDetails.submissionId;
  const intakeFingerprint = priorDetails.submissionFingerprint;
  return {
    kind: data.entryType === "package" ? "package" : "personalised",
    contact: record.contact,
    fingerprint: record.fingerprint,
    details: {
      ...priorDetails,
      ...record.details,
      source: "website_progressive_enquiry",
      intakeSourcePath: priorDetails.sourcePath || "/",
      continuationSourcePath: data.sourcePath,
      sourcePath: priorDetails.sourcePath || "/",
      submissionId: intakeSubmissionId,
      submissionFingerprint: intakeFingerprint,
      continuationSubmissionId: data.submissionId,
      continuationSubmissionFingerprint: record.fingerprint,
      questionnaireCompletedAt: completedAt,
    },
  };
}

export function replayContinuation(prior, submissionId, fingerprint) {
  if (prior.details.continuationSubmissionId !== submissionId ||
      prior.details.continuationSubmissionFingerprint !== fingerprint) {
    const error = new Error("Enquiry continuation was already completed.");
    error.code = "enquiry_continuation_conflict";
    throw error;
  }
  return { inquiryId: prior.id, status: "completed", replayed: true };
}
