export const PROPOSAL_BLOCK_TYPES = Object.freeze({
  COVER: "cover",
  PERSONAL_NOTE: "personal_note",
  ABOUT_BUSINESS: "about_business",
  PROJECT_BACKGROUND: "project_background",
  GOALS: "goals",
  PROPOSED_SOLUTION: "proposed_solution",
  DELIVERABLES: "deliverables",
  PRICING: "pricing",
  TIMELINE: "timeline",
  TERMS: "terms",
  APPROVAL: "approval",
});

export const PROPOSAL_TYPES = Object.freeze({
  ERP: "erp",
  WEBSITE: "website",
  ONBOARDING: "onboarding",
  TRAVEL: "travel",
});

export const PROPOSAL_STATUSES = Object.freeze({
  DRAFT: "draft",
  INTERNAL_REVIEW: "internal_review",
  SHARED: "shared",
  CHANGES_REQUESTED: "changes_requested",
  APPROVED: "approved",
  ARCHIVED: "archived",
});

export const PROPOSAL_TYPE_OPTIONS = Object.freeze([
  { value: PROPOSAL_TYPES.WEBSITE, label: "Website proposal" },
  { value: PROPOSAL_TYPES.ERP, label: "ERP proposal" },
  { value: PROPOSAL_TYPES.ONBOARDING, label: "Onboarding proposal" },
  { value: PROPOSAL_TYPES.TRAVEL, label: "Travel proposal" },
]);

export const PROPOSAL_STATUS_OPTIONS = Object.freeze([
  { value: PROPOSAL_STATUSES.DRAFT, label: "Draft" },
  { value: PROPOSAL_STATUSES.INTERNAL_REVIEW, label: "Internal review" },
  { value: PROPOSAL_STATUSES.SHARED, label: "Shared" },
  { value: PROPOSAL_STATUSES.CHANGES_REQUESTED, label: "Changes requested" },
  { value: PROPOSAL_STATUSES.APPROVED, label: "Approved" },
  { value: PROPOSAL_STATUSES.ARCHIVED, label: "Archived" },
]);

export const PROPOSAL_THEME_OPTIONS = Object.freeze([
  { value: "dev", label: "Dev ERP" },
  { value: "studio", label: "Studio proposal" },
  { value: "travel", label: "Travel-ready" },
]);

const BLOCK_DEFINITION_LIST = [
  {
    type: PROPOSAL_BLOCK_TYPES.COVER,
    label: "Cover section",
    defaultTitle: "A thoughtful digital system for your next chapter",
    defaultKicker: "Proposal",
    defaultBody:
      "Prepared to clarify scope, investment, timing, and the working relationship before implementation begins.",
    required: true,
  },
  {
    type: PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE,
    label: "Personal note",
    defaultTitle: "A note from Nana",
    defaultBody:
      "Thank you for trusting us with this work. This proposal is written to make the path clear: what we will build, why it matters, and how we will keep the process calm and accountable.",
    required: true,
  },
  {
    type: PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS,
    label: "About/business section",
    defaultTitle: "About the work",
    defaultBody:
      "This section frames the business, audience, and operational reality behind the proposed solution.",
    defaultItems: ["Brand position", "Audience needs", "Operational context"],
  },
  {
    type: PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND,
    label: "Project background",
    defaultTitle: "Project background",
    defaultBody:
      "The current workflow has grown enough that a clearer, more reliable system will improve execution, communication, and decision-making.",
  },
  {
    type: PROPOSAL_BLOCK_TYPES.GOALS,
    label: "Goals/objectives",
    defaultTitle: "Goals and objectives",
    defaultBody: "The proposal is shaped around practical outcomes.",
    defaultItems: [
      "Create a polished client-facing experience",
      "Reduce manual follow-up",
      "Make status and next steps easier to understand",
    ],
  },
  {
    type: PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION,
    label: "Proposed solution",
    defaultTitle: "Proposed solution",
    defaultBody:
      "A staged implementation that starts with the foundation, then adds the pieces that create the most operational value.",
    defaultItems: [
      "Discovery and structure",
      "Design and implementation",
      "Review, launch support, and handover",
    ],
  },
  {
    type: PROPOSAL_BLOCK_TYPES.DELIVERABLES,
    label: "Deliverables",
    defaultTitle: "Deliverables",
    defaultBody: "The project includes the following deliverables.",
    defaultItems: [
      "Reusable content and page structure",
      "Responsive interface implementation",
      "Launch checklist and support notes",
    ],
  },
  {
    type: PROPOSAL_BLOCK_TYPES.PRICING,
    label: "Pricing summary",
    defaultTitle: "Investment summary",
    defaultBody:
      "Pricing should remain editable until final scope, timeline, and payment terms are confirmed.",
    defaultPricingItems: [
      { label: "Foundation package", amount: "TBD", note: "Final amount pending scope approval" },
    ],
  },
  {
    type: PROPOSAL_BLOCK_TYPES.TIMELINE,
    label: "Timeline/phases",
    defaultTitle: "Timeline and phases",
    defaultBody: "A phased delivery keeps the project easy to review and adjust.",
    defaultTimelineItems: [
      { label: "Phase 1", duration: "Discovery", note: "Confirm goals, content, and requirements" },
      { label: "Phase 2", duration: "Build", note: "Implement the approved structure" },
      { label: "Phase 3", duration: "Launch", note: "Review, polish, and handover" },
    ],
  },
  {
    type: PROPOSAL_BLOCK_TYPES.TERMS,
    label: "Terms/support",
    defaultTitle: "Terms and support",
    defaultBody:
      "Support, payment timing, client responsibilities, and change requests should be confirmed before implementation starts.",
    defaultItems: [
      "Final scope is confirmed before build work begins",
      "Client feedback windows should be agreed upfront",
      "Additional work is quoted separately",
    ],
  },
  {
    type: PROPOSAL_BLOCK_TYPES.APPROVAL,
    label: "Approval section",
    defaultTitle: "Approval",
    defaultBody:
      "When ready, the client will be able to review, approve, and later connect this proposal to invoicing and payment workflows.",
    required: true,
  },
];

