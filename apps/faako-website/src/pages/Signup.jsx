import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRocket,
  faCircleCheck,
  faBuilding,
  faUsers,
  faBolt,
} from "@fortawesome/free-solid-svg-icons";
import "../styles/pages/Auth.css";

const PACKAGE_OPTIONS = [
  {
    id: "starter",
    name: "Starter",
    summary: "Good for a simple launch.",
    moduleLimit: 3
  },
  {
    id: "professional",
    name: "Professional",
    summary: "Best for growing teams.",
    moduleLimit: 8
  },
  {
    id: "enterprise",
    name: "Enterprise",
    summary: "For larger custom projects and rollout support.",
    moduleLimit: null
  }
];

const TIER_RANK = {
  starter: 1,
  professional: 2,
  enterprise: 3
};

const MODULE_OPTIONS = [
  {
    id: "website",
    name: "Website",
    description: "Marketing website with lead capture",
    minPackage: "starter"
  },
  {
    id: "payments",
    name: "Payments",
    description: "Mobile Money and payment tracking",
    minPackage: "starter"
  },
  {
    id: "bookings",
    name: "Bookings",
    description: "Appointments and reservations",
    minPackage: "starter"
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Live stock visibility",
    minPackage: "professional"
  },
  {
    id: "orders",
    name: "Orders",
    description: "Track orders from quote to delivery",
    minPackage: "professional"
  },
  {
    id: "crm",
    name: "CRM",
    description: "Leads and customer management",
    minPackage: "professional"
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Live overview of daily operations",
    minPackage: "professional"
  },
  {
    id: "reports",
    name: "Reports",
    description: "Weekly and monthly business reporting",
    minPackage: "professional"
  },
  {
    id: "delivery",
    name: "Delivery",
    description: "Dispatch and route status",
    minPackage: "professional"
  },
  {
    id: "scheduler",
    name: "Scheduler",
    description: "Staff shifts and availability",
    minPackage: "professional"
  },
  {
    id: "hr",
    name: "HR & Payroll",
    description: "People operations and payroll",
    minPackage: "enterprise"
  },
  {
    id: "integrations",
    name: "Integrations",
    description: "Connect with other business tools",
    minPackage: "enterprise"
  },
  {
    id: "analytics",
    name: "Advanced Analytics",
    description: "Deeper reports and planning insights",
    minPackage: "enterprise"
  },
  {
    id: "support",
    name: "Support Desk",
    description: "Track customer issues and support requests",
    minPackage: "enterprise"
  }
];

const COMMUNICATION_OPTIONS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone-calls", label: "Phone Calls" },
  { id: "email", label: "Email" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "walk-in", label: "In Person" },
  { id: "website-chat", label: "Website Chat" },
  { id: "sms", label: "SMS" },
  { id: "other", label: "Other" }
];

const PHONE_COUNTRY_OPTIONS = [
  { id: "gh", label: "Ghana", code: "+233" },
  { id: "ng", label: "Nigeria", code: "+234" },
  { id: "ke", label: "Kenya", code: "+254" },
  { id: "za", label: "South Africa", code: "+27" },
  { id: "uk", label: "United Kingdom", code: "+44" },
  { id: "us", label: "United States", code: "+1" },
  { id: "ca", label: "Canada", code: "+1" }
];

const DEFAULT_PACKAGE = "professional";
const DEFAULT_PRIMARY_COLOR = "#2f855a";
const DEFAULT_SECONDARY_COLOR = "#f59e0b";
const DEFAULT_WEBSITE_URL_PREFIX = "https://";
const DEFAULT_PHONE_COUNTRY_CODE = "+233";
const PHONE_DIGIT_COUNT = 10;
const DEFAULT_COMMUNICATION_CHANNELS = ["whatsapp", "phone-calls"];
const SIGNUP_DRAFT_STORAGE_KEY = "faako-signup-draft-v1";
const HONEYPOT_FIELD_NAME = "companyFax";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const resolveApiEndpoint = (path) => {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (!configuredBaseUrl) {
    return `/api/${normalizedPath}`;
  }

  if (/^https?:\/\//i.test(configuredBaseUrl)) {
    return new URL(normalizedPath, `${configuredBaseUrl}/`).toString();
  }
  const normalizedBasePath = `/${configuredBaseUrl.replace(/^\/+/, "")}`;
  return `${normalizedBasePath}/${normalizedPath}`;
};

