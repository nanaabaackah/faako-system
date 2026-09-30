const formatDate = (value) => {
  if (!value) return "-";
  if (typeof value === "string") {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return `${day}-${month}-${year.slice(-2)}`;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

const formatFullDate = (value) => {
  if (!value) return "-";
  let date;
  if (typeof value === "string") {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      date = new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  date = date || new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const normalizeCurrency = (currency) => {
  if (typeof currency !== "string") return "GHS";
  const trimmed = currency.trim();
  return trimmed ? trimmed.toUpperCase() : "GHS";
};

const formatMoney = (value, currency = "GHS") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const normalized = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: normalized,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${normalized} ${amount}`;
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MOBILE_VIEW_QUERY = "(max-width: 720px)";

const getIsMobileView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;

const formatUser = (name) => name || "Admin";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeCustomerName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");
const getBookingDisplayReference = (booking) =>
  String(booking?.reference || (booking?.id ? `#${booking.id}` : "Booking"));

const formatAttendantsNeeded = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Attendants: -";
  return `Attendants: ${parsed}`;
};

const getBookingItemType = (item) =>
  String(item?.itemType || item?.inventoryItemType || "STANDARD").trim().toUpperCase() || "STANDARD";

const isBookingVariantParent = (item) => getBookingItemType(item) === "VARIANT_PARENT";

const getBookingVariants = (item) => (Array.isArray(item?.variants) ? item.variants : []);

const getBookingVariantAvailableQty = (variant) => {
  const explicit = Number(variant?.availableQty);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  return Math.max(0, Number(variant?.stockQty ?? 0) - Number(variant?.reservedQty ?? 0));
};

const getBookingLineKey = (productId, variantId = "") => `${productId}:${variantId || "standard"}`;

const formatBookingVariantName = (product, variant) =>
  [product?.name, variant?.variantName, variant?.variantNumber, variant?.color, variant?.size]
    .filter(Boolean)
    .join(" / ");

const normalizeStatus = (status) => {
  if (typeof status !== "string") return "";
  const normalized = status.trim().toLowerCase();
  return normalized === "canceled" ? "cancelled" : normalized;
};

const BOOKING_STATUS_FILTERS = new Set(["all", "pending", "confirmed", "completed", "cancelled"]);

const normalizeBookingStatusFilter = (value) => {
  const normalized = normalizeStatus(value);
  return BOOKING_STATUS_FILTERS.has(normalized) ? normalized : "all";
};

const BOOKING_TIMING_FILTERS = new Set(["all", "today", "overdue", "next7"]);

const normalizeBookingTimingFilter = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return BOOKING_TIMING_FILTERS.has(normalized) ? normalized : "all";
};

const normalizeIdFilter = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
};

const BOOKING_VIEW_FILTERS = new Set(["list", "cards", "board", "map"]);
const MOBILE_BOOKING_VIEW_FILTERS = new Set(["list", "map"]);
const BOOKINGS_UI_STORAGE_KEY = "reebs_portal_bookings_ui_state";
const BOOKING_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const BOOKING_TIMING_OPTIONS = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "next7", label: "Next 7 days" },
  { value: "overdue", label: "Overdue" },
];
const BOOKING_EDITOR_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const BOOKING_EDITOR_NEXT_STATUSES = {
  pending: new Set(["pending", "confirmed", "cancelled"]),
  confirmed: new Set(["confirmed", "completed", "cancelled"]),
  completed: new Set(["completed"]),
  cancelled: new Set(["cancelled"]),
};
const BOOKING_TIME_OPTIONS = [
  { value: "", label: "No time" },
  ...Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 === 0 ? "00" : "30";
    const value = `${String(hour).padStart(2, "0")}:${minute}`;
    return { value, label: value };
  }),
];

const normalizeBookingView = (value, { isMobile = false } = {}) => {
  const normalized = String(value || "").trim().toLowerCase();
  const allowedViews = isMobile ? MOBILE_BOOKING_VIEW_FILTERS : BOOKING_VIEW_FILTERS;
  if (allowedViews.has(normalized)) return normalized;
  return "list";
};

