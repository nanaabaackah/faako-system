const TIME_WINDOWS = new Set([
  "9am-11am",
  "11am-1pm",
  "1pm-3pm",
  "3pm-5pm",
  "5pm-7pm",
]);

const isRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
};

const cleanDate = (value) => {
  const next = cleanText(value, 32);
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "";
};

const cleanWindow = (value) => {
  const next = cleanText(value, 32);
  return TIME_WINDOWS.has(next) ? next : "";
};

const cleanDistanceKm = (value) => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.replace(/[^\d.]+/g, ""))
        : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 10) / 10;
};

export const sanitizeOrderLogisticsDetails = (value) => {
  if (!isRecord(value)) return null;

  const next = {};
  const address = cleanText(value.address, 240);
  const contact = cleanText(value.contact, 64);
  const date = cleanDate(value.date);
  const window = cleanWindow(value.window);
  const notes = cleanText(value.notes, 500);
  const distanceKm = cleanDistanceKm(value.distanceKm);

  if (address) next.address = address;
  if (contact) next.contact = contact;
  if (date) next.date = date;
  if (window) next.window = window;
  if (notes) next.notes = notes;
  if (Number.isFinite(distanceKm)) next.distanceKm = distanceKm;

  return Object.keys(next).length ? next : null;
};
