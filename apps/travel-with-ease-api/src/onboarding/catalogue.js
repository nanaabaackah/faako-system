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
        "Learn the tools available to your role. This guide never edits records or publishes content. You can skip it and resume from the footer.",
      ],
      [
        "dashboard",
        "overview",
        "Your dashboard",
        "Review your workspace activity and use the module shortcuts to choose your next task.",
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
        "Select a page to inspect its current content. Only approved published content belongs on the public website.",
      ],
      [
        "drafts",
        "content-draft",
        "Work with drafts",
        "Review each field and save deliberately. A saved draft is not a published update. Leave this guide open or pause it while you work.",
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
        "Review the media library before uploading a duplicate. Check image descriptions and usage rights.",
      ],
      [
        "upload",
        "media-upload",
        "Upload responsibly",
        "Use the upload controls only when you have permission and approved assets. This guide does not upload files for you.",
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
        "Use the filters and open an enquiry to inspect its details. Customer information must stay within the workspace.",
      ],
      [
        "details",
        "enquiries",
        "Handle an enquiry deliberately",
        "Open a record when you are ready. Review the customer's request before explicitly changing its status. The guide never changes a record.",
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
        "Check the draft, image rights and preview. Publishing is a separate privileged action, not part of this tutorial.",
      ],
      [
        "confirmation",
        "content-publication",
        "Confirm the publication outcome",
        "A request is not a completed deployment. Review publication status and the website before considering an update live.",
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
        "Grant only the access a colleague needs, using their independently verified identity. Google sign-in alone does not grant a workspace role.",
      ],
      [
        "revoke",
        "staff",
        "Review access regularly",
        "Check current staff access. Deactivation and session revocation are deliberate administrative actions, never tutorial actions.",
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
        "Your role determines available modules. Google and Cloudflare Access manage identity and MFA. Use Sign out all devices if you need to end your workspace sessions.",
      ],
      [
        "settings",
        "account-settings",
        "Workspace settings",
        "Review your role, workspace reference and session expiry. Tutorial preferences are personal. Workspace ownership and infrastructure settings require your authorised administrator.",
      ],
      [
        "preferences",
        "tutorial-footer",
        "Make the guide work for you",
        "Use Tutorial Mode in this footer to turn hints off, resume, restart or choose a tutorial. Progress is saved to your own account across devices and deployments.",
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