const SIGNUP_ENDPOINT = resolveApiEndpoint("signup");
const DEFAULT_FORM_VALUES = {
  companyName: "",
  contactName: "",
  email: "",
  phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
  phone: "",
  businessType: "both",
  teamSize: "1-10",
  logoUrl: "",
  currency: "GHS",
  timelinePreference: "soon",
  currentWorkflow: "",
  painPoints: "",
  projectDetails: "",
  additionalNotes: ""
};

const normalizeHexColorValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  return HEX_COLOR_PATTERN.test(withHash) ? withHash.toLowerCase() : null;
};

const parseJsonObject = (value) => {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeTextValue = (value) => String(value || "").trim();

const normalizeEmailValue = (value) => normalizeTextValue(value).toLowerCase();

const normalizePhoneCountryCode = (value) =>
  PHONE_COUNTRY_OPTIONS.some((option) => option.code === value)
    ? value
    : DEFAULT_PHONE_COUNTRY_CODE;

const normalizePhoneInputValue = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, PHONE_DIGIT_COUNT);

const isValidPhoneInputValue = (value) =>
  !value || normalizePhoneInputValue(value).length === PHONE_DIGIT_COUNT;

const buildPhoneValue = (countryCode, phoneNumber) => {
  const normalizedPhone = normalizePhoneInputValue(phoneNumber);

  if (!normalizedPhone) {
    return "";
  }

  return `${normalizePhoneCountryCode(countryCode)} ${normalizedPhone}`;
};

const splitPhoneValue = (phoneValue, phoneCountryCode) => {
  const normalizedCountryCode = normalizePhoneCountryCode(phoneCountryCode);
  const normalizedPhoneValue = normalizeTextValue(phoneValue);

  if (!normalizedPhoneValue) {
    return {
      phoneCountryCode: normalizedCountryCode,
      phone: ""
    };
  }

  const matchingOption = PHONE_COUNTRY_OPTIONS.find(
    ({ code }) =>
      normalizedPhoneValue === code ||
      normalizedPhoneValue.startsWith(`${code} `) ||
      normalizedPhoneValue.startsWith(code)
  );
  const activeCountryCode = matchingOption?.code || normalizedCountryCode;
  const localPhone = matchingOption
    ? normalizedPhoneValue.slice(matchingOption.code.length).trim()
    : normalizedPhoneValue.replace(
        new RegExp(`^${normalizedCountryCode.replace("+", "\\+")}\\s*`),
        ""
      ).trim() || normalizedPhoneValue;

  return {
    phoneCountryCode: activeCountryCode,
    phone: normalizePhoneInputValue(localPhone)
  };
};

const normalizeWebsiteInputValue = (value) =>
  normalizeTextValue(value)
    .replace(URL_SCHEME_PATTERN, "")
    .replace(/^\/+/, "");

const normalizeWebsiteUrlValue = (value) => {
  const normalized = normalizeWebsiteInputValue(value);

  if (!normalized) {
    return "";
  }

  return `${DEFAULT_WEBSITE_URL_PREFIX}${normalized}`;
};

const normalizeHttpUrlValue = (value) => {
  const normalized = normalizeTextValue(value);
  if (!normalized) {
    return "";
  }

  if (!URL_SCHEME_PATTERN.test(normalized)) {
    return `${DEFAULT_WEBSITE_URL_PREFIX}${normalized.replace(/^\/+/, "")}`;
  }

  return normalized;
};

const isValidEmail = (value) => EMAIL_PATTERN.test(value);

const isValidHttpUrl = (value) => {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
};

const PACKAGE_LABEL_BY_ID = Object.fromEntries(
  PACKAGE_OPTIONS.map((pkg) => [pkg.id, pkg.name])
);

const packageIncludesModule = (packageId, moduleMinPackage) =>
  (TIER_RANK[packageId] || 0) >= (TIER_RANK[moduleMinPackage] || 0);

const getDefaultModules = (packageId) => {
  const defaultsByPackage = {
    starter: ["website", "payments", "bookings"],
    professional: ["website", "inventory", "orders", "crm"],
    enterprise: ["website", "inventory", "orders", "crm", "dashboard", "reports"]
  };

  return defaultsByPackage[packageId] || defaultsByPackage.professional;
};

