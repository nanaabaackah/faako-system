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

const SIGNUP_DRAFT_STORAGE_KEY = "faako-onboarding-intake-draft-v1";
const HONEYPOT_FIELD_NAME = "companyFax";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveApiEndpoint = (path) => {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (!configuredBaseUrl) return `/api/${normalizedPath}`;
  if (/^https?:\/\//i.test(configuredBaseUrl)) {
    return new URL(normalizedPath, `${configuredBaseUrl}/`).toString();
  }

  return `/${configuredBaseUrl.replace(/^\/+/, "")}/${normalizedPath}`;
};

const SIGNUP_ENDPOINT = "https://formspree.io/f/xojnpypr";

const WIZARD_STEPS = [
  { id: "company", title: "Company Details" },
  { id: "contact", title: "Primary Contact" },
  { id: "operations", title: "Business Operations" },
  { id: "modules", title: "Apps / Modules" },
  { id: "payments", title: "Payment Preferences" },
  { id: "communications", title: "Communication" },
  { id: "domain", title: "Domain & Email" },
  { id: "admins", title: "Admin Users" },
  { id: "security", title: "Security Review" },
  { id: "review", title: "Review & Submit" },
];

const MODULE_OPTIONS = [
  ["website", "Website"],
  ["shop-storefront", "Shop / Storefront"],
  ["inventory", "Inventory"],
  ["orders", "Orders"],
  ["payments", "Payments"],
  ["receipts", "Receipts"],
  ["crm-customers", "CRM / Customers"],
  ["accounting-finance", "Accounting / Finance"],
  ["delivery-fulfillment", "Delivery / Fulfillment"],
  ["directory-team", "Directory / Team"],
  ["reports-analytics", "Reports / Analytics"],
  ["bookings", "Bookings"],
  ["proposal-generator", "Proposal Generator"],
  ["notifications", "Notifications"],
  ["documents", "Documents"],
  ["maintenance-support", "Maintenance / Support"],
];

const PAYMENT_PROVIDER_OPTIONS = [
  "Paystack",
  "Hubtel",
  "Flutterwave",
  "Stripe",
  "Manual",
  "Not sure",
];

const PAYMENT_METHOD_OPTIONS = [
  ["momo", "MoMo"],
  ["card", "Card"],
  ["bank-transfer", "Bank transfer"],
  ["cash", "Cash"],
  ["international-payments", "International payments"],
];

const PAYMENT_TYPE_OPTIONS = [
  ["product-purchases", "Product purchases"],
  ["invoices", "Invoices"],
  ["bookings", "Bookings"],
  ["deposits", "Deposits"],
  ["subscriptions", "Subscriptions"],
  ["service-payments", "Service payments"],
];

const NOTIFICATION_CHANNEL_OPTIONS = [
  ["email", "Email"],
  ["whatsapp", "WhatsApp"],
  ["sms", "SMS"],
  ["in-app-admin", "In-app/admin only"],
];

const NOTIFICATION_TYPE_OPTIONS = [
  ["order-confirmation", "Order confirmation"],
  ["payment-receipt", "Payment receipt"],
  ["booking-reminder", "Booking reminder"],
  ["delivery-update", "Delivery update"],
  ["low-stock-alert", "Low stock alert"],
  ["admin-alert", "Admin alert"],
  ["proposal-invoice-update", "Proposal/invoice update"],
];

const DESIRED_EMAIL_OPTIONS = ["info@", "hello@", "support@", "sales@", "admin@"];

const ADMIN_ROLE_OPTIONS = [
  ["owner", "Owner"],
  ["manager", "Manager"],
  ["sales", "Sales"],
  ["inventory", "Inventory"],
  ["accountant", "Accountant"],
  ["delivery", "Delivery"],
  ["viewer", "Viewer"],
];

const YES_NO_UNSURE = ["Yes", "No", "Not sure"];

