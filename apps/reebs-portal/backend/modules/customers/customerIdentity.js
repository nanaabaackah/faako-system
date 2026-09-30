const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_COUNTRY_CODE = "233";

const cleanText = (value, maxLength = 255) => {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
};

export const normalizeCustomerEmail = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return { value: null, isValid: true };
  return {
    value: normalized,
    isValid: EMAIL_PATTERN.test(normalized),
  };
};

export const normalizeCustomerPhone = (value) => {
  const input = String(value || "").trim();
  if (!input) return { value: null, display: null, isValid: true, isGhanaian: false };

  const internationalInput = input.startsWith("+") || input.startsWith("00");
  let digits = input.replace(/\D/g, "");
  if (input.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `${GHANA_COUNTRY_CODE}${digits.slice(1)}`;
  } else if (digits.length === 9 && !internationalInput) {
    digits = `${GHANA_COUNTRY_CODE}${digits}`;
  }

  const isValid = digits.length >= 8 && digits.length <= 15;
  if (!isValid) {
    return { value: null, display: input, isValid: false, isGhanaian: false };
  }

  const normalized = `+${digits}`;
  const isGhanaian = digits.startsWith(GHANA_COUNTRY_CODE) && digits.length === 12;
  const display = isGhanaian
    ? `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
    : normalized;

  return { value: normalized, display, isValid: true, isGhanaian };
};

export const normalizeCustomerType = (value) =>
  String(value || "").trim().toLowerCase() === "organization" ? "organization" : "individual";

export const buildCustomerInput = (input = {}) => {
  const customerType = normalizeCustomerType(input.customerType);
  const name = cleanText(input.name, 180);
  const organizationName = cleanText(input.organizationName, 180);
  const contactPersonName = cleanText(input.contactPersonName, 180);
  const email = normalizeCustomerEmail(input.email);
  const phone = normalizeCustomerPhone(input.phone);
  const secondaryPhone = normalizeCustomerPhone(input.secondaryPhone);
  const displayName = customerType === "organization" ? organizationName || name : name;

  const errors = [];
  if (!displayName) errors.push({ field: customerType === "organization" ? "organizationName" : "name", code: "REQUIRED" });
  if (!email.isValid) errors.push({ field: "email", code: "INVALID_EMAIL" });
  if (!phone.isValid) errors.push({ field: "phone", code: "INVALID_PHONE" });
  if (!secondaryPhone.isValid) errors.push({ field: "secondaryPhone", code: "INVALID_PHONE" });
  return {
    value: {
      customerType,
      name: displayName,
      organizationName: customerType === "organization" ? organizationName || displayName : null,
      contactPersonName: customerType === "organization" ? contactPersonName : null,
      email: email.value,
      normalizedEmail: email.value,
      phone: phone.display,
      normalizedPhone: phone.value,
      secondaryPhone: secondaryPhone.display,
      normalizedSecondaryPhone: secondaryPhone.value,
      addressLine1: cleanText(input.addressLine1, 220),
      addressLine2: cleanText(input.addressLine2, 220),
      locality: cleanText(input.locality, 120),
      region: cleanText(input.region, 120),
      ghanaPostGps: cleanText(input.ghanaPostGps, 40)?.toUpperCase() || null,
      preferredContactMethod: ["phone", "email", "sms"].includes(String(input.preferredContactMethod || "").toLowerCase())
        ? String(input.preferredContactMethod).toLowerCase()
        : null,
      internalNotes: cleanText(input.internalNotes, 4000),
    },
    errors,
  };
};

export const buildCustomerReference = (customerId) =>
  `CUS-${String(Number(customerId) || 0).padStart(6, "0")}`;

export const getCustomerIdentitySearchTerms = (value) => {
  const query = String(value || "").trim();
  const email = normalizeCustomerEmail(query);
  const phone = normalizeCustomerPhone(query);
  return {
    query,
    normalizedEmail: email.isValid ? email.value : null,
    normalizedPhone: phone.isValid ? phone.value : null,
  };
};