const arrayEquals = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const loadSignupDraft = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const clearSignupDraft = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
};

const saveSignupDraft = (draft) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SIGNUP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

const getInitialSignupState = () => {
  const draft = loadSignupDraft();
  const packageIds = new Set(PACKAGE_OPTIONS.map((pkg) => pkg.id));
  const moduleIds = new Set(MODULE_OPTIONS.map((module) => module.id));
  const communicationIds = new Set(
    COMMUNICATION_OPTIONS.map((channel) => channel.id)
  );

  const selectedPackage = packageIds.has(draft?.selectedPackage)
    ? draft.selectedPackage
    : DEFAULT_PACKAGE;

  const availableModuleIds = new Set(
    MODULE_OPTIONS.filter((module) =>
      packageIncludesModule(selectedPackage, module.minPackage)
    ).map((module) => module.id)
  );

  const selectedModules = Array.isArray(draft?.selectedModules)
    ? draft.selectedModules.filter(
        (moduleId) => moduleIds.has(moduleId) && availableModuleIds.has(moduleId)
      )
    : [];

  const communicationChannels = Array.isArray(draft?.communicationChannels)
    ? draft.communicationChannels.filter((channelId) =>
        communicationIds.has(channelId)
      )
    : [];

  const primaryColorInput = normalizeTextValue(draft?.brandPrimaryColorInput);
  const secondaryColorInput = normalizeTextValue(draft?.brandSecondaryColorInput);
  const primaryColor =
    normalizeHexColorValue(primaryColorInput) ||
    normalizeHexColorValue(draft?.brandPrimaryColor) ||
    DEFAULT_PRIMARY_COLOR;
  const secondaryColor =
    normalizeHexColorValue(secondaryColorInput) ||
    normalizeHexColorValue(draft?.brandSecondaryColor) ||
    DEFAULT_SECONDARY_COLOR;
  const baseFormValues = {
    ...DEFAULT_FORM_VALUES,
    ...(draft?.formValues && typeof draft.formValues === "object"
      ? Object.fromEntries(
          Object.entries(DEFAULT_FORM_VALUES).map(([key, fallbackValue]) => [
            key,
            typeof draft.formValues[key] === "string"
              ? draft.formValues[key]
              : fallbackValue
          ])
        )
      : {})
  };
  const normalizedPhoneState = splitPhoneValue(
    baseFormValues.phone,
    baseFormValues.phoneCountryCode
  );

  return {
    formValues: {
      ...baseFormValues,
      ...normalizedPhoneState
    },
    selectedPackage,
    selectedModules:
      selectedModules.length > 0 ? selectedModules : getDefaultModules(selectedPackage),
    communicationChannels:
      communicationChannels.length > 0
        ? communicationChannels
        : DEFAULT_COMMUNICATION_CHANNELS,
    brandPrimaryColor: primaryColor,
    brandSecondaryColor: secondaryColor,
    brandPrimaryColorInput: primaryColorInput || primaryColor,
    brandSecondaryColorInput: secondaryColorInput || secondaryColor,
    websiteUrl: normalizeWebsiteInputValue(draft?.websiteUrl)
  };
};

const isDraftPristine = (draft) =>
  arrayEquals(draft.selectedModules, getDefaultModules(DEFAULT_PACKAGE)) &&
  arrayEquals(draft.communicationChannels, DEFAULT_COMMUNICATION_CHANNELS) &&
  draft.selectedPackage === DEFAULT_PACKAGE &&
  draft.brandPrimaryColor === DEFAULT_PRIMARY_COLOR &&
  draft.brandSecondaryColor === DEFAULT_SECONDARY_COLOR &&
  draft.brandPrimaryColorInput === DEFAULT_PRIMARY_COLOR &&
  draft.brandSecondaryColorInput === DEFAULT_SECONDARY_COLOR &&
  draft.websiteUrl === "" &&
  Object.entries(DEFAULT_FORM_VALUES).every(
    ([key, defaultValue]) => draft.formValues[key] === defaultValue
  );

