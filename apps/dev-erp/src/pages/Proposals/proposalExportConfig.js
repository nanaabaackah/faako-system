import { PROPOSAL_BLOCK_TYPES } from "./proposalSchema";

export const PROPOSAL_EXPORT_TARGETS = Object.freeze({
  ONLINE_PREVIEW: "online_preview",
  PRINT: "print",
  PDF: "pdf",
});

export const PROPOSAL_EXPORT_SECTION_ROLES = Object.freeze({
  COVER: "cover",
  NOTE: "note",
  NARRATIVE: "narrative",
  PRICING: "pricing",
  TIMELINE: "timeline",
  TERMS: "terms",
  APPROVAL: "approval",
});

export const PROPOSAL_EXPORT_SECTION_CONFIG = Object.freeze({
  [PROPOSAL_BLOCK_TYPES.COVER]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.COVER,
    pageMode: "cover",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.NOTE,
    pageMode: "feature",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.NARRATIVE,
    pageMode: "standard",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.NARRATIVE,
    pageMode: "standard",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.GOALS]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.NARRATIVE,
    pageMode: "standard",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.NARRATIVE,
    pageMode: "feature",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.DELIVERABLES]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.NARRATIVE,
    pageMode: "standard",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.PRICING]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.PRICING,
    pageMode: "table",
    printBreakBefore: true,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.TIMELINE]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.TIMELINE,
    pageMode: "timeline",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.TERMS]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.TERMS,
    pageMode: "standard",
    printBreakBefore: false,
    printBreakInside: "avoid",
  },
  [PROPOSAL_BLOCK_TYPES.APPROVAL]: {
    role: PROPOSAL_EXPORT_SECTION_ROLES.APPROVAL,
    pageMode: "approval",
    printBreakBefore: true,
    printBreakInside: "avoid",
  },
});

export const getProposalExportSectionConfig = (blockType) =>
  PROPOSAL_EXPORT_SECTION_CONFIG[blockType] || {
    role: PROPOSAL_EXPORT_SECTION_ROLES.NARRATIVE,
    pageMode: "standard",
    printBreakBefore: false,
    printBreakInside: "avoid",
  };

export const isProposalBlockVisibleInExport = (block) =>
  block?.type !== PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE && Boolean(block?.required || block?.enabled);

export const getProposalExportBlocks = (proposal) =>
  (proposal?.blocks || []).filter(isProposalBlockVisibleInExport);

export const getProposalExportMetadata = (proposal, target = PROPOSAL_EXPORT_TARGETS.ONLINE_PREVIEW) => ({
  target,
  proposalId: proposal?.savedId || proposal?.id || null,
  title: proposal?.title || "Untitled proposal",
  clientName: proposal?.clientName || "Client name",
  proposalType: proposal?.proposalType || "website",
  theme: proposal?.branding?.theme || "studio",
  version: proposal?.version || 1,
  updatedAt: proposal?.updatedAt || null,
  sections: getProposalExportBlocks(proposal).map((block, index) => ({
    id: block.id || `${block.type}-${index + 1}`,
    type: block.type,
    title: block.title,
    order: index + 1,
    ...getProposalExportSectionConfig(block.type),
  })),
});
