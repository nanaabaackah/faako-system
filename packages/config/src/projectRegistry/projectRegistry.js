export const PROJECT_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
  INTERNAL: "internal",
};

export const PROJECT_CASE_STUDY_STATUS = {
  DISABLED: "disabled",
  DRAFT: "draft",
  ENABLED: "enabled",
};

export const PORTFOLIO_PROJECT_REGISTRY = [
  {
    key: "stroane-web",
    appKey: "stroane-web",
    appPath: "apps/stroane-web",
    projectName: "Stroane Web / Stroane Solutions",
    projectType: "Client Website / Lightweight Commerce",
    status: "foundation",
    visibility: PROJECT_VISIBILITY.PUBLIC,
    clientPublic: true,
    privateInternal: false,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "A lightweight Stroane Solutions product catalogue and inquiry website foundation for food safety supplies.",
    longDescription:
      "Placeholder for a future public case study after catalogue data, deployment, inquiry persistence, and client-approved screenshots are finalized.",
    techStack: ["React", "Vite", "TypeScript", "Express", "Prisma", "PostgreSQL", "Netlify", "Railway/Supabase-ready"],
    features: [
      "Product catalogue foundation",
      "Category browsing",
      "Product detail pages",
      "Mapped product images",
      "Backend-aware catalogue fallback",
      "Database-backed catalogue read fallback",
      "Mobile-friendly catalogue filtering",
      "Quote-only product inquiries",
      "Contact-page inquiry submission",
      "Validated inquiry persistence foundation",
      "Persistent cart foundation",
      "Pending order checkout foundation",
      "Paystack checkout MVP",
      "Customer-safe order notification foundation",
      "Paystack webhook verification foundation",
      "Paystack-ready payment planning",
      "Backend/deployment readiness planning",
    ],
    liveUrl: "https://stroanesolutions.com",
    screenshots: [],
    screenshotPlaceholders: [
      "Homepage hero",
      "Catalogue category browsing",
      "Product detail inquiry form",
      "Contact inquiry form",
      "Future deployed backend health check",
    ],
    latestMilestone: "Paystack webhook verification foundation",
    lastUpdated: "2026-05-20",
    relatedDocsPath: "docs/apps/stroane-web",
    notes:
      "Do not auto-publish a case study. Keep client/internal backend details private until reviewed and approved.",
  },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

export const getPortfolioProjects = ({ includePrivate = false } = {}) =>
  clone(
    PORTFOLIO_PROJECT_REGISTRY.filter(
      (project) => includePrivate || project.visibility === PROJECT_VISIBILITY.PUBLIC
    )
  );

export const getPortfolioProjectByKey = (key) =>
  clone(PORTFOLIO_PROJECT_REGISTRY.find((project) => project.key === key) || null);

export const getPortfolioProjectByAppKey = (appKey) =>
  clone(PORTFOLIO_PROJECT_REGISTRY.find((project) => project.appKey === appKey) || null);

export const getCaseStudyReadyProjects = () =>
  clone(
    PORTFOLIO_PROJECT_REGISTRY.filter(
      (project) =>
        project.clientPublic &&
        project.caseStudyEnabled &&
        project.caseStudyStatus === PROJECT_CASE_STUDY_STATUS.ENABLED
    )
  );

export const validatePortfolioProject = (project = {}) => {
  const missing = [];
  for (const field of [
    "key",
    "appKey",
    "appPath",
    "projectName",
    "projectType",
    "status",
    "shortDescription",
    "techStack",
    "features",
    "latestMilestone",
    "lastUpdated",
    "relatedDocsPath",
  ]) {
    const value = project[field];
    if (Array.isArray(value) ? value.length === 0 : !value) missing.push(field);
  }

  if (project.clientPublic && project.caseStudyEnabled && !project.liveUrl) {
    missing.push("liveUrl");
  }

  return {
    key: project.key || "",
    appKey: project.appKey || "",
    valid: missing.length === 0,
    missing,
  };
};

export const validatePortfolioProjectRegistry = () =>
  PORTFOLIO_PROJECT_REGISTRY.map((project) => validatePortfolioProject(project));