const DEFAULT_VALUES = {
  company: {
    businessName: "",
    legalBusinessName: "",
    industry: "",
    country: "Ghana",
    city: "",
    address: "",
    mainPhone: "",
    mainEmail: "",
    websiteDomain: "",
    currency: "GHS",
    timezone: "Africa/Accra",
    registrationNumber: "",
    logoStatus: "Will share later",
  },
  contact: {
    name: "",
    roleTitle: "",
    email: "",
    phoneWhatsapp: "",
    preferredContactMethod: "WhatsApp",
  },
  operations: {
    offerings: "",
    staffCount: "",
    branchCount: "",
    currentTools: "",
    workflowProblems: "",
    launchTimeline: "Within 30 days",
    priorityGoals: "",
  },
  modules: {
    selected: ["website", "shop-storefront", "payments"],
    customNotes: "",
  },
  payments: {
    acceptsOnlinePayments: "Not sure",
    preferredProvider: "Paystack",
    methods: ["momo", "card", "bank-transfer"],
    paystackAccountStatus: "Not sure",
    providerBusinessEmail: "",
    settlementCountry: "Ghana",
    defaultCurrency: "GHS",
    paymentTypes: ["product-purchases", "invoices"],
    notificationPreference: "Email and WhatsApp",
  },
  communications: {
    mainBusinessEmail: "",
    preferredSendingEmail: "",
    supportEmail: "",
    existingEmailProvider: "Not sure",
    needsBusinessEmailSetup: "Not sure",
    whatsappNumber: "",
    whatsappDisplayName: "",
    whatsappCategory: "",
    smsNeeded: "Not sure",
    customerNotificationChannels: ["email", "whatsapp"],
    notificationTypes: ["order-confirmation", "payment-receipt", "admin-alert"],
  },
  domain: {
    hasDomain: "Not sure",
    domainName: "",
    domainProvider: "Not sure",
    hasBusinessEmail: "Not sure",
    desiredEmailAddresses: ["info@", "support@"],
    needsHostingSetup: "Not sure",
    currentWebsiteUrl: "",
  },
  admins: {
    ownerName: "",
    ownerEmail: "",
    staffAccountsNeeded: "",
    rolesNeeded: ["owner", "manager", "viewer"],
  },
  security: {
    roleBasedAccess: "Not sure",
    auditLogs: "Not sure",
    handlesPersonalData: "Yes",
    handlesOnlinePayments: "Not sure",
    backups: "Yes",
    privacyConcerns: "",
    consent: false,
  },
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const normalizeText = (value) => String(value || "").trim();

const isValidEmail = (value) => EMAIL_PATTERN.test(normalizeText(value).toLowerCase());

const parseJsonObject = (value) => {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const buildFormBody = (payload) => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(payload)) {
    if (value === null || typeof value === "undefined") continue;
    if (typeof value === "object") {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  }

  return params;
};

const loadDraft = () => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const mergeDraft = (defaults, draft) => {
  if (!draft || typeof draft !== "object") return deepClone(defaults);
  const next = deepClone(defaults);

  for (const [sectionKey, sectionValue] of Object.entries(defaults)) {
    const incomingSection = draft[sectionKey];
    if (!incomingSection || typeof incomingSection !== "object") continue;

    for (const [fieldKey, fallbackValue] of Object.entries(sectionValue)) {
      const incomingValue = incomingSection[fieldKey];
      if (Array.isArray(fallbackValue)) {
        next[sectionKey][fieldKey] = Array.isArray(incomingValue)
          ? incomingValue.filter((item) => typeof item === "string")
          : fallbackValue;
      } else if (typeof fallbackValue === "boolean") {
        next[sectionKey][fieldKey] = typeof incomingValue === "boolean"
          ? incomingValue
          : fallbackValue;
      } else if (typeof incomingValue === "string") {
        next[sectionKey][fieldKey] = incomingValue;
      }
    }
  }

  return next;
};

const clearDraft = () => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
    } catch {
      // Local storage can be unavailable in private or locked-down browser modes.
    }
  }
};

const saveDraft = (values) => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SIGNUP_DRAFT_STORAGE_KEY, JSON.stringify(values));
      return true;
    } catch {
      return false;
    }
  }

  return false;
};

const setNestedValue = (values, path, value) => {
  const [section, field] = path.split(".");
  return {
    ...values,
    [section]: {
      ...values[section],
      [field]: value,
    },
  };
};

