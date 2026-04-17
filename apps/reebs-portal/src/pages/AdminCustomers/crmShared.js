import { faClipboardList, faColumns, faTableCells } from "/src/icons/iconSet";

export const EMPTY_CUSTOMER_FORM = { name: "", email: "", phone: "" };

export const SEGMENT_OPTIONS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "loyal", label: "Loyal" },
  { key: "risk", label: "At risk" },
  { key: "prospect", label: "New" },
];

export const SORT_OPTIONS = [
  { key: "recent", label: "Recent" },
  { key: "value", label: "Value" },
  { key: "activity", label: "Activity" },
  { key: "name", label: "Name" },
];

export const VIEW_OPTIONS = [
  { key: "list", label: "List", icon: faClipboardList },
  { key: "card", label: "Cards", icon: faTableCells },
  { key: "kanban", label: "Kanban", icon: faColumns },
];

export const MOBILE_CARD_VIEW_QUERY = "(max-width: 720px)";

export const KANBAN_COLUMNS = [
  { key: "prospect", label: "New" },
  { key: "active", label: "Active" },
  { key: "loyal", label: "Loyal" },
  { key: "risk", label: "At risk" },
];

export const CUSTOMER_SEGMENTS = new Set(KANBAN_COLUMNS.map((column) => column.key));

export const getIsMobileCardView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_CARD_VIEW_QUERY).matches;

export const formatMoney = (value, currency = "GHS") => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  } catch {
    return `${currency} ${Math.round(Number(value) || 0)}`;
  }
};

export const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const centsToMoneyAmount = (value) => toNumber(value) / 100;

export const sanitizePhone = (value) => String(value || "").replace(/\D/g, "");

export const getQuantile = (values, percentile) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * percentile))
  );
  return sorted[index];
};

export const getLastTouch = (customer) =>
  customer?.last_activity_at || customer?.updatedAt || customer?.createdAt || null;

export const getDaysSince = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

export const getTouchLabel = (daysSince) => {
  if (daysSince === null) return "No activity";
  if (daysSince <= 0) return "Today";
  if (daysSince === 1) return "1 day";
  if (daysSince < 30) return `${daysSince} days`;
  const months = Math.round(daysSince / 30);
  if (months < 12) return `${months} mo`;
  return `${Math.round(daysSince / 365)} yr`;
};

export const getSegmentLabel = (segment) => {
  switch (segment) {
    case "loyal":
      return "Loyal";
    case "risk":
      return "At risk";
    case "prospect":
      return "New";
    case "active":
    default:
      return "Active";
  }
};

export const getCustomerSegment = (record, thresholds) => {
  if (CUSTOMER_SEGMENTS.has(record.segmentOverride)) {
    return record.segmentOverride;
  }
  if (record.activity <= 0) return "prospect";
  if (record.daysSince !== null && record.daysSince > 120) return "risk";
  if (record.ltv >= thresholds.loyalValue || record.activity >= thresholds.loyalActivity) {
    return "loyal";
  }
  return "active";
};

export const buildSearchBlob = (customer) =>
  [
    customer.name,
    customer.email,
    customer.phone,
    sanitizePhone(customer.phone),
    getSegmentLabel(customer.segment),
    customer.orders,
    customer.bookings,
    customer.ltv,
    formatDate(customer.lastTouch),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const readResponseError = async (response, fallbackMessage) => {
  try {
    const body = await response.json();
    return body?.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};
