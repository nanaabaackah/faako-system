import { PROPOSAL_STATUSES } from "./proposalSchema";

export const PROPOSAL_REVIEW_CHECKS = Object.freeze([
  {
    key: "scopeReviewed",
    label: "Scope reviewed",
    description: "Core problem, outcome, and delivery boundaries are clear.",
  },
  {
    key: "pricingReviewed",
    label: "Pricing reviewed",
    description: "Investment summary is ready for client review.",
  },
  {
    key: "timelineReviewed",
    label: "Timeline reviewed",
    description: "Phases and delivery expectations are realistic.",
  },
  {
    key: "termsReviewed",
    label: "Terms reviewed",
    description: "Support, payment timing, and change-request terms are clear.",
  },
  {
    key: "approvalCopyReviewed",
    label: "Approval copy reviewed",
    description: "Approval language is ready for a future client action.",
  },
]);

export const PROPOSAL_STATUS_TONES = Object.freeze({
  [PROPOSAL_STATUSES.DRAFT]: "neutral",
  [PROPOSAL_STATUSES.INTERNAL_REVIEW]: "warning",
  [PROPOSAL_STATUSES.SHARED]: "info",
  [PROPOSAL_STATUSES.CHANGES_REQUESTED]: "warning",
  [PROPOSAL_STATUSES.APPROVED]: "success",
  [PROPOSAL_STATUSES.ARCHIVED]: "neutral",
});

export const PROPOSAL_STATUS_DESCRIPTIONS = Object.freeze({
  [PROPOSAL_STATUSES.DRAFT]: "Private working draft.",
  [PROPOSAL_STATUSES.INTERNAL_REVIEW]: "Internal team review before client sharing.",
  [PROPOSAL_STATUSES.SHARED]: "Shared for controlled client review.",
  [PROPOSAL_STATUSES.CHANGES_REQUESTED]: "Client requested changes. Revise before invoice handoff.",
  [PROPOSAL_STATUSES.APPROVED]: "Client approved. Ready for invoice draft handoff.",
  [PROPOSAL_STATUSES.ARCHIVED]: "Inactive proposal record.",
});

export const createDefaultProposalWorkflow = (workflow = {}) => ({
  reviewNotes: typeof workflow.reviewNotes === "string" ? workflow.reviewNotes : "",
  internalComments: typeof workflow.internalComments === "string" ? workflow.internalComments : "",
  clientChangeRequestNotes:
    typeof workflow.clientChangeRequestNotes === "string" ? workflow.clientChangeRequestNotes : "",
  readiness: PROPOSAL_REVIEW_CHECKS.reduce((checks, check) => {
    checks[check.key] = Boolean(workflow.readiness?.[check.key]);
    return checks;
  }, {}),
  statusUpdatedAt: workflow.statusUpdatedAt || null,
  statusUpdatedBy: workflow.statusUpdatedBy || null,
  statusHistory: Array.isArray(workflow.statusHistory) ? workflow.statusHistory.slice(0, 20) : [],
  clientResponse:
    workflow.clientResponse && typeof workflow.clientResponse === "object"
      ? {
          action: workflow.clientResponse.action || null,
          clientName: workflow.clientResponse.clientName || "",
          clientContact: workflow.clientResponse.clientContact || "",
          message: workflow.clientResponse.message || "",
          respondedAt: workflow.clientResponse.respondedAt || null,
          approvedAt: workflow.clientResponse.approvedAt || null,
          requestedChangesAt: workflow.clientResponse.requestedChangesAt || null,
        }
      : null,
  futureClientActions: {
    review: Boolean(workflow.futureClientActions?.review),
    requestChanges: Boolean(workflow.futureClientActions?.requestChanges),
    approve: Boolean(workflow.futureClientActions?.approve),
  },
});

export const getProposalStatusTone = (status) =>
  PROPOSAL_STATUS_TONES[status] || PROPOSAL_STATUS_TONES[PROPOSAL_STATUSES.DRAFT];

export const getProposalStatusDescription = (status) =>
  PROPOSAL_STATUS_DESCRIPTIONS[status] || PROPOSAL_STATUS_DESCRIPTIONS[PROPOSAL_STATUSES.DRAFT];

export const getProposalReadinessSummary = (workflow = {}) => {
  const readiness = workflow.readiness || {};
  const completed = PROPOSAL_REVIEW_CHECKS.filter((check) => Boolean(readiness[check.key])).length;
  return {
    completed,
    total: PROPOSAL_REVIEW_CHECKS.length,
    isReady: completed === PROPOSAL_REVIEW_CHECKS.length,
  };
};