const toggleListValue = (values, path, value) => {
  const [section, field] = path.split(".");
  const current = Array.isArray(values[section][field]) ? values[section][field] : [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

  return setNestedValue(values, path, next);
};

const getField = (values, path) => {
  const [section, field] = path.split(".");
  return values?.[section]?.[field] ?? "";
};

const buildReviewSections = (values) => [
  {
    title: "Company Details",
    rows: [
      ["Business name", values.company.businessName],
      ["Legal name", values.company.legalBusinessName],
      ["Industry", values.company.industry],
      ["Location", [values.company.city, values.company.country].filter(Boolean).join(", ")],
      ["Address", values.company.address],
      ["Main phone", values.company.mainPhone],
      ["Main email", values.company.mainEmail],
      ["Website/domain", values.company.websiteDomain],
      ["Currency", values.company.currency],
      ["Timezone", values.company.timezone],
      ["Registration number", values.company.registrationNumber],
      ["Logo", values.company.logoStatus],
    ],
  },
  {
    title: "Primary Contact",
    rows: [
      ["Name", values.contact.name],
      ["Role/title", values.contact.roleTitle],
      ["Email", values.contact.email],
      ["Phone/WhatsApp", values.contact.phoneWhatsapp],
      ["Preferred method", values.contact.preferredContactMethod],
    ],
  },
  {
    title: "Business Operations",
    rows: [
      ["Sells/provides", values.operations.offerings],
      ["Staff/users", values.operations.staffCount],
      ["Branches/locations", values.operations.branchCount],
      ["Current tools", values.operations.currentTools],
      ["Workflow problems", values.operations.workflowProblems],
      ["Launch timeline", values.operations.launchTimeline],
      ["Priority goals", values.operations.priorityGoals],
    ],
  },
  {
    title: "Required Apps / Modules",
    rows: [
      ["Selected modules", values.modules.selected.join(", ")],
      ["Custom notes", values.modules.customNotes],
    ],
  },
  {
    title: "Payment Preferences",
    rows: [
      ["Accepts online payments", values.payments.acceptsOnlinePayments],
      ["Preferred provider", values.payments.preferredProvider],
      ["Payment methods", values.payments.methods.join(", ")],
      ["Paystack account", values.payments.paystackAccountStatus],
      ["Provider business email", values.payments.providerBusinessEmail],
      ["Settlement country", values.payments.settlementCountry],
      ["Default currency", values.payments.defaultCurrency],
      ["Payment types", values.payments.paymentTypes.join(", ")],
      ["Payment notifications", values.payments.notificationPreference],
    ],
  },
  {
    title: "Communication Preferences",
    rows: [
      ["Main business email", values.communications.mainBusinessEmail],
      ["Preferred sending email", values.communications.preferredSendingEmail],
      ["Support email", values.communications.supportEmail],
      ["Email provider", values.communications.existingEmailProvider],
      ["Needs business email setup", values.communications.needsBusinessEmailSetup],
      ["WhatsApp number", values.communications.whatsappNumber],
      ["WhatsApp display name", values.communications.whatsappDisplayName],
      ["WhatsApp category", values.communications.whatsappCategory],
      ["SMS needed", values.communications.smsNeeded],
      ["Customer channels", values.communications.customerNotificationChannels.join(", ")],
      ["Notification types", values.communications.notificationTypes.join(", ")],
    ],
  },
  {
    title: "Domain & Email Details",
    rows: [
      ["Has domain", values.domain.hasDomain],
      ["Domain name", values.domain.domainName],
      ["Domain provider", values.domain.domainProvider],
      ["Has business email", values.domain.hasBusinessEmail],
      ["Desired emails", values.domain.desiredEmailAddresses.join(", ")],
      ["Needs hosting setup", values.domain.needsHostingSetup],
      ["Current website", values.domain.currentWebsiteUrl],
    ],
  },
  {
    title: "Admin Users",
    rows: [
      ["Owner/admin name", values.admins.ownerName],
      ["Owner/admin email", values.admins.ownerEmail],
      ["Staff accounts needed", values.admins.staffAccountsNeeded],
      ["Roles needed", values.admins.rolesNeeded.join(", ")],
    ],
  },
  {
    title: "Security & Compliance",
    rows: [
      ["Role-based access", values.security.roleBasedAccess],
      ["Audit logs", values.security.auditLogs],
      ["Handles personal data", values.security.handlesPersonalData],
      ["Handles online payments", values.security.handlesOnlinePayments],
      ["Backups", values.security.backups],
      ["Data/privacy concerns", values.security.privacyConcerns],
    ],
  },
];

const validateStep = (stepId, values) => {
  if (stepId === "company") {
    if (!normalizeText(values.company.businessName)) return "Enter the business name.";
    if (!isValidEmail(values.company.mainEmail)) return "Enter a valid main business email.";
  }
  if (stepId === "contact") {
    if (!normalizeText(values.contact.name)) return "Enter the primary contact name.";
    if (!isValidEmail(values.contact.email)) return "Enter a valid primary contact email.";
  }
  if (stepId === "operations") {
    if (!normalizeText(values.operations.offerings)) return "Tell us what the business sells or provides.";
    if (!normalizeText(values.operations.workflowProblems)) return "Add the current workflow problems.";
  }
  if (stepId === "modules" && values.modules.selected.length === 0) {
    return "Select at least one app or module.";
  }
  if (stepId === "payments" && values.payments.methods.length === 0) {
    return "Select at least one payment method or choose Manual.";
  }
  if (
    stepId === "communications" &&
    values.communications.customerNotificationChannels.length === 0
  ) {
    return "Select at least one customer notification channel.";
  }
  if (stepId === "admins" && values.admins.ownerEmail && !isValidEmail(values.admins.ownerEmail)) {
    return "Enter a valid owner/admin email.";
  }
  if (stepId === "security" && !values.security.consent) {
    return "Confirm that Faako will review setup and security before launch.";
  }

  return "";
};

const buildPayload = (values, honeypotValue) => {
  const contactEmail = normalizeText(values.contact.email).toLowerCase();
  const companyEmail = normalizeText(values.company.mainEmail).toLowerCase();
  const selectedModules = values.modules.selected;
  const setupChecklist = [
    values.payments.acceptsOnlinePayments !== "No" ? "Paystack/payment setup review" : null,
    values.communications.preferredSendingEmail || values.communications.mainBusinessEmail
      ? "Resend/email sending setup review"
      : null,
    values.communications.whatsappNumber ? "WhatsApp Business setup review" : null,
    values.communications.smsNeeded === "Yes" ? "SMS provider setup review" : null,
    values.domain.hasDomain !== "No" ? "Domain/DNS setup review" : null,
    values.domain.needsHostingSetup !== "No" ? "Hosting/deployment setup review" : null,
    selectedModules.length ? "Module enablement planning" : null,
    values.admins.staffAccountsNeeded ? "Admin user creation planning" : null,
    "Security and privacy launch review",
  ].filter(Boolean);

  return {
    onboardingVersion: "2026-05-client-intake",
    companyName: normalizeText(values.company.businessName),
    contactName: normalizeText(values.contact.name),
    email: contactEmail || companyEmail,
    phone: normalizeText(values.contact.phoneWhatsapp || values.company.mainPhone),
    teamSize: normalizeText(values.operations.staffCount),
    currency: normalizeText(values.company.currency || values.payments.defaultCurrency),
    websiteUrl: normalizeText(values.company.websiteDomain || values.domain.currentWebsiteUrl),
    packageTier: "enterprise",
    requestedModules: selectedModules,
    communicationChannels: values.communications.customerNotificationChannels,
    businessType: "both",
    timelinePreference: "exploring",
    currentWorkflow: normalizeText(values.operations.workflowProblems),
    painPoints: normalizeText(values.operations.workflowProblems),
    projectDetails: normalizeText(values.operations.priorityGoals),
    additionalNotes: normalizeText(values.modules.customNotes),
    intake: values,
    setupChecklist,
    [HONEYPOT_FIELD_NAME]: normalizeText(honeypotValue),
  };
};

function TextField({ label, path, values, onChange, required = false, type = "text", placeholder = "", autoComplete = "" }) {
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

function TextAreaField({ label, path, values, onChange, required = false, placeholder = "", rows = 4 }) {
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

export default function Signup() {
  const initialValues = useMemo(() => mergeDraft(DEFAULT_VALUES, loadDraft()), []);
  const [values, setValues] = useState(initialValues);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [honeypotValue, setHoneypotValue] = useState("");
  const [draftStatus, setDraftStatus] = useState(
    "Draft saves automatically on this device."
  );

  const activeStep = WIZARD_STEPS[activeStepIndex];
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
    setValues((current) => setNestedValue(current, path, value));
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
      message: "Creating your onboarding summary and sending copies...",
    });

    const response = await fetch(SIGNUP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        companyName: payload.companyName,
        contactName: payload.contactName,
        email: payload.email,
        phone: payload.phone,
        teamSize: payload.teamSize,
        packageTier: payload.packageTier,
        requestedModules: payload.requestedModules.join(", "),
        currentWorkflow: payload.currentWorkflow,
        painPoints: payload.painPoints,
        projectDetails: payload.projectDetails,
        launchTimeline: payload.intake?.operations?.launchTimeline,
        preferredProvider: payload.intake?.payments?.preferredProvider,
        communicationChannels: payload.communicationChannels.join(", "),
        setupChecklist: payload.setupChecklist.join(", "),
      }),
    });

    const result = await response.json();

    if (!response.ok || result?.ok === false) {
      throw new Error(
        result?.errors?.[0]?.message ||
        "Could not submit onboarding intake. Please try again."
      );
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
            <span>Client onboarding intake</span>
          </div>
          <h1>Tell us what your business needs before setup starts.</h1>
          <p className="lead">
            This guided intake collects the business details Faako needs to plan
            your website, shop, operations tools, and launch setup. Do not enter
            API keys, passwords, tokens, or private banking credentials here.
          </p>
          <ul className="auth-suite-points">
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              We collect business setup details, not private integration secrets.
            </li>
            <li>
              <FontAwesomeIcon icon={faUsers} />
              You get a PDF copy of your responses after submission.
            </li>
            <li>
              <FontAwesomeIcon icon={faShieldHalved} />
              Final security, payment, email, and integration setup is reviewed
              by Faako before launch.
            </li>
          </ul>
          <div className="auth-suite-tags">
            <span>
              <FontAwesomeIcon icon={faBuilding} />
              Business profile
            </span>
            <span>
              <FontAwesomeIcon icon={faBolt} />
              Setup planning
            </span>
          </div>
        </section>

        <section className="signup-shell signup-wizard-shell">
          <div className="signup-form-side">
            <div className="signup-wizard-progress" aria-label="Onboarding progress">
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
              action={SIGNUP_ENDPOINT}
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

                {activeStep.id === "company" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Business name" path="company.businessName" values={values} onChange={updateField} required />
                      <TextField label="Legal business name if different" path="company.legalBusinessName" values={values} onChange={updateField} />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Business type / industry" path="company.industry" values={values} onChange={updateField} placeholder="Retail, food service, travel, services..." />
                      <TextField label="Business registration number" path="company.registrationNumber" values={values} onChange={updateField} placeholder="Optional" />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Country" path="company.country" values={values} onChange={updateField} />
                      <TextField label="City" path="company.city" values={values} onChange={updateField} />
                    </div>
                    <TextAreaField label="Business address" path="company.address" values={values} onChange={updateField} rows={3} />
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Main phone" path="company.mainPhone" values={values} onChange={updateField} type="tel" />
                      <TextField label="Main email" path="company.mainEmail" values={values} onChange={updateField} type="email" required />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Website/domain if any" path="company.websiteDomain" values={values} onChange={updateField} placeholder="example.com" />
                      <TextField label="Timezone" path="company.timezone" values={values} onChange={updateField} />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Currency" path="company.currency" values={values} onChange={updateField} />
                      <SelectField label="Logo" path="company.logoStatus" values={values} onChange={updateField} options={["Will share later", "Already available", "Needs design support"]} />
                    </div>
                  </section>
                ) : null}

                {activeStep.id === "contact" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Contact name" path="contact.name" values={values} onChange={updateField} required />
                      <TextField label="Role/title" path="contact.roleTitle" values={values} onChange={updateField} />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Email" path="contact.email" values={values} onChange={updateField} type="email" required />
                      <TextField label="Phone / WhatsApp" path="contact.phoneWhatsapp" values={values} onChange={updateField} type="tel" />
                    </div>
                    <SelectField label="Preferred contact method" path="contact.preferredContactMethod" values={values} onChange={updateField} options={["WhatsApp", "Phone", "Email", "SMS"]} />
                  </section>
                ) : null}

                {activeStep.id === "operations" ? (
                  <section className="signup-section">
                    <TextAreaField label="What does the business sell or provide?" path="operations.offerings" values={values} onChange={updateField} required placeholder="Products, services, rentals, bookings, consulting..." />
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Number of staff/users" path="operations.staffCount" values={values} onChange={updateField} placeholder="e.g. 8" />
                      <TextField label="Branches/locations" path="operations.branchCount" values={values} onChange={updateField} placeholder="e.g. 1 branch" />
                    </div>
                    <TextAreaField label="Current tools used" path="operations.currentTools" values={values} onChange={updateField} placeholder="Excel, WhatsApp, paper records, Shopify, POS app..." />
                    <TextAreaField label="Current workflow problems" path="operations.workflowProblems" values={values} onChange={updateField} required placeholder="What is slow, manual, or hard to track today?" />
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Expected launch timeline" path="operations.launchTimeline" values={values} onChange={updateField} options={["Immediately", "Within 30 days", "1-3 months", "3+ months", "Not sure"]} />
                      <TextField label="Priority goals" path="operations.priorityGoals" values={values} onChange={updateField} placeholder="Sales, orders, payments, visibility..." />
                    </div>
                  </section>
                ) : null}

                {activeStep.id === "modules" ? (
                  <section className="signup-section">
                    <CheckboxGrid legend="Required apps / modules" help="Select everything you expect Faako to plan for." options={MODULE_OPTIONS} values={values} path="modules.selected" onToggle={toggleFieldValue} />
                    <TextAreaField label="Custom module notes" path="modules.customNotes" values={values} onChange={updateField} placeholder="Any custom reports, special workflows, or future tools?" />
                  </section>
                ) : null}

                {activeStep.id === "payments" ? (
                  <section className="signup-section">
                    <p className="signup-secure-note">
                      Faako will request sensitive setup credentials through a secure setup process if needed. Please do not enter API keys, passwords, or private banking credentials here.
                    </p>
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Will accept online payments?" path="payments.acceptsOnlinePayments" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                      <SelectField label="Preferred provider" path="payments.preferredProvider" values={values} onChange={updateField} options={PAYMENT_PROVIDER_OPTIONS} />
                    </div>
                    <CheckboxGrid legend="Payment methods needed" options={PAYMENT_METHOD_OPTIONS} values={values} path="payments.methods" onToggle={toggleFieldValue} />
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Paystack account status" path="payments.paystackAccountStatus" values={values} onChange={updateField} options={["Not started", "Pending", "Active", "Not sure"]} />
                      <TextField label="Business email for payment provider" path="payments.providerBusinessEmail" values={values} onChange={updateField} type="email" />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Settlement country" path="payments.settlementCountry" values={values} onChange={updateField} />
                      <TextField label="Default currency" path="payments.defaultCurrency" values={values} onChange={updateField} />
                    </div>
                    <CheckboxGrid legend="Expected payment types" options={PAYMENT_TYPE_OPTIONS} values={values} path="payments.paymentTypes" onToggle={toggleFieldValue} />
                    <TextField label="Payment notification preference" path="payments.notificationPreference" values={values} onChange={updateField} />
                  </section>
                ) : null}

                {activeStep.id === "communications" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Main business email" path="communications.mainBusinessEmail" values={values} onChange={updateField} type="email" />
                      <TextField label="Preferred sending email" path="communications.preferredSendingEmail" values={values} onChange={updateField} type="email" />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Support email" path="communications.supportEmail" values={values} onChange={updateField} type="email" />
                      <SelectField label="Existing email provider" path="communications.existingEmailProvider" values={values} onChange={updateField} options={["Google Workspace", "Zoho", "Hostinger", "Microsoft 365", "Other", "Not sure"]} />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Needs business email setup?" path="communications.needsBusinessEmailSetup" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                      <SelectField label="SMS needed?" path="communications.smsNeeded" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="WhatsApp business number" path="communications.whatsappNumber" values={values} onChange={updateField} type="tel" />
                      <TextField label="WhatsApp display name" path="communications.whatsappDisplayName" values={values} onChange={updateField} />
                    </div>
                    <TextField label="WhatsApp business category" path="communications.whatsappCategory" values={values} onChange={updateField} />
                    <CheckboxGrid legend="Preferred customer notification channels" options={NOTIFICATION_CHANNEL_OPTIONS} values={values} path="communications.customerNotificationChannels" onToggle={toggleFieldValue} />
                    <CheckboxGrid legend="Notification types wanted" options={NOTIFICATION_TYPE_OPTIONS} values={values} path="communications.notificationTypes" onToggle={toggleFieldValue} />
                  </section>
                ) : null}

                {activeStep.id === "domain" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Has domain?" path="domain.hasDomain" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                      <TextField label="Domain name" path="domain.domainName" values={values} onChange={updateField} placeholder="example.com" />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Domain provider" path="domain.domainProvider" values={values} onChange={updateField} options={["Hostinger", "Namecheap", "GoDaddy", "Cloudflare", "Other", "Not sure"]} />
                      <SelectField label="Has business email?" path="domain.hasBusinessEmail" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                    </div>
                    <CheckboxGrid legend="Desired email addresses" options={DESIRED_EMAIL_OPTIONS} values={values} path="domain.desiredEmailAddresses" onToggle={toggleFieldValue} />
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Needs hosting setup?" path="domain.needsHostingSetup" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                      <TextField label="Current website URL" path="domain.currentWebsiteUrl" values={values} onChange={updateField} />
                    </div>
                  </section>
                ) : null}

                {activeStep.id === "admins" ? (
                  <section className="signup-section">
                    <p className="signup-secure-note">
                      This plans account setup only. Faako will create live users later through a reviewed admin process.
                    </p>
                    <div className="signup-grid signup-grid--two">
                      <TextField label="Owner/admin name" path="admins.ownerName" values={values} onChange={updateField} />
                      <TextField label="Owner/admin email" path="admins.ownerEmail" values={values} onChange={updateField} type="email" />
                    </div>
                    <TextField label="Number of staff accounts needed" path="admins.staffAccountsNeeded" values={values} onChange={updateField} />
                    <CheckboxGrid legend="Roles needed" options={ADMIN_ROLE_OPTIONS} values={values} path="admins.rolesNeeded" onToggle={toggleFieldValue} />
                  </section>
                ) : null}

                {activeStep.id === "security" ? (
                  <section className="signup-section">
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Needs role-based access?" path="security.roleBasedAccess" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                      <SelectField label="Needs audit logs?" path="security.auditLogs" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                    </div>
                    <div className="signup-grid signup-grid--two">
                      <SelectField label="Handles customer personal data?" path="security.handlesPersonalData" values={values} onChange={updateField} options={["Yes", "No"]} />
                      <SelectField label="Handles online payments?" path="security.handlesOnlinePayments" values={values} onChange={updateField} options={["Yes", "No"]} />
                    </div>
                    <SelectField label="Needs backups?" path="security.backups" values={values} onChange={updateField} options={YES_NO_UNSURE} />
                    <TextAreaField label="Data/privacy concerns" path="security.privacyConcerns" values={values} onChange={updateField} placeholder="Any data sensitivity, access, or retention concerns?" />
                    <p className="signup-secure-note">
                      Final security, payment, email, and integration setup will be reviewed by Faako before launch.
                    </p>
                    <label className={`signup-chip signup-consent ${values.security.consent ? "is-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={values.security.consent}
                        onChange={(event) => updateField("security.consent", event.target.checked)}
                      />
                      <span>I understand Faako will review setup and security before launch.</span>
                    </label>
                  </section>
                ) : null}

                {activeStep.id === "review" ? (
                  <section className="signup-section">
                    <p className="signup-help-text signup-help-text--strong">
                      Review your intake before submitting. A PDF copy will be sent to the contact email and Faako.
                    </p>
                    <div className="signup-review-grid">
                      {reviewSections.map((section) => (
                        <article className="signup-review-card" key={section.title}>
                          <h3>{section.title}</h3>
                          <dl>
                            {section.rows
                              .filter(([, value]) => normalizeText(value))
                              .map(([label, value]) => (
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
                    {status.state === "loading" ? "Submitting..." : "Submit onboarding intake"}
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
                        ? "Preparing your intake"
                        : status.state === "success"
                          ? "Onboarding intake received"
                          : "Submission failed"}
                    </p>
                    <p className="signup-status-message">{status.message}</p>
                  </div>
                </div>
              ) : (
                <p className="form-note signup-draft-note">
                  <span>{draftStatus}</span>
                  <span>
                    We review every intake manually. Integrations are configured later through secure setup, not through this form.
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
