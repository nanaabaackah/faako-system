import assert from "node:assert/strict";
import test from "node:test";
import { PROPOSAL_BLOCK_TYPES } from "./proposalSchema.js";
import {
  PROPOSAL_TEMPLATE_KEYS,
  applyProposalTemplate,
  createProposalFromTemplate,
} from "./proposalTemplates.js";

const getBlock = (proposal, type) => proposal.blocks.find((block) => block.type === type);

test("template switching keeps entered proposal fields while adopting untouched template defaults", () => {
  const website = createProposalFromTemplate(PROPOSAL_TEMPLATE_KEYS.BUSINESS_WEBSITE);
  const editedWebsite = {
    ...website,
    title: "Nana's launch proposal",
    clientName: "Akosua Studio",
    branding: {
      ...website.branding,
      businessName: "By Nana",
    },
    personalNotes: {
      ...website.personalNotes,
      introduction: "A custom note for Akosua.",
    },
    blocks: website.blocks.map((block) =>
      block.type === PROPOSAL_BLOCK_TYPES.GOALS
        ? {
            ...block,
            items: ["Launch the new brand", "Make enquiries easier"],
          }
        : block
    ),
  };

  const switched = applyProposalTemplate(editedWebsite, PROPOSAL_TEMPLATE_KEYS.ERP_SYSTEM);
  const switchedGoals = getBlock(switched, PROPOSAL_BLOCK_TYPES.GOALS);
  const switchedTimeline = getBlock(switched, PROPOSAL_BLOCK_TYPES.TIMELINE);

  assert.equal(switched.template.key, PROPOSAL_TEMPLATE_KEYS.ERP_SYSTEM);
  assert.equal(switched.title, "Nana's launch proposal");
  assert.equal(switched.clientName, "Akosua Studio");
  assert.equal(switched.branding.businessName, "By Nana");
  assert.equal(switched.branding.theme, "dev");
  assert.equal(switched.personalNotes.introduction, "A custom note for Akosua.");
  assert.deepEqual(switchedGoals.items, ["Launch the new brand", "Make enquiries easier"]);
  assert.equal(switchedTimeline.timelineItems[0].duration, "Discovery");
});

test("template switching keeps explicit section choices and saved workflow state", () => {
  const onboarding = createProposalFromTemplate(PROPOSAL_TEMPLATE_KEYS.ONBOARDING_IMPLEMENTATION);
  const editedOnboarding = {
    ...onboarding,
    savedId: 42,
    status: "internal_review",
    workflow: {
      ...onboarding.workflow,
      reviewNotes: "Ready for the final pricing pass.",
    },
    branding: {
      ...onboarding.branding,
      theme: "travel",
    },
    blocks: onboarding.blocks.map((block) =>
      block.type === PROPOSAL_BLOCK_TYPES.PRICING
        ? { ...block, enabled: true, body: "Custom pricing notes." }
        : block
    ),
  };

  const switched = applyProposalTemplate(editedOnboarding, PROPOSAL_TEMPLATE_KEYS.SERVICE);
  const switchedPricing = getBlock(switched, PROPOSAL_BLOCK_TYPES.PRICING);

  assert.equal(switched.savedId, 42);
  assert.equal(switched.status, "internal_review");
  assert.equal(switched.workflow.reviewNotes, "Ready for the final pricing pass.");
  assert.equal(switched.branding.theme, "travel");
  assert.equal(switchedPricing.enabled, true);
  assert.equal(switchedPricing.body, "Custom pricing notes.");
});
