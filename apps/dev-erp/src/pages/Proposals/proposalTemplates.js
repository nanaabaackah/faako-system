import {
  PROPOSAL_BLOCK_DEFINITION_BY_TYPE,
  PROPOSAL_BLOCK_TYPES,
  PROPOSAL_TYPES,
  createProposalBlock,
  createProposalDraft,
} from "./proposalSchema.js";

export const PROPOSAL_TEMPLATE_KEYS = Object.freeze({
  BLANK: "blank-proposal-template",
  ERP_SYSTEM: "erp-system-template",
  BUSINESS_WEBSITE: "business-website-template",
  CLIENT_PORTAL: "client-portal-template",
  INVENTORY_POS: "inventory-pos-template",
  OPERATIONAL_WORKFLOW: "operational-workflow-template",
  BUSINESS_AUTOMATION: "business-automation-template",
  ONBOARDING_IMPLEMENTATION: "onboarding-implementation-template",
  SERVICE: "service-proposal-template",
  MAINTENANCE_SUPPORT: "maintenance-support-template",
  TRAVEL_ITINERARY: "travel-itinerary-template",
});

export const DEFAULT_PROPOSAL_SECTION_ORDER = Object.freeze([
  PROPOSAL_BLOCK_TYPES.COVER,
  PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE,
  PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS,
  PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND,
  PROPOSAL_BLOCK_TYPES.GOALS,
  PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION,
  PROPOSAL_BLOCK_TYPES.DELIVERABLES,
  PROPOSAL_BLOCK_TYPES.PRICING,
  PROPOSAL_BLOCK_TYPES.TIMELINE,
  PROPOSAL_BLOCK_TYPES.TERMS,
  PROPOSAL_BLOCK_TYPES.APPROVAL,
]);

const cloneArray = (items = []) =>
  Array.isArray(items) ? items.map((item) => (typeof item === "object" ? { ...item } : item)) : [];

const cloneTemplateValue = (value) => {
  if (Array.isArray(value)) return value.map((item) => cloneTemplateValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneTemplateValue(item)])
    );
  }
  return value;
};

const templateValuesMatch = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const preserveEditedTemplateValue = (currentValue, sourceValue, nextValue) => {
  if (currentValue === undefined || templateValuesMatch(currentValue, sourceValue)) {
    return cloneTemplateValue(nextValue);
  }
  return cloneTemplateValue(currentValue);
};

const mergeTemplateFields = (current = {}, source = {}, next = {}) =>
  Object.fromEntries(
    [...new Set([...Object.keys(next), ...Object.keys(current)])].map((key) => [
      key,
      preserveEditedTemplateValue(current[key], source[key], next[key]),
    ])
  );

const normalizeSectionOrder = (sectionOrder = DEFAULT_PROPOSAL_SECTION_ORDER) => {
  const knownSections = new Set(Object.values(PROPOSAL_BLOCK_TYPES));
  const orderedSections = sectionOrder.filter((section) => knownSections.has(section));
  const missingRequiredSections = DEFAULT_PROPOSAL_SECTION_ORDER.filter(
    (section) => !orderedSections.includes(section)
  );

  return [...orderedSections, ...missingRequiredSections];
};

const createTemplate = ({
  key,
  name,
  title,
  description,
  proposalType,
  clientName,
  theme,
  styleReference,
  categoryTags = [],
  isBlank = false,
  defaultSectionOrder = DEFAULT_PROPOSAL_SECTION_ORDER,
  disabledSections = [],
  defaultContent = {},
}) => {
  const sectionOrder = normalizeSectionOrder(defaultSectionOrder);
  const disabledSectionSet = new Set(disabledSections);

  return Object.freeze({
    key,
    id: key,
    name,
    title,
    description,
    proposalType,
    clientName,
    theme,
    styleReference,
    categoryTags,
    isBlank,
    version: 1,
    defaultSectionOrder: sectionOrder,
    disabledSections: [...disabledSectionSet],
    enabledSections: sectionOrder.filter((section) => !disabledSectionSet.has(section)),
    defaultContent,
  });
};

