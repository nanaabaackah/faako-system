// The package process gained a fifth client-approved step on 19 November 2026.
// Preserve historic four-step CMS revisions without overwriting their wording.
export const packageTravelPackStep = Object.freeze({
  heading: "Travel with your pack",
  text: "You receive your travel pack with all your confirmed bookings, and we walk you through it on WhatsApp before you go.",
});

export function withPackageTravelPackStep(steps) {
  return Array.isArray(steps) && steps.length === 4
    ? [...steps, { ...packageTravelPackStep }]
    : steps;
}

export function withUpdatedPackageFlow(flows) {
  if (!flows?.package?.steps || !flows?.planning?.steps) return flows;
  const updatedSteps = withPackageTravelPackStep(flows.package.steps);
  return updatedSteps === flows.package.steps ? flows : {
    ...flows,
    package: { ...flows.package, steps: updatedSteps },
  };
}
