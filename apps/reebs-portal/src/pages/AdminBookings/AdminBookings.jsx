/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import "./AdminBookings.css";
import {
  OFFLINE_QUEUE_ACTION_TYPES,
  SYNC_STATES,
  createIndexedDbQueueStorage,
  incrementRetryMetadata,
  useOnlineStatus,
} from "@faako/offline-sync";
import { AnimatedLoadingState, NoticeBanner, SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faPlus,
  faRotateRight,
  faTruck,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import TablePagination from "../../components/TablePagination/TablePagination";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../components/AuthContext/AuthContext";
import SearchField from "../../components/SearchField/SearchField";
import BookingEditorModal from "./components/BookingEditorModal";
import BookingDetailModal from "./components/BookingDetailModal";
import {
  canAccessPrivilegedPortalArea,
  normalizeAdminRole,
} from "../../utils/adminAccess";
import {
  fetchBookingInvoiceDetails,
  fetchInvoiceDocumentById,
} from "../../utils/invoiceDocumentCache";
import {
  buildQueuedBookingAction,
  getBookingQueueFailureState,
  getQueuedBookingNotice,
  isQueuedBookingForScope,
} from "./offlineBookingQueue";

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

function BookingCustomerPicker({
  value,
  onChange,
  onClear,
  onFocus,
  onBlur,
  onKeyDown,
  menuOpen,
  options,
  selectedCustomerId,
  onSelectCustomer,
  typedCustomerName,
  matchedTypedCustomer,
  onCreateCustomer,
  createBusy = false,
  disabled = false,
  directoryError = "",
}) {
  return (
    <div className="bookings-customer-picker">
      <SearchField
        value={value}
        onChange={onChange}
        onClear={onClear}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="Search or add customer"
        aria-label="Search or add customer"
        disabled={disabled}
        required
      />
      {menuOpen ? (
        options.length || typedCustomerName ? (
          <div className="bookings-customer-options" role="listbox" aria-label="Customer directory">
            {options.map((customer) => {
              const isActive = String(customer.id) === String(selectedCustomerId);
              return (
                <button
                  key={customer.id}
                  type="button"
                  className={`bookings-customer-option${isActive ? " is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelectCustomer(String(customer.id))}
                  disabled={disabled}
                >
                  <span>{customer.name}</span>
                  <small>{customer.phone ? customer.phone : `#${customer.id}`}</small>
                </button>
              );
            })}
            {typedCustomerName && !matchedTypedCustomer ? (
              <button
                type="button"
                className="bookings-customer-option bookings-customer-option--create"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onCreateCustomer}
                disabled={disabled || createBusy}
              >
                <span>{createBusy ? `Creating "${typedCustomerName}"...` : `Create "${typedCustomerName}"`}</span>
                <small>{createBusy ? "Please wait" : "Press Enter"}</small>
              </button>
            ) : null}
          </div>
        ) : null
      ) : null}
      {typedCustomerName && !matchedTypedCustomer ? (
        <p className="bookings-inline-note">New customer will be created on save.</p>
      ) : null}
      {directoryError ? <p className="bookings-inline-note">{directoryError}</p> : null}
    </div>
  );
}

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

const isCompletedBooking = (booking) => normalizeStatus(booking?.status) === "completed";

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

const parseJsonResponse = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const buildBookingEditorState = (booking, currentUserId = "") => ({
  customerId: booking?.customerId ? String(booking.customerId) : "",
  customerName: booking?.customerName || "",
  eventDate: booking?.eventDate ? String(booking.eventDate).slice(0, 10) : "",
  startTime: normalizeBookingTimeInput(booking?.startTime),
  endTime: normalizeBookingTimeInput(booking?.endTime),
  venueAddress: booking?.venueAddress || "",
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
  discount: "",
  discountType: "amount",
});

const getTodayDateInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// OPTIMIZATION: Debounce utility to prevent request storms (accounting module pattern)
const createDebouncedCallback = (callback, delayMs = 300) => {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(...args);
      timeoutId = null;
    }, delayMs);
  };
};

// OPTIMIZATION: Request cancellation helper for race condition prevention
const createAbortController = () => {
  if (typeof AbortController === "undefined") return null;
  return new AbortController();
};

const buildDetailExpenseDraft = (booking = null) => ({
  query: "",
  amount: "",
  date: booking?.eventDate ? String(booking.eventDate).slice(0, 10) : getTodayDateInputValue(),
});

