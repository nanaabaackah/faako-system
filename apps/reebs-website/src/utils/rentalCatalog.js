const normalizeRentalText = (value) => String(value || "").trim().toLowerCase();
const RENTAL_UNAVAILABLE_PATTERN =
  /\b(unavailable|out of service|out-of-service|maintenance|repair|broken|damaged|offline|inactive|retired|not working)\b/i;
const RENTAL_DATE_HELD_PATTERN = /\b(booked|reserved|hold|pending)\b/i;

const slugifyRentalValue = (value = "") => {
  if (value == null) return "";
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

const getRentalPageLeaf = (value = "") =>
  String(value || "")
    .split("/")
    .filter(Boolean)
    .pop() || "";

const isKidsPartyMachine = (item = {}) => {
  const name = normalizeRentalText(item?.name);
  return (
    name.includes("popcorn")
    || name.includes("snow cone")
    || name.includes("snowcone")
    || name.includes("cotton candy")
  );
};

const getFrontendRentalCategory = (item = {}) => {
  if (isKidsPartyMachine(item)) return "Kids Rentals";

  const raw = String(
    item?.specificCategory
    || item?.specificcategory
    || item?.category
    || ""
  ).trim();
  const lowered = raw.toLowerCase();

  if (!raw) return "Other";
  if (lowered.includes("bouncy")) return "Bouncy Castles";
  if (lowered.includes("kid") && lowered.includes("rental")) return "Kids Rentals";
  if (lowered.includes("machine") || lowered.includes("setup")) return "Setup";
  if (
    lowered.includes("indoor")
    || lowered.includes("board game")
    || lowered.includes("jenga")
  ) {
    return "Indoor Games";
  }

  return raw;
};

const isKnownFrontendRentalCategory = (item = {}) => {
  const category = getFrontendRentalCategory(item);
  if (!category) return false;
  if (["Setup", "Indoor Games", "Bouncy Castles", "Kids Rentals"].includes(category)) {
    return true;
  }
  return category.toLowerCase().includes("rental");
};

const isFrontendRentalItem = (item = {}) => {
  const source = normalizeRentalText(
    item?.sourceCategoryCode || item?.sourcecategorycode || ""
  );
  const sku = normalizeRentalText(item?.sku);

  return source
    ? source === "rental"
    : sku.startsWith("ren") || isKnownFrontendRentalCategory(item);
};

const isFrontendRentalBookable = (item = {}) => {
  if (
    item?.status === false ||
    item?.isActive === false ||
    item?.isWorking === false ||
    item?.working === false
  ) {
    return false;
  }

  const statusText = [
    item?.availability,
    item?.status,
    item?.condition,
    item?.maintenanceStatus,
    item?.workingStatus,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");

  return !RENTAL_UNAVAILABLE_PATTERN.test(statusText);
};

const getFrontendRentalAvailabilityLabel = (item = {}) => {
  if (!isFrontendRentalBookable(item)) return "Unavailable";

  const statusText = [
    item?.availability,
    item?.status,
    item?.condition,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");

  if (RENTAL_DATE_HELD_PATTERN.test(statusText)) return "Check date";
  return "Date availability";
};

const shouldExcludeFrontendRental = (item = {}) => {
  const source = normalizeRentalText(
    item?.sourceCategoryCode || item?.sourcecategorycode || ""
  );
  if (source === "water") return true;

  const category = getFrontendRentalCategory(item);
  if (category.toLowerCase() === "party supplies") return true;
  if (category !== "Setup") return false;

  const name = normalizeRentalText(item?.name);
  return (
    name.includes("air blower")
    || name.includes("air-blower")
    || name.includes("airblower")
    || name.includes("blower pump")
  );
};

const getFrontendRentalDetailSlug = (item = {}) => {
  const explicitSlug = slugifyRentalValue(item?.slug || "");
  const pageSlug = slugifyRentalValue(getRentalPageLeaf(item?.page));
  const nameSlug = slugifyRentalValue(item?.name);
  const idSlug = String(item?.id || item?.productId || "").trim();

  return explicitSlug || pageSlug || nameSlug || idSlug;
};

const getFrontendRentalDetailPath = (item = {}) =>
  `/rentals/${getFrontendRentalDetailSlug(item)}`;

const matchesFrontendRentalDetailSlug = (item = {}, slug = "") => {
  const normalizedSlug = slugifyRentalValue(slug);
  if (!normalizedSlug) return false;

  const slugCandidates = [
    slugifyRentalValue(item?.slug || ""),
    slugifyRentalValue(getRentalPageLeaf(item?.page)),
    slugifyRentalValue(item?.name),
    slugifyRentalValue(String(item?.id || item?.productId || "").trim()),
  ].filter(Boolean);

  return slugCandidates.includes(normalizedSlug);
};

export {
  getFrontendRentalCategory,
  getFrontendRentalAvailabilityLabel,
  getFrontendRentalDetailPath,
  getFrontendRentalDetailSlug,
  isFrontendRentalBookable,
  isFrontendRentalItem,
  matchesFrontendRentalDetailSlug,
  shouldExcludeFrontendRental,
  slugifyRentalValue,
};
