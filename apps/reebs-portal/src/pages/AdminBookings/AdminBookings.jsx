/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
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
import BookingCustomerPicker from "./components/BookingCustomerPicker";
import {
  BOOKING_EDITOR_NEXT_STATUSES,
  BOOKING_EDITOR_STATUS_OPTIONS,
  BOOKING_STATUS_OPTIONS,
  BOOKINGS_UI_STORAGE_KEY,
  BOOKING_TIME_OPTIONS,
  BOOKING_TIMING_OPTIONS,
  DESKTOP_BOOKING_VIEW_OPTIONS,
  MOBILE_BOOKING_VIEW_OPTIONS,
  MOBILE_VIEW_QUERY,
  buildBookingEditorState,
  buildBookingsSearch,
  buildDetailExpenseDraft,
  buildMapUrl,
  createAbortController,
  createDebouncedCallback,
  formatAttendantsNeeded,
  formatBookingTimeWindow,
  formatBookingVariantName,
  formatDate,
  formatDateTime,
  formatFullDate,
  formatMoney,
  formatUser,
  getBookingDisplayReference,
  getBookingDocumentStatus,
  getBookingDocumentTitle,
  getBookingLineKey,
  getBookingVariantAvailableQty,
  getBookingVariants,
  getDeliveryMeta,
  getDeliveryStatusLabel,
  getInitialBookingsUiState,
  getIsMobileView,
  isBookingVariantParent,
  isClosedBooking,
  matchesBookingTiming,
  normalizeBookingStatusFilter,
  normalizeBookingTimingFilter,
  normalizeBookingView,
  normalizeCurrency,
  normalizeCustomerName,
  normalizeIdFilter,
  normalizePhoneDigits,
  normalizeStatus,
  sumBookingExpenses,
  toNumber,
} from "./bookingViewModel";
import {
  createBookingCustomer,
  createBookingExpense,
  fetchBookingById as requestBookingById,
  fetchBookingCustomers,
  fetchBookingDeliveries,
  fetchBookingExpenses,
  fetchBookingOverview,
  fetchBouncyCastles,
  fetchRentalProducts,
  submitBooking,
} from "./services/bookingsApi";
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
  createBookingQueueIdempotencyKey,
  getBookingQueueFailureState,
  getQueuedBookingNotice,
  isQueuedBookingForScope,
} from "./offlineBookingQueue";

const BookingEditorModal = React.lazy(() => import("./components/BookingEditorModal"));
const BookingDetailModal = React.lazy(() => import("./components/BookingDetailModal"));