function AdminBookings() {
  const location = useLocation();
  const initialUiState = getInitialBookingsUiState();
  const [bookings, setBookings] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialUiState.status);
  const [assignedFilter, setAssignedFilter] = useState(initialUiState.assigned);
  const [timingFilter, setTimingFilter] = useState(initialUiState.timing);
  const [query, setQuery] = useState(initialUiState.query);
  const [viewMode, setViewMode] = useState(initialUiState.view);
  const [page, setPage] = useState(0);
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [mapSelectionId, setMapSelectionId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const pageSize = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [bookingQueueNotice, setBookingQueueNotice] = useState(null);
  const [offlineNoticeDismissed, setOfflineNoticeDismissed] = useState(false);
  const [detailBooking, setDetailBooking] = useState(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailExpenseDraft, setDetailExpenseDraft] = useState(() => buildDetailExpenseDraft());
  const [detailExpenseSaving, setDetailExpenseSaving] = useState(false);
  const [detailExpenseError, setDetailExpenseError] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [customerCreating, setCustomerCreating] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    venueAddress: "",
    status: "pending",
    assignedUserId: "",
    items: [],
    discount: "",
    discountType: "amount",
  });
  const [bouncyCastles, setBouncyCastles] = useState([]);
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const bookingQueueStorage = useMemo(() => createIndexedDbQueueStorage(), []);
  const roleKey = normalizeAdminRole(user?.role);
  const canManageBookings = canAccessPrivilegedPortalArea(roleKey);
  const canAccessInvoicing = canManageBookings;
  const navigate = useNavigate();
  const supportLoadStateRef = useRef({
    products: { loaded: false, promise: null },
    customers: { loaded: false, promise: null },
    bouncyCastles: { loaded: false, promise: null },
    deliveries: { loaded: false, promise: null },
    expenses: { loaded: false, promise: null },
  });
  
  // OPTIMIZATION: Cache request cancellation and mobile view state
  const requestCancelRef = useRef(null);
  const bookingQueueSyncingRef = useRef(false);
  const cachedIsMobileView = useRef(getIsMobileView());
  const debouncedSetStatusFilterRef = useRef(null);
  const debouncedSetAssignedFilterRef = useRef(null);
  const debouncedSetTimingFilterRef = useRef(null);
  const debouncedSetQueryRef = useRef(null);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => {
      document.body.classList.remove("admin-theme");
      // OPTIMIZATION: Cleanup pending requests on unmount
      if (requestCancelRef.current) {
        requestCancelRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      setOfflineNoticeDismissed(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(MOBILE_VIEW_QUERY);
    const handleChange = () => {
      const matches = mediaQuery.matches;
      cachedIsMobileView.current = matches; // OPTIMIZATION: Cache the value
      setIsMobileView(matches);
      if (matches) {
        setModalOpen(false);
        setEditing(null);
        setViewMode((current) => normalizeBookingView(current, { isMobile: true }));
      }
    };
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    setDetailExpenseDraft(buildDetailExpenseDraft(detailBooking));
    setDetailExpenseSaving(false);
    setDetailExpenseError("");
  }, [detailBooking?.eventDate, detailBooking?.id]);

  useEffect(() => {
    if (detailBooking) return;
    setDetailEditing(false);
  }, [detailBooking]);

  // OPTIMIZATION: Initialize debounced filter setters
  useEffect(() => {
    debouncedSetStatusFilterRef.current = createDebouncedCallback((value) => {
      setStatusFilter(value);
    }, 300);
    debouncedSetAssignedFilterRef.current = createDebouncedCallback((value) => {
      setAssignedFilter(value);
    }, 300);
    debouncedSetTimingFilterRef.current = createDebouncedCallback((value) => {
      setTimingFilter(value);
    }, 300);
    debouncedSetQueryRef.current = createDebouncedCallback((value) => {
      setQuery(value);
    }, 300);

    return () => {
      // Cleanup: flush any pending debounced updates
      if (debouncedSetStatusFilterRef.current) {
        debouncedSetStatusFilterRef.current.flush?.();
      }
      if (debouncedSetAssignedFilterRef.current) {
        debouncedSetAssignedFilterRef.current.flush?.();
      }
      if (debouncedSetTimingFilterRef.current) {
        debouncedSetTimingFilterRef.current.flush?.();
      }
      if (debouncedSetQueryRef.current) {
        debouncedSetQueryRef.current.flush?.();
      }
    };
  }, []);

  const runSupportLoader = (key, loader, { force = false } = {}) => {
    const entry = supportLoadStateRef.current[key];
    if (entry.promise) return entry.promise;
    if (!force && entry.loaded) return Promise.resolve();
    entry.promise = (async () => {
      try {
        await loader();
        entry.loaded = true;
      } catch (err) {
        entry.loaded = false;
        throw err;
      } finally {
        entry.promise = null;
      }
    })();
    return entry.promise;
  };

  const loadProducts = ({ force = false } = {}) =>
    runSupportLoader(
      "products",
      async () => {
        const response = await fetch("/api/inventory");
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to fetch products (${response.status}).`);
        }
        const rentalProducts = (Array.isArray(payload) ? payload : []).filter((item) => {
          const sku = (item.sku || "").toString().toUpperCase();
          const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toString().toUpperCase();
          const name = (item.name || "").toString().toLowerCase();
          const isPump = sku.startsWith("PUM") || name.includes("motor pump");
          return (source === "RENTAL" || sku.startsWith("RENT")) && !isPump;
        });
        setProducts(rentalProducts);
      },
      { force }
    );

  const loadCustomers = ({ force = false } = {}) =>
    runSupportLoader(
      "customers",
      async () => {
        const response = await fetch("/api/customers?compact=1");
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to fetch customers (${response.status}).`);
        }
        setCustomers(Array.isArray(payload) ? payload : []);
      },
      { force }
    );

  const loadBouncyCastles = ({ force = false } = {}) =>
    runSupportLoader(
      "bouncyCastles",
      async () => {
        const response = await fetch("/api/bouncy_castles");
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to fetch bouncy castles (${response.status}).`);
        }
        setBouncyCastles(Array.isArray(payload) ? payload : []);
      },
      { force }
    );

  const loadDeliveries = ({ force = false } = {}) =>
    runSupportLoader(
      "deliveries",
      async () => {
        const response = await fetch("/api/deliveries");
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to fetch deliveries (${response.status}).`);
        }
        setDeliveries(Array.isArray(payload) ? payload : []);
      },
      { force }
    );

  const loadExpenses = ({ force = false } = {}) =>
    runSupportLoader(
      "expenses",
      async () => {
        const response = await fetch("/api/expenses");
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to fetch expenses (${response.status}).`);
        }
        setExpenses(Array.isArray(payload) ? payload : []);
      },
      { force }
    );

  const fetchBookingById = useCallback(async (bookingId) => {
    // OPTIMIZATION: Cancel previous request if still pending
    if (requestCancelRef.current) {
      requestCancelRef.current.abort();
    }
    requestCancelRef.current = createAbortController();
    
    try {
      const response = await fetch(`/api/bookings?id=${bookingId}`, {
        signal: requestCancelRef.current?.signal,
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to fetch booking (${response.status}).`);
      }
      return payload;
    } catch (err) {
      // Ignore abort errors (user navigated away)
      if (err.name === "AbortError") return null;
      throw err;
    }
  }, []);

  const ensureSupportData = async (
    {
      products: shouldLoadProducts = false,
      customers: shouldLoadCustomers = false,
      bouncyCastles: shouldLoadBouncyCastles = false,
      deliveries: shouldLoadDeliveries = false,
      expenses: shouldLoadExpenses = false,
    } = {},
    options = {}
  ) => {
    const tasks = [];
    if (shouldLoadProducts) tasks.push(loadProducts(options));
    if (shouldLoadCustomers) tasks.push(loadCustomers(options));
    if (shouldLoadBouncyCastles) tasks.push(loadBouncyCastles(options));
    if (shouldLoadDeliveries) tasks.push(loadDeliveries(options));
    if (shouldLoadExpenses) tasks.push(loadExpenses(options));
    
    // OPTIMIZATION: Better error handling - log errors but don't fail entire operation
    const results = await Promise.allSettled(tasks);
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason);
    
    if (errors.length > 0) {
      console.warn("Some support data failed to load:", errors);
    }
    
    // Return success if at least some data loaded
    return true;
  };

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const requests = [fetch("/api/bookings?compact=1")];
      if (canManageBookings) {
        requests.push(fetch("/api/users"));
        requests.push(fetch("/api/invoice-documents?compact=1"));
      }
      const responses = await Promise.all(requests);
      const payloads = await Promise.all(responses.map((response) => parseJsonResponse(response)));
      const bookingsRes = responses[0];
      const bookingsPayload = payloads[0];
      const usersRes = canManageBookings ? responses[1] : null;
      const usersPayload = canManageBookings ? payloads[1] : [];
      const documentsRes = canManageBookings ? responses[2] : null;
      const documentsPayload = canManageBookings ? payloads[2] : [];

      if (!bookingsRes.ok) {
        throw new Error(bookingsPayload?.error || `Failed to fetch bookings (${bookingsRes.status}).`);
      }
      if (usersRes && !usersRes.ok) {
        throw new Error(usersPayload?.error || `Failed to fetch team members (${usersRes.status}).`);
      }
      if (documentsRes && !documentsRes.ok) {
        throw new Error(documentsPayload?.error || `Failed to fetch invoice documents (${documentsRes.status}).`);
      }

      setBookings(Array.isArray(bookingsPayload) ? bookingsPayload : []);
      setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      setDocuments(Array.isArray(documentsPayload) ? documentsPayload : []);
      void ensureSupportData(
        canManageBookings ? { deliveries: true, expenses: true } : { deliveries: true },
        { force: true }
      ).catch((err) => {
        console.warn("Failed to hydrate booking support data", err);
      });
    } catch (err) {
      console.error("Failed to load bookings", err);
      setError(err.message || "We couldn't load bookings right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [canManageBookings]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasUrlUiState = ["q", "status", "assigned", "timing", "view"].some((key) => params.has(key));
    if (!hasUrlUiState) return;
    const nextQuery = params.get("q") || "";
    const nextStatus = normalizeBookingStatusFilter(params.get("status"));
    const nextAssigned = normalizeIdFilter(params.get("assigned"));
    const nextTiming = normalizeBookingTimingFilter(params.get("timing"));
    const nextView = normalizeBookingView(params.get("view"), { isMobile: isMobileView });
    setQuery((current) => (current === nextQuery ? current : nextQuery));
    setStatusFilter((current) => (current === nextStatus ? current : nextStatus));
    setAssignedFilter((current) => (current === nextAssigned ? current : nextAssigned));
    setTimingFilter((current) => (current === nextTiming ? current : nextTiming));
    setViewMode((current) => (current === nextView ? current : nextView));
  }, [isMobileView, location.search]);

  useEffect(() => {
    const normalizedView = normalizeBookingView(viewMode, { isMobile: isMobileView });
    if (normalizedView === viewMode) return;
    setViewMode(normalizedView);
  }, [isMobileView, viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        BOOKINGS_UI_STORAGE_KEY,
        JSON.stringify({
          status: statusFilter,
          assigned: assignedFilter,
          timing: timingFilter,
          query,
          view: viewMode,
        })
      );
    } catch {
      // Ignore storage failures and keep the page usable.
    }
  }, [assignedFilter, query, statusFilter, timingFilter, viewMode]);

  useEffect(() => {
    setPage(0);
  }, [assignedFilter, statusFilter, query, timingFilter, bookings.length, viewMode]);

  const productMap = useMemo(() => {
    const map = new Map();
    for (const item of products) {
      map.set(Number(item.id), item);
    }
    return map;
  }, [products]);

  const bouncyMap = useMemo(() => {
    const map = new Map();
    for (const castle of bouncyCastles) {
      const productId = Number(castle?.productId);
      if (!Number.isFinite(productId)) continue;
      const motors = toNumber(castle?.motorsToPump, 0);
      map.set(productId, motors);
    }
    return map;
  }, [bouncyCastles]);

  const customerById = useMemo(() => {
    const map = new Map();
    customers.forEach((customer) => {
      const customerId = Number(customer?.id);
      if (!Number.isFinite(customerId)) return;
      map.set(customerId, customer);
    });
    return map;
  }, [customers]);

  const deliveryByBookingId = useMemo(() => {
    const map = new Map();
    deliveries.forEach((delivery) => {
      const bookingId = Number(delivery?.bookingId || delivery?.id);
      if (!Number.isFinite(bookingId)) return;
      map.set(bookingId, delivery);
    });
    return map;
  }, [deliveries]);

  const expensesByBookingId = useMemo(() => {
    const map = new Map();
    expenses.forEach((expense) => {
      const bookingId = Number(expense?.bookingId);
      if (!Number.isFinite(bookingId)) return;
      const current = map.get(bookingId) || [];
      current.push(expense);
      map.set(bookingId, current);
    });
    return map;
  }, [expenses]);

  const documentByBookingId = useMemo(() => {
    const map = new Map();
    documents.forEach((document) => {
      const sourceType = String(document?.sourceType || "").trim().toLowerCase();
      const sourceId = Number(document?.sourceId);
      if (sourceType !== "bookings" || !Number.isFinite(sourceId)) return;
      map.set(sourceId, document);
    });
    return map;
  }, [documents]);

  const detailItems = useMemo(() => {
    if (!detailBooking || !Array.isArray(detailBooking.items)) return [];
    const baseItems = detailBooking.items.map((item, index) => ({
      ...item,
      _key: `item-${item.id || item.productId || index}-${item.variantId || "standard"}`,
    }));

    const hasPump = baseItems.some((item) => {
      const product = productMap.get(Number(item.productId));
      const name = String(item.productName || product?.name || "").toLowerCase();
      const sku = String(product?.sku || "").toUpperCase();
      return name.includes("pump") || sku.startsWith("PUM");
    });

    const pumpQuantity = baseItems.reduce((sum, item) => {
      const motors = bouncyMap.get(Number(item.productId)) || 0;
      if (!motors) return sum;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      return sum + motors * qty;
    }, 0);

    if (pumpQuantity > 0 && !hasPump) {
      baseItems.push({
        productId: "motor-pump",
        quantity: pumpQuantity,
        productName: "Motor Pump",
        productImage: "",
        _key: `pump-${detailBooking.id || "detail"}`,
      });
    }

    return baseItems;
  }, [detailBooking, productMap, bouncyMap]);

  const filteredBookings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = bookings.filter((booking) => {
      if (statusFilter !== "all" && String(booking.status || "").toLowerCase() !== statusFilter) {
        return false;
      }
      if (assignedFilter && String(booking.assignedUserId || "") !== assignedFilter) {
        return false;
      }
      if (!matchesBookingTiming(booking, timingFilter)) {
        return false;
      }
      if (!needle) return true;
      const idText = String(booking.id || "").toLowerCase();
      const customer = String(booking.customerName || "").toLowerCase();
      const status = String(booking.status || "").toLowerCase();
      return idText.includes(needle) || customer.includes(needle) || status.includes(needle);
    });
    return list;
  }, [assignedFilter, bookings, query, statusFilter, timingFilter]);

  const sortedBookings = useMemo(() => {
    const list = [...filteredBookings];
    list.sort((a, b) => {
      const aClosed = isClosedBooking(a) ? 1 : 0;
      const bClosed = isClosedBooking(b) ? 1 : 0;
      if (aClosed !== bClosed) return aClosed - bClosed;

      const aEvent = new Date(a.eventDate || 0).getTime();
      const bEvent = new Date(b.eventDate || 0).getTime();
      if (aEvent !== bEvent) return aEvent - bEvent;

      return Number(b.id || 0) - Number(a.id || 0);
    });
    return list;
  }, [filteredBookings]);

  // OPTIMIZATION: Memoize view mode normalization to avoid recalculation on every render
  const activeViewMode = useMemo(() => {
    return normalizeBookingView(viewMode, { isMobile: isMobileView });
  }, [viewMode, isMobileView]);

  const availableViewOptions = isMobileView
    ? MOBILE_BOOKING_VIEW_OPTIONS
    : DESKTOP_BOOKING_VIEW_OPTIONS;

  const bookingBoardColumns = useMemo(() => {
    const columns = [
      { id: "pending", label: "Pending", items: [] },
      { id: "confirmed", label: "Confirmed", items: [] },
      { id: "completed", label: "Completed", items: [] },
      { id: "cancelled", label: "Cancelled", items: [] },
    ];
    const columnMap = new Map(columns.map((column) => [column.id, column]));

    sortedBookings.forEach((booking) => {
      const stage = normalizeStatus(booking?.status);
      const columnId = columnMap.has(stage) ? stage : "pending";
      columnMap.get(columnId)?.items.push(booking);
    });

    return columns;
  }, [sortedBookings]);

  useEffect(() => {
    if (loading) return;
    if (activeViewMode === "map") {
      void ensureSupportData({ deliveries: true }).catch((err) => {
        console.warn("Failed to load delivery data", err);
      });
    }
  }, [activeViewMode, loading]);

  const bookingsWithAddress = useMemo(
    () => sortedBookings.filter((booking) => String(booking?.venueAddress || "").trim()),
    [sortedBookings]
  );

  useEffect(() => {
    if (!bookingsWithAddress.length) {
      setMapSelectionId(null);
      return;
    }
    setMapSelectionId((current) => {
      if (bookingsWithAddress.some((booking) => String(booking.id) === String(current))) {
        return current;
      }
      return bookingsWithAddress[0].id;
    });
  }, [bookingsWithAddress]);

  const selectedMapBooking = useMemo(() => {
    if (!bookingsWithAddress.length) return null;
    return bookingsWithAddress.find((booking) => String(booking.id) === String(mapSelectionId)) || bookingsWithAddress[0];
  }, [bookingsWithAddress, mapSelectionId]);

  const detailIndex = useMemo(() => {
    if (!detailBooking) return -1;
    return sortedBookings.findIndex((booking) => booking.id === detailBooking.id);
  }, [detailBooking, sortedBookings]);

  const canGoPrevDetail = detailIndex > 0;
  const canGoNextDetail = detailIndex >= 0 && detailIndex < sortedBookings.length - 1;

  const goPrevDetail = () => {
    if (!canGoPrevDetail) return;
    openBookingDetail(sortedBookings[detailIndex - 1]);
  };

  const goNextDetail = () => {
    if (!canGoNextDetail) return;
    openBookingDetail(sortedBookings[detailIndex + 1]);
  };

  const detailCustomer = useMemo(
    () => (detailBooking ? customerById.get(Number(detailBooking.customerId)) || null : null),
    [customerById, detailBooking]
  );

  const detailDelivery = useMemo(
    () => (detailBooking ? deliveryByBookingId.get(Number(detailBooking.id)) || null : null),
    [deliveryByBookingId, detailBooking]
  );

  const detailDocument = useMemo(
    () => (detailBooking ? documentByBookingId.get(Number(detailBooking.id)) || null : null),
    [detailBooking, documentByBookingId]
  );

  const detailExpenses = useMemo(
    () => (detailBooking ? expensesByBookingId.get(Number(detailBooking.id)) || [] : []),
    [detailBooking, expensesByBookingId]
  );

  const detailExpenseTotal = useMemo(
    () => sumBookingExpenses(detailExpenses),
    [detailExpenses]
  );

  const pageCount = Math.max(1, Math.ceil(sortedBookings.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedBookings = useMemo(() => {
    const start = clampedPage * pageSize;
    return sortedBookings.slice(start, start + pageSize);
  }, [sortedBookings, clampedPage, pageSize]);
  const bookingsFilteredTotal = useMemo(
    () => sortedBookings.reduce((sum, booking) => sum + toNumber(booking.totalAmount, 0) / 100, 0),
    [sortedBookings]
  );
  const bookingsTableTotal = useMemo(
    () => paginatedBookings.reduce((sum, booking) => sum + toNumber(booking.totalAmount, 0) / 100, 0),
    [paginatedBookings]
  );
  const renderBookingsPagination = (header = false, className = "") => (
    <TablePagination
      total={sortedBookings.length}
      pageIndex={clampedPage}
      pageSize={pageSize}
      pageCount={pageCount}
      onPrevious={() => setPage((p) => Math.max(0, p - 1))}
      onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
      header={header}
      className={className}
    />
  );

  const upcomingBookingsCount = useMemo(
    () => sortedBookings.filter((booking) => matchesBookingTiming(booking, "next7")).length,
    [sortedBookings]
  );

  const confirmedBookingsCount = useMemo(
    () => sortedBookings.filter((booking) => normalizeStatus(booking.status) === "confirmed").length,
    [sortedBookings]
  );

  const completedBookingCount = useMemo(
    () => sortedBookings.filter((booking) => normalizeStatus(booking.status) === "completed").length,
    [sortedBookings]
  );

  const linkedDocumentCount = useMemo(
    () => sortedBookings.filter((booking) => documentByBookingId.has(Number(booking.id))).length,
    [documentByBookingId, sortedBookings]
  );

  const linkedExpenseTotal = useMemo(
    () =>
      sortedBookings.reduce(
        (sum, booking) => sum + sumBookingExpenses(expensesByBookingId.get(Number(booking.id)) || []),
        0
      ),
    [expensesByBookingId, sortedBookings]
  );

  // OPTIMIZATION: Calculate full total including expenses (booking items + expenses)
  const bookingsTotalWithExpenses = useMemo(
    () => bookingsFilteredTotal + linkedExpenseTotal,
    [bookingsFilteredTotal, linkedExpenseTotal]
  );

  const unassignedBookingsCount = useMemo(
    () => sortedBookings.filter((booking) => !Number.isFinite(Number(booking.assignedUserId))).length,
    [sortedBookings]
  );

  const filteredProducts = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();
    const list = [...products].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    if (!needle) return list;
    return list.filter((product) => {
      const variantMatch = getBookingVariants(product).some((variant) =>
        [variant.sku, variant.variantName, variant.variantNumber, variant.color, variant.size]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
      return product.name?.toLowerCase().includes(needle) || product.sku?.toLowerCase().includes(needle) || variantMatch;
    });
  }, [productQuery, products]);

  const selectedFormCustomer = useMemo(() => {
    const customerId = Number(form.customerId);
    if (!Number.isFinite(customerId) || customerId <= 0) return null;
    return customerById.get(customerId) || null;
  }, [customerById, form.customerId]);

  const deferredCustomerQuery = useDeferredValue(form.customerName || "");
  const typedBookingCustomerName = String(form.customerName || "").trim();

  const matchedTypedBookingCustomer = useMemo(() => {
    if (!typedBookingCustomerName) return null;
    const normalizedName = normalizeCustomerName(typedBookingCustomerName);
    return customers.find((customer) => normalizeCustomerName(customer.name) === normalizedName) || null;
  }, [customers, typedBookingCustomerName]);

  const filteredBookingCustomerOptions = useMemo(() => {
    if (!customers.length) return [];
    const normalizedQuery = normalizeCustomerName(deferredCustomerQuery);
    const phoneQuery = normalizePhoneDigits(deferredCustomerQuery);
    const hasQuery = Boolean(normalizedQuery || phoneQuery);
    
    // OPTIMIZATION: Pre-compute normalized values and cache results
    const next = hasQuery
      ? customers.filter((customer) => {
          const matchesName =
            normalizedQuery && normalizeCustomerName(customer.name).includes(normalizedQuery);
          const matchesPhone =
            phoneQuery && normalizePhoneDigits(customer.phone).includes(phoneQuery);
          return Boolean(matchesName || matchesPhone);
        })
      : customers;
    
    // OPTIMIZATION: Sort once and memoize result
    return [...next].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [customers, deferredCustomerQuery]);

  const bookingCurrency = useMemo(() => {
    const firstItem = form.items[0];
    if (!firstItem) return "GHS";
    const product = productMap.get(Number(firstItem.productId));
    return normalizeCurrency(product?.currency || "GHS");
  }, [form.items, productMap]);

  const assignedFilterOptions = useMemo(
    () => [
      { value: "", label: "Everyone" },
      ...users.map((member) => ({
        value: String(member.id),
        label: member.fullName || [member.firstName, member.lastName].filter(Boolean).join(" "),
      })),
    ],
    [users],
  );

  const assignedUserOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...users.map((member) => ({
        value: String(member.id),
        label: member.fullName || [member.firstName, member.lastName].filter(Boolean).join(" "),
      })),
    ],
    [users],
  );

  // OPTIMIZATION: Extract shared booking subtotal calculation to prevent duplicate computation
  const bookingSubtotalCents = useMemo(() => {
    return form.items.reduce((sum, item) => {
      const product = productMap.get(Number(item.productId));
      const overridePrice = Number(item.price);
      const priceCents = Number.isFinite(overridePrice) && overridePrice >= 0
        ? Math.round(overridePrice * 100)
        : Number(product?.price ?? 0);
      const quantity = Number(item.quantity) || 1;
      return sum + priceCents * quantity;
    }, 0);
  }, [form.items, productMap]);

  const bookingDiscountAmount = useMemo(() => {
    const rawDiscount = Math.max(0, Number(form.discount) || 0);
    if (form.discountType === "percent") {
      return (bookingSubtotalCents / 100) * (rawDiscount / 100);
    }
    return rawDiscount;
  }, [bookingSubtotalCents, form.discount, form.discountType]);

  const bookingTotalCents = useMemo(() => {
    const rawDiscount = Math.max(0, Number(form.discount) || 0);
    const discountCents = form.discountType === "percent"
      ? Math.round(bookingSubtotalCents * (rawDiscount / 100))
      : Math.round(rawDiscount * 100);
    return Math.max(0, bookingSubtotalCents - discountCents);
  }, [bookingSubtotalCents, form.discount, form.discountType]);

  const viewInvoice = (booking) => {
    if (!booking?.id || !canAccessInvoicing) return;
    const bookingId = Number(booking.id);
    const bookingDocument = documentByBookingId.get(bookingId) || null;
    if (bookingDocument?.id) {
      void fetchInvoiceDocumentById(bookingDocument.id).catch(() => {});
    }
    void fetchBookingInvoiceDetails(bookingId).catch(() => {});
    navigate(`/admin/invoicing?type=bookings&id=${booking.id}`);
  };

  const addDetailExpense = async (event) => {
    event.preventDefault();
    if (!detailBooking?.id) return;
    if (isCompletedBooking(detailBooking)) {
      setDetailExpenseError("Completed bookings are locked and can't be edited.");
      return;
    }

    const description = String(detailExpenseDraft.query || "").trim();
    const amountValue = Number(detailExpenseDraft.amount);
    const expenseDate = String(detailExpenseDraft.date || "").trim();

    if (!description) {
      setDetailExpenseError("Enter an expense description.");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setDetailExpenseError("Enter a valid expense amount.");
      return;
    }
    if (!expenseDate) {
      setDetailExpenseError("Select the expense date.");
      return;
    }

    setDetailExpenseSaving(true);
    setDetailExpenseError("");

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "auto",
          description,
          amount: amountValue,
          bookingId: detailBooking.id,
          date: expenseDate,
        }),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to add expense.");
      }

      if (payload && typeof payload === "object") {
        setExpenses((prev) => {
          const next = [payload, ...prev.filter((row) => String(row?.id) !== String(payload?.id))];
          next.sort((a, b) => {
            const dateA = new Date(a?.date || 0).getTime();
            const dateB = new Date(b?.date || 0).getTime();
            if (dateB !== dateA) return dateB - dateA;
            return Number(b?.id || 0) - Number(a?.id || 0);
          });
          return next;
        });
      } else {
        await loadExpenses({ force: true });
      }

      setDetailExpenseDraft((current) => ({
        ...current,
        query: "",
        amount: "",
      }));
    } catch (err) {
      console.error("Booking expense add failed", err);
      setDetailExpenseError(err.message || "Failed to add expense.");
    } finally {
      setDetailExpenseSaving(false);
    }
  };

  const viewDelivery = (booking) => {
    if (!booking?.id) return;
    navigate(`/admin/delivery?bookingId=${booking.id}`);
  };

  const viewCustomer = (booking) => {
    const customerId = Number(booking?.customerId);
    setDetailBooking(null);
    if (Number.isFinite(customerId) && customerId > 0) {
      navigate(`/admin/customers?id=${customerId}`);
      return;
    }
    navigate("/admin/customers");
  };

  const getBookingActorPayload = useCallback(
    () => ({
      userId: user?.id,
      userName:
        user?.fullName ||
        user?.name ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        undefined,
      userEmail: user?.email,
    }),
    [user?.email, user?.firstName, user?.fullName, user?.id, user?.lastName, user?.name]
  );

  const resolveOfflineBookingCustomer = useCallback(() => {
    const selectedCustomerId = Number(form.customerId);
    if (Number.isFinite(selectedCustomerId) && selectedCustomerId > 0) {
      return customerById.get(selectedCustomerId) || {
        id: selectedCustomerId,
        name: form.customerName || "",
      };
    }
    if (matchedTypedBookingCustomer?.id) {
      return matchedTypedBookingCustomer;
    }
    return null;
  }, [customerById, form.customerId, form.customerName, matchedTypedBookingCustomer]);

  const buildBookingRequestPayload = useCallback(
    ({ customerId, isEdit }) => ({
      id: isEdit ? editing.id : undefined,
      customerId: Number(customerId),
      eventDate: form.eventDate,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      venueAddress: form.venueAddress,
      status: form.status,
      assignedUserId: form.assignedUserId ? Number(form.assignedUserId) : null,
      discount: bookingDiscountAmount,
      items: form.items.map((item) => ({
        ...item,
        price: Number(item.price) || undefined,
      })),
      ...getBookingActorPayload(),
    }),
    [
      bookingDiscountAmount,
      editing?.id,
      form.assignedUserId,
      form.endTime,
      form.eventDate,
      form.items,
      form.startTime,
      form.status,
      form.venueAddress,
      getBookingActorPayload,
    ]
  );

  const loadQueuedBookingActions = useCallback(async () => {
    if (!canManageBookings || !user?.organizationId || !user?.id) {
      setBookingQueueNotice(null);
      return [];
    }

    try {
      const queued = (await bookingQueueStorage.list()).filter((item) =>
        isQueuedBookingForScope(item, {
          organizationId: user.organizationId,
          actorId: user.id,
        })
      );
      setBookingQueueNotice(getQueuedBookingNotice(queued));
      return queued;
    } catch (queueError) {
      setBookingQueueNotice({
        status: SYNC_STATES.FAILED,
        tone: "error",
        title: "Sync failed",
        message: queueError.message || "Unable to read the local booking queue.",
      });
      return [];
    }
  }, [bookingQueueStorage, canManageBookings, user?.id, user?.organizationId]);

  const syncQueuedBookingAction = useCallback(async (queueItem) => {
    await bookingQueueStorage.updateStatus(queueItem.id, SYNC_STATES.SYNCING, {
      lastAttemptAt: new Date().toISOString(),
    });
    setBookingQueueNotice({
      status: SYNC_STATES.SYNCING,
      tone: "loading",
      title: "Syncing",
      message: "Submitting queued booking action. The server will validate availability, customer, status, and permissions.",
    });

    try {
      const queuedPayload = queueItem.payload || {};
      const endpoint = queuedPayload.endpoint || {};
      const response = await fetch(endpoint.path || "/api/bookings", {
        method: endpoint.method || "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": queuedPayload.idempotencyKey || queueItem.id,
        },
        body: JSON.stringify(queuedPayload.booking || {}),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || "Queued booking action could not sync.");
      }

      await bookingQueueStorage.remove(queueItem.id);
      if (payload && typeof payload === "object") {
        setBookings((prev) => {
          const exists = prev.some((row) => String(row.id) === String(payload.id));
          if (exists) {
            return prev.map((row) => (String(row.id) === String(payload.id) ? payload : row));
          }
          return [payload, ...prev];
        });
        setDetailBooking((current) =>
          current && String(current.id) === String(payload.id) ? payload : current
        );
        setEditing((current) =>
          current && String(current.id) === String(payload.id) ? payload : current
        );
      }
      setBookingQueueNotice({
        status: SYNC_STATES.SYNCED,
        tone: "success",
        title: "Synced",
        message: payload?.id
          ? `Queued booking action synced as booking #${payload.id}.`
          : "Queued booking action synced.",
      });
      return payload;
    } catch (queueError) {
      const message = queueError.message || "Queued booking action could not sync.";
      const failureState = getBookingQueueFailureState(message);
      await bookingQueueStorage.updateStatus(queueItem.id, failureState.status, {
        conflictStatus: failureState.conflictStatus,
        retry: incrementRetryMetadata(queueItem.retry, {
          now: new Date(),
          lastError: message,
        }),
        lastAttemptAt: new Date().toISOString(),
      });
      setBookingQueueNotice({
        status: failureState.status,
        tone: "error",
        title: failureState.status === SYNC_STATES.NEEDS_REVIEW ? "Needs review" : "Sync failed",
        message:
          failureState.status === SYNC_STATES.NEEDS_REVIEW
            ? `${message} Review availability, customer, status, or permissions before retrying.`
            : message,
      });
      return null;
    }
  }, [bookingQueueStorage]);

  const syncQueuedBookingActions = useCallback(async () => {
    if (
      !isOnline ||
      bookingQueueSyncingRef.current ||
      !canManageBookings ||
      !user?.organizationId ||
      !user?.id
    ) {
      return;
    }

    bookingQueueSyncingRef.current = true;
    try {
      const queued = await loadQueuedBookingActions();
      const pending = queued.filter((item) => item.status === SYNC_STATES.PENDING);
      for (const queueItem of pending) {
        await syncQueuedBookingAction(queueItem);
      }
    } finally {
      bookingQueueSyncingRef.current = false;
    }
  }, [
    canManageBookings,
    isOnline,
    loadQueuedBookingActions,
    syncQueuedBookingAction,
    user?.id,
    user?.organizationId,
  ]);

  useEffect(() => {
    void loadQueuedBookingActions();
  }, [loadQueuedBookingActions]);

  useEffect(() => {
    void syncQueuedBookingActions();
  }, [syncQueuedBookingActions]);

  const addItem = (product, variant = null) => {
    setForm((prev) => {
      if (isBookingVariantParent(product) && !variant) return prev;
      const lineKey = getBookingLineKey(product.id, variant?.id);
      const existing = prev.items.find((item) => getBookingLineKey(item.productId, item.variantId) === lineKey);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            getBookingLineKey(item.productId, item.variantId) === lineKey
              ? { ...item, quantity: (Number(item.quantity) || 1) + 1 }
              : item
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            productId: product.id,
            variantId: variant?.id || null,
            productName: product.name || "",
            variantLabel: variant ? formatBookingVariantName(product, variant) : "",
            quantity: 1,
            price: variant
              && variant.priceOverride !== null
              && typeof variant.priceOverride !== "undefined"
              && variant.priceOverride !== ""
              && Number.isFinite(Number(variant.priceOverride))
              ? Number(variant.priceOverride).toFixed(2)
              : Number.isFinite(product?.price) ? (product.price / 100).toFixed(2) : "",
          },
        ],
      };
    });
  };

  const updateItemQuantity = (lineKey, nextValue) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (getBookingLineKey(item.productId, item.variantId) !== lineKey) return item;
        const next = Math.max(1, parseInt(nextValue, 10) || 1);
        return { ...item, quantity: next };
      }),
    }));
  };

  const updateItemPrice = (lineKey, nextValue) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (getBookingLineKey(item.productId, item.variantId) !== lineKey) return item;
        return { ...item, price: nextValue };
      }),
    }));
  };

  const removeItem = (lineKey) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => getBookingLineKey(item.productId, item.variantId) !== lineKey),
    }));
  };

  const handleBookingCustomerChange = (nextValue) => {
    const customerId = Number(nextValue);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setForm((prev) => ({ ...prev, customerId: "" }));
      return;
    }
    const customer = customerById.get(customerId);
    setForm((prev) => ({
      ...prev,
      customerId: String(customerId),
      customerName: customer?.name || prev.customerName,
    }));
    setCustomerMenuOpen(false);
  };

  const handleBookingCustomerInputChange = (nextValue) => {
    setCustomerMenuOpen(true);
    setForm((prev) => {
      const normalizedValue = normalizeCustomerName(nextValue);
      const normalizedSelectedName = normalizeCustomerName(selectedFormCustomer?.name);
      const keepLinkedCustomer = normalizedValue && normalizedValue === normalizedSelectedName;
      return {
        ...prev,
        customerName: nextValue,
        customerId: keepLinkedCustomer ? prev.customerId : "",
      };
    });
  };

  const createBookingCustomer = async (providedName = "") => {
    const customerName = String(providedName || form.customerName || "").trim();
    if (!customerName) {
      setSaveError("Enter a customer name.");
      return null;
    }

    setCustomerCreating(true);
    setSaveError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customerName }),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create customer.");
      }
      if (!payload?.id) {
        throw new Error("Customer could not be created.");
      }
      setCustomers((current) => [payload, ...current.filter((customer) => Number(customer.id) !== Number(payload.id))]);
      setForm((prev) => ({
        ...prev,
        customerId: String(payload.id),
        customerName: payload.name || customerName,
      }));
      setCustomerMenuOpen(false);
      return payload;
    } catch (err) {
      console.error("Failed to create booking customer", err);
      setSaveError(err.message || "Failed to create customer.");
      return null;
    } finally {
      setCustomerCreating(false);
    }
  };

  const ensureBookingCustomer = async () => {
    const existingCustomerId = Number(form.customerId);
    if (Number.isFinite(existingCustomerId) && existingCustomerId > 0) {
      return existingCustomerId;
    }
    if (matchedTypedBookingCustomer?.id) {
      handleBookingCustomerChange(String(matchedTypedBookingCustomer.id));
      return Number(matchedTypedBookingCustomer.id);
    }
    const createdCustomer = await createBookingCustomer();
    const createdCustomerId = Number(createdCustomer?.id);
    return Number.isFinite(createdCustomerId) && createdCustomerId > 0 ? createdCustomerId : null;
  };

  const commitBookingCustomerInput = async () => {
    const typedName = typedBookingCustomerName;
    if (!typedName) {
      setForm((prev) => ({ ...prev, customerId: "", customerName: "" }));
      setCustomerMenuOpen(false);
      return;
    }
    if (matchedTypedBookingCustomer?.id) {
      handleBookingCustomerChange(String(matchedTypedBookingCustomer.id));
      return;
    }
    await createBookingCustomer(typedName);
  };

  const handleBookingCustomerInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitBookingCustomerInput();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setCustomerMenuOpen(false);
    }
  };

  const openCreate = () => {
    if (!canManageBookings) return;
    ensureSupportData({ customers: true, products: true, bouncyCastles: true })
      .then(() => {
        setDetailEditing(false);
        setEditing(null);
        setSaveError("");
        setProductQuery("");
        setCustomerMenuOpen(false);
        setForm({
          customerId: "",
          customerName: "",
          eventDate: "",
          startTime: "",
          endTime: "",
          venueAddress: "",
          status: "pending",
          assignedUserId: user?.id ? String(user.id) : "",
          items: [],
          discount: "",
          discountType: "amount",
        });
        setModalOpen(true);
      })
      .catch((err) => {
        console.error("Failed to load booking form data", err);
        setError(err.message || "We couldn't load the booking form right now.");
      });
  };

  const openEdit = (booking, { inline = false } = {}) => {
    if (!canManageBookings) {
      openBookingDetail(booking);
      return;
    }

    if (isCompletedBooking(booking)) {
      openBookingDetail(booking);
      return;
    }

    ensureSupportData({ customers: true, products: true, bouncyCastles: true })
      .then(async () => {
        const fullBooking = await fetchBookingById(booking.id);
        if (isCompletedBooking(fullBooking)) {
          openBookingDetail(fullBooking);
          return;
        }
        setBookings((current) => current.map((row) => (row.id === fullBooking.id ? { ...row, ...fullBooking } : row)));
        setDetailBooking((current) => (current && current.id === fullBooking.id ? fullBooking : current));
        setEditing(fullBooking);
        setSaveError("");
        setProductQuery("");
        setCustomerMenuOpen(false);
        setForm(buildBookingEditorState(fullBooking, user?.id ? String(user.id) : ""));
        if (inline) {
          setDetailEditing(true);
          setModalOpen(false);
          return;
        }
        setDetailEditing(false);
        setModalOpen(true);
      })
      .catch((err) => {
        console.error("Failed to load booking edit data", err);
        setError(err.message || "We couldn't load this booking right now.");
      });
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setSaveError("");
    setCustomerMenuOpen(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = String(params.get("action") || "").trim().toLowerCase();
    const bookingId = params.get("id");
    if ((!action && !bookingId) || loading) return;

    const nextSearch = buildBookingsSearch({
      query: params.get("q") || "",
      status: params.get("status") || "all",
      assigned: params.get("assigned") || "",
      timing: params.get("timing") || "all",
      view: params.get("view") || viewMode,
      isMobile: isMobileView,
    });
    const finish = () =>
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
        },
        { replace: true }
      );

    if (action === "create") {
      openCreate();
      finish();
      return;
    }

    if (!bookingId) {
      finish();
      return;
    }

    const targetBooking = bookings.find((booking) => String(booking.id) === String(bookingId));
    if (!targetBooking) {
      finish();
      return;
    }

    if (action === "edit") {
      openEdit(targetBooking);
      finish();
      return;
    }

    openBookingDetail(targetBooking);
    finish();
  }, [bookings, isMobileView, loading, location.pathname, location.search, navigate, viewMode]);

  const save = async (event) => {
    event.preventDefault();
    setSaveError("");

    if (editing?.id && isCompletedBooking(editing)) {
      return setSaveError("Completed bookings are locked and can't be edited.");
    }
    if (!form.eventDate) return setSaveError("Event date is required.");
    if (!form.venueAddress.trim()) return setSaveError("Venue address is required.");
    if (!form.items.length) return setSaveError("Add at least one item to the booking.");

    setSaving(true);
    try {
      const isEdit = Boolean(editing?.id);
      if (!isOnline) {
        if (!user?.organizationId || !user?.id) {
          throw new Error("Sign in again before saving an offline booking action.");
        }
        const offlineCustomer = resolveOfflineBookingCustomer();
        const offlineCustomerId = Number(offlineCustomer?.id);
        if (!Number.isFinite(offlineCustomerId) || offlineCustomerId <= 0) {
          throw new Error("Select an existing customer before saving offline. New customer creation needs a connection.");
        }
        const bookingPayload = buildBookingRequestPayload({
          customerId: offlineCustomerId,
          isEdit,
        });
        await bookingQueueStorage.put(
          buildQueuedBookingAction({
            organizationId: user.organizationId,
            actorId: user.id,
            actionType: isEdit
              ? OFFLINE_QUEUE_ACTION_TYPES.UPDATE_BOOKING_DETAILS
              : OFFLINE_QUEUE_ACTION_TYPES.CREATE_BOOKING,
            method: isEdit ? "PUT" : "POST",
            booking: bookingPayload,
            customer: offlineCustomer,
            previousStatus: editing?.status || "",
            source: detailEditing ? "booking-detail-inline-edit" : "booking-editor",
          })
        );
        setBookingQueueNotice({
          status: SYNC_STATES.PENDING,
          tone: "info",
          title: "Pending sync",
          message: "Offline booking saved. Pending sync. Availability is not reserved until the server confirms it.",
        });
        if (detailEditing) {
          setDetailEditing(false);
          setEditing(null);
        } else {
          setModalOpen(false);
          setEditing(null);
        }
        setCustomerMenuOpen(false);
        return;
      }

      const customerId = await ensureBookingCustomer();
      if (!Number.isFinite(Number(customerId)) || Number(customerId) <= 0) {
        throw new Error("Select or create a customer.");
      }
      const bookingPayload = buildBookingRequestPayload({
        customerId,
        isEdit,
      });
      const response = await fetch("/api/bookings", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Save failed.");

      setBookings((prev) => {
        if (isEdit) return prev.map((row) => (row.id === payload.id ? payload : row));
        return [payload, ...prev];
      });
      setDetailBooking((current) => (current && current.id === payload.id ? payload : current));

      if (detailEditing) {
        setEditing(payload);
        setDetailEditing(false);
      } else {
        setModalOpen(false);
        setEditing(null);
      }
    } catch (err) {
      console.error("Save booking failed", err);
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateBookingStatus = async (booking, nextStatus) => {
    if (!booking?.id) return;
    if (isCompletedBooking(booking)) return;
    if (normalizeStatus(booking.status) === normalizeStatus(nextStatus)) return;

    if (!isOnline) {
      setStatusUpdatingId(booking.id);
      setError("");
      try {
        if (!user?.organizationId || !user?.id) {
          throw new Error("Sign in again before saving an offline booking status action.");
        }
        await bookingQueueStorage.put(
          buildQueuedBookingAction({
            organizationId: user.organizationId,
            actorId: user.id,
            actionType: OFFLINE_QUEUE_ACTION_TYPES.UPDATE_BOOKING_STATUS,
            method: "PUT",
            booking: {
              id: booking.id,
              status: nextStatus,
              ...getBookingActorPayload(),
            },
            customer: {
              id: booking.customerId,
              name: booking.customerName || "",
              phone: booking.customerPhone || "",
              email: booking.customerEmail || "",
            },
            previousStatus: booking.status || "",
            source: "booking-status-action",
          })
        );
        setBookingQueueNotice({
          status: SYNC_STATES.PENDING,
          tone: "info",
          title: "Pending sync",
          message: "Offline booking status saved. Pending sync. Server status and availability remain unchanged until sync succeeds.",
        });
      } catch (err) {
        console.error("Offline booking status queue failed", err);
        setError(err.message || "Failed to queue booking status update.");
      } finally {
        setStatusUpdatingId(null);
      }
      return;
    }
    
    // OPTIMIZATION: Store previous state for rollback
    const previousStatus = booking.status;
    
    setStatusUpdatingId(booking.id);
    setError("");
    setBookings((prev) =>
      prev.map((row) => (row.id === booking.id ? { ...row, status: nextStatus } : row))
    );
    setDetailBooking((prev) => (prev && prev.id === booking.id ? { ...prev, status: nextStatus } : prev));
    
    try {
      const response = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: booking.id,
          status: nextStatus,
          userId: user?.id,
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to update booking.");
      setBookings((prev) =>
        prev.map((row) => (row.id === payload.id ? payload : row))
      );
      setDetailBooking((prev) => (prev && prev.id === payload.id ? payload : prev));
    } catch (err) {
      console.error("Booking status update failed", err);
      // OPTIMIZATION: Rollback to previous state on failure
      setBookings((prev) =>
        prev.map((row) => (row.id === booking.id ? { ...row, status: previousStatus } : row))
      );
      setDetailBooking((prev) => (prev && prev.id === booking.id ? { ...prev, status: previousStatus } : prev));
      setError(err.message || "Failed to update booking.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openBookingDetail = (booking) => {
    setDetailEditing(false);
    void ensureSupportData({
      customers: true,
      products: true,
      bouncyCastles: true,
      deliveries: true,
      expenses: true,
    }).catch((err) => {
      console.warn("Failed to load booking detail data", err);
    });
    setDetailBooking(booking);
    void fetchBookingById(booking.id)
      .then((fullBooking) => {
        setBookings((current) =>
          current.map((row) => (row.id === fullBooking.id ? { ...row, ...fullBooking } : row))
        );
        setDetailBooking((current) => (current && current.id === fullBooking.id ? fullBooking : current));
      })
      .catch((err) => {
        console.error("Failed to hydrate booking detail", err);
        setError(err.message || "We couldn't load this booking right now.");
      });
  };

  const handleBookingRowKeyDown = (event, booking) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openBookingDetail(booking);
  };

  const closeDetail = () => {
    setDetailEditing(false);
    setDetailBooking(null);
    setEditing(null);
    setSaveError("");
    setCustomerMenuOpen(false);
  };

  const cancelDetailEdit = () => {
    setDetailEditing(false);
    setSaveError("");
    setCustomerMenuOpen(false);
  };

  const sharedBookingEditorProps = {
    editing,
    save,
    saveError,
    setSaveError,
    saving,
    form,
    setForm,
    customerMenuOpen,
    setCustomerMenuOpen,
    handleBookingCustomerInputChange,
    handleBookingCustomerInputKeyDown,
    filteredBookingCustomerOptions,
    typedBookingCustomerName,
    matchedTypedBookingCustomer,
    commitBookingCustomerInput,
    handleBookingCustomerChange,
    customerCreating,
    BookingCustomerPickerComponent: BookingCustomerPicker,
    BOOKING_TIME_OPTIONS,
    BOOKING_EDITOR_STATUS_OPTIONS,
    assignedUserOptions,
    productQuery,
    setProductQuery,
    filteredProducts,
    addItem,
    formItems: form.items,
    productMap,
    getLineKey: getBookingLineKey,
    getProductVariants: getBookingVariants,
    getVariantAvailableQty: getBookingVariantAvailableQty,
    formatVariantName: formatBookingVariantName,
    isVariantParent: isBookingVariantParent,
    updateItemPrice,
    updateItemQuantity,
    removeItem,
    bookingTotalCents,
    bookingCurrency: (value) => formatMoney(value, bookingCurrency),
  };

  return (
    <div className="admin-page bookings-page">
      <div className="admin-shell bookings-shell">
        <AdminBreadcrumb items={[{ label: "Bookings" }]} />

        <AdminPageHeader
          className="bookings-header"
          copyClassName="bookings-header-copy"
          actionsClassName="bookings-header-actions admin-header-actions"
          title="Bookings"
          actions={(
            <>
              <button
                type="button"
                className="bookings-secondary"
                onClick={fetchAll}
                aria-label="Refresh bookings"
                title="Refresh bookings"
              >
                <AppIcon icon={faRotateRight} />
                Refresh
              </button>
              {canManageBookings ? (
                <button
                  type="button"
                  className="bookings-primary"
                  onClick={openCreate}
                  aria-label="Create booking"
                  title="Create booking"
                >
                  <AppIcon icon={faPlus} />
                  Create booking
                </button>
              ) : null}
            </>
          )}
        />

        {loading && (
          <AnimatedLoadingState
            compact
            className="glass-card bookings-loading-state admin-module-loading"
            title="Loading bookings"
            message="Preparing rental status, delivery, and expense data."
            variant="dashboard"
          />
        )}
        {!loading && error && (
          <NoticeBanner
            tone="error"
            title="Bookings unavailable"
            message={error}
            className="bookings-inline"
            onDismiss={() => setError("")}
            action={(
              <button type="button" className="bookings-secondary" onClick={fetchAll}>
                <AppIcon icon={faRotateRight} /> Retry
              </button>
            )}
          />
        )}
        {bookingQueueNotice ? (
          <NoticeBanner
            tone={bookingQueueNotice.tone || "info"}
            title={bookingQueueNotice.title}
            message={bookingQueueNotice.message}
            className={`bookings-sync-banner is-${bookingQueueNotice.tone || "info"}`}
            onDismiss={() => setBookingQueueNotice(null)}
          />
        ) : !isOnline && canManageBookings && !offlineNoticeDismissed ? (
          <NoticeBanner
            tone="info"
            title="Offline"
            message="Booking actions can be saved locally. The server will confirm availability when sync runs."
            className="bookings-sync-banner is-info"
            onDismiss={() => setOfflineNoticeDismissed(true)}
          />
        ) : null}

        {!loading && !error && (
          <section className="bookings-summary-grid">
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Upcoming</p>
              <strong className="bookings-summary-value">{upcomingBookingsCount}</strong>
            </article>
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Confirmed</p>
              <strong className="bookings-summary-value">{confirmedBookingsCount}</strong>
            </article>
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Completed</p>
              <strong className="bookings-summary-value">{completedBookingCount}</strong>
            </article>
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Expenses</p>
              <strong className="bookings-summary-value">{formatMoney(linkedExpenseTotal, "GHS")}</strong>
            </article>
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Booked value</p>
              <strong className="bookings-summary-value">{formatMoney(bookingsTotalWithExpenses, "GHS")}</strong>
            </article>
          </section>
        )}

        {!loading && !error && (
          <section className="bookings-results-panel">
            <div className="bookings-toolbar bookings-results-toolbar" aria-label="Booking controls">
              <div className="bookings-toolbar-row">
                <div className="bookings-toolbar-filters">
                  <SelectField
                    fieldClassName="bookings-filter"
                    label="Status"
                    value={statusFilter}
                    options={BOOKING_STATUS_OPTIONS}
                    onChangeValue={setStatusFilter}
                    ariaLabel="Filter bookings by status"
                  />
                  <SelectField
                    fieldClassName="bookings-filter"
                    label="Timing"
                    value={timingFilter}
                    options={BOOKING_TIMING_OPTIONS}
                    onChangeValue={setTimingFilter}
                    ariaLabel="Filter bookings by timing"
                  />
                  <SelectField
                    fieldClassName="bookings-filter"
                    label="Assigned"
                    value={assignedFilter}
                    options={assignedFilterOptions}
                    onChangeValue={setAssignedFilter}
                    ariaLabel="Filter bookings by assignee"
                  />
                </div>
              </div>
              <div className="bookings-toolbar-search-row">
                <label className="bookings-search">
                  Search
                  <SearchField
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onClear={() => setQuery("")}
                    placeholder="Booking, customer, venue"
                    aria-label="Search bookings"
                  />
                </label>
                <div className="admin-view-toggle bookings-view-tabs" role="tablist" aria-label="Booking views">
                  {availableViewOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      role="tab"
                      aria-selected={activeViewMode === option.key}
                      tabIndex={activeViewMode === option.key ? 0 : -1}
                      className={`admin-chip ${activeViewMode === option.key ? "is-active" : ""}`}
                      onClick={() => setViewMode(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(activeViewMode === "list" && isMobileView) || (!isMobileView && activeViewMode === "cards")
              ? renderBookingsPagination(true)
              : null}

            {activeViewMode === "list" ? (
              isMobileView ? (
                <div className="bookings-mobile-list" role="list" aria-label="Bookings">
                  {paginatedBookings.length === 0 ? (
                    <p className="bookings-empty">No bookings found.</p>
                  ) : (
                    paginatedBookings.map((booking, index) => {
                      const totalValue = toNumber(booking.totalAmount, 0) / 100;
                      const bookingDocument = documentByBookingId.get(Number(booking.id)) || null;

                      return (
                        <article
                          key={booking.id}
                          role="button"
                          tabIndex={0}
                          className="glass-card bookings-mobile-card"
                          onClick={() => openBookingDetail(booking)}
                          onKeyDown={(event) => handleBookingRowKeyDown(event, booking)}
                        >
                          <div className="bookings-mobile-card-head">
                            <div className="bookings-mobile-card-copy">
                              <span className="bookings-mobile-card-index">
                                #{clampedPage * pageSize + index}
                              </span>
                              <strong>Booking #{booking.id}</strong>
                              <p>{booking.customerName || "Customer"}</p>
                            </div>
                            <div className="bookings-mobile-card-aside">
                              <span className={`bookings-pill ${booking.status || "pending"}`}>
                                {booking.status || "pending"}
                              </span>
                              <strong className="bookings-mobile-card-total">
                                {formatMoney(totalValue, "GHS")}
                              </strong>
                            </div>
                          </div>

                          <div className="bookings-mobile-card-grid">
                            <div className="bookings-mobile-card-field">
                              <span>Date</span>
                              <strong>{formatFullDate(booking.eventDate)}</strong>
                            </div>
                            <div className="bookings-mobile-card-field">
                              <span>Time</span>
                              <strong>{formatBookingTimeWindow(booking)}</strong>
                            </div>
                            <div className="bookings-mobile-card-field bookings-mobile-card-field--full">
                              <span>Location</span>
                              <strong>{booking.venueAddress || "-"}</strong>
                            </div>
                            <div className="bookings-mobile-card-field bookings-mobile-card-field--full">
                              <span>Invoice</span>
                              <strong>{getBookingDocumentTitle(bookingDocument)}</strong>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="admin-table admin-table-scroll bookings-table-scroll">
                  {renderBookingsPagination(true, "bookings-table-pagination")}
                  <table className="bookings-hub-table">
                    <thead>
                      <tr>
                        <th className="table-row-index">
                          <span className="bookings-table-heading">ID</span>
                        </th>
                        <th className="bookings-col-booking">
                          <span className="bookings-table-heading">Booking</span>
                        </th>
                        <th className="bookings-col-customer">
                          <span className="bookings-table-heading">Customer</span>
                        </th>
                        <th className="bookings-col-date">
                          <span className="bookings-table-heading">Date</span>
                        </th>
                        <th className="bookings-col-address">
                          <span className="bookings-table-heading">Location</span>
                        </th>
                        <th className="bookings-col-time">
                          <span className="bookings-table-heading">Time</span>
                        </th>
                        <th className="bookings-col-invoice">
                          <span className="bookings-table-heading">Invoice</span>
                        </th>
                        <th className="bookings-col-status">
                          <span className="bookings-table-heading">Status</span>
                        </th>
                        <th className="bookings-col-total">
                          <span className="bookings-table-heading">Total</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBookings.length === 0 && (
                        <tr>
                          <td colSpan={9} className="bookings-empty">
                            No bookings found.
                          </td>
                        </tr>
                      )}
                      {paginatedBookings.map((booking, index) => {
                        const totalValue = toNumber(booking.totalAmount, 0) / 100;
                        const bookingDocument = documentByBookingId.get(Number(booking.id)) || null;

                        return (
                          <tr
                            key={booking.id}
                            className="bookings-row"
                            onClick={() => openBookingDetail(booking)}
                            onKeyDown={(event) => handleBookingRowKeyDown(event, booking)}
                            tabIndex={0}
                          >
                            <td className="table-row-index">
                              <span className="bookings-table-text">{clampedPage * pageSize + index}</span>
                            </td>
                            <td className="bookings-col-booking">
                              <span className="bookings-table-text">#{booking.id}</span>
                            </td>
                            <td className="bookings-col-customer">
                              <span className="bookings-table-text">{booking.customerName || "Customer"}</span>
                            </td>
                            <td className="bookings-col-date">
                              <span className="bookings-table-text">{formatDate(booking.eventDate)}</span>
                            </td>
                            <td className="bookings-col-address">
                              <span className="bookings-table-text">{booking.venueAddress || "-"}</span>
                            </td>
                            <td className="bookings-col-time">
                              <span className="bookings-table-text">{formatBookingTimeWindow(booking)}</span>
                            </td>
                            <td className="bookings-col-invoice">
                              <span className="bookings-table-text">{getBookingDocumentTitle(bookingDocument)}</span>
                            </td>
                            <td className="bookings-col-status">
                              <span className={`bookings-pill ${booking.status || "pending"}`}>
                                {booking.status || "pending"}
                              </span>
                            </td>
                            <td className="bookings-col-total bookings-total-cell">
                              {formatMoney(totalValue, "GHS")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {sortedBookings.length > 0 && (
                      <tfoot className="admin-table-footer">
                        <tr>
                          <td className="admin-table-summary-cell is-count">
                            <span className="admin-table-summary-value">Total</span>
                          </td>
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell bookings-total-footer">
                            <span className="admin-table-summary-value">{formatMoney(bookingsTableTotal, "GHS")}</span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  {renderBookingsPagination(false, "bookings-table-pagination")}
                </div>
              )
            ) : null}

            {!isMobileView && activeViewMode === "cards" ? (
              <div className="bookings-card-grid" role="list" aria-label="Booking cards">
                {paginatedBookings.length === 0 ? (
                  <p className="bookings-empty">No bookings found.</p>
                ) : (
                  paginatedBookings.map((booking) => {
                    const totalValue = toNumber(booking.totalAmount, 0) / 100;
                    const bookingDocument = documentByBookingId.get(Number(booking.id)) || null;
                    const bookingDelivery = deliveryByBookingId.get(Number(booking.id)) || null;
                    const hasScheduledDelivery = Number.isFinite(Number(bookingDelivery?.deliveryId));

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        className="bubble-card bookings-card"
                        onClick={() => openBookingDetail(booking)}
                      >
                        <div className="bookings-card-head bookings-card-head--cards">
                          <div className="bookings-card-status-pills">
                            <span className={`bookings-pill small ${booking.status || "pending"}`}>
                              {booking.status || "pending"}
                            </span>
                            {hasScheduledDelivery ? (
                              <span
                                className="bookings-link-pill is-live bookings-card-delivery-pill"
                                title={`Delivery ${getDeliveryStatusLabel(bookingDelivery)} · ${getDeliveryMeta(bookingDelivery)}`}
                              >
                                <AppIcon icon={faTruck} />
                                Delivery {getDeliveryStatusLabel(bookingDelivery)}
                              </span>
                            ) : null}
                          </div>
                          <h4>{booking.customerName || "Customer"}</h4>
                        </div>
                        <span className="bookings-amount">{formatMoney(totalValue, "GHS")}</span>
                        <p className="bookings-card-meta">
                          {formatFullDate(booking.eventDate)} · {formatBookingTimeWindow(booking)}
                        </p>
                        <p className="bookings-card-meta">{booking.venueAddress || "-"}</p>
                        <div className="bookings-card-links bookings-card-links--compact">
                          <span>Assigned To: {formatUser(booking.assignedUserName)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}

            {!isMobileView && activeViewMode === "board" ? (
              sortedBookings.length === 0 ? (
                <p className="bookings-empty">No bookings found.</p>
              ) : (
                <div className="bookings-kanban" aria-label="Booking board">
                  {bookingBoardColumns.map((column) => (
                    <section key={column.id} className="bookings-kanban-column">
                      <div className="bookings-kanban-head">
                        <div>
                          <h4>{column.label}</h4>
                          <p>{column.items.length} booking{column.items.length === 1 ? "" : "s"}</p>
                        </div>
                        <span className="bookings-link-pill is-empty">{column.items.length}</span>
                      </div>
                      <div className="bookings-kanban-list">
                        {column.items.length === 0 ? (
                          <p className="bookings-muted">No bookings here.</p>
                        ) : (
                          column.items.map((booking) => {
                            const totalValue = toNumber(booking.totalAmount, 0) / 100;

                            return (
                              <button
                                key={booking.id}
                                type="button"
                                className="bubble-card bookings-card bookings-card--kanban"
                                onClick={() => openBookingDetail(booking)}
                              >
                                <div className="bookings-card-head">
                                  <span className={`bookings-pill small ${booking.status || "pending"}`}>
                                    {booking.status || "pending"}
                                  </span>
                                  <span className="bookings-amount">{formatMoney(totalValue, "GHS")}</span>
                                </div>
                                <h4>{booking.customerName || "Customer"}</h4>
                                <p className="bookings-card-meta">
                                  {formatFullDate(booking.eventDate)} · {formatBookingTimeWindow(booking)}
                                </p>
                                <p className="bookings-card-meta">{booking.venueAddress || "-"}</p>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : null}

            {activeViewMode === "map" ? (
              <div className="bookings-map-view">
                <div className="bookings-map-list">
                  {bookingsWithAddress.length === 0 ? (
                    <p className="bookings-muted">No bookings with a location in this view.</p>
                  ) : (
                    bookingsWithAddress.map((booking) => {
                      const bookingDelivery = deliveryByBookingId.get(Number(booking.id)) || null;
                      const isActive = selectedMapBooking?.id === booking.id;
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          className={`bubble-card bookings-map-item${isActive ? " is-active" : ""}`}
                          onClick={() => setMapSelectionId(booking.id)}
                        >
                          <div className="bookings-map-item-head">
                            <strong>#{booking.id} · {booking.customerName || "Customer"}</strong>
                            <span className={`bookings-pill small ${booking.status || "pending"}`}>
                              {booking.status || "pending"}
                            </span>
                          </div>
                          <p>{formatDate(booking.eventDate)} · {formatBookingTimeWindow(booking)}</p>
                          <p>{booking.venueAddress}</p>
                          <span className={`bookings-link-pill ${bookingDelivery ? "is-live" : "is-empty"}`}>
                            {getDeliveryStatusLabel(bookingDelivery)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <section className="glass-card bookings-map-stage">
                  {selectedMapBooking ? (
                    <>
                      <div className="bookings-map-stage-head">
                        <div>
                          <h4>#{selectedMapBooking.id} · {selectedMapBooking.customerName || "Customer"}</h4>
                          <p>{selectedMapBooking.venueAddress}</p>
                        </div>
                        <button
                          type="button"
                          className="bookings-edit"
                          onClick={() => openBookingDetail(selectedMapBooking)}
                        >
                          Open booking
                        </button>
                      </div>
                      <div className="booking-map bookings-map-stage-frame">
                        <iframe
                          title="Selected booking location"
                          src={buildMapUrl(selectedMapBooking.venueAddress)}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    </>
                  ) : (
                    <p className="bookings-muted">Select a booking to view the location.</p>
                  )}
                </section>
              </div>
            ) : null}

            {(activeViewMode === "list" && isMobileView) || (!isMobileView && activeViewMode === "cards") ? (
              renderBookingsPagination()
            ) : null}
          </section>
        )}
      </div>

      <BookingEditorModal
        open={modalOpen}
        closeModal={closeModal}
        {...sharedBookingEditorProps}
      />

      <BookingDetailModal
        booking={detailBooking}
        detailEditing={detailEditing}
        detailCustomer={detailCustomer}
        detailDelivery={detailDelivery}
        detailDocument={detailDocument}
        detailExpenses={detailExpenses}
        detailExpenseTotal={detailExpenseTotal}
        detailItems={detailItems}
        productMap={productMap}
        isMobileView={isMobileView}
        canAccessInvoicing={canAccessInvoicing}
        canGoPrevDetail={canGoPrevDetail}
        canGoNextDetail={canGoNextDetail}
        statusUpdatingId={statusUpdatingId}
        goPrevDetail={goPrevDetail}
        goNextDetail={goNextDetail}
        updateBookingStatus={updateBookingStatus}
        viewInvoice={viewInvoice}
        viewDelivery={viewDelivery}
        openEdit={canManageBookings ? (booking) => openEdit(booking, { inline: true }) : undefined}
        closeInlineEdit={cancelDetailEdit}
        closeDetail={closeDetail}
        viewCustomer={viewCustomer}
        editor={sharedBookingEditorProps}
        detailExpenseDraft={detailExpenseDraft}
        setDetailExpenseDraft={setDetailExpenseDraft}
        detailExpenseSaving={detailExpenseSaving}
        detailExpenseError={detailExpenseError}
        setDetailExpenseError={setDetailExpenseError}
        addDetailExpense={addDetailExpense}
        bookingLocked={isCompletedBooking(detailBooking)}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
        formatBookingTimeWindow={formatBookingTimeWindow}
        getDeliveryStatusLabel={getDeliveryStatusLabel}
        getDeliveryMeta={getDeliveryMeta}
        getBookingDocumentTitle={getBookingDocumentTitle}
        getBookingDocumentStatus={getBookingDocumentStatus}
        formatMoney={formatMoney}
        formatUser={formatUser}
        formatAttendantsNeeded={formatAttendantsNeeded}
        normalizeStatus={normalizeStatus}
      />
    </div>
  );
}

export default AdminBookings;
