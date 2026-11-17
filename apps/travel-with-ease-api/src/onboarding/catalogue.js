// Targets are application-owned identifiers, never selectors supplied by clients.
export const tutorialVersion = 1;
export const tutorials = [
  {
    id: "welcome",
    module: "overview",
    title: "Welcome to Travel With Ease",
    steps: [
      [
        "workspace",
        "workspace",
        "Your staff workspace",
        "Explore your workspace and the tools available to you.",
      ],
      [
        "dashboard",
        "overview",
        "Your dashboard",
        "Review recent activity or open a workspace module.",
      ],
    ],
  },
  {
    id: "content",
    module: "content",
    permission: "content.read",
    title: "Website content",
    steps: [
      [
        "pages",
        "content-pages",
        "Choose a website page",
        "Select a page to edit.",
      ],
      [
        "drafts",
        "content-draft",
        "Work with drafts",
        "Edit the content, then save your draft.",
      ],
    ],
  },
  {
    id: "media",
    module: "media",
    permission: "media.read",
    title: "Media library",
    steps: [
      [
        "library",
        "media",
        "Find approved media",
        "Find an existing photo or upload a new one.",
      ],
      [
        "upload",
        "media-upload",
        "Upload responsibly",
        "Upload a photo and add alternative text.",
      ],
    ],
  },
  {
    id: "enquiries",
    module: "enquiries",
    permission: "enquiries.read",
    title: "Enquiries",
    steps: [
      [
        "list",
        "enquiry-filters",
        "Review incoming enquiries",
        "Filter enquiries and open one to review.",
      ],
      [
        "details",
        "enquiries",
        "Handle an enquiry deliberately",
        "Review a traveller's request and update its status.",
      ],
    ],
  },
  {
    id: "publishing",
    module: "content",
    permission: "content.publish",
    title: "Publishing",
    steps: [
      [
        "review",
        "content",
        "Review before publishing",
        "Review your draft and preview it before publishing.",
      ],
      [
        "confirmation",
        "content-publication",
        "Confirm the publication outcome",
        "Check the publication status until it shows Live.",
      ],
    ],
  },
  {
    id: "staff",
    module: "staff",
    permission: "staff.manage",
    title: "Staff access",
    steps: [
      [
        "access",
        "staff-invitations",
        "Manage staff access",
        "Invite a colleague by email and assign their role.",
      ],
      [
        "revoke",
        "staff",
        "Review access regularly",
        "Review accounts and revoke access when needed.",
      ],
    ],
  },
  {
    id: "account",
    module: "settings",
    title: "Account and workspace",
    steps: [
      [
        "session",
        "session",
        "Your account",
        "Review your role and sign-in options.",
      ],
      [
        "settings",
        "account-settings",
        "Workspace settings",
        "View your account and session expiry.",
      ],
      [
        "preferences",
        "tutorial-footer",
        "Make the guide work for you",
        "Open Help & tutorials to resume or restart a tour.",
      ],
    ],
  },
];

export function allowedTutorials(permissions, disabledModules = []) {
  return tutorials
    .filter(
      (tour) =>
        !disabledModules.includes(tour.module) &&
        (!tour.permission || permissions.includes(tour.permission)),
    )
    .map((tour) => ({
      ...tour,
      version: tutorialVersion,
      steps: tour.steps.map(([id, target, title, description]) => ({
        id: `${tour.id}:${tutorialVersion}:${id}`,
        target,
        title,
        description,
        module: tour.module,
      })),
    }));
}

export function transitionProgress(previous, action, catalogue) {
  const steps = catalogue.flatMap((tour) => tour.steps);
  const ids = steps.map((step) => step.id);
  const result = { ...previous, completed: [...previous.completed] };
  const current = ids.includes(previous.position)
    ? previous.position
    : ids.find((id) => !previous.completed.includes(id)) || ids[0] || null;
  if (action.type === "toggle") {
    result.enabled = action.enabled;
    if (!action.enabled && result.status === "active") result.status = "paused";
  } else if (action.type === "skip") {
    result.status = "paused";
  } else if (action.type === "complete") {
    result.status = "completed";
    result.last_completed_version = tutorialVersion;
    result.completed = [...new Set([...result.completed, ...ids])];
    result.position = null;
  } else if (["start", "resume", "restart"].includes(action.type)) {
    result.enabled = true;
    result.status = "active";
    result.position = action.type === "restart" ? ids[0] || null : current;
  } else if (action.type === "launch") {
    const tour = catalogue.find((item) => item.id === action.tutorialId);
    if (!tour) throw new Error("Tutorial unavailable.");
    result.enabled = true;
    result.status = "active";
    result.position = tour.steps[0].id;
  } else if (["next", "back"].includes(action.type)) {
    if (previous.status !== "active" || !previous.enabled)
      throw new Error("Resume the tutorial first.");
    const index = ids.indexOf(current);
    if (action.type === "next" && current)
      result.completed = [...new Set([...result.completed, current])];
    result.position =
      ids[Math.max(0, index + (action.type === "next" ? 1 : -1))] || null;
    if (!result.position) {
      result.status = "completed";
      result.last_completed_version = tutorialVersion;
    }
  } else throw new Error("Unknown tutorial action.");
  return result;
}
