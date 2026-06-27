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
    techStack: ["React", "Vite", "TypeScript", "Express", "Prisma", "PostgreSQL", "Cloudflare Pages", "Railway/Supabase-ready"],
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
  {
    key: "dev-erp",
    appKey: "dev-erp",
    appPath: "apps/dev-erp",
    projectName: "Dev ERP",
    projectType: "Internal Operations ERP",
    status: "production",
    visibility: PROJECT_VISIBILITY.INTERNAL,
    clientPublic: false,
    privateInternal: true,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "A production-sensitive ERP for operations, invoicing, proposals, rent workflows, audit logs, and app monitoring.",
    longDescription:
      "Internal ERP surface used for live operational workflows. Keep screenshots, data, and implementation details private unless a sanitized internal case study is prepared.",
    techStack: ["React", "Vite", "Express", "Prisma", "PostgreSQL", "Node.js", "Playwright"],
    features: [
      "Role-based module access",
      "Registry-driven ERP module navigation",
      "Proposal workflow and client response MVP",
      "Faako onboarding submission review",
      "Invoicing and proposal workflows",
      "Audit logs and reports",
      "Rent and booking modules",
      "System health monitoring",
    ],
    liveUrl: "https://dev.nanaabaackah.com",
    screenshots: [],
    screenshotPlaceholders: ["Dashboard", "Invoicing", "Audit logs", "System health"],
    latestMilestone: "Registry-driven modules, proposals, onboarding review, and security validation coverage",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/dev-erp",
    notes: "Production-sensitive internal app. Do not publish customer or operational data.",
  },
  {
    key: "reebs-website",
    appKey: "reebs-website",
    appPath: "apps/reebs-website",
    projectName: "REEBS Party Themes Website",
    projectType: "Commerce Storefront / Rental Booking",
    status: "active-build",
    visibility: PROJECT_VISIBILITY.PUBLIC,
    clientPublic: true,
    privateInternal: false,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Public REEBS storefront for party supplies, rentals, checkout requests, and customer-facing catalogue browsing.",
    longDescription:
      "Customer-facing commerce and rental booking surface connected to the REEBS portal APIs. Case study remains disabled until final UX, checkout, and deployment readiness are approved.",
    techStack: ["React", "Vite", "Express API integration", "Prisma-backed catalogue", "Playwright-ready"],
    features: [
      "Shop catalogue",
      "Rental catalogue",
      "Cart and checkout flow",
      "Rental detail pages",
      "CRM-backed contact planning brief submission",
      "Customer account redirects",
    ],
    liveUrl: "https://reebspartythemes.com",
    screenshots: [],
    screenshotPlaceholders: ["Home", "Shop", "Rentals", "Checkout"],
    latestMilestone: "Checkout, rental availability, and CRM contact request persistence",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/reebs-website",
    notes: "Public app; keep payment handling customer-safe and avoid collecting raw card details.",
  },
  {
    key: "reebs-portal",
    appKey: "reebs-portal",
    appPath: "apps/reebs-portal",
    projectName: "REEBS Portal",
    projectType: "Internal Commerce and Rental Operations Portal",
    status: "active-build",
    visibility: PROJECT_VISIBILITY.INTERNAL,
    clientPublic: false,
    privateInternal: true,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Authenticated operations portal for REEBS inventory, bookings, orders, invoices, reports, staff, and water workflows.",
    longDescription:
      "Internal admin portal and API host for REEBS business workflows. Keep operational screenshots and data private until explicitly sanitized.",
    techStack: ["React", "Vite", "Express", "Prisma", "PostgreSQL", "Netlify-style functions"],
    features: [
      "Inventory management",
      "Booking and order management",
      "CRM customer and contact request follow-up",
      "Receipts and invoicing",
      "Reports and audit logs",
      "Role-gated admin modules",
      "Registry-driven module navigation foundation",
    ],
    screenshots: [],
    screenshotPlaceholders: ["Dashboard", "Inventory", "Bookings", "Receipts and invoicing"],
    latestMilestone: "CRM contact request persistence and module navigation cleanup",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/reebs-portal",
    notes: "Internal app; protect role access and avoid exposing unauthorized module surfaces.",
  },
  {
    key: "faako-website",
    appKey: "faako-website",
    appPath: "apps/faako-website",
    projectName: "Faako Website",
    projectType: "Marketing Website",
    status: "foundation",
    visibility: PROJECT_VISIBILITY.PUBLIC,
    clientPublic: true,
    privateInternal: false,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Public Faako marketing website surface for the brand, services, and lead generation.",
    longDescription:
      "Marketing website foundation for Faako. Case study remains disabled until brand content and launch assets are finalized.",
    techStack: ["React", "Vite", "@faako/ui"],
    features: ["Marketing pages", "Responsive layout", "Shared UI integration"],
    screenshots: [],
    screenshotPlaceholders: ["Homepage", "Services", "Contact"],
    latestMilestone: "Monorepo readiness registration",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/faako-website",
    notes: "Public marketing app; keep registry metadata current before launch.",
  },
  {
    key: "faako-erp",
    appKey: "faako-erp",
    appPath: "apps/faako-erp",
    projectName: "Faako ERP",
    projectType: "ERP Shell",
    status: "foundation",
    visibility: PROJECT_VISIBILITY.INTERNAL,
    clientPublic: false,
    privateInternal: true,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Faako ERP frontend shell for shared admin navigation and future operations modules.",
    longDescription:
      "Internal ERP shell foundation that reuses shared Faako UI and config packages. Treat as internal until modules and permissions are production-ready.",
    techStack: ["React", "Vite", "@faako/config", "@faako/ui"],
    features: ["ERP shell", "Shared navigation", "Route foundation"],
    screenshots: [],
    screenshotPlaceholders: ["ERP shell", "Module placeholder"],
    latestMilestone: "Monorepo readiness registration",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/faako-erp",
    notes: "Internal shell; complete module ownership before production use.",
  },
  {
    key: "faako-api",
    appKey: "faako-api",
    appPath: "apps/faako-api",
    projectName: "Faako API",
    projectType: "Backend API",
    status: "foundation",
    visibility: PROJECT_VISIBILITY.INTERNAL,
    clientPublic: false,
    privateInternal: true,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Shared Faako API foundation for backend services, security headers, Prisma access, and demo access controls.",
    longDescription:
      "Internal API surface for Faako platform services. Keep implementation and environment details private.",
    techStack: ["Node.js", "Express", "Prisma", "PostgreSQL", "@faako/security"],
    features: ["Express API", "Security headers", "Prisma integration", "Demo access controls"],
    screenshots: [],
    screenshotPlaceholders: ["API health", "Security configuration"],
    latestMilestone: "Security gate and syntax validation",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/faako-api",
    notes: "Backend app; no public case study until a sanitized API overview exists.",
  },
  {
    key: "bynana-portfolio",
    appKey: "bynana-portfolio",
    appPath: "apps/bynana-portfolio",
    projectName: "By Nana Portfolio",
    projectType: "Portfolio Website",
    status: "active",
    visibility: PROJECT_VISIBILITY.PUBLIC,
    clientPublic: true,
    privateInternal: false,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Public portfolio website for Nana with project presentation and visual brand storytelling.",
    longDescription:
      "Portfolio surface for showcasing selected public work. Case studies should remain opt-in per project approval.",
    techStack: ["React", "Vite", "Three.js", "@faako/ui"],
    features: ["Portfolio pages", "Visual project presentation", "Shared loader integration"],
    screenshots: [],
    screenshotPlaceholders: ["Homepage", "Projects", "Contact"],
    latestMilestone: "Monorepo readiness registration",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/bynana-portfolio",
    notes: "Public portfolio; publish only approved project details.",
  },
  {
    key: "ui-workbench",
    appKey: "ui-workbench",
    appPath: "apps/ui-workbench",
    projectName: "Faako UI Workbench",
    projectType: "Internal Design System Workbench",
    status: "foundation",
    visibility: PROJECT_VISIBILITY.INTERNAL,
    clientPublic: false,
    privateInternal: true,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Internal workbench for reviewing shared Faako UI components and interaction states.",
    longDescription:
      "Design system workbench used to test shared UI components outside production apps.",
    techStack: ["React", "Vite", "@faako/ui"],
    features: ["Component previews", "Design token checks", "Shared loader previews"],
    screenshots: [],
    screenshotPlaceholders: ["Component gallery", "Loading states"],
    latestMilestone: "Monorepo readiness registration",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/ui-workbench",
    notes: "Internal workbench; not a customer-facing app.",
  },
  {
    key: "system-starter",
    appKey: "system-starter",
    appPath: "apps/system-starter",
    projectName: "System Starter",
    projectType: "Application Starter",
    status: "template",
    visibility: PROJECT_VISIBILITY.INTERNAL,
    clientPublic: false,
    privateInternal: true,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription:
      "Starter app for quickly creating new Faako system surfaces from shared conventions.",
    longDescription:
      "Internal starter/template app used as a baseline for new projects in the monorepo.",
    techStack: ["React", "Vite", "@faako/ui"],
    features: ["Starter layout", "Shared UI integration", "Template baseline"],
    screenshots: [],
    screenshotPlaceholders: ["Starter workspace"],
    latestMilestone: "Monorepo readiness registration",
    lastUpdated: "2026-06-25",
    relatedDocsPath: "docs/apps/system-starter",
    notes: "Template app; keep lightweight and dependency-minimal.",
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
