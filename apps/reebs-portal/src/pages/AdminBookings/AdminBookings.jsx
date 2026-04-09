/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import "./AdminBookings.css";
import { SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faPlus,
  faRotateRight,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../components/AuthContext/AuthContext";
import SearchField from "../../components/SearchField/SearchField";
import BookingEditorModal from "./components/BookingEditorModal";
import BookingDetailModal from "./components/BookingDetailModal";

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

const BOOKING_VIEW_FILTERS = new Set(["list", "map"]);
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

const normalizeBookingView = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (BOOKING_VIEW_FILTERS.has(normalized)) return normalized;
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

  if (hasUrlUiState) {
    return {
      status: normalizeBookingStatusFilter(params.get("status")),
      assigned: normalizeIdFilter(params.get("assigned")),
      timing: normalizeBookingTimingFilter(params.get("timing")),
      query: params.get("q") || "",
      view: normalizeBookingView(params.get("view")),
    };
  }

  return {
    status: normalizeBookingStatusFilter(stored?.status),
    assigned: normalizeIdFilter(stored?.assigned),
    timing: normalizeBookingTimingFilter(stored?.timing),
    query: String(stored?.query || ""),
    view: normalizeBookingView(stored?.view),
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
  action = "",
  id = "",
} = {}) => {
  const params = new URLSearchParams();
  const trimmedQuery = String(query || "").trim();
  const normalizedStatus = normalizeBookingStatusFilter(status);
  const normalizedAssigned = normalizeIdFilter(assigned);
  const normalizedTiming = normalizeBookingTimingFilter(timing);
  const normalizedView = normalizeBookingView(view);
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
  if (document.sentAt) return "Sent";
  const paymentStatus = String(document.paymentStatus || "draft").trim().toLowerCase();
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

const BOOKING_VIEW_OPTIONS = [
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
        quantity: item.quantity,
        price: Number.isFinite(item.price) ? (item.price / 100).toFixed(2) : "",
      }))
    : [],
  discount: "",
  discountType: "amount",
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
  const [detailBooking, setDetailBooking] = useState(null);

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
  const roleKey = String(user?.role || "").trim().toLowerCase();
  const canAccessInvoicing = roleKey === "admin" || roleKey === "manager";
  const navigate = useNavigate();
  const supportLoadStateRef = useRef({
    products: { loaded: false, promise: null },
    customers: { loaded: false, promise: null },
    bouncyCastles: { loaded: false, promise: null },
    deliveries: { loaded: false, promise: null },
    expenses: { loaded: false, promise: null },
  });

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(MOBILE_VIEW_QUERY);
    const handleChange = () => {
      const matches = mediaQuery.matches;
      setIsMobileView(matches);
      if (matches) {
        setModalOpen(false);
        setEditing(null);
        setViewMode((current) => normalizeBookingView(current));
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
        const response = await fetch("/.netlify/functions/inventory");
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
        const response = await fetch("/.netlify/functions/customers");
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
        const response = await fetch("/.netlify/functions/bouncy_castles");
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
        const response = await fetch("/.netlify/functions/deliveries");
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
        const response = await fetch("/.netlify/functions/expenses");
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to fetch expenses (${response.status}).`);
        }
        setExpenses(Array.isArray(payload) ? payload : []);
      },
      { force }
    );

  const fetchBookingById = useCallback(async (bookingId) => {
    const response = await fetch(`/.netlify/functions/bookings?id=${bookingId}`);
    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(payload?.error || `Failed to fetch booking (${response.status}).`);
    }
    return payload;
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
    await Promise.all(tasks);
  };

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingsRes, usersRes, documentsRes] = await Promise.all([
        fetch("/.netlify/functions/bookings?compact=1"),
        fetch("/.netlify/functions/users"),
        fetch("/.netlify/functions/invoice-documents?compact=1"),
      ]);

      const [bookingsPayload, usersPayload, documentsPayload] = await Promise.all([
        parseJsonResponse(bookingsRes),
        parseJsonResponse(usersRes),
        parseJsonResponse(documentsRes),
      ]);

      if (!bookingsRes.ok) {
        throw new Error(bookingsPayload?.error || `Failed to fetch bookings (${bookingsRes.status}).`);
      }
      if (!usersRes.ok) {
        throw new Error(usersPayload?.error || `Failed to fetch team members (${usersRes.status}).`);
      }
      if (!documentsRes.ok) {
        throw new Error(documentsPayload?.error || `Failed to fetch invoice documents (${documentsRes.status}).`);
      }

      setBookings(Array.isArray(bookingsPayload) ? bookingsPayload : []);
      setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      setDocuments(Array.isArray(documentsPayload) ? documentsPayload : []);
      void ensureSupportData({ deliveries: true, expenses: true }, { force: true }).catch((err) => {
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
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasUrlUiState = ["q", "status", "assigned", "timing", "view"].some((key) => params.has(key));
    if (!hasUrlUiState) return;
    const nextQuery = params.get("q") || "";
    const nextStatus = normalizeBookingStatusFilter(params.get("status"));
    const nextAssigned = normalizeIdFilter(params.get("assigned"));
    const nextTiming = normalizeBookingTimingFilter(params.get("timing"));
    const nextView = normalizeBookingView(params.get("view"));
    setQuery((current) => (current === nextQuery ? current : nextQuery));
    setStatusFilter((current) => (current === nextStatus ? current : nextStatus));
    setAssignedFilter((current) => (current === nextAssigned ? current : nextAssigned));
    setTimingFilter((current) => (current === nextTiming ? current : nextTiming));
    setViewMode((current) => (current === nextView ? current : nextView));
  }, [location.search]);

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
      _key: `item-${item.id || item.productId || index}`,
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

  const activeViewMode = viewMode;

  const availableViewOptions = BOOKING_VIEW_OPTIONS;

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
  const bookingsTableTotal = useMemo(
    () => sortedBookings.reduce((sum, booking) => sum + toNumber(booking.totalAmount, 0) / 100, 0),
    [sortedBookings]
  );

  const upcomingBookingsCount = useMemo(
    () => sortedBookings.filter((booking) => matchesBookingTiming(booking, "next7")).length,
    [sortedBookings]
  );

  const confirmedBookingsCount = useMemo(
    () => sortedBookings.filter((booking) => normalizeStatus(booking.status) === "confirmed").length,
    [sortedBookings]
  );

  const linkedDeliveryCount = useMemo(
    () => sortedBookings.filter((booking) => deliveryByBookingId.has(Number(booking.id))).length,
    [deliveryByBookingId, sortedBookings]
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

  const unassignedBookingsCount = useMemo(
    () => sortedBookings.filter((booking) => !Number.isFinite(Number(booking.assignedUserId))).length,
    [sortedBookings]
  );

  const filteredProducts = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();
    const list = [...products].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    if (!needle) return list;
    return list.filter((product) => {
      return product.name?.toLowerCase().includes(needle) || product.sku?.toLowerCase().includes(needle);
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
    const next = hasQuery
      ? customers.filter((customer) => {
          const matchesName =
            normalizedQuery && normalizeCustomerName(customer.name).includes(normalizedQuery);
          const matchesPhone =
            phoneQuery && normalizePhoneDigits(customer.phone).includes(phoneQuery);
          return Boolean(matchesName || matchesPhone);
        })
      : customers;
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

  const bookingDiscountAmount = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      const product = productMap.get(Number(item.productId));
      const overridePrice = Number(item.price);
      const priceCents = Number.isFinite(overridePrice) && overridePrice >= 0
        ? Math.round(overridePrice * 100)
        : Number(product?.price ?? 0);
      const quantity = Number(item.quantity) || 1;
      return sum + priceCents * quantity;
    }, 0);
    const rawDiscount = Math.max(0, Number(form.discount) || 0);
    if (form.discountType === "percent") {
      return (subtotal / 100) * (rawDiscount / 100);
    }
    return rawDiscount;
  }, [form.items, form.discount, form.discountType, productMap]);

  const bookingTotalCents = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      const product = productMap.get(Number(item.productId));
      const overridePrice = Number(item.price);
      const priceCents = Number.isFinite(overridePrice) && overridePrice >= 0
        ? Math.round(overridePrice * 100)
        : Number(product?.price ?? 0);
      const quantity = Number(item.quantity) || 1;
      return sum + priceCents * quantity;
    }, 0);
    const rawDiscount = Math.max(0, Number(form.discount) || 0);
    const discountCents = form.discountType === "percent"
      ? Math.round(subtotal * (rawDiscount / 100))
      : Math.round(rawDiscount * 100);
    return Math.max(0, subtotal - discountCents);
  }, [form.items, form.discount, form.discountType, productMap]);

  const viewInvoice = (booking) => {
    if (!booking?.id || !canAccessInvoicing) return;
    navigate(`/admin/invoicing?type=bookings&id=${booking.id}`);
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

  const viewExpenses = (booking) => {
    if (!booking?.id) {
      setDetailBooking(null);
      navigate("/admin/expenses");
      return;
    }
    setDetailBooking(null);
    navigate(`/admin/expenses?bookingId=${booking.id}`);
  };

  const addItem = (product) => {
    setForm((prev) => {
      const existing = prev.items.find((item) => Number(item.productId) === Number(product.id));
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            Number(item.productId) === Number(product.id)
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
            quantity: 1,
            price: Number.isFinite(product?.price) ? (product.price / 100).toFixed(2) : "",
          },
        ],
      };
    });
  };

  const updateItemQuantity = (productId, nextValue) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (Number(item.productId) !== Number(productId)) return item;
        const next = Math.max(1, parseInt(nextValue, 10) || 1);
        return { ...item, quantity: next };
      }),
    }));
  };

  const updateItemPrice = (productId, nextValue) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (Number(item.productId) !== Number(productId)) return item;
        return { ...item, price: nextValue };
      }),
    }));
  };

  const removeItem = (productId) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => Number(item.productId) !== Number(productId)),
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
      const response = await fetch("/.netlify/functions/customers", {
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
    if (isMobileView) return;
    ensureSupportData({ customers: true, products: true, bouncyCastles: true })
      .then(() => {
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

  const openEdit = (booking) => {
    if (isMobileView) return;
    ensureSupportData({ customers: true, products: true, bouncyCastles: true })
      .then(async () => {
        const fullBooking = await fetchBookingById(booking.id);
        setBookings((current) => current.map((row) => (row.id === fullBooking.id ? { ...row, ...fullBooking } : row)));
        setEditing(fullBooking);
        setSaveError("");
        setProductQuery("");
        setCustomerMenuOpen(false);
        setForm(buildBookingEditorState(fullBooking, user?.id ? String(user.id) : ""));
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
      if (!isMobileView) {
        openCreate();
      }
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
      if (!isMobileView) {
        openEdit(targetBooking);
      }
      finish();
      return;
    }

    openBookingDetail(targetBooking);
    finish();
  }, [bookings, isMobileView, loading, location.pathname, location.search, navigate, viewMode]);

  const save = async (event) => {
    event.preventDefault();
    setSaveError("");

    if (!form.eventDate) return setSaveError("Event date is required.");
    if (!form.venueAddress.trim()) return setSaveError("Venue address is required.");
    if (!form.items.length) return setSaveError("Add at least one item to the booking.");

    setSaving(true);
    try {
      const customerId = await ensureBookingCustomer();
      if (!Number.isFinite(Number(customerId)) || Number(customerId) <= 0) {
        throw new Error("Select or create a customer.");
      }
      const isEdit = Boolean(editing?.id);
      const response = await fetch("/.netlify/functions/bookings", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          userId: user?.id,
          userName: user?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
          userEmail: user?.email,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Save failed.");

      setBookings((prev) => {
        if (isEdit) return prev.map((row) => (row.id === payload.id ? payload : row));
        return [payload, ...prev];
      });

      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      console.error("Save booking failed", err);
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateBookingStatus = async (booking, nextStatus) => {
    if (!booking?.id) return;
    if (normalizeStatus(booking.status) === normalizeStatus(nextStatus)) return;
    setStatusUpdatingId(booking.id);
    setError("");
    setBookings((prev) =>
      prev.map((row) => (row.id === booking.id ? { ...row, status: nextStatus } : row))
    );
    setDetailBooking((prev) => (prev && prev.id === booking.id ? { ...prev, status: nextStatus } : prev));
    try {
      const response = await fetch("/.netlify/functions/bookings", {
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
      setBookings((prev) =>
        prev.map((row) => (row.id === booking.id ? booking : row))
      );
      setDetailBooking((prev) => (prev && prev.id === booking.id ? booking : prev));
      setError(err.message || "Failed to update booking.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openBookingDetail = (booking) => {
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
              <button type="button" className="bookings-secondary" onClick={fetchAll}>
                <AppIcon icon={faRotateRight} />
              </button>
              {!isMobileView ? (
                <button type="button" className="bookings-primary" onClick={openCreate}>
                  <AppIcon icon={faPlus} />
                </button>
              ) : null}
            </>
          )}
        />

        {loading && <p className="bookings-status">Loading bookings...</p>}
        {!loading && error && (
          <div className="bookings-inline">
            <p className="bookings-error">{error}</p>
            <button type="button" className="bookings-secondary" onClick={fetchAll}>
              <AppIcon icon={faRotateRight} /> Retry
            </button>
          </div>
        )}

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
              <p className="bookings-summary-label">Delivery</p>
              <strong className="bookings-summary-value">{linkedDeliveryCount}</strong>
            </article>
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Invoices</p>
              <strong className="bookings-summary-value">{linkedDocumentCount}</strong>
            </article>
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Expenses</p>
              <strong className="bookings-summary-value">{formatMoney(linkedExpenseTotal, "GHS")}</strong>
            </article>
            <article className="bubble-card bookings-summary-card">
              <p className="bookings-summary-label">Booked value</p>
              <strong className="bookings-summary-value">{formatMoney(bookingsTableTotal, "GHS")}</strong>
              <span className="bookings-summary-sub">{unassignedBookingsCount} unassigned</span>
            </article>
          </section>
        )}

        {!loading && !error && (
          <section className="glass-card admin-table bookings-results-panel">
            <div className="bookings-results-head">
              <div>
                <h3>{sortedBookings.length} Bookings</h3>
              </div>
              <div className="bookings-results-meta">
                <span>{formatMoney(bookingsTableTotal, "GHS")}</span>
              </div>
            </div>

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
                              <strong>{formatDate(booking.eventDate)}</strong>
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
                <div className="admin-table-scroll inventory-table-scroll bookings-table-scroll">
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

            {activeViewMode === "list" ? (
              <div className="table-pagination">
                <span>
                  Showing {sortedBookings.length === 0 ? 0 : clampedPage * pageSize + 1}-
                  {Math.min(sortedBookings.length, (clampedPage + 1) * pageSize)} of {sortedBookings.length}
                </span>
                <div className="table-pagination-controls">
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}>
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={clampedPage >= pageCount - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>

      <BookingEditorModal
        open={modalOpen}
        editing={editing}
        closeModal={closeModal}
        save={save}
        saveError={saveError}
        saving={saving}
        form={form}
        setForm={setForm}
        customerMenuOpen={customerMenuOpen}
        setCustomerMenuOpen={setCustomerMenuOpen}
        handleBookingCustomerInputChange={handleBookingCustomerInputChange}
        handleBookingCustomerInputKeyDown={handleBookingCustomerInputKeyDown}
        filteredBookingCustomerOptions={filteredBookingCustomerOptions}
        typedBookingCustomerName={typedBookingCustomerName}
        matchedTypedBookingCustomer={matchedTypedBookingCustomer}
        commitBookingCustomerInput={commitBookingCustomerInput}
        handleBookingCustomerChange={handleBookingCustomerChange}
        customerCreating={customerCreating}
        BookingCustomerPickerComponent={BookingCustomerPicker}
        BOOKING_TIME_OPTIONS={BOOKING_TIME_OPTIONS}
        BOOKING_EDITOR_STATUS_OPTIONS={BOOKING_EDITOR_STATUS_OPTIONS}
        assignedUserOptions={assignedUserOptions}
        productQuery={productQuery}
        setProductQuery={setProductQuery}
        filteredProducts={filteredProducts}
        addItem={addItem}
        formItems={form.items}
        productMap={productMap}
        updateItemPrice={updateItemPrice}
        updateItemQuantity={updateItemQuantity}
        removeItem={removeItem}
        bookingTotalCents={bookingTotalCents}
        bookingCurrency={(value) => formatMoney(value, bookingCurrency)}
      />

      <BookingDetailModal
        booking={detailBooking}
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
        openEdit={openEdit}
        closeDetail={() => setDetailBooking(null)}
        viewCustomer={viewCustomer}
        viewExpenses={viewExpenses}
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