const BookingModalLoading = ({ label }) => (
  <div className="customers-modal bookings-modal" role="status" aria-live="polite">
    <div className="customers-modal-panel">
      <AnimatedLoadingState title={label} />
    </div>
  </div>
);




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
  const [detailExpenseSuccess, setDetailExpenseSuccess] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [customerCreating, setCustomerCreating] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    eventDate: "",
    eventEndDate: "",
    startTime: "",
    endTime: "",
    venueAddress: "",
    venueGhanaPostGps: "",
    customerNotes: "",
    internalNotes: "",
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
  
  const requestCancelRef = useRef(null);
  const bookingCreateIdempotencyKeyRef = useRef("");
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
      cachedIsMobileView.current = matches;
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
    setDetailExpenseSuccess("");
  }, [detailBooking?.eventDate, detailBooking?.id]);

  useEffect(() => {
    if (detailBooking) return;
    setDetailEditing(false);
  }, [detailBooking]);

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
      debouncedSetStatusFilterRef.current?.cancel?.();
      debouncedSetAssignedFilterRef.current?.cancel?.();
      debouncedSetTimingFilterRef.current?.cancel?.();
      debouncedSetQueryRef.current?.cancel?.();
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
        setProducts(await fetchRentalProducts());
      },
      { force }
    );

  const loadCustomers = ({ force = false } = {}) =>
    runSupportLoader(
      "customers",
      async () => {
        setCustomers(await fetchBookingCustomers());
      },
      { force }
    );

  const loadBouncyCastles = ({ force = false } = {}) =>
    runSupportLoader(
      "bouncyCastles",
      async () => {
        setBouncyCastles(await fetchBouncyCastles());
      },
      { force }
    );

  const loadDeliveries = ({ force = false } = {}) =>
    runSupportLoader(
      "deliveries",
      async () => {
        setDeliveries(await fetchBookingDeliveries());
      },
      { force }
    );

  const loadExpenses = ({ force = false } = {}) =>
    runSupportLoader(
      "expenses",
      async () => {
        setExpenses(await fetchBookingExpenses());
      },
      { force }
    );

  const fetchBookingById = useCallback(async (bookingId) => {
    if (requestCancelRef.current) {
      requestCancelRef.current.abort();
    }
    requestCancelRef.current = createAbortController();
    
    try {
      return await requestBookingById(bookingId, {
        signal: requestCancelRef.current?.signal,
      });
    } catch (err) {
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
    
    const results = await Promise.allSettled(tasks);
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason);
    
    if (errors.length > 0) {
      console.warn("Some support data failed to load:", errors);
    }
    
    return true;
  };

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const overview = await fetchBookingOverview({ canManageBookings });
      setBookings(overview.bookings);
      setUsers(overview.users);
      setDocuments(overview.documents);
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
      const reference = String(booking.reference || "").toLowerCase();
      const customer = String(booking.customerName || "").toLowerCase();
      const status = String(booking.status || "").toLowerCase();
      return reference.includes(needle) || idText.includes(needle) || customer.includes(needle) || status.includes(needle);
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
    if (isClosedBooking(detailBooking)) {
      setDetailExpenseError("Completed and cancelled bookings are locked and can't be edited.");
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
    setDetailExpenseSuccess("");

    try {
      const payload = await createBookingExpense({
        category: "auto",
        description,
        amount: amountValue,
        bookingId: detailBooking.id,
        date: expenseDate,
      });

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
      setDetailExpenseSuccess(
        canAccessInvoicing
          ? "Expense linked to this booking. It will be included when the invoice is opened or refreshed."
          : "Expense linked to this booking."
      );
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
      eventEndDate: form.eventEndDate || form.eventDate,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      venueAddress: form.venueAddress,
      venueGhanaPostGps: form.venueGhanaPostGps || null,
      customerNotes: form.customerNotes || null,
      internalNotes: form.internalNotes || null,
      status: form.status,
      assignedUserId: form.assignedUserId ? Number(form.assignedUserId) : null,
      discountCents: Math.round(bookingDiscountAmount * 100),
      items: form.items.map((item) => ({
        productId: Number(item.productId),
        variantId: item.variantId ? Number(item.variantId) : null,
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPriceCents: Number.isFinite(Number(item.price))
          ? Math.max(0, Math.round(Number(item.price) * 100))
          : undefined,
      })),
      ...getBookingActorPayload(),
    }),
    [
      bookingDiscountAmount,
      editing?.id,
      form.assignedUserId,
      form.endTime,
      form.eventEndDate,
      form.eventDate,
      form.customerNotes,
      form.internalNotes,
      form.items,
      form.startTime,
      form.status,
      form.venueGhanaPostGps,
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
      const payload = await submitBooking({
        path: endpoint.path || "/api/bookings",
        method: endpoint.method || "POST",
        idempotencyKey: queuedPayload.idempotencyKey || queueItem.id,
        payload: queuedPayload.booking || {},
        failureMessage: "Queued booking action could not sync",
      });

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
              ? (Number(variant.priceOverride) / 100).toFixed(2)
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
      const payload = await createBookingCustomer({ name: customerName });
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
        bookingCreateIdempotencyKeyRef.current = createBookingQueueIdempotencyKey();
        setForm({
          customerId: "",
          customerName: "",
          eventDate: "",
          eventEndDate: "",
          startTime: "",
          endTime: "",
          venueAddress: "",
          venueGhanaPostGps: "",
          customerNotes: "",
          internalNotes: "",
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

    if (isClosedBooking(booking)) {
      openBookingDetail(booking);
      return;
    }

    ensureSupportData({ customers: true, products: true, bouncyCastles: true })
      .then(async () => {
        const fullBooking = await fetchBookingById(booking.id);
        if (isClosedBooking(fullBooking)) {
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
      const requestedCustomerId = Number(params.get("customerId"));
      const requestedCustomer = customerById.get(requestedCustomerId);
      if (requestedCustomer) {
        setForm((current) => ({
          ...current,
          customerId: String(requestedCustomerId),
          customerName: requestedCustomer.name || "",
        }));
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

    if (editing?.id && isClosedBooking(editing)) {
      return setSaveError("Completed and cancelled bookings are locked and can't be edited.");
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
      const payload = await submitBooking({
        method: isEdit ? "PUT" : "POST",
        idempotencyKey: !isEdit
          ? bookingCreateIdempotencyKeyRef.current
            || (bookingCreateIdempotencyKeyRef.current = createBookingQueueIdempotencyKey())
          : undefined,
        payload: bookingPayload,
        failureMessage: "Save failed",
      });

      setBookings((prev) => {
        if (isEdit) return prev.map((row) => (row.id === payload.id ? payload : row));
        return [payload, ...prev];
      });
      if (!isEdit) bookingCreateIdempotencyKeyRef.current = "";
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
    if (isClosedBooking(booking)) return;
    if (normalizeStatus(booking.status) === normalizeStatus(nextStatus)) return;
    if (
      normalizeStatus(nextStatus) === "cancelled"
      && typeof window !== "undefined"
      && !window.confirm(`Cancel ${getBookingDisplayReference(booking)}? This releases its rental reservation.`)
    ) {
      return;
    }

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
    
    const previousStatus = booking.status;
    
    setStatusUpdatingId(booking.id);
    setError("");
    setBookings((prev) =>
      prev.map((row) => (row.id === booking.id ? { ...row, status: nextStatus } : row))
    );
    setDetailBooking((prev) => (prev && prev.id === booking.id ? { ...prev, status: nextStatus } : prev));
    
    try {
      const payload = await submitBooking({
        method: "PUT",
        payload: {
          id: booking.id,
          status: nextStatus,
          userId: user?.id,
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        },
        failureMessage: "Failed to update booking",
      });
      setBookings((prev) =>
        prev.map((row) => (row.id === payload.id ? payload : row))
      );
      setDetailBooking((prev) => (prev && prev.id === payload.id ? payload : prev));
    } catch (err) {
      console.error("Booking status update failed", err);
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
    BOOKING_EDITOR_STATUS_OPTIONS: BOOKING_EDITOR_STATUS_OPTIONS.filter((option) => {
      if (!editing?.id) return ["pending", "confirmed"].includes(option.value);
      const allowed = BOOKING_EDITOR_NEXT_STATUSES[normalizeStatus(editing.status)];
      return allowed ? allowed.has(option.value) : option.value === normalizeStatus(editing.status);
    }),
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
                              <strong>{getBookingDisplayReference(booking)}</strong>
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
                              <span className="bookings-table-text">{getBookingDisplayReference(booking)}</span>
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
                            <strong>{getBookingDisplayReference(booking)} · {booking.customerName || "Customer"}</strong>
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
                          <h4>{getBookingDisplayReference(selectedMapBooking)} · {selectedMapBooking.customerName || "Customer"}</h4>
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

      {modalOpen ? (
        <Suspense fallback={<BookingModalLoading label="Opening booking editor" />}>
          <BookingEditorModal
            open
            closeModal={closeModal}
            {...sharedBookingEditorProps}
          />
        </Suspense>
      ) : null}

      {detailBooking ? (
        <Suspense fallback={<BookingModalLoading label="Opening booking details" />}>
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
        detailExpenseSuccess={detailExpenseSuccess}
        setDetailExpenseSuccess={setDetailExpenseSuccess}
        addDetailExpense={addDetailExpense}
        bookingLocked={isClosedBooking(detailBooking)}
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
        </Suspense>
      ) : null}
    </div>
  );
}

export default AdminBookings;