const WEBSITE_SECTION_ORDER = DEFAULT_PROPOSAL_SECTION_ORDER;
const ERP_SECTION_ORDER = Object.freeze([
  PROPOSAL_BLOCK_TYPES.COVER,
  PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE,
  PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND,
  PROPOSAL_BLOCK_TYPES.GOALS,
  PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION,
  PROPOSAL_BLOCK_TYPES.DELIVERABLES,
  PROPOSAL_BLOCK_TYPES.TIMELINE,
  PROPOSAL_BLOCK_TYPES.PRICING,
  PROPOSAL_BLOCK_TYPES.TERMS,
  PROPOSAL_BLOCK_TYPES.APPROVAL,
  PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS,
]);
const ONBOARDING_SECTION_ORDER = Object.freeze([
  PROPOSAL_BLOCK_TYPES.COVER,
  PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE,
  PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS,
  PROPOSAL_BLOCK_TYPES.GOALS,
  PROPOSAL_BLOCK_TYPES.TIMELINE,
  PROPOSAL_BLOCK_TYPES.DELIVERABLES,
  PROPOSAL_BLOCK_TYPES.TERMS,
  PROPOSAL_BLOCK_TYPES.APPROVAL,
  PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND,
  PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION,
  PROPOSAL_BLOCK_TYPES.PRICING,
]);
const TRAVEL_SECTION_ORDER = Object.freeze([
  PROPOSAL_BLOCK_TYPES.COVER,
  PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE,
  PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND,
  PROPOSAL_BLOCK_TYPES.GOALS,
  PROPOSAL_BLOCK_TYPES.TIMELINE,
  PROPOSAL_BLOCK_TYPES.DELIVERABLES,
  PROPOSAL_BLOCK_TYPES.PRICING,
  PROPOSAL_BLOCK_TYPES.TERMS,
  PROPOSAL_BLOCK_TYPES.APPROVAL,
  PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS,
  PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION,
]);

const BLANK_DISABLED_SECTIONS = Object.freeze([
  PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS,
  PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND,
  PROPOSAL_BLOCK_TYPES.GOALS,
  PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION,
  PROPOSAL_BLOCK_TYPES.DELIVERABLES,
  PROPOSAL_BLOCK_TYPES.PRICING,
  PROPOSAL_BLOCK_TYPES.TIMELINE,
  PROPOSAL_BLOCK_TYPES.TERMS,
]);