const readStoredBookingsUiState = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(BOOKINGS_UI_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const getInitialBookingsUiState = () => {
  if (typeof window === "undefined") {
      return {
        status: "all",
        assigned: "",
        timing: "all",
        query: "",
        view: "list",
      };
  }

  const params = new URLSearchParams(window.location.search);
  const hasUrlUiState = ["q", "status", "assigned", "timing", "view"].some((key) => params.has(key));
  const stored = readStoredBookingsUiState();
  const isMobile = getIsMobileView();

  if (hasUrlUiState) {
    return {
      status: normalizeBookingStatusFilter(params.get("status")),
      assigned: normalizeIdFilter(params.get("assigned")),
      timing: normalizeBookingTimingFilter(params.get("timing")),
      query: params.get("q") || "",
      view: normalizeBookingView(params.get("view"), { isMobile }),
    };
  }

  return {
    status: normalizeBookingStatusFilter(stored?.status),
    assigned: normalizeIdFilter(stored?.assigned),
    timing: normalizeBookingTimingFilter(stored?.timing),
    query: String(stored?.query || ""),
    view: normalizeBookingView(stored?.view, { isMobile }),
  };
};

const isClosedBooking = (booking) => {
  const status = normalizeStatus(booking?.status);
  return ["completed", "cancelled"].includes(status);
};

const getBookingScheduleDate = (booking) => {
  if (!booking?.eventDate) return null;
  const parsed = new Date(booking.eventDate);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const matchesBookingTiming = (booking, timingFilter) => {
  if (timingFilter === "all") return true;
  if (isClosedBooking(booking)) return false;
  const eventDate = getBookingScheduleDate(booking);
  if (!eventDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (timingFilter === "today") {
    return eventDate.getTime() === today.getTime();
  }
  if (timingFilter === "overdue") {
    return eventDate.getTime() < today.getTime();
  }
  if (timingFilter === "next7") {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return eventDate.getTime() >= today.getTime() && eventDate.getTime() < nextWeek.getTime();
  }
  return true;
};

const normalizeBookingTimeInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const twentyFourHourMatch = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHourMatch) {
    const [, hour, minute] = twentyFourHourMatch;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }
  const meridiemMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!meridiemMatch) return raw;
  const [, hourText, minute, meridiem] = meridiemMatch;
  let hour = Number(hourText);
  if (!Number.isFinite(hour)) return raw;
  const normalizedMeridiem = meridiem.toUpperCase();
  if (normalizedMeridiem === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour < 12) {
    hour += 12;
  }
  return `${String(hour).padStart(2, "0")}:${minute}`;
};

const buildBookingsSearch = ({
  query = "",
  status = "all",
  assigned = "",
  timing = "all",
  view,
  isMobile = false,
  action = "",
  id = "",
} = {}) => {
  const params = new URLSearchParams();
  const trimmedQuery = String(query || "").trim();
  const normalizedStatus = normalizeBookingStatusFilter(status);
  const normalizedAssigned = normalizeIdFilter(assigned);
  const normalizedTiming = normalizeBookingTimingFilter(timing);
  const normalizedView = normalizeBookingView(view, { isMobile });
  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }
  if (normalizedStatus !== "all") {
    params.set("status", normalizedStatus);
  }
  if (normalizedAssigned) {
    params.set("assigned", normalizedAssigned);
  }
  if (normalizedTiming !== "all") {
    params.set("timing", normalizedTiming);
  }
  if (normalizedView) {
    params.set("view", normalizedView);
  }
  if (action) {
    params.set("action", String(action).trim().toLowerCase());
  }
  if (id) {
    params.set("id", String(id).trim());
  }
  const next = params.toString();
  return next ? `?${next}` : "";
};

const buildMapUrl = (address) => {
  if (!address) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
};

const formatBookingTimeWindow = (booking) => {
  const start = String(booking?.startTime || "").trim().toUpperCase();
  const end = String(booking?.endTime || "").trim().toUpperCase();
  if (!start && !end) return "TIME TBD";
  return start || end;
};

const getBookingDocumentTitle = (document) => {
  if (!document) return "Draft";
  const reference = String(document.invoiceNumber || "").trim();
  if (reference) return reference;
  return "Draft";
};

const getBookingDocumentStatus = (document) => {
  if (!document) return "Open in invoicing";
  const paymentStatus = String(document.paymentStatus || "draft").trim().toLowerCase();
  if (paymentStatus === "paid" || paymentStatus === "unpaid") return paymentStatus;
  if (document.sentAt) return "unpaid";
  return paymentStatus || "draft";
};

const getDeliveryStatusLabel = (delivery) => {
  if (!delivery) return "No stop";
  return normalizeStatus(delivery.deliveryStatus || delivery.status || "scheduled").replace(/_/g, " ");
};

