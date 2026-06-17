import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faBuilding,
  faCircleCheck,
  faShieldHalved,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import "../styles/pages/Auth.css";

const CLIENT_SETUP_DRAFT_STORAGE_KEY = "faako-client-setup-draft-v1";
const HONEYPOT_FIELD_NAME = "companyFax";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEGACY_NETLIFY_FUNCTIONS_PATH = "/.netlify/functions";

const normalizeConfiguredApiBaseUrl = (value) => {
  const configuredBaseUrl = String(value || "").trim().replace(/\/+$/, "");
  if (!configuredBaseUrl) return "";

  return configuredBaseUrl.replace(
    new RegExp(`${LEGACY_NETLIFY_FUNCTIONS_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    "/api"
  );
};

const resolveApiEndpoint = (path) => {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

  if (!configuredBaseUrl) return `/api/${normalizedPath}`;
  if (/^https?:\/\//i.test(configuredBaseUrl)) {
    return new URL(normalizedPath, `${configuredBaseUrl}/`).toString();
  }

  return `/${configuredBaseUrl.replace(/^\/+/, "")}/${normalizedPath}`;
};

const CLIENT_SETUP_ENDPOINT = resolveApiEndpoint("signup");

const WIZARD_STEPS = [
  { id: "contact", title: "Contact" },
  { id: "service", title: "Service Needed" },
  { id: "business", title: "Current Setup" },
  { id: "brand", title: "Brand & Content" },
  { id: "details", title: "Follow-Up Questions" },
  { id: "integrations", title: "Integrations" },
  { id: "launch", title: "Next Steps" },
  { id: "review", title: "Review & Submit" },
];

const SERVICE_OPTIONS = [
  {
    id: "website",
    label: "Website",
    summary: "A new website, landing page, redesign, or clearer online presence.",
    checklist: "Website scope review",
  },
  {
    id: "portal",
    label: "Client portal",
    summary: "A place where clients, staff, or partners can log in and get things done.",
    checklist: "Portal access and workflow review",
  },
  {
    id: "shop",
    label: "Online shop / payments",
    summary: "Sell products, take payments, receive orders, or manage checkout.",
    checklist: "Shop, checkout, and payment review",
  },
  {
    id: "dashboard",
    label: "Dashboard / reports",
    summary: "See key numbers without building manual spreadsheets every week.",
    checklist: "Dashboard and reporting review",
  },
  {
    id: "operations-system",
    label: "Business system",
    summary: "Track inventory, orders, bookings, customers, staff, or daily work.",
    checklist: "Operations system planning",
  },
  {
    id: "automation",
    label: "Automation / integrations",
    summary: "Connect tools, reduce repeated admin work, or send better alerts.",
    checklist: "Automation and integration review",
  },
];

const SERVICE_LABEL_BY_ID = Object.fromEntries(
  SERVICE_OPTIONS.map((option) => [option.id, option.label])
);

const BUSINESS_TOOL_OPTIONS = [
  ["whatsapp", "WhatsApp"],
  ["instagram-facebook", "Instagram / Facebook"],
  ["google-sheets-excel", "Google Sheets / Excel"],
  ["email", "Email"],
  ["google-forms", "Google Forms"],
  ["pos", "POS app"],
  ["shopify-woocommerce", "Shopify / WooCommerce"],
  ["accounting-app", "Accounting app"],
  ["paper-records", "Paper records"],
  ["existing-system", "Existing website/admin system"],
];

const BUSINESS_TOOL_LABEL_BY_ID = Object.fromEntries(BUSINESS_TOOL_OPTIONS);

const INTEGRATION_OPTIONS = [
  {
    id: "google-analytics",
    label: "Google Analytics",
    description: "Shows where visitors come from and which pages they use most.",
  },
  {
    id: "google-search-console",
    label: "Google Search Console",
    description: "Helps check if Google can find and understand the website.",
  },
  {
    id: "seo",
    label: "SEO basics",
    description: "Improves page titles, descriptions, links, and search visibility.",
  },
  {
    id: "aeo",
    label: "AEO basics",
    description: "Structures answers so AI search tools and answer engines understand the business better.",
  },
  {
    id: "paystack",
    label: "Paystack",
    description: "Collects online payments by card, MoMo, bank transfer, or checkout link.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Lets customers message the team or receive simple updates through WhatsApp.",
  },
  {
    id: "email-sending",
    label: "Email sending",
    description: "Sends form responses, receipts, alerts, or customer updates from a business email.",
  },
  {
    id: "sms",
    label: "SMS alerts",
    description: "Sends short reminders or status updates to customers and staff.",
  },
  {
    id: "google-maps",
    label: "Google Maps",
    description: "Shows business location, directions, branches, or service areas.",
  },
  {
    id: "booking-calendar",
    label: "Booking calendar",
    description: "Lets customers request or book appointments, calls, visits, or services.",
  },
  {
    id: "crm-lead-tracking",
    label: "Lead tracking / CRM",
    description: "Saves enquiries and follow-ups so requests are not missed.",
  },
  {
    id: "meta-pixel",
    label: "Meta Pixel",
    description: "Helps measure Facebook and Instagram ad results when ads are running.",
  },
];

const INTEGRATION_LABEL_BY_ID = Object.fromEntries(
  INTEGRATION_OPTIONS.map((option) => [option.id, option.label])
);

const WEBSITE_PAGE_OPTIONS = [
  ["home", "Home"],
  ["about", "About"],
  ["services", "Services"],
  ["products", "Products"],
  ["contact", "Contact"],
  ["booking", "Booking"],
  ["portfolio", "Portfolio"],
  ["blog", "Blog/news"],
];

const WEBSITE_PAGE_LABEL_BY_ID = Object.fromEntries(WEBSITE_PAGE_OPTIONS);

const WEBSITE_FEATURE_OPTIONS = [
  ["quote-form", "Quote/request form"],
  ["booking-form", "Booking form"],
  ["whatsapp-button", "WhatsApp button"],
  ["gallery", "Photo gallery"],
  ["testimonials", "Reviews/testimonials"],
  ["faq", "FAQ section"],
  ["downloads", "Downloadable files"],
  ["newsletter", "Newsletter signup"],
  ["blog", "Blog/news updates"],
  ["live-chat", "Live chat"],
];

const WEBSITE_FEATURE_LABEL_BY_ID = Object.fromEntries(WEBSITE_FEATURE_OPTIONS);

const ARRAY_LABELS_BY_PATH = {
  "service.extraProducts": SERVICE_LABEL_BY_ID,
  "business.toolsUsed": BUSINESS_TOOL_LABEL_BY_ID,
  "website.pagesNeeded": WEBSITE_PAGE_LABEL_BY_ID,
  "website.featuresNeeded": WEBSITE_FEATURE_LABEL_BY_ID,
  "integrations.selected": INTEGRATION_LABEL_BY_ID,
};

const PRODUCT_DETAILS_CONFIG = {
  website: {
    title: "Website Questions",
    intro: "These help us understand what visitors should see and do on the site.",
    requiredPath: "website.mainAction",
    requiredMessage: "Tell us what visitors should be able to do on the website.",
    fields: [
      {
        type: "select",
        label: "What kind of website work is this?",
        path: "website.websiteType",
        options: ["New website", "Redesign current website", "Landing page", "Not sure yet"],
      },
      {
        type: "textarea",
        label: "What should the website explain clearly?",
        path: "website.websiteGoal",
        placeholder: "Your services, products, prices, locations, proof of work, how to contact you...",
      },
      {
        type: "text",
        label: "Who is the website mainly for?",
        path: "website.targetAudience",
        placeholder: "New customers, parents, companies, members, students...",
      },
      {
        type: "checkbox",
        legend: "Pages you may need",
        path: "website.pagesNeeded",
        options: WEBSITE_PAGE_OPTIONS,
      },
      {
        type: "checkbox",
        legend: "Website features you may need",
        path: "website.featuresNeeded",
        options: WEBSITE_FEATURE_OPTIONS,
      },
      {
        type: "textarea",
        label: "What should visitors be able to do?",
        path: "website.mainAction",
        required: true,
        placeholder: "Call you, request a quote, book, buy, WhatsApp your team...",
      },
      {
        type: "textarea",
        label: "What information must be on the website?",
        path: "website.mustHaveInfo",
        placeholder: "Services, prices, branches, menus, opening hours, policies, team, proof of work...",
      },
      {
        type: "select",
        label: "Do you already have written content and images?",
        path: "website.contentReady",
        options: ["Yes", "Some of it", "No", "Need help"],
      },
      {
        type: "select",
        label: "How often will the website need updates?",
        path: "website.updateFrequency",
        options: ["Rarely", "Monthly", "Weekly", "Often", "Not sure"],
      },
      {
        type: "text",
        label: "Any websites you like?",
        path: "website.exampleSites",
        placeholder: "Paste links or describe the style",
      },
    ],
  },
  portal: {
    title: "Portal Questions",
    intro: "These help us plan who signs in and what each person should be able to do.",
    requiredPath: "portal.portalPurpose",
    requiredMessage: "Tell us what the portal should help people do.",
    fields: [
      {
        type: "select",
        label: "Who will use the portal?",
        path: "portal.audience",
        options: ["Clients", "Staff", "Partners/vendors", "Mixed users", "Not sure yet"],
      },
      {
        type: "textarea",
        label: "What should the portal help people do?",
        path: "portal.portalPurpose",
        required: true,
        placeholder: "View updates, upload files, approve work, make requests, track orders...",
      },
      {
        type: "textarea",
        label: "What information should users see?",
        path: "portal.informationShown",
        placeholder: "Project status, invoices, documents, bookings, order history...",
      },
      {
        type: "checkbox",
        legend: "Actions users may need",
        path: "portal.actionsNeeded",
        options: [
          ["request", "Send requests"],
          ["upload", "Upload files"],
          ["approve", "Approve work"],
          ["pay", "Make payments"],
          ["message", "Message the team"],
          ["track", "Track progress"],
        ],
      },
      {
        type: "select",
        label: "Do different users need different access?",
        path: "portal.needsDifferentAccess",
        options: ["Yes", "No", "Not sure"],
      },
    ],
  },
  shop: {
    title: "Shop / Payment Questions",
    intro: "These help us plan checkout, product setup, delivery, and payment flow.",
    requiredPath: "shop.sellWhat",
    requiredMessage: "Tell us what you want to sell or collect payment for.",
    fields: [
      {
        type: "textarea",
        label: "What will you sell or collect payment for?",
        path: "shop.sellWhat",
        required: true,
        placeholder: "Products, service packages, bookings, deposits, subscriptions...",
      },
      {
        type: "select",
        label: "About how many products or services?",
        path: "shop.itemCount",
        options: ["1-10", "11-50", "51-200", "200+", "Not sure"],
      },
      {
        type: "checkbox",
        legend: "Payment methods needed",
        path: "shop.paymentMethods",
        options: [
          ["momo", "MoMo"],
          ["card", "Card"],
          ["bank-transfer", "Bank transfer"],
          ["cash", "Cash/manual"],
          ["invoice", "Invoice payment"],
        ],
      },
      {
        type: "select",
        label: "How will customers receive orders?",
        path: "shop.deliveryMethod",
        options: ["Delivery", "Pickup", "Both", "Digital delivery", "Not sure"],
      },
      {
        type: "select",
        label: "Should stock or availability be tracked?",
        path: "shop.trackInventory",
        options: ["Yes", "No", "Not sure"],
      },
    ],
  },
  dashboard: {
    title: "Dashboard / Report Questions",
    intro: "These help us understand which numbers matter most and who needs to see them.",
    requiredPath: "dashboard.numbersToTrack",
    requiredMessage: "Tell us the numbers or updates you want to track.",
    fields: [
      {
        type: "textarea",
        label: "What numbers or updates do you want to track?",
        path: "dashboard.numbersToTrack",
        required: true,
        placeholder: "Sales, expenses, orders, stock, bookings, leads, team activity...",
      },
      {
        type: "textarea",
        label: "Where does this information live today?",
        path: "dashboard.dataSources",
        placeholder: "Excel, WhatsApp, POS app, website, accounting app, paper records...",
      },
      {
        type: "select",
        label: "How often should reports be checked?",
        path: "dashboard.reportFrequency",
        options: ["Daily", "Weekly", "Monthly", "Only when needed", "Not sure"],
      },
      {
        type: "text",
        label: "Who needs to see the dashboard?",
        path: "dashboard.viewers",
        placeholder: "Owner, managers, sales team, finance...",
      },
      {
        type: "select",
        label: "Do you need exports or scheduled summaries?",
        path: "dashboard.needsExports",
        options: ["Yes", "No", "Not sure"],
      },
    ],
  },
  "operations-system": {
    title: "Business System Questions",
    intro: "These help us map the day-to-day work the system should organize.",
    requiredPath: "operationsSystem.workflowsToManage",
    requiredMessage: "Tell us the work you want the system to manage.",
    fields: [
      {
        type: "textarea",
        label: "What work should the system help manage?",
        path: "operationsSystem.workflowsToManage",
        required: true,
        placeholder: "Inventory, orders, bookings, customers, staff, expenses, delivery...",
      },
      {
        type: "textarea",
        label: "What usually happens from start to finish?",
        path: "operationsSystem.workflowSteps",
        placeholder: "Customer orders, team confirms, payment is made, delivery is assigned...",
      },
      {
        type: "text",
        label: "How many people or locations will use it?",
        path: "operationsSystem.peopleAndLocations",
        placeholder: "e.g. 8 staff, 2 branches",
      },
      {
        type: "checkbox",
        legend: "Records you may want to move into the system",
        path: "operationsSystem.recordsToImport",
        options: [
          ["customers", "Customers"],
          ["products", "Products/services"],
          ["stock", "Stock"],
          ["orders", "Orders"],
          ["invoices", "Invoices"],
          ["staff", "Staff"],
        ],
      },
      {
        type: "select",
        label: "Do different staff need different access?",
        path: "operationsSystem.needsRoles",
        options: ["Yes", "No", "Not sure"],
      },
    ],
  },
  automation: {
    title: "Automation / Integration Questions",
    intro: "These help us find the repeated work that should become easier.",
    requiredPath: "automation.repetitiveTasks",
    requiredMessage: "Tell us the repeated task you want to reduce.",
    fields: [
      {
        type: "textarea",
        label: "What repeated task should become easier?",
        path: "automation.repetitiveTasks",
        required: true,
        placeholder: "Sending reminders, copying data, creating invoices, updating sheets...",
      },
      {
        type: "textarea",
        label: "Which tools should connect, if any?",
        path: "automation.toolsToConnect",
        placeholder: "Website, WhatsApp, Google Sheets, email, payment provider, CRM...",
      },
      {
        type: "checkbox",
        legend: "Where should alerts or updates go?",
        path: "automation.alertChannels",
        options: [
          ["email", "Email"],
          ["whatsapp", "WhatsApp"],
          ["sms", "SMS"],
          ["dashboard", "Dashboard"],
          ["spreadsheet", "Spreadsheet"],
        ],
      },
      {
        type: "select",
        label: "How often does this task happen?",
        path: "automation.taskFrequency",
        options: ["Many times a day", "Daily", "Weekly", "Monthly", "Not sure"],
      },
      {
        type: "textarea",
        label: "What should happen when something goes wrong?",
        path: "automation.exceptionHandling",
        placeholder: "Notify a manager, hold the request for review, retry later...",
      },
    ],
  },
};

const DEFAULT_VALUES = {
  contact: {
    businessName: "",
    name: "",
    roleTitle: "",
    email: "",
    phoneWhatsapp: "",
    preferredContactMethod: "WhatsApp",
  },
  service: {
    primaryProduct: "website",
    extraProducts: [],
    projectReason: "",
    desiredOutcome: "",
  },
  business: {
    industry: "",
    currentWebsite: "",
    customerType: "",
    teamSize: "",
    toolsUsed: ["whatsapp", "google-sheets-excel"],
    currentTools: "",
    currentProcess: "",
    painPoints: "",
  },
  brand: {
    sharedContentLink: "",
    colourScheme: "",
    brandFeeling: "",
    logoStatus: "Will share later",
    contentOwner: "",
    mustAvoid: "",
    contentNotes: "",
  },
  website: {
    websiteType: "New website",
    websiteGoal: "",
    targetAudience: "",
    pagesNeeded: ["home", "about", "services", "contact"],
    featuresNeeded: ["quote-form", "whatsapp-button"],
    mainAction: "",
    mustHaveInfo: "",
    contentReady: "Some of it",
    updateFrequency: "Monthly",
    exampleSites: "",
  },
  portal: {
    audience: "Clients",
    portalPurpose: "",
    informationShown: "",
    actionsNeeded: ["request", "track"],
    needsDifferentAccess: "Not sure",
  },
  shop: {
    sellWhat: "",
    itemCount: "1-10",
    paymentMethods: ["momo", "card"],
    deliveryMethod: "Both",
    trackInventory: "Not sure",
  },
  dashboard: {
    numbersToTrack: "",
    dataSources: "",
    reportFrequency: "Weekly",
    viewers: "",
    needsExports: "Not sure",
  },
  operationsSystem: {
    workflowsToManage: "",
    workflowSteps: "",
    peopleAndLocations: "",
    recordsToImport: ["customers", "orders"],
    needsRoles: "Not sure",
  },
  automation: {
    repetitiveTasks: "",
    toolsToConnect: "",
    alertChannels: ["email", "whatsapp"],
    taskFrequency: "Daily",
    exceptionHandling: "",
  },
  integrations: {
    selected: ["seo", "google-analytics"],
    existingAccounts: "",
    integrationNotes: "",
  },
  launch: {
    timeline: "1-3 months",
    budgetComfort: "Need guidance",
    hasDecisionMaker: "Yes",
    filesReady: "Some files are ready",
    bestTimeToContact: "",
    extraNotes: "",
    consent: false,
  },
};

const REVIEW_SECTIONS = [
  {
    title: "Contact",
    rows: [
      ["Business name", "contact.businessName"],
      ["Contact name", "contact.name"],
      ["Role/title", "contact.roleTitle"],
      ["Email", "contact.email"],
      ["Phone / WhatsApp", "contact.phoneWhatsapp"],
      ["Preferred contact", "contact.preferredContactMethod"],
    ],
  },
  {
    title: "Service Needed",
    rows: [
      ["Main service", "service.primaryProduct"],
      ["Extra services", "service.extraProducts"],
      ["Why now", "service.projectReason"],
      ["Good outcome", "service.desiredOutcome"],
    ],
  },
  {
    title: "Current Setup",
    rows: [
      ["Industry", "business.industry"],
      ["Current website", "business.currentWebsite"],
      ["Customers served", "business.customerType"],
      ["Team size", "business.teamSize"],
      ["Tools currently used", "business.toolsUsed"],
      ["Other current tools", "business.currentTools"],
      ["Current process", "business.currentProcess"],
      ["Pain points", "business.painPoints"],
    ],
  },
  {
    title: "Brand & Content",
    rows: [
      ["Shared content link", "brand.sharedContentLink"],
      ["Colour scheme", "brand.colourScheme"],
      ["Brand feeling", "brand.brandFeeling"],
      ["Logo status", "brand.logoStatus"],
      ["Content owner", "brand.contentOwner"],
      ["Things to avoid", "brand.mustAvoid"],
      ["Content notes", "brand.contentNotes"],
    ],
  },
  {
    title: "Integrations",
    rows: [
      ["Selected integrations", "integrations.selected"],
      ["Existing accounts", "integrations.existingAccounts"],
      ["Integration notes", "integrations.integrationNotes"],
    ],
  },
  {
    title: "Next Steps",
    rows: [
      ["Timeline", "launch.timeline"],
      ["Budget comfort", "launch.budgetComfort"],
      ["Decision maker available", "launch.hasDecisionMaker"],
      ["Files ready", "launch.filesReady"],
      ["Best time to contact", "launch.bestTimeToContact"],
      ["Extra notes", "launch.extraNotes"],
    ],
  },
];

const PRODUCT_REVIEW_SECTIONS = {
  website: {
    title: "Website Details",
    rows: [
      ["Work type", "website.websiteType"],
      ["Website should explain", "website.websiteGoal"],
      ["Main audience", "website.targetAudience"],
      ["Pages", "website.pagesNeeded"],
      ["Features", "website.featuresNeeded"],
      ["Visitor action", "website.mainAction"],
      ["Must-have information", "website.mustHaveInfo"],
      ["Content/images", "website.contentReady"],
      ["Update frequency", "website.updateFrequency"],
      ["Example sites", "website.exampleSites"],
    ],
  },
  portal: {
    title: "Portal Details",
    rows: [
      ["Users", "portal.audience"],
      ["Purpose", "portal.portalPurpose"],
      ["Information shown", "portal.informationShown"],
      ["User actions", "portal.actionsNeeded"],
      ["Different access", "portal.needsDifferentAccess"],
    ],
  },
  shop: {
    title: "Shop / Payment Details",
    rows: [
      ["What will be sold", "shop.sellWhat"],
      ["Item count", "shop.itemCount"],
      ["Payment methods", "shop.paymentMethods"],
      ["Delivery method", "shop.deliveryMethod"],
      ["Track inventory", "shop.trackInventory"],
    ],
  },
  dashboard: {
    title: "Dashboard Details",
    rows: [
      ["Numbers to track", "dashboard.numbersToTrack"],
      ["Data sources", "dashboard.dataSources"],
      ["Report frequency", "dashboard.reportFrequency"],
      ["Viewers", "dashboard.viewers"],
      ["Exports/summaries", "dashboard.needsExports"],
    ],
  },
  "operations-system": {
    title: "Business System Details",
    rows: [
      ["Workflows", "operationsSystem.workflowsToManage"],
      ["Current steps", "operationsSystem.workflowSteps"],
      ["People/locations", "operationsSystem.peopleAndLocations"],
      ["Records to import", "operationsSystem.recordsToImport"],
      ["Different staff access", "operationsSystem.needsRoles"],
    ],
  },
  automation: {
    title: "Automation Details",
    rows: [
      ["Repeated task", "automation.repetitiveTasks"],
      ["Tools to connect", "automation.toolsToConnect"],
      ["Alert channels", "automation.alertChannels"],
      ["Task frequency", "automation.taskFrequency"],
      ["If something goes wrong", "automation.exceptionHandling"],
    ],
  },
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const normalizeText = (value) => String(value || "").trim();

const isValidEmail = (value) => EMAIL_PATTERN.test(normalizeText(value).toLowerCase());

const hasMeaningfulValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  return normalizeText(value).length > 0;
};

const mergeDraft = (defaults, draft) => {
  if (!draft || typeof draft !== "object") return deepClone(defaults);

  const mergeValue = (fallback, incoming) => {
    if (Array.isArray(fallback)) {
      return Array.isArray(incoming)
        ? incoming.filter((item) => typeof item === "string")
        : fallback;
    }
    if (typeof fallback === "boolean") {
      return typeof incoming === "boolean" ? incoming : fallback;
    }
    if (fallback && typeof fallback === "object") {
      const next = {};
      for (const [key, value] of Object.entries(fallback)) {
        next[key] = mergeValue(value, incoming?.[key]);
      }
      return next;
    }
    return typeof incoming === "string" ? incoming : fallback;
  };

  return mergeValue(defaults, draft);
};

const loadDraft = () => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(CLIENT_SETUP_DRAFT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const saveDraft = (values) => {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(CLIENT_SETUP_DRAFT_STORAGE_KEY, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
};

const clearDraft = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CLIENT_SETUP_DRAFT_STORAGE_KEY);
  } catch {
    // Local storage can be unavailable in private or locked-down browser modes.
  }
};

const getField = (values, path) => {
  const keys = path.split(".");
  let current = values;

  for (const key of keys) {
    if (!current || typeof current !== "object") return "";
    current = current[key];
  }

  return current ?? "";
};

const setNestedValue = (values, path, value) => {
  const keys = path.split(".");
  const next = Array.isArray(values) ? [...values] : { ...values };
  let cursor = next;

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }

    const currentValue = cursor[key];
    cursor[key] = Array.isArray(currentValue)
      ? [...currentValue]
      : { ...(currentValue || {}) };
    cursor = cursor[key];
  });

  return next;
};

const toggleListValue = (values, path, value) => {
  const current = getField(values, path);
  const selected = Array.isArray(current) ? current : [];
  const next = selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];

  return setNestedValue(values, path, next);
};

const getSelectedServiceIds = (values) => {
  const primary = values.service.primaryProduct;
  const extras = Array.isArray(values.service.extraProducts)
    ? values.service.extraProducts
    : [];

  return [primary, ...extras.filter((id) => id && id !== primary)];
};

const formatServiceList = (serviceIds) =>
  serviceIds
    .map((id) => SERVICE_LABEL_BY_ID[id] || id)
    .filter(Boolean)
    .join(", ");

const formatReviewValue = (value, labelPath = "") => {
  if (Array.isArray(value)) {
    if (!value.length) return "";
    const labelMap = ARRAY_LABELS_BY_PATH[labelPath] || {};
    return value
      .map((item) => labelMap[item] || item)
      .join(", ");
  }

  if (labelPath === "service.primaryProduct") {
    return SERVICE_LABEL_BY_ID[value] || value;
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  return normalizeText(value);
};

const buildReviewSections = (values) => {
  const selectedServices = getSelectedServiceIds(values);
  const productSections = selectedServices
    .map((serviceId) => PRODUCT_REVIEW_SECTIONS[serviceId])
    .filter(Boolean);

  return [...REVIEW_SECTIONS.slice(0, 4), ...productSections, ...REVIEW_SECTIONS.slice(4)]
    .map((section) => ({
      ...section,
      rows: section.rows
        .map(([label, path]) => [label, formatReviewValue(getField(values, path), path)])
        .filter(([, value]) => hasMeaningfulValue(value)),
    }))
    .filter((section) => section.rows.length > 0);
};

const buildSetupChecklist = (selectedServiceIds, selectedIntegrationIds) =>
  [
    ...selectedServiceIds
      .map((serviceId) => SERVICE_OPTIONS.find((option) => option.id === serviceId)?.checklist)
      .filter(Boolean),
    ...selectedIntegrationIds
      .map((integrationId) => INTEGRATION_LABEL_BY_ID[integrationId])
      .filter(Boolean)
      .map((label) => `${label} setup review`),
    "Plain-language scope review",
    "Security and launch readiness review",
  ];

const summarizeSelectedDetails = (values, selectedServiceIds) =>
  selectedServiceIds
    .map((serviceId) => {
      const config = PRODUCT_REVIEW_SECTIONS[serviceId];
      if (!config) return "";

      const details = config.rows
        .map(([label, path]) => {
          const value = formatReviewValue(getField(values, path), path);
          return value ? `${label}: ${value}` : "";
        })
        .filter(Boolean)
        .join("; ");

      return details ? `${config.title}: ${details}` : "";
    })
    .filter(Boolean)
    .join("\n");

const validateStep = (stepId, values) => {
  if (stepId === "contact") {
    if (!normalizeText(values.contact.businessName)) return "Enter the business name.";
    if (!normalizeText(values.contact.name)) return "Enter the contact name.";
    if (!isValidEmail(values.contact.email)) return "Enter a valid contact email.";
  }

  if (stepId === "service") {
    if (!normalizeText(values.service.primaryProduct)) return "Choose the main service needed.";
    if (!normalizeText(values.service.projectReason)) {
      return "Tell us why you need this service now.";
    }
  }

  if (stepId === "business" && !normalizeText(values.business.painPoints)) {
    return "Tell us what feels slow, confusing, or hard to manage today.";
  }

  if (stepId === "details") {
    for (const serviceId of getSelectedServiceIds(values)) {
      const config = PRODUCT_DETAILS_CONFIG[serviceId];
      if (config?.requiredPath && !normalizeText(getField(values, config.requiredPath))) {
        return config.requiredMessage;
      }
    }
  }

  if (stepId === "launch" && !values.launch.consent) {
    return "Confirm that Faako can review your answers and contact you about next steps.";
  }

  return "";
};

const buildPayload = (values, honeypotValue) => {
  const selectedServiceIds = getSelectedServiceIds(values);
  const selectedServiceLabels = formatServiceList(selectedServiceIds);
  const selectedIntegrationIds = Array.isArray(values.integrations.selected)
    ? values.integrations.selected
    : [];
  const selectedIntegrationLabels = selectedIntegrationIds
    .map((id) => INTEGRATION_LABEL_BY_ID[id] || id)
    .filter(Boolean)
    .join(", ");
  const businessToolLabels = values.business.toolsUsed
    .map((id) => BUSINESS_TOOL_LABEL_BY_ID[id] || id)
    .filter(Boolean)
    .join(", ");
  const websitePageLabels = values.website.pagesNeeded
    .map((id) => WEBSITE_PAGE_LABEL_BY_ID[id] || id)
    .filter(Boolean)
    .join(", ");
  const websiteFeatureLabels = values.website.featuresNeeded
    .map((id) => WEBSITE_FEATURE_LABEL_BY_ID[id] || id)
    .filter(Boolean)
    .join(", ");
  const selectedDetailsSummary = summarizeSelectedDetails(values, selectedServiceIds);
  const currentWorkflow =
    normalizeText(values.business.painPoints) ||
    normalizeText(values.business.currentProcess) ||
    normalizeText(values.service.projectReason);

  const intake = {
    meta: {
      formType: "client-setup",
      formLabel: "Client setup form",
      version: "2026-06-client-setup",
    },
    contact: values.contact,
    service: {
      ...values.service,
      selectedServices: selectedServiceIds,
      selectedServiceLabels,
    },
    business: {
      ...values.business,
      toolsUsedLabels: businessToolLabels,
    },
    brand: values.brand,
    website: {
      ...values.website,
      pagesNeededLabels: websitePageLabels,
      featuresNeededLabels: websiteFeatureLabels,
    },
    portal: values.portal,
    shop: values.shop,
    dashboard: values.dashboard,
    operationsSystem: values.operationsSystem,
    automation: values.automation,
    integrations: {
      ...values.integrations,
      selectedIntegrationLabels,
    },
    launch: values.launch,
  };

  return {
    formType: "client-setup",
    formLabel: "Client setup form",
    companyName: normalizeText(values.contact.businessName),
    contactName: normalizeText(values.contact.name),
    email: normalizeText(values.contact.email).toLowerCase(),
    phone: normalizeText(values.contact.phoneWhatsapp),
    teamSize: normalizeText(values.business.teamSize),
    currency: "GHS",
    websiteUrl: normalizeText(values.business.currentWebsite),
    packageTier: "custom",
    requestedModules: selectedServiceIds,
    businessType: normalizeText(values.business.industry) || "not-specified",
    currentWorkflow,
    communicationChannels: [values.contact.preferredContactMethod].filter(Boolean),
    timelinePreference: normalizeText(values.launch.timeline),
    projectDetails: [
      `Services needed: ${selectedServiceLabels}`,
      `Reason: ${normalizeText(values.service.projectReason)}`,
      `Desired outcome: ${normalizeText(values.service.desiredOutcome)}`,
      `Shared content: ${normalizeText(values.brand.sharedContentLink)}`,
      `Colours/style: ${normalizeText(values.brand.colourScheme || values.brand.brandFeeling)}`,
      `Integrations: ${selectedIntegrationLabels}`,
      selectedDetailsSummary,
    ]
      .filter(Boolean)
      .join("\n"),
    painPoints: currentWorkflow,
    additionalNotes: normalizeText(values.launch.extraNotes),
    intake,
    setupChecklist: buildSetupChecklist(selectedServiceIds, selectedIntegrationIds),
    [HONEYPOT_FIELD_NAME]: normalizeText(honeypotValue),
  };
};

function TextField({
  label,
  path,
  values,
  onChange,
  required = false,
  type = "text",
  placeholder = "",
  autoComplete = "",
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={getField(values, path)}
        onChange={(event) => onChange(path, event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
      />
    </label>
  );
}

function TextAreaField({
  label,
  path,
  values,
  onChange,
  required = false,
  placeholder = "",
  rows = 4,
}) {
  return (
    <label>
      {label}
      <textarea
        value={getField(values, path)}
        onChange={(event) => onChange(path, event.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
      />
    </label>
  );
}

function SelectField({ label, path, values, onChange, options }) {
  return (
    <label>
      {label}
      <select value={getField(values, path)} onChange={(event) => onChange(path, event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGrid({ legend, help, options, values, path, onToggle }) {
  const selected = getField(values, path);

  return (
    <fieldset className="signup-choice-group">
      <legend>{legend}</legend>
      {help ? <p className="signup-help-text">{help}</p> : null}
      <div className="signup-chip-grid signup-chip-grid--wide">
        {options.map((option) => {
          const [id, label] = Array.isArray(option) ? option : [option, option];
          const checked = Array.isArray(selected) && selected.includes(id);

          return (
            <label key={id} className={`signup-chip ${checked ? "is-selected" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(path, id)}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function DescribedCheckboxGrid({ legend, help, options, values, path, onToggle }) {
  const selected = getField(values, path);

  return (
    <fieldset className="signup-choice-group">
      <legend>{legend}</legend>
      {help ? <p className="signup-help-text">{help}</p> : null}
      <div className="signup-module-grid">
        {options.map((option) => {
          const checked = Array.isArray(selected) && selected.includes(option.id);

          return (
            <label
              key={option.id}
              className={`signup-module-option ${checked ? "is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(path, option.id)}
              />
              <span className="signup-module-name">{option.label}</span>
              <span className="signup-module-description">{option.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PrimaryServicePicker({ values, onChange }) {
  const selected = values.service.primaryProduct;

  return (
    <fieldset className="signup-choice-group">
      <legend>Main service needed</legend>
      <p className="signup-help-text">
        Pick the closest match. You can add related services below.
      </p>
      <div className="signup-module-grid">
        {SERVICE_OPTIONS.map((option) => {
          const checked = selected === option.id;

          return (
            <label
              key={option.id}
              className={`signup-module-option ${checked ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="primaryProduct"
                checked={checked}
                onChange={() => onChange("service.primaryProduct", option.id)}
              />
              <span className="signup-module-name">{option.label}</span>
              <span className="signup-module-description">{option.summary}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ProductQuestionGroup({ config, values, onChange, onToggle }) {
  return (
    <article className="signup-review-card">
      <h3>{config.title}</h3>
      <p className="signup-help-text signup-help-text--strong">{config.intro}</p>
      <div className="signup-section">
        {config.fields.map((field) => {
          if (field.type === "select") {
            return (
              <SelectField
                key={field.path}
                label={field.label}
                path={field.path}
                values={values}
                onChange={onChange}
                options={field.options}
              />
            );
          }

          if (field.type === "checkbox") {
            return (
              <CheckboxGrid
                key={field.path}
                legend={field.legend}
                help={field.help}
                options={field.options}
                values={values}
                path={field.path}
                onToggle={onToggle}
              />
            );
          }

          if (field.type === "textarea") {
            return (
              <TextAreaField
                key={field.path}
                label={field.label}
                path={field.path}
                values={values}
                onChange={onChange}
                required={field.required}
                placeholder={field.placeholder}
                rows={field.rows || 4}
              />
            );
          }

          return (
            <TextField
              key={field.path}
              label={field.label}
              path={field.path}
              values={values}
              onChange={onChange}
              required={field.required}
              placeholder={field.placeholder}
              type={field.inputType || "text"}
            />
          );
        })}
      </div>
    </article>
  );
}

export default function ClientSetup() {
  const initialValues = useMemo(() => mergeDraft(DEFAULT_VALUES, loadDraft()), []);
  const [values, setValues] = useState(initialValues);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [honeypotValue, setHoneypotValue] = useState("");
  const [draftStatus, setDraftStatus] = useState(
    "Draft saves automatically on this device."
  );

  const activeStep = WIZARD_STEPS[activeStepIndex];
  const selectedServiceIds = getSelectedServiceIds(values);
  const reviewSections = useMemo(() => buildReviewSections(values), [values]);

  useEffect(() => {
    const saved = saveDraft(values);
    setDraftStatus(
      saved
        ? "Draft saved locally. It will stay here if you refresh before submitting."
        : "Draft auto-save is unavailable in this browser session."
    );
  }, [values]);

  const updateField = (path, value) => {
    setStatus((current) =>
      current.state === "loading" ? current : { state: "idle", message: "" }
    );

    setValues((current) => {
      const next = setNestedValue(current, path, value);
      if (path === "service.primaryProduct") {
        return setNestedValue(
          next,
          "service.extraProducts",
          next.service.extraProducts.filter((serviceId) => serviceId !== value)
        );
      }
      return next;
    });
  };

  const toggleFieldValue = (path, value) => {
    setStatus((current) =>
      current.state === "loading" ? current : { state: "idle", message: "" }
    );
    setValues((current) => toggleListValue(current, path, value));
  };

  const goToStep = (index) => {
    if (index < activeStepIndex) {
      setActiveStepIndex(index);
      return;
    }

    for (let cursor = 0; cursor < index; cursor += 1) {
      const error = validateStep(WIZARD_STEPS[cursor].id, values);
      if (error) {
        setActiveStepIndex(cursor);
        setStatus({ state: "error", message: error });
        return;
      }
    }

    setActiveStepIndex(index);
  };

  const goNext = () => {
    const error = validateStep(activeStep.id, values);
    if (error) {
      setStatus({ state: "error", message: error });
      return;
    }

    setStatus({ state: "idle", message: "" });
    setActiveStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  };

  const goBack = () => {
    setStatus({ state: "idle", message: "" });
    setActiveStepIndex((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    for (const step of WIZARD_STEPS) {
      if (step.id === "review") continue;
      const error = validateStep(step.id, values);
      if (error) {
        setActiveStepIndex(WIZARD_STEPS.findIndex((item) => item.id === step.id));
        setStatus({ state: "error", message: error });
        return;
      }
    }

    const payload = buildPayload(values, honeypotValue);

    setStatus({
      state: "loading",
      message: "Sending your setup answers to Faako...",
    });

    try {
      const response = await fetch(CLIENT_SETUP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          formType: payload.formType,
          formLabel: payload.formLabel,
          companyName: payload.companyName,
          contactName: payload.contactName,
          email: payload.email,
          phone: payload.phone,
          teamSize: payload.teamSize,
          currency: payload.currency,
          websiteUrl: payload.websiteUrl,
          packageTier: payload.packageTier,
          requestedModules: payload.requestedModules.join(", "),
          businessType: payload.businessType,
          currentWorkflow: payload.currentWorkflow,
          painPoints: payload.painPoints,
          projectDetails: payload.projectDetails,
          timelinePreference: payload.timelinePreference,
          communicationChannels: payload.communicationChannels.join(", "),
          additionalNotes: payload.additionalNotes,
          intake: payload.intake,
          setupChecklist: payload.setupChecklist,
        }),
      });

      const result = await response.json();

      if (!response.ok || result?.ok === false) {
        throw new Error(
          result?.errors?.[0]?.message ||
            result?.error ||
            "Could not submit the client setup form. Please try again."
        );
      }

      clearDraft();
      setValues(deepClone(DEFAULT_VALUES));
      setHoneypotValue("");
      setActiveStepIndex(0);
      setDraftStatus("Draft cleared after successful submission.");
      setStatus({
        state: "success",
        message:
          "Client setup form submitted. Faako will review it and follow up with next steps.",
      });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error.message || "Could not submit the client setup form. Please try again.",
      });
    }
  };

  return (
    <section className="page signup signup-page auth-suite auth-suite--signup">
      <div className="auth-suite-shell">
        <section className="auth-suite-panel signup-wizard-hero">
          <div className="auth-suite-kicker signup-wizard-kicker">
            <div className="signup-icon-badge">
              <img
                className="signup-icon-logo"
                src="/assets/logos/logo-white.png"
                alt="Faako logo"
                loading="lazy"
              />
            </div>
            <span>Client setup form</span>
          </div>
          <h1>Help us understand what you need before we plan the work.</h1>
          <p className="lead">
            This short wizard asks simple questions about the service you need.
            Your follow-up questions change based on whether you choose a
            website, portal, shop, dashboard, business system, or automation.
          </p>
          <ul className="auth-suite-points">
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Plain-language questions with no technical setup required.
            </li>
            <li>
              <FontAwesomeIcon icon={faUsers} />
              Product-specific follow-ups help Faako plan the right scope.
            </li>
            <li>
              <FontAwesomeIcon icon={faShieldHalved} />
              Do not enter passwords, API keys, tokens, or private banking details.
            </li>
          </ul>
          <div className="auth-suite-tags">
            <span>
              <FontAwesomeIcon icon={faBuilding} />
              Service scope
            </span>
            <span>
              <FontAwesomeIcon icon={faBolt} />
              Setup planning
            </span>
          </div>
        </section>

        <section className="signup-shell signup-wizard-shell">
          <div className="signup-form-side">
            <div className="signup-wizard-progress" aria-label="Client setup progress">
              {WIZARD_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  className={`signup-wizard-step ${
                    index === activeStepIndex ? "is-active" : ""
                  } ${index < activeStepIndex ? "is-complete" : ""}`}
                  onClick={() => goToStep(index)}
                >
                  <span>{index + 1}</span>
                  <strong>{step.title}</strong>
                </button>
              ))}
            </div>

            <form
              className="form signup-form signup-wizard-form"
              onSubmit={handleSubmit}
              action={CLIENT_SETUP_ENDPOINT}
              method="POST"
            >
              <div className="signup-hidden-field" aria-hidden="true">
                <label htmlFor={HONEYPOT_FIELD_NAME}>Leave this field empty</label>
                <input
                  id={HONEYPOT_FIELD_NAME}
                  name={HONEYPOT_FIELD_NAME}
                  type="text"
                  value={honeypotValue}
                  onChange={(event) => setHoneypotValue(event.target.value)}
                  tabIndex={-1}
                  autoComplete="new-password"
                />
              </div>

              <div className="signup-wizard-card">
                <div className="signup-wizard-card-head">
                  <p className="signup-wizard-count">
                    Step {activeStepIndex + 1} of {WIZARD_STEPS.length}
                  </p>
                  <h2>{activeStep.title}</h2>
                </div>

                {activeStep.id === "contact" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <TextField
                        label="Business name"
                        path="contact.businessName"
                        values={values}
                        onChange={updateField}
                        required
                        autoComplete="organization"
                      />
                      <TextField
                        label="Your name"
                        path="contact.name"
                        values={values}
                        onChange={updateField}
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField
                        label="Your role"
                        path="contact.roleTitle"
                        values={values}
                        onChange={updateField}
                        placeholder="Owner, manager, project lead..."
                      />
                      <SelectField
                        label="Best way to reach you"
                        path="contact.preferredContactMethod"
                        values={values}
                        onChange={updateField}
                        options={["WhatsApp", "Phone", "Email", "SMS"]}
                      />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField
                        label="Email"
                        path="contact.email"
                        values={values}
                        onChange={updateField}
                        type="email"
                        required
                        autoComplete="email"
                      />
                      <TextField
                        label="Phone / WhatsApp"
                        path="contact.phoneWhatsapp"
                        values={values}
                        onChange={updateField}
                        type="tel"
                        autoComplete="tel"
                      />
                    </div>
                  </section>
                ) : null}

                {activeStep.id === "service" ? (
                  <section className="signup-section">
                    <PrimaryServicePicker values={values} onChange={updateField} />
                    <CheckboxGrid
                      legend="Related services to consider"
                      help="Optional. Add anything that may be part of the same project."
                      options={SERVICE_OPTIONS.filter(
                        (option) => option.id !== values.service.primaryProduct
                      ).map((option) => [option.id, option.label])}
                      values={values}
                      path="service.extraProducts"
                      onToggle={toggleFieldValue}
                    />
                    <TextAreaField
                      label="Why do you need this service now?"
                      path="service.projectReason"
                      values={values}
                      onChange={updateField}
                      required
                      placeholder="What changed, what is missing, or what are you trying to improve?"
                    />
                    <TextAreaField
                      label="What would make this project successful?"
                      path="service.desiredOutcome"
                      values={values}
                      onChange={updateField}
                      placeholder="More enquiries, fewer manual steps, better customer experience, clearer reports..."
                    />
                  </section>
                ) : null}

                {activeStep.id === "business" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <TextField
                        label="Business type / industry"
                        path="business.industry"
                        values={values}
                        onChange={updateField}
                        placeholder="Retail, services, food, school, logistics..."
                      />
                      <TextField
                        label="Current website or social page"
                        path="business.currentWebsite"
                        values={values}
                        onChange={updateField}
                        placeholder="Optional link"
                      />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField
                        label="Who do you serve?"
                        path="business.customerType"
                        values={values}
                        onChange={updateField}
                        placeholder="Consumers, businesses, students, members..."
                      />
                      <TextField
                        label="Team size"
                        path="business.teamSize"
                        values={values}
                        onChange={updateField}
                        placeholder="e.g. 5 staff"
                      />
                    </div>
                    <CheckboxGrid
                      legend="Tools you currently use"
                      help="Select the tools or places where business information lives today."
                      options={BUSINESS_TOOL_OPTIONS}
                      values={values}
                      path="business.toolsUsed"
                      onToggle={toggleFieldValue}
                    />
                    <TextAreaField
                      label="Other current tools or important details"
                      path="business.currentTools"
                      values={values}
                      onChange={updateField}
                      placeholder="Add anything not listed above, or explain how those tools are being used."
                    />
                    <TextAreaField
                      label="How does the work happen today?"
                      path="business.currentProcess"
                      values={values}
                      onChange={updateField}
                      placeholder="A quick step-by-step is enough. No need for technical detail."
                    />
                    <TextAreaField
                      label="What feels slow, confusing, or hard to manage?"
                      path="business.painPoints"
                      values={values}
                      onChange={updateField}
                      required
                      placeholder="Missed enquiries, hard-to-track payments, manual reports, unclear stock..."
                    />
                  </section>
                ) : null}

                {activeStep.id === "brand" ? (
                  <section className="signup-section">
                    <p className="signup-secure-note">
                      If you already have logos, photos, copy, menus, brochures,
                      brand guides, or product lists, share a Google Drive or folder link.
                      Make sure the link is viewable by Faako.
                    </p>
                    <TextField
                      label="Google Drive or shared folder link"
                      path="brand.sharedContentLink"
                      values={values}
                      onChange={updateField}
                      type="url"
                      placeholder="https://drive.google.com/..."
                    />
                    <div className="signup-grid signup-grid--two">
                      <TextField
                        label="Colour scheme or brand colours"
                        path="brand.colourScheme"
                        values={values}
                        onChange={updateField}
                        placeholder="Green and gold, black/white, #0f3d35..."
                      />
                      <SelectField
                        label="Logo status"
                        path="brand.logoStatus"
                        values={values}
                        onChange={updateField}
                        options={["Will share later", "Already available", "Needs cleanup", "Needs design support", "Not sure"]}
                      />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField
                        label="How should the design feel?"
                        path="brand.brandFeeling"
                        values={values}
                        onChange={updateField}
                        placeholder="Clean, premium, friendly, bold, corporate..."
                      />
                      <TextField
                        label="Who will provide content?"
                        path="brand.contentOwner"
                        values={values}
                        onChange={updateField}
                        placeholder="Me, my team, Faako support, not sure..."
                      />
                    </div>
                    <TextAreaField
                      label="Anything the design should avoid?"
                      path="brand.mustAvoid"
                      values={values}
                      onChange={updateField}
                      placeholder="Colours, styles, wording, layouts, or examples you do not like."
                    />
                    <TextAreaField
                      label="Content notes"
                      path="brand.contentNotes"
                      values={values}
                      onChange={updateField}
                      placeholder="Important files in the folder, missing photos, copy that still needs writing, preferred image style..."
                    />
                  </section>
                ) : null}

                {activeStep.id === "details" ? (
                  <section className="signup-section">
                    <p className="signup-secure-note">
                      These questions are based on what you selected. Short answers
                      are fine. Faako can clarify details with you later.
                    </p>
                    <div className="signup-review-grid">
                      {selectedServiceIds.map((serviceId) => (
                        <ProductQuestionGroup
                          key={serviceId}
                          config={PRODUCT_DETAILS_CONFIG[serviceId]}
                          values={values}
                          onChange={updateField}
                          onToggle={toggleFieldValue}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeStep.id === "integrations" ? (
                  <section className="signup-section">
                    <p className="signup-secure-note">
                      Select anything you may want connected or prepared. You do
                      not need to have accounts ready, and you should not enter
                      passwords, API keys, or tokens here.
                    </p>
                    <DescribedCheckboxGrid
                      legend="Integration and setup options"
                      help="Each option includes a short description so it is easier to choose."
                      options={INTEGRATION_OPTIONS}
                      values={values}
                      path="integrations.selected"
                      onToggle={toggleFieldValue}
                    />
                    <TextAreaField
                      label="Existing accounts or tools for these options"
                      path="integrations.existingAccounts"
                      values={values}
                      onChange={updateField}
                      placeholder="Paystack account pending, Google Analytics already exists, WhatsApp Business number available..."
                    />
                    <TextAreaField
                      label="Anything else about integrations?"
                      path="integrations.integrationNotes"
                      values={values}
                      onChange={updateField}
                      placeholder="What should connect, what should be measured, or what you are unsure about."
                    />
                  </section>
                ) : null}

                {activeStep.id === "launch" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <SelectField
                        label="When would you like to start?"
                        path="launch.timeline"
                        values={values}
                        onChange={updateField}
                        options={["Immediately", "Within 30 days", "1-3 months", "3+ months", "Not sure"]}
                      />
                      <SelectField
                        label="Budget comfort"
                        path="launch.budgetComfort"
                        values={values}
                        onChange={updateField}
                        options={["Need guidance", "Starter scope", "Standard project", "Larger build", "Not ready to discuss"]}
                      />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <SelectField
                        label="Is the decision maker available?"
                        path="launch.hasDecisionMaker"
                        values={values}
                        onChange={updateField}
                        options={["Yes", "No", "I am the decision maker", "Not sure"]}
                      />
                      <SelectField
                        label="Are brand files, photos, or content ready?"
                        path="launch.filesReady"
                        values={values}
                        onChange={updateField}
                        options={["Yes", "Some files are ready", "No", "Need help"]}
                      />
                    </div>
                    <TextField
                      label="Best time to contact you"
                      path="launch.bestTimeToContact"
                      values={values}
                      onChange={updateField}
                      placeholder="Weekday mornings, after 3pm, WhatsApp first..."
                    />
                    <TextAreaField
                      label="Anything else we should know?"
                      path="launch.extraNotes"
                      values={values}
                      onChange={updateField}
                      placeholder="Special deadlines, preferred style, must-have features, people to include..."
                    />
                    <p className="signup-secure-note">
                      Please do not enter passwords, API keys, tokens, private
                      email credentials, or bank login details in this form.
                    </p>
                    <label className={`signup-chip signup-consent ${values.launch.consent ? "is-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={values.launch.consent}
                        onChange={(event) => updateField("launch.consent", event.target.checked)}
                      />
                      <span>Faako may review these answers and contact me about next steps.</span>
                    </label>
                  </section>
                ) : null}

                {activeStep.id === "review" ? (
                  <section className="signup-section">
                    <p className="signup-help-text signup-help-text--strong">
                      Review your answers before submitting. Faako will use this
                      to prepare a clearer setup conversation.
                    </p>
                    <div className="signup-review-grid">
                      {reviewSections.map((section) => (
                        <article className="signup-review-card" key={section.title}>
                          <h3>{section.title}</h3>
                          <dl>
                            {section.rows.map(([label, value]) => (
                              <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="signup-wizard-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={goBack}
                  disabled={activeStepIndex === 0 || status.state === "loading"}
                >
                  Back
                </button>
                {activeStep.id === "review" ? (
                  <button
                    className="button button-primary signup-submit"
                    type="submit"
                    disabled={status.state === "loading"}
                  >
                    {status.state === "loading" ? "Submitting..." : "Submit setup form"}
                  </button>
                ) : (
                  <button
                    className="button button-primary signup-submit"
                    type="button"
                    onClick={goNext}
                    disabled={status.state === "loading"}
                  >
                    Continue
                  </button>
                )}
              </div>

              {status.message ? (
                <div
                  className={`signup-status-panel signup-status-panel--${status.state}`}
                  role="status"
                  aria-live="polite"
                  aria-busy={status.state === "loading"}
                >
                  <div className="signup-status-indicator" aria-hidden="true">
                    {status.state === "loading" ? (
                      <span className="signup-status-spinner" />
                    ) : (
                      <span className="signup-status-symbol">
                        {status.state === "success" ? "✓" : "!"}
                      </span>
                    )}
                  </div>
                  <div className="signup-status-copy">
                    <p className="signup-status-title">
                      {status.state === "loading"
                        ? "Submitting setup form"
                        : status.state === "success"
                          ? "Client setup form received"
                          : "Submission failed"}
                    </p>
                    <p className="signup-status-message">{status.message}</p>
                  </div>
                </div>
              ) : (
                <p className="form-note signup-draft-note">
                  <span>{draftStatus}</span>
                  <span>
                    We review every setup form manually. Sensitive credentials are handled later through secure setup.
                  </span>
                </p>
              )}
            </form>
          </div>
        </section>
      </div>
    </section>
  );
}