export const PROPOSAL_TEMPLATE_LIBRARY = Object.freeze([
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.BLANK,
    name: "Start from scratch",
    title: "Untitled Proposal",
    clientName: "",
    proposalType: PROPOSAL_TYPES.WEBSITE,
    theme: "studio",
    styleReference: "blank",
    categoryTags: ["blank", "scratch", "custom"],
    isBlank: true,
    description: "A clean blank proposal with reusable sections ready to turn on and edit.",
    defaultSectionOrder: DEFAULT_PROPOSAL_SECTION_ORDER,
    disabledSections: BLANK_DISABLED_SECTIONS,
    defaultContent: {
      branding: {
        tagline: "A flexible proposal draft ready for manual structure.",
      },
      personalNotes: {
        introduction: "",
        founderMessage: "",
        closing: "",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Proposal",
          title: "Untitled proposal",
          body: "",
        },
        [PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE]: { body: "" },
        [PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS]: { body: "", items: [] },
        [PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND]: { body: "" },
        [PROPOSAL_BLOCK_TYPES.GOALS]: { body: "", items: [] },
        [PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION]: { body: "", items: [] },
        [PROPOSAL_BLOCK_TYPES.DELIVERABLES]: { body: "", items: [] },
        [PROPOSAL_BLOCK_TYPES.PRICING]: { body: "", pricingItems: [] },
        [PROPOSAL_BLOCK_TYPES.TIMELINE]: { body: "", timelineItems: [] },
        [PROPOSAL_BLOCK_TYPES.TERMS]: { body: "", items: [] },
        [PROPOSAL_BLOCK_TYPES.APPROVAL]: {
          title: "Approval",
          body: "",
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.ERP_SYSTEM,
    name: "ERP system",
    title: "ERP System Proposal",
    clientName: "Operations Client",
    proposalType: PROPOSAL_TYPES.ERP,
    theme: "dev",
    styleReference: "operations",
    categoryTags: ["erp", "service", "operations"],
    description: "A reusable foundation for ERP/admin workflow proposals.",
    defaultSectionOrder: ERP_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "Operational clarity for teams, records, and reporting.",
      },
      personalNotes: {
        introduction:
          "This proposal focuses on the systems that keep day-to-day operations clear, trackable, and easier to review.",
        closing:
          "After the workflow map is approved, implementation can move in phases without disrupting existing operations.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "ERP proposal",
          title: "A practical ERP system for clearer operations",
          body:
            "Prepared to align modules, users, records, reporting, and rollout priorities before implementation begins.",
        },
        [PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND]: {
          body:
            "The current process needs a clearer system for tracking work, reducing manual follow-up, and keeping operational records consistent.",
        },
        [PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION]: {
          items: [
            "Map current workflows and permissions",
            "Build the core operational modules first",
            "Add reporting, audit visibility, and handover support",
          ],
        },
        [PROPOSAL_BLOCK_TYPES.TIMELINE]: {
          timelineItems: [
            { label: "Phase 1", duration: "Discovery", note: "Confirm modules, roles, and data boundaries" },
            { label: "Phase 2", duration: "Core build", note: "Implement the approved operational workflows" },
            { label: "Phase 3", duration: "Review", note: "Test production-sensitive paths and train users" },
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.BUSINESS_WEBSITE,
    name: "Business website",
    title: "Business Website Proposal",
    clientName: "Website Client",
    proposalType: PROPOSAL_TYPES.WEBSITE,
    theme: "studio",
    styleReference: "presentation",
    categoryTags: ["website", "service"],
    description: "A website and digital presence proposal foundation.",
    defaultSectionOrder: WEBSITE_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "A polished digital presence with a clear launch path.",
      },
      personalNotes: {
        introduction:
          "This proposal frames the website as a practical growth system: clear positioning, useful content, and a launch plan that can keep improving after go-live.",
        founderMessage:
          "My focus is to make the build feel clear and calm, with enough structure to protect quality without slowing down decisions.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Website proposal",
          title: "A website growth system for the next chapter",
          body:
            "Prepared to align brand presence, customer trust, launch priorities, and support needs before implementation begins.",
        },
        [PROPOSAL_BLOCK_TYPES.GOALS]: {
          items: [
            "Clarify the offer and customer journey",
            "Create a responsive, trustworthy website experience",
            "Prepare content and launch steps for confident handover",
          ],
        },
        [PROPOSAL_BLOCK_TYPES.DELIVERABLES]: {
          items: [
            "Responsive website structure and core pages",
            "Reusable content sections and contact paths",
            "Launch checklist, analytics readiness, and handover notes",
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.CLIENT_PORTAL,
    name: "Client portal",
    title: "Client Portal Proposal",
    clientName: "Portal Client",
    proposalType: PROPOSAL_TYPES.ERP,
    theme: "dev",
    styleReference: "portal",
    categoryTags: ["erp", "portal", "service"],
    description: "A proposal for authenticated client-facing portal workflows.",
    defaultSectionOrder: ERP_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "A secure client workspace for requests, updates, and records.",
      },
      personalNotes: {
        introduction:
          "This proposal frames the client portal as a clear workspace where clients can review updates, submit requests, and access key documents.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Portal proposal",
          title: "A client portal for clearer service delivery",
          body: "Prepared to define the secure client experience, internal workflows, and rollout boundaries.",
        },
        [PROPOSAL_BLOCK_TYPES.GOALS]: {
          items: [
            "Give clients one clear place to view updates",
            "Reduce manual status follow-up",
            "Keep sensitive records behind authenticated access",
          ],
        },
        [PROPOSAL_BLOCK_TYPES.DELIVERABLES]: {
          items: [
            "Client dashboard and secure login structure",
            "Request/status workflow outline",
            "Admin review and handover notes",
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.INVENTORY_POS,
    name: "Inventory/POS",
    title: "Inventory and POS Proposal",
    clientName: "Retail Client",
    proposalType: PROPOSAL_TYPES.ERP,
    theme: "dev",
    styleReference: "retail-operations",
    categoryTags: ["erp", "pos", "inventory", "service"],
    description: "A starter for inventory, POS, stock, and sales workflow proposals.",
    defaultSectionOrder: ERP_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "A clearer path from sale to stock visibility.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Inventory and POS proposal",
          title: "A stock-aware POS workflow for daily operations",
          body: "Prepared to map sales, stock visibility, staff workflow, and reporting needs.",
        },
        [PROPOSAL_BLOCK_TYPES.GOALS]: {
          items: [
            "Make sales entry faster and easier to review",
            "Improve stock visibility without changing stock rules blindly",
            "Prepare reporting for daily operational decisions",
          ],
        },
        [PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION]: {
          items: [
            "POS flow and product catalog structure",
            "Inventory adjustment and reporting views",
            "Safe rollout plan with staff training",
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.OPERATIONAL_WORKFLOW,
    name: "Operational workflow",
    title: "Operational Workflow Proposal",
    clientName: "Workflow Client",
    proposalType: PROPOSAL_TYPES.ERP,
    theme: "dev",
    styleReference: "workflow",
    categoryTags: ["erp", "operations", "service"],
    description: "A proposal for mapping and improving manual operational workflows.",
    defaultSectionOrder: ERP_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "A structured workflow from request to review.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Workflow proposal",
          title: "A clearer workflow for repeatable operations",
          body: "Prepared to document current steps, define ownership, and build a calmer process.",
        },
        [PROPOSAL_BLOCK_TYPES.PROJECT_BACKGROUND]: {
          body: "The current workflow depends on scattered updates, repeated follow-up, or manual tracking.",
        },
        [PROPOSAL_BLOCK_TYPES.DELIVERABLES]: {
          items: [
            "Workflow map and responsibility structure",
            "Operational screens or forms for the approved flow",
            "Review checklist and launch support notes",
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.BUSINESS_AUTOMATION,
    name: "Business automation",
    title: "Business Automation Proposal",
    clientName: "Automation Client",
    proposalType: PROPOSAL_TYPES.ERP,
    theme: "dev",
    styleReference: "automation",
    categoryTags: ["automation", "service", "erp"],
    description: "A starter for practical automation and productivity workflows.",
    defaultSectionOrder: ERP_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "Less repetition, clearer handoffs, better visibility.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Automation proposal",
          title: "Practical automation for repeated business tasks",
          body: "Prepared to identify safe automation opportunities and keep final decisions under human review.",
        },
        [PROPOSAL_BLOCK_TYPES.GOALS]: {
          items: [
            "Reduce repetitive manual work",
            "Improve consistency across handoffs",
            "Keep sensitive decisions auditable and reviewed",
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.ONBOARDING_IMPLEMENTATION,
    name: "Onboarding implementation",
    title: "Onboarding and Implementation Proposal",
    clientName: "New Client",
    proposalType: PROPOSAL_TYPES.ONBOARDING,
    theme: "dev",
    styleReference: "onboarding",
    categoryTags: ["onboarding", "service"],
    description: "A setup and implementation plan for new-client onboarding.",
    defaultSectionOrder: ONBOARDING_SECTION_ORDER,
    disabledSections: [PROPOSAL_BLOCK_TYPES.PRICING],
    defaultContent: {
      branding: {
        tagline: "A calm path from kickoff to handover.",
      },
      personalNotes: {
        introduction:
          "This proposal is designed to make onboarding feel organized from the first conversation through setup, review, and handover.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.GOALS]: {
          items: [
            "Confirm scope, access, and responsibilities early",
            "Keep onboarding steps visible and accountable",
            "Prepare the client for a clean handover",
          ],
        },
        [PROPOSAL_BLOCK_TYPES.TIMELINE]: {
          timelineItems: [
            { label: "Kickoff", duration: "Week 1", note: "Confirm goals, contacts, and required access" },
            { label: "Setup", duration: "Weeks 1-2", note: "Prepare the approved structure and core assets" },
            { label: "Handover", duration: "Final review", note: "Confirm support notes, ownership, and next steps" },
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.SERVICE,
    name: "Service proposal",
    title: "Service Proposal",
    clientName: "Service Client",
    proposalType: PROPOSAL_TYPES.WEBSITE,
    theme: "studio",
    styleReference: "service",
    categoryTags: ["service", "website"],
    description: "A flexible proposal for service packages, retainers, or one-off work.",
    defaultSectionOrder: WEBSITE_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "Clear scope, service boundaries, and next steps.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Service proposal",
          title: "A focused service proposal with clear outcomes",
          body: "Prepared to confirm scope, deliverables, timeline, and support expectations.",
        },
        [PROPOSAL_BLOCK_TYPES.DELIVERABLES]: {
          items: [
            "Confirmed service scope",
            "Delivery milestones",
            "Support and handover notes",
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.MAINTENANCE_SUPPORT,
    name: "Maintenance and support",
    title: "Maintenance and Support Proposal",
    clientName: "Support Client",
    proposalType: PROPOSAL_TYPES.ONBOARDING,
    theme: "dev",
    styleReference: "support",
    categoryTags: ["service", "onboarding", "support"],
    description: "A starter for ongoing support, maintenance, and operational care.",
    defaultSectionOrder: ONBOARDING_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "Ongoing care with clear expectations and escalation paths.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Support proposal",
          title: "Maintenance and support for a stable system",
          body: "Prepared to define support coverage, response expectations, and maintenance priorities.",
        },
        [PROPOSAL_BLOCK_TYPES.GOALS]: {
          items: [
            "Keep core workflows stable",
            "Clarify response and escalation expectations",
            "Plan small improvements without disrupting operations",
          ],
        },
      },
    },
  }),
  createTemplate({
    key: PROPOSAL_TEMPLATE_KEYS.TRAVEL_ITINERARY,
    name: "Travel itinerary",
    title: "Travel Itinerary Proposal",
    clientName: "Travel Client",
    proposalType: PROPOSAL_TYPES.TRAVEL,
    theme: "travel",
    styleReference: "travel",
    categoryTags: ["travel", "placeholder"],
    description: "A future-ready structure for travel planning and itinerary proposals.",
    defaultSectionOrder: TRAVEL_SECTION_ORDER,
    defaultContent: {
      branding: {
        tagline: "A clear itinerary, thoughtful options, and simple approval steps.",
      },
      personalNotes: {
        introduction:
          "This proposal frames the experience, timing, inclusions, and decision points so travel planning can stay easy to review.",
      },
      blocks: {
        [PROPOSAL_BLOCK_TYPES.COVER]: {
          kicker: "Travel proposal",
          title: "A travel experience shaped around the guest journey",
          body:
            "Prepared to outline the proposed experience, schedule, inclusions, pricing assumptions, and approval path.",
        },
        [PROPOSAL_BLOCK_TYPES.TIMELINE]: {
          timelineItems: [
            { label: "Experience outline", duration: "Planning", note: "Confirm destination, dates, and guest needs" },
            { label: "Itinerary draft", duration: "Review", note: "Map schedule, stays, activities, and transfers" },
            { label: "Confirmation", duration: "Approval", note: "Prepare final details after client approval" },
          ],
        },
      },
    },
  }),
]);

export const getProposalTemplateByKey = (templateKey) =>
  PROPOSAL_TEMPLATE_LIBRARY.find(
    (template) => template.key === templateKey || template.id === templateKey
  ) || PROPOSAL_TEMPLATE_LIBRARY[0];

const applyBlockDefaults = (block, overrides = {}) => ({
  ...block,
  ...overrides,
  items: overrides.items ? cloneArray(overrides.items) : block.items,
  pricingItems: overrides.pricingItems ? cloneArray(overrides.pricingItems) : block.pricingItems,
  timelineItems: overrides.timelineItems ? cloneArray(overrides.timelineItems) : block.timelineItems,
});

export const createProposalBlocksFromTemplate = (template) => {
  const disabledSections = new Set(template.disabledSections || []);
  const blockDefaults = template.defaultContent?.blocks || {};

  return template.defaultSectionOrder
    .map((sectionType, index) => {
      const definition = PROPOSAL_BLOCK_DEFINITION_BY_TYPE[sectionType];
      if (!definition) return null;

      const block = applyBlockDefaults(createProposalBlock(definition, index), blockDefaults[sectionType]);

      return {
        ...block,
        enabled: block.required || !disabledSections.has(sectionType),
      };
    })
    .filter(Boolean);
};

export const createProposalFromTemplate = (templateKey) => {
  const template = getProposalTemplateByKey(templateKey);
  const draft = createProposalDraft({
    id: template.key,
    title: template.title,
    clientName: template.clientName,
    proposalType: template.proposalType,
    theme: template.theme,
  });

  return {
    ...draft,
    metadata: {
      ...draft.metadata,
      templateKey: template.key,
      templateName: template.name,
      templateVersion: template.version,
      proposalType: template.proposalType,
      styleReference: template.styleReference,
      isBlankTemplate: Boolean(template.isBlank),
    },
    template: {
      key: template.key,
      name: template.name,
      version: template.version,
      styleReference: template.styleReference,
      isBlank: Boolean(template.isBlank),
      sectionOrder: [...template.defaultSectionOrder],
      enabledSections: [...template.enabledSections],
      disabledSections: [...template.disabledSections],
    },
    branding: {
      ...draft.branding,
      ...(template.defaultContent?.branding || {}),
    },
    personalNotes: {
      ...draft.personalNotes,
      ...(template.defaultContent?.personalNotes || {}),
    },
    blocks: createProposalBlocksFromTemplate(template),
  };
};

const getProposalSourceTemplateKey = (proposal = {}) =>
  proposal.template?.key ||
  proposal.metadata?.templateKey ||
  proposal.metadata?.templateId ||
  PROPOSAL_TEMPLATE_KEYS.BLANK;

const getBlockByType = (proposal, type) =>
  (proposal?.blocks || []).find((block) => block.type === type) || {};

export const applyProposalTemplate = (proposal, templateKey) => {
  const current = proposal && typeof proposal === "object" ? proposal : {};
  const source = createProposalFromTemplate(getProposalSourceTemplateKey(current));
  const next = createProposalFromTemplate(templateKey);

  return {
    ...next,
    ...current,
    id: next.id,
    title: preserveEditedTemplateValue(current.title, source.title, next.title),
    clientName: preserveEditedTemplateValue(current.clientName, source.clientName, next.clientName),
    preparedBy: preserveEditedTemplateValue(current.preparedBy, source.preparedBy, next.preparedBy),
    preparedDate: preserveEditedTemplateValue(
      current.preparedDate,
      source.preparedDate,
      next.preparedDate
    ),
    proposalType: preserveEditedTemplateValue(
      current.proposalType,
      source.proposalType,
      next.proposalType
    ),
    metadata: {
      ...(current.metadata || {}),
      ...next.metadata,
    },
    template: next.template,
    branding: mergeTemplateFields(current.branding, source.branding, next.branding),
    personalNotes: mergeTemplateFields(
      current.personalNotes,
      source.personalNotes,
      next.personalNotes
    ),
    blocks: next.blocks.map((nextBlock) => ({
      ...nextBlock,
      ...mergeTemplateFields(
        getBlockByType(current, nextBlock.type),
        getBlockByType(source, nextBlock.type),
        nextBlock
      ),
      id: nextBlock.id,
      type: nextBlock.type,
      label: nextBlock.label,
      required: nextBlock.required,
    })),
  };
};

export const getProposalTemplateSectionSummary = (template) => {
  const enabledCount = template.enabledSections?.length || 0;
  const disabledCount = template.disabledSections?.length || 0;
  const disabledCopy = disabledCount > 0 ? ` · ${disabledCount} optional off` : "";

  return `${enabledCount} default sections${disabledCopy}`;
};
