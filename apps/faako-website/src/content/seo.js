import { getModuleById } from "../data/modules.js";

export const SITE_NAME = "Faako";
export const SITE_URL = "https://faako.nanaabaackah.com";
export const DEFAULT_SOCIAL_IMAGE = "/assets/logos/logo-colour-long.png";

const pageSeo = {
  "/": {
    title: "Faako | Business Systems and Automation for Ghanaian Teams",
    description:
      "Faako helps Ghanaian businesses connect websites, operations, customer follow-up, inventory, delivery, and reporting in one practical system.",
    type: "website",
  },
  "/about": {
    title: "About Faako | Practical Business Systems Built in Ghana",
    description:
      "Learn how Faako helps Ghanaian teams replace scattered business processes with connected, supported systems.",
  },
  "/case-studies": {
    title: "Faako Use-Case Scenarios | Business System Rollout Examples",
    description:
      "Explore sample Faako rollout scenarios for retail, distribution, service, and growing teams.",
  },
  "/client-setup": {
    title: "Faako Client Setup Form",
    description:
      "Share the plain-language information Faako needs to understand and plan your website, portal, shop, dashboard, system, or automation project.",
    noIndex: true,
  },
  "/configure": {
    title: "Configure Your Faako System | Project Blueprint",
    description:
      "Choose the Faako modules and rollout approach that fit your business, then review an indicative project blueprint.",
  },
  "/contact": {
    title: "Contact Faako | Plan Your Business System",
    description:
      "Contact the Faako team in Accra to discuss websites, connected operations, customer workflows, reporting, and business automation.",
  },
  "/dashboard": {
    title: "Faako Dashboard Preview",
    description:
      "Preview how a connected Faako workspace can bring operational and project information into one view.",
    noIndex: true,
  },
  "/forgot-password": {
    title: "Recover Your Faako Login",
    description: "Request help recovering access to a Faako account.",
    noIndex: true,
  },
  "/login": {
    title: "Faako Account Sign In",
    description: "Access the Faako account sign-in experience.",
    noIndex: true,
  },
  "/pricing": {
    title: "Faako Pricing | Website and Business System Packages",
    description:
      "Review Faako package examples, module pricing, implementation costs, and payment options before planning your system.",
  },
  "/privacy": {
    title: "Faako Privacy and Cookie Policy",
    description:
      "Read how Faako describes personal-data handling, cookies, retention, security controls, and privacy requests.",
  },
  "/signup": {
    title: "Faako Client Onboarding Intake",
    description:
      "Submit the business and project details Faako needs to prepare an onboarding summary and plan the next setup steps.",
    noIndex: true,
  },
  "/solutions": {
    title: "Faako Solutions | Websites, Operations and Business Reporting",
    description:
      "Explore Faako modules for websites, inventory, customer follow-up, reports, delivery, and team operations.",
  },
  "/terms": {
    title: "Faako Terms of Service",
    description:
      "Review the standards and commercial terms that apply when using Faako products and services.",
  },
};

const homeFaq = [
  {
    question: "Is Faako secure?",
    answer:
      "Faako uses strong security and regular backups to keep business records safe.",
  },
  {
    question: "Who is Faako for?",
    answer:
      "Faako is for small and growing businesses in Ghana that want to run their work in one place.",
  },
  {
    question: "Do you charge any hidden fees?",
    answer:
      "Pricing is scoped upfront and shared before work starts, including what is covered.",
  },
  {
    question: "How long does it take to set up?",
    answer:
      "The current Faako guidance says most website projects take 2–4 weeks and full system setups usually take 4–10 weeks.",
  },
];

const pricingFaq = [
  {
    question: "Can I start with Starter and upgrade later?",
    answer:
      "Yes. The pricing page says clients can pay the difference between packages when they are ready to expand.",
  },
  {
    question: "Can I host it myself?",
    answer:
      "Yes, if your team can manage hosting. Faako can provide guidance while your team handles ongoing upkeep.",
  },
  {
    question: "Do you offer discounts for NGOs or schools?",
    answer:
      "The pricing page says registered non-profits and schools can request discounted pricing.",
  },
];

const normalizePath = (path) => {
  const pathname = String(path || "/").split(/[?#]/, 1)[0] || "/";
  return pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
};

export const getSeoForPath = (path) => {
  const normalizedPath = normalizePath(path);

  if (normalizedPath.startsWith("/modules/")) {
    const moduleId = normalizedPath.split("/")[2];
    const module = getModuleById(moduleId);
    if (module) {
      return {
        title: `${module.title} Module | Faako`,
        description: module.detailSummary,
        module,
      };
    }
  }

  return (
    pageSeo[normalizedPath] || {
      title: "Page Not Found | Faako",
      description:
        "The requested Faako page is not available. Return to the homepage or contact the team for help.",
      noIndex: true,
    }
  );
};

const buildFaqSchema = (items) => ({
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

export const buildStructuredData = (path, seo) => {
  const normalizedPath = normalizePath(path);
  const canonical = new URL(normalizedPath, SITE_URL).toString();
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Faako",
      url: SITE_URL,
      email: "hello@faako.nanaabaackah.com",
      logo: new URL("/assets/logos/logo-colour.png", SITE_URL).toString(),
      address: {
        "@type": "PostalAddress",
        addressLocality: "Accra",
        addressCountry: "GH",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-GH",
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: seo.title,
      description: seo.description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-GH",
    },
  ];

  if (seo.module) {
    graph.push({
      "@type": "Service",
      name: `${seo.module.title} module`,
      description: seo.module.detailSummary,
      provider: { "@id": `${SITE_URL}/#organization` },
      areaServed: "GH",
      url: canonical,
    });
  }

  if (normalizedPath === "/") graph.push(buildFaqSchema(homeFaq));
  if (normalizedPath === "/pricing") graph.push(buildFaqSchema(pricingFaq));

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
};