export const PROPOSAL_BLOCK_DEFINITIONS = Object.freeze(BLOCK_DEFINITION_LIST);

export const PROPOSAL_BLOCK_DEFINITION_BY_TYPE = Object.freeze(
  BLOCK_DEFINITION_LIST.reduce((definitions, definition) => {
    definitions[definition.type] = definition;
    return definitions;
  }, {})
);

const createBlockId = (type, index) => `${type}-${index + 1}`;

export const createProposalBlock = (definition, index = 0) => ({
  id: createBlockId(definition.type, index),
  type: definition.type,
  label: definition.label,
  title: definition.defaultTitle,
  kicker: definition.defaultKicker || "",
  body: definition.defaultBody || "",
  enabled: true,
  required: Boolean(definition.required),
  items: definition.defaultItems ? [...definition.defaultItems] : [],
  pricingItems: definition.defaultPricingItems
    ? definition.defaultPricingItems.map((item) => ({ ...item }))
    : [],
  timelineItems: definition.defaultTimelineItems
    ? definition.defaultTimelineItems.map((item) => ({ ...item }))
    : [],
});

export const createProposalBlocks = () =>
  PROPOSAL_BLOCK_DEFINITIONS.map((definition, index) => createProposalBlock(definition, index));

export const createProposalDraft = ({
  id = "proposal-template-foundation",
  proposalType = PROPOSAL_TYPES.WEBSITE,
  title = "Website Growth System Proposal",
  clientName = "Stroane Solutions",
  preparedBy = "Nana Aba Ackah",
  theme = "studio",
} = {}) => ({
  id,
  status: PROPOSAL_STATUSES.DRAFT,
  version: 1,
  metadata: {
    templateId: id,
  },
  proposalType,
  title,
  clientName,
  preparedBy,
  preparedDate: new Date().toISOString().slice(0, 10),
  branding: {
    theme,
    businessName: "Dev ERP Proposals",
    tagline: "Clear scope. Calm execution. Practical next steps.",
  },
  personalNotes: {
    introduction:
      "This proposal is designed to be useful before it is beautiful: a shared working document that makes the project easier to approve, schedule, and eventually invoice.",
    founderMessage:
      "My goal is to make the build feel grounded and collaborative, with clear choices instead of surprises.",
    closing:
      "Once the structure feels right, the next phase can add secure sharing, PDF export, approval, invoicing, and payment links.",
  },
  workflow: {
    reviewNotes: "",
    internalComments: "",
    clientChangeRequestNotes: "",
    readiness: {
      scopeReviewed: false,
      pricingReviewed: false,
      timelineReviewed: false,
      termsReviewed: false,
      approvalCopyReviewed: false,
    },
    statusUpdatedAt: null,
    statusUpdatedBy: null,
    statusHistory: [],
    futureClientActions: {
      review: false,
      requestChanges: false,
      approve: false,
    },
  },
  blocks: createProposalBlocks(),
});

export const parseMultilineItems = (value = "") =>
  String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

export const serializeMultilineItems = (items = []) =>
  Array.isArray(items) ? items.filter(Boolean).join("\n") : "";