export default function Signup() {
  const initialSignupState = useMemo(() => getInitialSignupState(), []);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [formValues, setFormValues] = useState(initialSignupState.formValues);
  const [selectedPackage, setSelectedPackage] = useState(
    initialSignupState.selectedPackage
  );
  const [selectedModules, setSelectedModules] = useState(
    initialSignupState.selectedModules
  );
  const [communicationChannels, setCommunicationChannels] = useState(
    initialSignupState.communicationChannels
  );
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(
    initialSignupState.brandPrimaryColor
  );
  const [brandSecondaryColor, setBrandSecondaryColor] = useState(
    initialSignupState.brandSecondaryColor
  );
  const [brandPrimaryColorInput, setBrandPrimaryColorInput] = useState(
    initialSignupState.brandPrimaryColorInput
  );
  const [brandSecondaryColorInput, setBrandSecondaryColorInput] = useState(
    initialSignupState.brandSecondaryColorInput
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialSignupState.websiteUrl);
  const [honeypotValue, setHoneypotValue] = useState("");

  const activePackage = useMemo(
    () =>
      PACKAGE_OPTIONS.find((pkg) => pkg.id === selectedPackage) ||
      PACKAGE_OPTIONS[0],
    [selectedPackage]
  );

  const moduleLimit = activePackage.moduleLimit;

  useEffect(() => {
    const allowedModuleIds = MODULE_OPTIONS
      .filter((module) => packageIncludesModule(selectedPackage, module.minPackage))
      .map((module) => module.id);

    setSelectedModules((current) => {
      const filtered = current.filter((moduleId) =>
        allowedModuleIds.includes(moduleId)
      );

      if (filtered.length > 0) {
        if (moduleLimit !== null && filtered.length > moduleLimit) {
          return filtered.slice(0, moduleLimit);
        }
        return filtered;
      }

      const defaults = getDefaultModules(selectedPackage).filter((moduleId) =>
        allowedModuleIds.includes(moduleId)
      );

      if (moduleLimit !== null) {
        return defaults.slice(0, moduleLimit);
      }

      return defaults;
    });
  }, [selectedPackage, moduleLimit]);

  useEffect(() => {
    const draft = {
      formValues,
      selectedPackage,
      selectedModules,
      communicationChannels,
      brandPrimaryColor,
      brandSecondaryColor,
      brandPrimaryColorInput,
      brandSecondaryColorInput,
      websiteUrl
    };

    if (isDraftPristine(draft)) {
      clearSignupDraft();
      return;
    }

    saveSignupDraft(draft);
  }, [
    formValues,
    selectedPackage,
    selectedModules,
    communicationChannels,
    brandPrimaryColor,
    brandSecondaryColor,
    brandPrimaryColorInput,
    brandSecondaryColorInput,
    websiteUrl
  ]);

  const clearResolvedStatus = () => {
    setStatus((current) =>
      current.state === "loading" || current.state === "idle"
        ? current
        : { state: "idle", message: "" }
    );
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    clearResolvedStatus();
    setFormValues((current) => ({
      ...current,
      [name]: name === "phone" ? normalizePhoneInputValue(value) : value
    }));
  };

  const handlePackageChange = (event) => {
    clearResolvedStatus();
    setSelectedPackage(event.target.value);
  };

  const toggleModule = (moduleId) => {
    clearResolvedStatus();

    setSelectedModules((current) => {
      if (current.includes(moduleId)) {
        return current.filter((item) => item !== moduleId);
      }

      if (moduleLimit !== null && current.length >= moduleLimit) {
        setStatus({
          state: "error",
          message: `${activePackage.name} allows up to ${moduleLimit} features.`
        });
        return current;
      }

      return [...current, moduleId];
    });
  };

  const toggleCommunicationChannel = (channelId) => {
    clearResolvedStatus();
    setCommunicationChannels((current) => {
      if (current.includes(channelId)) {
        return current.filter((item) => item !== channelId);
      }
      return [...current, channelId];
    });
  };

  const handlePrimaryColorPickerChange = (event) => {
    clearResolvedStatus();
    const value = event.target.value.toLowerCase();
    setBrandPrimaryColor(value);
    setBrandPrimaryColorInput(value);
  };

  const handlePrimaryColorInputChange = (event) => {
    clearResolvedStatus();
    const value = event.target.value;
    setBrandPrimaryColorInput(value);

    const normalized = normalizeHexColorValue(value);
    if (normalized) {
      setBrandPrimaryColor(normalized);
    }
  };

  const handlePrimaryColorInputBlur = () => {
    const normalized =
      normalizeHexColorValue(brandPrimaryColorInput) || brandPrimaryColor;
    setBrandPrimaryColor(normalized);
    setBrandPrimaryColorInput(normalized);
  };

  const handleSecondaryColorPickerChange = (event) => {
    clearResolvedStatus();
    const value = event.target.value.toLowerCase();
    setBrandSecondaryColor(value);
    setBrandSecondaryColorInput(value);
  };

  const handleSecondaryColorInputChange = (event) => {
    clearResolvedStatus();
    const value = event.target.value;
    setBrandSecondaryColorInput(value);

    const normalized = normalizeHexColorValue(value);
    if (normalized) {
      setBrandSecondaryColor(normalized);
    }
  };

  const handleSecondaryColorInputBlur = () => {
    const normalized =
      normalizeHexColorValue(brandSecondaryColorInput) || brandSecondaryColor;
    setBrandSecondaryColor(normalized);
    setBrandSecondaryColorInput(normalized);
  };

  const handleWebsiteUrlChange = (event) => {
    clearResolvedStatus();
    setWebsiteUrl(normalizeWebsiteInputValue(event.target.value));
  };

  const handleHoneypotChange = (event) => {
    setHoneypotValue(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (selectedModules.length === 0) {
      setStatus({
        state: "error",
        message: "Select at least one feature before submitting."
      });
      return;
    }

    if (communicationChannels.length === 0) {
      setStatus({
        state: "error",
        message: "Select at least one communication channel."
      });
      return;
    }

    const normalizedWebsiteUrl = normalizeWebsiteUrlValue(websiteUrl);
    const normalizedLogoUrl = normalizeHttpUrlValue(formValues.logoUrl);
    const normalizedEmail = normalizeEmailValue(formValues.email);
    const companyName = normalizeTextValue(formValues.companyName);
    const contactName = normalizeTextValue(formValues.contactName);
    const currentWorkflow = normalizeTextValue(formValues.currentWorkflow);

    if (!companyName || !contactName || !currentWorkflow) {
      setStatus({
        state: "error",
        message: "Complete the required fields before submitting."
      });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setStatus({
        state: "error",
        message: "Enter a valid work email address."
      });
      return;
    }

    if (!isValidPhoneInputValue(formValues.phone)) {
      setStatus({
        state: "error",
        message: `Enter a ${PHONE_DIGIT_COUNT}-digit phone number or leave the field blank.`
      });
      return;
    }

    if (!isValidHttpUrl(normalizedWebsiteUrl)) {
      setStatus({
        state: "error",
        message: "Enter a valid website URL or leave the field as is."
      });
      return;
    }

    if (!isValidHttpUrl(normalizedLogoUrl)) {
      setStatus({
        state: "error",
        message: "Enter a valid logo URL or leave the field blank."
      });
      return;
    }

    const payload = {
      companyName,
      contactName,
      email: normalizedEmail,
      phone: buildPhoneValue(formValues.phoneCountryCode, formValues.phone),
      businessType: normalizeTextValue(formValues.businessType),
      teamSize: normalizeTextValue(formValues.teamSize),
      websiteUrl: normalizedWebsiteUrl,
      logoUrl: normalizedLogoUrl,
      brandPrimaryColor,
      brandSecondaryColor,
      currency: normalizeTextValue(formValues.currency),
      timelinePreference: normalizeTextValue(formValues.timelinePreference),
      currentWorkflow,
      painPoints: normalizeTextValue(formValues.painPoints),
      projectDetails: normalizeTextValue(formValues.projectDetails),
      additionalNotes: normalizeTextValue(formValues.additionalNotes),
      packageTier: selectedPackage,
      requestedModules: selectedModules,
      communicationChannels,
      [HONEYPOT_FIELD_NAME]: normalizeTextValue(honeypotValue)
    };

    setStatus({ state: "loading", message: "Sending request..." });

    try {
      const response = await fetch(SIGNUP_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      const result = parseJsonObject(responseText);

      if (!response.ok || result?.ok === false || result?.errors) {
        const baseMessage =
          result?.error ||
          result?.errors?.[0]?.message ||
          "Could not submit form. Please try again.";
        const debugDetails = !import.meta.env.PROD
          ? [result?.debug?.message, result?.debug?.detail].filter(Boolean).join(" | ")
          : "";
        const message = debugDetails ? `${baseMessage}: ${debugDetails}` : baseMessage;
        throw new Error(message);
      }

      clearSignupDraft();
      setFormValues(DEFAULT_FORM_VALUES);
      setSelectedPackage(DEFAULT_PACKAGE);
      setSelectedModules(getDefaultModules(DEFAULT_PACKAGE));
      setCommunicationChannels(DEFAULT_COMMUNICATION_CHANNELS);
      setBrandPrimaryColor(DEFAULT_PRIMARY_COLOR);
      setBrandSecondaryColor(DEFAULT_SECONDARY_COLOR);
      setBrandPrimaryColorInput(DEFAULT_PRIMARY_COLOR);
      setBrandSecondaryColorInput(DEFAULT_SECONDARY_COLOR);
      setWebsiteUrl("");
      setHoneypotValue("");
      setStatus({
        state: "success",
        message: result?.message || "Thanks. We have received your form."
      });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error instanceof TypeError
            ? "Could not reach the signup service. Please try again shortly."
            : error.message || "Could not submit form. Please try again."
      });
    }
  };

  return (
    <section className="page signup signup-page auth-suite auth-suite--signup">
      <div className="auth-suite-shell">
        <section className="auth-suite-panel">
          <span className="auth-suite-kicker">
            
            <div className="signup-icon-badge">
              <img
                className="signup-icon-logo"
                src="/assets/logos/logo-white.png"
                alt="Faako logo"
                loading="lazy"
              />
            </div>
            <p>Client setup form</p>
          </span>
          <h1>Tell us what your business needs.</h1>
          <p className="lead">
            Complete this form once and we will prepare your proposal,
            launch plan, and timeline.
          </p>
          <ul className="auth-suite-points">
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Share how your business runs today and how customers reach you
            </li>
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Choose your package and feature priorities
            </li>
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Add your logo and brand colors for setup
            </li>
          </ul>
          <div className="auth-suite-tags">
            <span>
              <FontAwesomeIcon icon={faBuilding} />
              Business profile
            </span>
            <span>
              <FontAwesomeIcon icon={faUsers} />
              Daily process review
            </span>
            <span>
              <FontAwesomeIcon icon={faBolt} />
              Feature planning
            </span>
          </div>
        </section>

        <section className="signup-shell">
          <div className="signup-form-side">

            <form
              className="form signup-form"
              style={{ "--delay": "140ms" }}
              onSubmit={handleSubmit}
              action={SIGNUP_ENDPOINT}
              method="POST"
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-10000px",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden"
                }}
              >
                <label htmlFor={HONEYPOT_FIELD_NAME}>Leave this field empty</label>
                <input
                  id={HONEYPOT_FIELD_NAME}
                  name={HONEYPOT_FIELD_NAME}
                  type="text"
                  value={honeypotValue}
                  onChange={handleHoneypotChange}
                  tabIndex={-1}
                  autoComplete="new-password"
                />
              </div>

              <section className="signup-section">
                <h3>Company details</h3>

                <div className="signup-grid signup-grid--two">
                  <label>
                    Business name
                    <input
                      name="companyName"
                      value={formValues.companyName}
                      onChange={handleFieldChange}
                      placeholder="My Business Ltd"
                      required
                    />
                  </label>

                  <label>
                    Contact name
                    <input
                      name="contactName"
                      value={formValues.contactName}
                      onChange={handleFieldChange}
                      placeholder="Jane Doe"
                      required
                    />
                  </label>
                </div>

                <div className="signup-grid signup-grid--two">
                  <label>
                    Work email
                    <input
                      name="email"
                      type="email"
                      value={formValues.email}
                      onChange={handleFieldChange}
                      placeholder="you@company.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label>
                    Phone number
                    <div className="signup-phone-control">
                      <select
                        className="signup-phone-code"
                        name="phoneCountryCode"
                        value={formValues.phoneCountryCode}
                        onChange={handleFieldChange}
                        aria-label="Country calling code"
                      >
                        {PHONE_COUNTRY_OPTIONS.map((option) => (
                          <option key={`${option.id}-${option.code}`} value={option.code}>
                            {option.label} ({option.code})
                          </option>
                        ))}
                      </select>
                      <input
                        name="phone"
                        type="tel"
                        value={formValues.phone}
                        onChange={handleFieldChange}
                        inputMode="numeric"
                        maxLength={PHONE_DIGIT_COUNT}
                        pattern={`\\d{${PHONE_DIGIT_COUNT}}`}
                        placeholder="0200000000"
                        autoComplete="tel-national"
                      />
                    </div>
                  </label>
                </div>

                <div className="signup-grid signup-grid--two">
                  <label>
                    Business type
                    <select
                      name="businessType"
                      value={formValues.businessType}
                      onChange={handleFieldChange}
                    >
                      <option value="sell">Sales</option>
                      <option value="rent">Rentals</option>
                      <option value="both">Both</option>
                    </select>
                  </label>

                  <label>
                    Team size
                    <select
                      name="teamSize"
                      value={formValues.teamSize}
                      onChange={handleFieldChange}
                    >
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201+">201+</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="signup-section">
                <h3>Branding and setup</h3>

                <div className="signup-grid signup-grid--two">
                  <label>
                    Website URL
                    <div className="signup-url-control">
                      <span className="signup-url-prefix" aria-hidden="true">
                        {DEFAULT_WEBSITE_URL_PREFIX}
                      </span>
                      <input
                        className="signup-url-input"
                        name="websiteUrl"
                        type="text"
                        inputMode="url"
                        autoComplete="url"
                        value={websiteUrl}
                        onChange={handleWebsiteUrlChange}
                        placeholder="yourcompany.com"
                        spellCheck={false}
                      />
                    </div>
                  </label>

                  <label>
                    Logo URL
                    <input
                      name="logoUrl"
                      type="url"
                      value={formValues.logoUrl}
                      onChange={handleFieldChange}
                      placeholder="https://drive.google.com/..."
                    />
                  </label>
                </div>

                <div className="signup-grid signup-grid--two signup-grid--color">
                  <label>
                    Primary brand color
                    <div className="signup-color-control">
                      <input
                        className="signup-color-swatch"
                        type="color"
                        value={brandPrimaryColor}
                        onChange={handlePrimaryColorPickerChange}
                        aria-label="Pick primary brand color"
                      />
                      <input
                        className="signup-color-hex"
                        type="text"
                        value={brandPrimaryColorInput}
                        onChange={handlePrimaryColorInputChange}
                        onBlur={handlePrimaryColorInputBlur}
                        placeholder="#2f855a"
                      />
                    </div>
                  </label>

                  <label>
                    Secondary brand color
                    <div className="signup-color-control">
                      <input
                        className="signup-color-swatch"
                        type="color"
                        value={brandSecondaryColor}
                        onChange={handleSecondaryColorPickerChange}
                        aria-label="Pick secondary brand color"
                      />
                      <input
                        className="signup-color-hex"
                        type="text"
                        value={brandSecondaryColorInput}
                        onChange={handleSecondaryColorInputChange}
                        onBlur={handleSecondaryColorInputBlur}
                        placeholder="#f59e0b"
                      />
                    </div>
                  </label>
                </div>

                <div className="signup-grid signup-grid--two">
                  <label>
                    Preferred currency
                    <select
                      name="currency"
                      value={formValues.currency}
                      onChange={handleFieldChange}
                    >
                      <option value="GHS">GHS</option>
                      <option value="USD">USD</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </label>

                  <label>
                    Timeline to start
                    <select
                      name="timelinePreference"
                      value={formValues.timelinePreference}
                      onChange={handleFieldChange}
                    >
                      <option value="immediately">Immediately</option>
                      <option value="soon">Soon (within 30 days)</option>
                      <option value="exploring">Exploring options</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="signup-section">
                <h3>Current operations</h3>

                <label>
                  Describe your current process
                  <textarea
                    name="currentWorkflow"
                    value={formValues.currentWorkflow}
                    onChange={handleFieldChange}
                    rows={4}
                    placeholder="How do you currently track sales, stock, orders, and team tasks?"
                    required
                  />
                </label>

                <fieldset className="signup-choice-group">
                  <legend>Current communication channels</legend>
                  <p className="signup-help-text">
                    Select all channels you currently use with customers.
                  </p>

                  <div className="signup-chip-grid">
                    {COMMUNICATION_OPTIONS.map((channel) => {
                      const selected = communicationChannels.includes(channel.id);

                      return (
                        <label
                          key={channel.id}
                          className={`signup-chip ${selected ? "is-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            name="communicationChannels"
                            value={channel.id}
                            checked={selected}
                            onChange={() => toggleCommunicationChannel(channel.id)}
                          />
                          <span>{channel.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <label>
                  Biggest pain points
                  <textarea
                    name="painPoints"
                    value={formValues.painPoints}
                    onChange={handleFieldChange}
                    rows={3}
                    placeholder="What is slowing your team down the most right now?"
                  />
                </label>
              </section>

              <section className="signup-section">
                <h3>Package and modules</h3>

                <fieldset className="signup-choice-group">
                  <legend>Preferred package</legend>
                  <div className="signup-package-grid">
                    {PACKAGE_OPTIONS.map((pkg) => {
                      const checked = selectedPackage === pkg.id;
                      const limitText =
                        pkg.moduleLimit === null
                          ? "Unlimited modules"
                          : `Up to ${pkg.moduleLimit} modules`;

                      return (
                        <label
                          key={pkg.id}
                          className={`signup-package-option ${checked ? "is-selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name="packageTier"
                            value={pkg.id}
                            checked={checked}
                            onChange={handlePackageChange}
                          />
                          <span className="signup-package-name">{pkg.name}</span>
                          <span className="signup-package-summary">{pkg.summary}</span>
                          <span className="signup-package-limit">{limitText}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="signup-choice-group">
                  <legend>Modules you want</legend>
                  <p className="signup-help-text">
                    {moduleLimit === null
                      ? `Select the features you want for ${activePackage.name}.`
                      : `Select up to ${moduleLimit} features for ${activePackage.name}.`}
                  </p>

                  <div className="signup-module-grid">
                    {MODULE_OPTIONS.map((module) => {
                      const selected = selectedModules.includes(module.id);
                      const unavailable = !packageIncludesModule(
                        selectedPackage,
                        module.minPackage
                      );
                      const limitReached =
                        moduleLimit !== null && selectedModules.length >= moduleLimit;
                      const disabledForLimit = !selected && !unavailable && limitReached;
                      const disabled = unavailable || disabledForLimit;
                      const requiredPackageLabel = PACKAGE_LABEL_BY_ID[module.minPackage];

                      return (
                        <label
                          key={module.id}
                          className={`signup-module-option ${selected ? "is-selected" : ""} ${
                            unavailable ? "is-unavailable" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="requestedModules"
                            value={module.id}
                            checked={selected}
                            onChange={() => toggleModule(module.id)}
                            disabled={disabled}
                          />
                          <span className="signup-module-name">{module.name}</span>
                          <span className="signup-module-description">
                            {module.description}
                          </span>
                          {unavailable ? (
                            <span className="signup-module-requirement">
                              Available in {requiredPackageLabel}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>

                  <p className="signup-help-text signup-help-text--strong">
                    {selectedModules.length} module
                    {selectedModules.length === 1 ? "" : "s"} selected
                  </p>
                </fieldset>
              </section>

              <section className="signup-section">
                <h3>Project goals</h3>

                <label>
                  What should Faako help you achieve in the next 6-12 months?
                  <textarea
                    name="projectDetails"
                    value={formValues.projectDetails}
                    onChange={handleFieldChange}
                    rows={3}
                    placeholder="Share your top outcomes, limits, or must-have features."
                  />
                </label>

                <label>
                  Additional notes
                  <textarea
                    name="additionalNotes"
                    value={formValues.additionalNotes}
                    onChange={handleFieldChange}
                    rows={3}
                    placeholder="Anything else we should know before we send your proposal?"
                  />
                </label>
              </section>

              <button
                className="button button-primary signup-submit"
                type="submit"
                disabled={status.state === "loading"}
              >
                {status.state === "loading"
                  ? "Submitting..."
                  : "Submit form"}
              </button>

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
                        ? "Submitting your request"
                        : status.state === "success"
                          ? "Request received"
                          : "Submission failed"}
                    </p>
                    <p className="signup-status-message">{status.message}</p>
                  </div>
                </div>
              ) : (
                <p className="form-note">
                  We review every request and reply with next steps within one
                  business day.
                </p>
              )}
            </form>
          </div>
        </section>
      </div>
    </section>
  );
}