const getDeliveryMeta = (delivery) => {
  if (!delivery) return "Open delivery";
  return delivery.driverName || delivery.assignedUserName || "Unassigned";
};

const DESKTOP_BOOKING_VIEW_OPTIONS = [
  { key: "list", label: "List" },
  { key: "cards", label: "Cards" },
  { key: "board", label: "Board" },
  { key: "map", label: "Map" },
];

const MOBILE_BOOKING_VIEW_OPTIONS = [
  { key: "list", label: "List" },
  { key: "map", label: "Map" },
];

const sumBookingExpenses = (rows = []) =>
  rows.reduce((sum, row) => sum + toNumber(row?.amount, 0) / 100, 0);

const buildBookingEditorState = (booking, currentUserId = "") => ({
  customerId: booking?.customerId ? String(booking.customerId) : "",
  customerName: booking?.customerName || "",
  eventDate: booking?.eventDate ? String(booking.eventDate).slice(0, 10) : "",
  eventEndDate: booking?.eventEndDate
    ? String(booking.eventEndDate).slice(0, 10)
    : booking?.eventDate
      ? String(booking.eventDate).slice(0, 10)
      : "",
  startTime: normalizeBookingTimeInput(booking?.startTime),
  endTime: normalizeBookingTimeInput(booking?.endTime),
  venueAddress: booking?.venueAddress || "",
  venueGhanaPostGps: booking?.venueGhanaPostGps || "",
  customerNotes: booking?.customerNotes || "",
  internalNotes: booking?.internalNotes || "",
  status: booking?.status || "pending",
  assignedUserId: booking?.assignedUserId ? String(booking.assignedUserId) : currentUserId,
  items: Array.isArray(booking?.items)
    ? booking.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        productName: item.productName || "",
        variantLabel: item.variantLabel || "",
        quantity: item.quantity,
        price: Number.isFinite(item.price) ? (item.price / 100).toFixed(2) : "",
      }))
    : [],
  discount: Number(booking?.discountCents || 0) > 0
    ? (Number(booking.discountCents) / 100).toFixed(2)
    : "",
  discountType: "amount",
});

const getTodayDateInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createDebouncedCallback = (callback, delayMs = 300) => {
  let timeoutId = null;
  const debounced = (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(...args);
      timeoutId = null;
    }, delayMs);
  };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
  return debounced;
};

const createAbortController = () => {
  if (typeof AbortController === "undefined") return null;
  return new AbortController();
};

const buildDetailExpenseDraft = (booking = null) => ({
  query: "",
  amount: "",
  date: booking?.eventDate ? String(booking.eventDate).slice(0, 10) : getTodayDateInputValue(),
});

export {
  formatDate,
  formatFullDate,
  normalizeCurrency,
  formatMoney,
  formatDateTime,
  MOBILE_VIEW_QUERY,
  getIsMobileView,
  formatUser,
  toNumber,
  normalizeCustomerName,
  normalizePhoneDigits,
  getBookingDisplayReference,
  formatAttendantsNeeded,
  getBookingItemType,
  isBookingVariantParent,
  getBookingVariants,
  getBookingVariantAvailableQty,
  getBookingLineKey,
  formatBookingVariantName,
  normalizeStatus,
  normalizeBookingStatusFilter,
  normalizeBookingTimingFilter,
  normalizeIdFilter,
  BOOKINGS_UI_STORAGE_KEY,
  BOOKING_STATUS_OPTIONS,
  BOOKING_TIMING_OPTIONS,
  BOOKING_EDITOR_STATUS_OPTIONS,
  BOOKING_EDITOR_NEXT_STATUSES,
  BOOKING_TIME_OPTIONS,
  normalizeBookingView,
  getInitialBookingsUiState,
  isClosedBooking,
  matchesBookingTiming,
  normalizeBookingTimeInput,
  buildBookingsSearch,
  buildMapUrl,
  formatBookingTimeWindow,
  getBookingDocumentTitle,
  getBookingDocumentStatus,
  getDeliveryStatusLabel,
  getDeliveryMeta,
  DESKTOP_BOOKING_VIEW_OPTIONS,
  MOBILE_BOOKING_VIEW_OPTIONS,
  sumBookingExpenses,
  buildBookingEditorState,
  createDebouncedCallback,
  createAbortController,
  buildDetailExpenseDraft,
};
