import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLoadingState, ERPFormNotice, SelectField } from "@faako/ui";
import { useLocation, useNavigate } from "react-router-dom";
import "./AdminRentals.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import SearchField from "../../components/SearchField/SearchField";
import TablePagination from "../../components/TablePagination/TablePagination";
import { AppIcon } from "../../components/Icon/Icon";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { reebsApiResponse } from "../../api/client.js";
import {
  faCalendarDays,
  faFileInvoiceDollar,
  faPlus,
  faRotateRight,
  faWrench,
  faXmark,
} from "../../icons/iconSet";
import {
  fetchInventoryWithCache,
  splitInventory,
  writeInventoryCache,
} from "../../utils/inventoryCache";

const DETAIL_ID_PARAM = "id";
const DETAIL_CREATE_PARAM = "create";

const createEmptyRentalForm = () => ({
  id: null,
  name: "",
  sku: "",
  category: "",
  price: "",
  stock: "1",
  rate: "",
  attendantsNeeded: "",
  reorderLevel: "2",
  reorderQuantity: "0",
  age: "",
  imageUrl: "",
  description: "",
  currency: "GHS",
});

const createEmptyMaintenanceForm = () => ({
  issue: "",
  type: "repair",
  cost: "",
  notes: "",
});

const getQuantity = (item) => {
  const raw = item?.quantity ?? item?.stock ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

const getReorderLevel = (item) => {
  const raw = item?.reorderLevel ?? item?.reorder_level ?? item?.reorderlevel;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 2;
};

const getReorderQuantity = (item) => {
  const raw = item?.reorderQuantity ?? item?.reorder_quantity ?? item?.reorderquantity;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSourceCode = (item) =>
  String(item?.sourceCategoryCode || item?.sourcecategorycode || "")
    .trim()
    .toUpperCase();

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const isRentalItem = (item) => {
  const source = normalizeSourceCode(item);
  if (source) return source === "RENTAL";
  return String(item?.sku || "")
    .trim()
    .toUpperCase()
    .startsWith("REN");
};

const toTitleCase = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/gi, (match) => match.toUpperCase());

const formatCurrency = (amount, currency = "GHS") => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "-";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  const raw = String(value || "").trim();
  return raw ? raw.toUpperCase() : "TIME TBD";
};

const getSpecificCategory = (item) =>
  String(item?.specificCategory || item?.specificcategory || "")
    .replace(/\s+/g, " ")
    .trim();

const getDocumentReference = (document) => String(document?.invoiceNumber || "").trim() || "Draft";

const getDocumentEntryKey = (document) => {
  if (!document) return "";
  if (String(document.sourceType || "").toLowerCase() === "manual") {
    return document.id ? `manual-${document.id}` : "";
  }
  const sourceType = String(document.sourceType || "").toLowerCase();
  const sourceId = Number(document.sourceId);
  if (!sourceType || !Number.isFinite(sourceId) || sourceId <= 0) return "";
  return `${sourceType}-${sourceId}`;
};

const getDocumentSourceLabel = (document) => {
  const sourceType = String(document?.sourceType || "").toLowerCase();
  if (sourceType === "bookings") return `Booking #${document.sourceId}`;
  if (sourceType === "orders") return `Order #${document.sourceId}`;
  return "Built here";
};

const getRentalHealth = (item, openMaintenanceCount = 0) => {
  if (openMaintenanceCount > 0) return "maintenance";
  const statusText = normalizeStatus(item?.availability || item?.status || item?.condition || "");
  if (/\b(maintenance|repair|broken|damaged|not working)\b/.test(statusText)) return "maintenance";
  if (/\b(unavailable|out of service|offline|inactive|retired)\b/.test(statusText)) return "offline";
  if (item?.status === false || item?.isActive === false) return "offline";
  return "ready";
};

const getRentalHealthLabel = (value) => {
  switch (value) {
    case "maintenance":
      return "Maintenance";
    case "offline":
      return "Offline";
    case "out":
      return "Unavailable";
    default:
      return "Ready";
  }
};

const getRentalHealthClassName = (value) => {
  switch (value) {
    case "maintenance":
      return "is-maintenance";
    case "offline":
      return "is-offline";
    case "out":
      return "is-out";
    default:
      return "is-ready";
  }
};

const isUpcomingBooking = (booking, todayStart) => {
  const date = new Date(booking?.eventDate || "");
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);
  return date.getTime() >= todayStart;
};

const buildRentalFormFromItem = (item) => ({
  id: item?.id ?? null,
  name: item?.name || "",
  sku: item?.sku || "",
  category: getSpecificCategory(item),
  price: Number.isFinite(Number(item?.price)) ? String(Number(item.price)) : "",
  stock: String(getQuantity(item)),
  rate: item?.rate || "",
  attendantsNeeded:
    Number.isFinite(Number(item?.attendantsNeeded)) && Number(item.attendantsNeeded) > 0
      ? String(Number(item.attendantsNeeded))
      : "",
  reorderLevel: String(getReorderLevel(item)),
  reorderQuantity: String(getReorderQuantity(item)),
  age: item?.age || "",
  imageUrl: item?.imageUrl || item?.image || "",
  description: item?.description || "",
  currency: item?.currency || "GHS",
});

const fetchJson = async (url, init) => {
  const response = await reebsApiResponse(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `Request failed (${response.status}).`);
  }
  return payload;
};

function AdminRentals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const detailSyncRef = useRef("");
  const hasLoadedDataRef = useRef(false);

  const [inventoryItems, setInventoryItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("success");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [detailForm, setDetailForm] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [maintenanceForm, setMaintenanceForm] = useState(createEmptyMaintenanceForm());
  const [page, setPage] = useState(0);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const loadModuleData = useCallback(async ({ force = false } = {}) => {
    if (hasLoadedDataRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const inventoryPromise = force
        ? (async () => {
            const items = await fetchJson("/api/inventory");
            const safeItems = Array.isArray(items) ? items : [];
            writeInventoryCache(safeItems);
            return safeItems;
          })()
        : fetchInventoryWithCache().then((result) => result.items || []);

      const [inventoryPayload, bookingsPayload, maintenancePayload, documentsPayload] = await Promise.all([
        inventoryPromise,
        fetchJson("/api/bookings"),
        fetchJson("/api/maintenance"),
        fetchJson("/api/invoice-documents"),
      ]);

      setInventoryItems(Array.isArray(inventoryPayload) ? inventoryPayload : []);
      setBookings(Array.isArray(bookingsPayload) ? bookingsPayload : []);
      setMaintenanceLogs(Array.isArray(maintenancePayload) ? maintenancePayload : []);
      setDocuments(Array.isArray(documentsPayload) ? documentsPayload : []);
      hasLoadedDataRef.current = true;
    } catch (err) {
      console.error("Failed to load rental module data", err);
      setError(err.message || "Unable to load the rental module.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadModuleData();
  }, [loadModuleData]);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedRentalId = useMemo(() => {
    const parsed = Number(searchParams.get(DETAIL_ID_PARAM));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const isCreatingDetail = searchParams.get(DETAIL_CREATE_PARAM) === "1";

  const rentals = useMemo(() => {
    const nextRentals = splitInventory(inventoryItems).rentals.filter(isRentalItem);
    return [...nextRentals].sort((left, right) =>
      String(left?.name || "").localeCompare(String(right?.name || ""), undefined, {
        sensitivity: "base",
      })
    );
  }, [inventoryItems]);

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);

  const maintenanceByProductId = useMemo(() => {
    const map = new Map();
    maintenanceLogs.forEach((log) => {
      const productId = Number(log?.productId);
      if (!Number.isFinite(productId) || productId <= 0) return;
      const current = map.get(productId) || [];
      current.push(log);
      map.set(productId, current);
    });
    map.forEach((logs) =>
      logs.sort(
        (left, right) =>
          new Date(right?.createdAt || right?.updatedAt || 0).getTime() -
          new Date(left?.createdAt || left?.updatedAt || 0).getTime()
      )
    );
    return map;
  }, [maintenanceLogs]);

  const bookingDocumentByBookingId = useMemo(() => {
    const map = new Map();
    documents.forEach((document) => {
      if (document?.archivedAt) return;
      const sourceType = String(document?.sourceType || "").toLowerCase();
      const sourceId = Number(document?.sourceId);
      if (sourceType === "bookings" && Number.isFinite(sourceId) && sourceId > 0) {
        map.set(sourceId, document);
      }
    });
    return map;
  }, [documents]);

  const documentsByProductId = useMemo(() => {
    const map = new Map();
    documents.forEach((document) => {
      if (document?.archivedAt) return;
      const lineItems = Array.isArray(document?.lineItems) ? document.lineItems : [];
      const seenProducts = new Set();
      lineItems.forEach((lineItem) => {
        const productId = Number(lineItem?.productId);
        if (!Number.isFinite(productId) || productId <= 0 || seenProducts.has(productId)) return;
        seenProducts.add(productId);
        const current = map.get(productId) || [];
        current.push(document);
        map.set(productId, current);
      });
    });
    map.forEach((linkedDocuments) =>
      linkedDocuments.sort(
        (left, right) =>
          new Date(right?.updatedAt || right?.createdAt || 0).getTime() -
          new Date(left?.updatedAt || left?.createdAt || 0).getTime()
      )
    );
    return map;
  }, [documents]);

  const bookingsByProductId = useMemo(() => {
    const map = new Map();
    bookings.forEach((booking) => {
      const items = Array.isArray(booking?.items) ? booking.items : [];
      const groupedQuantities = new Map();
      items.forEach((item) => {
        const productId = Number(item?.productId);
        if (!Number.isFinite(productId) || productId <= 0) return;
        groupedQuantities.set(productId, (groupedQuantities.get(productId) || 0) + Math.max(1, Number(item?.quantity) || 1));
      });

      groupedQuantities.forEach((bookedQuantity, productId) => {
        const current = map.get(productId) || [];
        current.push({
          ...booking,
          bookedQuantity,
          linkedDocument: bookingDocumentByBookingId.get(Number(booking?.id)) || null,
        });
        map.set(productId, current);
      });
    });

    map.forEach((linkedBookings) =>
      linkedBookings.sort(
        (left, right) =>
          new Date(left?.eventDate || 0).getTime() - new Date(right?.eventDate || 0).getTime()
      )
    );
    return map;
  }, [bookings, bookingDocumentByBookingId]);

  const categoryOptions = useMemo(
    () =>
      [...new Set(rentals.map((item) => getSpecificCategory(item)).filter(Boolean))].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" })
      ),
    [rentals]
  );

  const filteredRentals = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rentals.filter((item) => {
      const category = getSpecificCategory(item);
      const openMaintenanceCount = (maintenanceByProductId.get(Number(item.id)) || []).filter(
        (log) => normalizeStatus(log?.status) === "open"
      ).length;
      const health = getRentalHealth(item, openMaintenanceCount);

      if (categoryFilter !== "all" && category !== categoryFilter) return false;
      if (healthFilter !== "all" && health !== healthFilter) return false;

      if (!needle) return true;
      const fields = [
        item?.name,
        item?.sku,
        category,
        item?.rate,
        item?.description,
      ];
      return fields.some((field) => String(field || "").toLowerCase().includes(needle));
    });
  }, [categoryFilter, healthFilter, maintenanceByProductId, query, rentals]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredRentals.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedRentals = useMemo(() => {
    const start = clampedPage * pageSize;
    return filteredRentals.slice(start, start + pageSize);
  }, [filteredRentals, clampedPage]);
  const rentalsTableSummary = useMemo(
    () =>
      paginatedRentals.reduce(
        (summary, item) => {
          const productId = Number(item.id);
          const linkedBookings = bookingsByProductId.get(productId) || [];
          const upcomingBookings = linkedBookings.filter((booking) => isUpcomingBooking(booking, todayStart)).length;
          const linkedDocuments = documentsByProductId.get(productId) || [];
          const openMaintenance = (maintenanceByProductId.get(productId) || []).filter(
            (log) => normalizeStatus(log?.status) === "open"
          ).length;

          summary.count += 1;
          summary.stock += getQuantity(item);
          summary.upcoming += upcomingBookings;
          summary.documents += linkedDocuments.length;
          summary.maintenance += openMaintenance;
          return summary;
        },
        { count: 0, stock: 0, upcoming: 0, documents: 0, maintenance: 0 }
      ),
    [bookingsByProductId, documentsByProductId, maintenanceByProductId, paginatedRentals, todayStart]
  );
  const renderRentalsPagination = (header = false) => (
    <TablePagination
      total={filteredRentals.length}
      pageIndex={clampedPage}
      pageSize={pageSize}
      pageCount={pageCount}
      onPrevious={() => setPage((p) => Math.max(0, p - 1))}
      onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
      header={header}
    />
  );

  useEffect(() => {
    setPage(0);
  }, [categoryFilter, healthFilter, query, rentals.length]);

  const globalSummary = useMemo(() => {
    const totalUnits = rentals.reduce((sum, item) => sum + getQuantity(item), 0);
    const upcomingBookings = bookings.filter((booking) => isUpcomingBooking(booking, todayStart)).length;
    const openMaintenance = maintenanceLogs.filter((log) => normalizeStatus(log?.status) === "open").length;
    return {
      totalRentals: rentals.length,
      totalUnits,
      upcomingBookings,
      openMaintenance,
    };
  }, [bookings, maintenanceLogs, rentals, todayStart]);

  const selectedRental = useMemo(
    () => rentals.find((item) => Number(item.id) === selectedRentalId) || null,
    [rentals, selectedRentalId]
  );

  useEffect(() => {
    const nextKey = isCreatingDetail ? "create" : selectedRental ? `rental-${selectedRental.id}` : "";
    if (!nextKey) {
      detailSyncRef.current = "";
      setDetailForm(null);
      setMaintenanceForm(createEmptyMaintenanceForm());
      setDetailError("");
      return;
    }

    if (detailSyncRef.current === nextKey) return;

    if (isCreatingDetail) {
      setDetailForm(createEmptyRentalForm());
      setMaintenanceForm(createEmptyMaintenanceForm());
      setDetailError("");
      detailSyncRef.current = nextKey;
      return;
    }

    if (!selectedRental) return;

    setDetailForm(buildRentalFormFromItem(selectedRental));
    setMaintenanceForm(createEmptyMaintenanceForm());
    setDetailError("");
    detailSyncRef.current = nextKey;
  }, [isCreatingDetail, selectedRental]);

  useEffect(() => {
    if (loading) return;
    if (!selectedRentalId || isCreatingDetail || selectedRental) return;
    setNotice("That rental item is no longer available.");
    setNoticeTone("error");
    detailSyncRef.current = "";
    navigate("/admin/rentals", { replace: true });
  }, [isCreatingDetail, loading, navigate, selectedRental, selectedRentalId]);

  const openCreateView = () => {
    detailSyncRef.current = "";
    navigate("/admin/rentals?create=1");
  };

  const openRentalDetail = (rentalId) => {
    detailSyncRef.current = "";
    navigate(`/admin/rentals?id=${rentalId}`);
  };

  const closeDetail = useCallback(() => {
    detailSyncRef.current = "";
    navigate("/admin/rentals");
  }, [navigate]);

  const activeDetailId = detailForm?.id ? Number(detailForm.id) : null;

  const detailMaintenanceLogs = useMemo(
    () => (activeDetailId ? maintenanceByProductId.get(activeDetailId) || [] : []),
    [activeDetailId, maintenanceByProductId]
  );

  const detailBookings = useMemo(
    () => (activeDetailId ? bookingsByProductId.get(activeDetailId) || [] : []),
    [activeDetailId, bookingsByProductId]
  );

  const detailDocuments = useMemo(
    () => (activeDetailId ? documentsByProductId.get(activeDetailId) || [] : []),
    [activeDetailId, documentsByProductId]
  );

  const detailOpenMaintenanceCount = useMemo(
    () => detailMaintenanceLogs.filter((log) => normalizeStatus(log?.status) === "open").length,
    [detailMaintenanceLogs]
  );

  const detailUpcomingBookings = useMemo(
    () => detailBookings.filter((booking) => isUpcomingBooking(booking, todayStart)),
    [detailBookings, todayStart]
  );

  const detailUniqueCustomerCount = useMemo(
    () =>
      new Set(
        detailBookings
          .map((booking) => booking.customerId || booking.customerName)
          .filter(Boolean)
      ).size,
    [detailBookings]
  );

  const detailMaintenanceSpend = useMemo(
    () => detailMaintenanceLogs.reduce((sum, log) => sum + toNumber(log?.cost, 0), 0),
    [detailMaintenanceLogs]
  );

  const detailHealth = useMemo(
    () => getRentalHealth(selectedRental || detailForm, detailOpenMaintenanceCount),
    [detailForm, detailOpenMaintenanceCount, selectedRental]
  );

  const handleRefresh = () => {
    setNotice("");
    void loadModuleData({ force: true });
  };

  const handleSaveRental = async () => {
    if (!detailForm) return;

    const name = detailForm.name.trim();
    const priceValue = Number(detailForm.price);
    const stockValue = Number.parseInt(detailForm.stock, 10);
    const attendantsValue =
      detailForm.attendantsNeeded !== "" ? Number.parseInt(detailForm.attendantsNeeded, 10) : null;
    const reorderLevelValue =
      detailForm.reorderLevel !== "" ? Number.parseInt(detailForm.reorderLevel, 10) : null;
    const reorderQuantityValue =
      detailForm.reorderQuantity !== "" ? Number.parseInt(detailForm.reorderQuantity, 10) : null;

    if (!name) {
      setDetailError("Name is required.");
      return;
    }
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setDetailError("Price must be zero or higher.");
      return;
    }
    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setDetailError("Tracked units must be zero or higher.");
      return;
    }
    if (detailForm.reorderLevel !== "" && (!Number.isFinite(reorderLevelValue) || reorderLevelValue < 0)) {
      setDetailError("Stock alert must be zero or higher.");
      return;
    }
    if (
      detailForm.reorderQuantity !== "" &&
      (!Number.isFinite(reorderQuantityValue) || reorderQuantityValue < 0)
    ) {
      setDetailError("Target add must be zero or higher.");
      return;
    }
    if (
      detailForm.attendantsNeeded !== "" &&
      (!Number.isFinite(attendantsValue) || attendantsValue < 0)
    ) {
      setDetailError("Attendants must be zero or higher.");
      return;
    }

    setSaving(true);
    setDetailError("");

    try {
      const payload = await fetchJson("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailForm.id || undefined,
          name,
          priceCents: Math.round(priceValue * 100),
          stock: stockValue,
          sourceCategoryCode: "RENTAL",
          specificCategory: detailForm.category || undefined,
          description: detailForm.description || undefined,
          currency: detailForm.currency || "GHS",
          attendantsNeeded: Number.isFinite(attendantsValue) ? attendantsValue : undefined,
          reorderLevel: Number.isFinite(reorderLevelValue) ? reorderLevelValue : undefined,
          reorderQuantity: Number.isFinite(reorderQuantityValue) ? reorderQuantityValue : undefined,
          age: detailForm.age || undefined,
          imageUrl: detailForm.imageUrl || undefined,
          rate: detailForm.rate || undefined,
          userId: user?.id,
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        }),
      });

      if (payload?.status === "pending_approval") {
        setNotice(payload?.message || "Changes sent for approval.");
        setNoticeTone("info");
        return;
      }

      setNotice(detailForm.id ? "Rental item updated." : "Rental item created.");
      setNoticeTone("success");
      detailSyncRef.current = "";

      if (!detailForm.id && payload?.id) {
        navigate(`/admin/rentals?id=${payload.id}`, { replace: true });
      } else if (payload?.id) {
        setDetailForm(buildRentalFormFromItem(payload));
      }

      await loadModuleData({ force: true });
    } catch (err) {
      console.error("Failed to save rental item", err);
      setDetailError(err.message || "Unable to save the rental item.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveRental = async () => {
    if (!detailForm?.id) return;
    if (typeof window !== "undefined" && !window.confirm("Archive this rental item?")) {
      return;
    }

    setSaving(true);
    setDetailError("");
    try {
      await fetchJson("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailForm.id,
          action: "archive",
          userId: user?.id,
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        }),
      });
      setNotice("Rental item archived.");
      setNoticeTone("success");
      detailSyncRef.current = "";
      closeDetail();
      await loadModuleData({ force: true });
    } catch (err) {
      console.error("Failed to archive rental item", err);
      setDetailError(err.message || "Unable to archive the rental item.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMaintenance = async (event) => {
    event.preventDefault();
    if (!activeDetailId) return;
    if (!maintenanceForm.issue.trim()) {
      setDetailError("Issue description is required.");
      return;
    }

    setMaintenanceSaving(true);
    setDetailError("");
    try {
      await fetchJson("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: activeDetailId,
          issue: maintenanceForm.issue,
          type: maintenanceForm.type,
          cost: maintenanceForm.cost || 0,
          notes: maintenanceForm.notes || undefined,
        }),
      });
      setMaintenanceForm(createEmptyMaintenanceForm());
      setNotice("Maintenance logged.");
      setNoticeTone("success");
      await loadModuleData({ force: true });
    } catch (err) {
      console.error("Failed to log maintenance", err);
      setDetailError(err.message || "Unable to log maintenance.");
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleUpdateMaintenanceStatus = async (log, nextStatus) => {
    if (!log?.id) return;
    setMaintenanceSaving(true);
    setDetailError("");
    try {
      await fetchJson("/api/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: log.id,
          status: nextStatus,
        }),
      });
      setNotice(nextStatus === "resolved" ? "Maintenance resolved." : "Maintenance reopened.");
      setNoticeTone("success");
      await loadModuleData({ force: true });
    } catch (err) {
      console.error("Failed to update maintenance status", err);
      setDetailError(err.message || "Unable to update maintenance.");
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const openBooking = (bookingId) => {
    navigate(`/admin/bookings?id=${bookingId}`);
  };

  const openDocument = (document) => {
    const entryKey = getDocumentEntryKey(document);
    if (!entryKey) {
      navigate("/admin/invoicing");
      return;
    }
    navigate(`/admin/invoicing?document=${encodeURIComponent(entryKey)}`);
  };

  useEffect(() => {
    if (!detailForm || typeof window === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDetail();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDetail, detailForm]);

  const headerActions = (
    <>
      <button
        type="button"
        className="admin-secondary admin-refresh rentals-header-action"
        onClick={handleRefresh}
        disabled={refreshing}
      >
        <AppIcon icon={faRotateRight} /> Refresh
      </button>
      <button type="button" className="admin-primary rentals-header-action" onClick={openCreateView}>
        <AppIcon icon={faPlus} /> New rental
      </button>
    </>
  );

  return (
    <div className="rentals-page">
      <div className="rentals-shell">
        <AdminBreadcrumb
          items={[{ label: "Rentals" }]}
        />

        <AdminPageHeader
          eyebrow="Rental Assets"
          title="Rentals"
          subtitle="Manage rental items, maintenance, linked bookings, and linked documents in one place."
          actions={headerActions}
        />

        {error ? (
          <ERPFormNotice tone="danger" title="Rentals unavailable" onDismiss={() => setError("")}>
            {error}
          </ERPFormNotice>
        ) : null}
        {notice ? (
          <ERPFormNotice
            tone={noticeTone === "error" ? "danger" : noticeTone}
            title={noticeTone === "success" ? "Rental updated" : "Rental notice"}
            onDismiss={() => setNotice("")}
          >
            {notice}
          </ERPFormNotice>
        ) : null}

        <section className="rentals-summary-grid">
          <article className="bubble-card rentals-summary-card">
            <p className="rentals-summary-label">Rental items</p>
            <h3 className="rentals-summary-value">{globalSummary.totalRentals}</h3>
            <p className="rentals-summary-sub">Active rental products</p>
          </article>
          <article className="bubble-card rentals-summary-card">
            <p className="rentals-summary-label">Units on hand</p>
            <h3 className="rentals-summary-value">{globalSummary.totalUnits}</h3>
            <p className="rentals-summary-sub">Tracked rental units</p>
          </article>
          <article className="bubble-card rentals-summary-card">
            <p className="rentals-summary-label">Upcoming bookings</p>
            <h3 className="rentals-summary-value">{globalSummary.upcomingBookings}</h3>
            <p className="rentals-summary-sub">Scheduled rental jobs</p>
          </article>
          <article className="bubble-card rentals-summary-card">
            <p className="rentals-summary-label">Open maintenance</p>
            <h3 className="rentals-summary-value">{globalSummary.openMaintenance}</h3>
            <p className="rentals-summary-sub">Assets currently offline</p>
          </article>
        </section>

        <section className="glass-card rentals-results-panel">
          <div className="rentals-results-head">
            <div>
              <h3>Rental items</h3>
              <p className="rentals-results-sub">Click an item to manage edits, maintenance, bookings, and linked documents.</p>
            </div>
            <div className="rentals-results-meta">
              <span>{filteredRentals.length}</span>
              <small>{filteredRentals.length === 1 ? "item" : "items"}</small>
            </div>
          </div>

          <div className="rentals-toolbar">
            <label className="rentals-search">
              <span>Search</span>
              <SearchField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery("")}
                placeholder="Search rental items"
                aria-label="Search rental items"
              />
            </label>

            <label className="rentals-filter">
              <span>Category</span>
              <SelectField value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </SelectField>
            </label>

            <label className="rentals-filter">
              <span>Health</span>
              <SelectField value={healthFilter} onChange={(event) => setHealthFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="ready">Ready</option>
                <option value="maintenance">Maintenance</option>
                <option value="offline">Offline</option>
                <option value="out">Unavailable</option>
              </SelectField>
            </label>
          </div>

          <div className="admin-table-scroll rentals-table-scroll">
            {renderRentalsPagination(true)}
            <table className="rentals-table">
              <thead>
                <tr>
                  <th className="table-row-index">#</th>
                  <th className="rentals-col-sku">SKU</th>
                  <th className="rentals-col-name">Item</th>
                  <th className="rentals-col-category">Category</th>
                  <th className="rentals-col-rate">Rate</th>
                  <th className="rentals-col-stock">Units</th>
                  <th className="rentals-col-bookings">Upcoming</th>
                  <th className="rentals-col-maintenance">Maint.</th>
                  <th className="rentals-col-documents">Docs</th>
                  <th className="rentals-col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="rentals-empty">
                      <AnimatedLoadingState
                        compact
                        className="rentals-loading-state admin-module-loading"
                        title="Loading rental items"
                        message="Checking availability, bookings, and maintenance."
                        variant="dashboard"
                      />
                    </td>
                  </tr>
                ) : filteredRentals.length ? (
                  paginatedRentals.map((item, index) => {
                    const productId = Number(item.id);
                    const category = getSpecificCategory(item) || "Rental";
                    const linkedBookings = bookingsByProductId.get(productId) || [];
                    const linkedDocuments = documentsByProductId.get(productId) || [];
                    const openMaintenanceCount = (maintenanceByProductId.get(productId) || []).filter(
                      (log) => normalizeStatus(log?.status) === "open"
                    ).length;
                    const upcomingBookings = linkedBookings.filter((booking) =>
                      isUpcomingBooking(booking, todayStart)
                    ).length;
                    const health = getRentalHealth(item, openMaintenanceCount);

                    return (
                      <tr
                        key={item.id}
                        className="rentals-row"
                        tabIndex={0}
                        onClick={() => openRentalDetail(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openRentalDetail(item.id);
                          }
                        }}
                      >
                        <td className="table-row-index">{clampedPage * pageSize + index}</td>
                        <td className="rentals-col-sku">
                          <span className="rentals-table-text">{item.sku || "-"}</span>
                        </td>
                        <td className="rentals-col-name">
                          <div className="rentals-cell-stack">
                            <strong className="rentals-table-text">{item.name || "Untitled rental"}</strong>
                          </div>
                        </td>
                        <td className="rentals-col-category">
                          <span className="rentals-table-text">{category}</span>
                        </td>
                        <td className="rentals-col-rate">
                          <span className="rentals-table-text">{item.rate || "Per item"}</span>
                        </td>
                        <td className="rentals-col-stock">
                          <span className="rentals-table-text">{getQuantity(item)}</span>
                        </td>
                        <td className="rentals-col-bookings">
                          <span className="rentals-table-text">{upcomingBookings}</span>
                        </td>
                        <td className="rentals-col-maintenance">
                          <span className="rentals-table-text">{openMaintenanceCount}</span>
                        </td>
                        <td className="rentals-col-documents">
                          <span className="rentals-table-text">{linkedDocuments.length}</span>
                        </td>
                        <td className="rentals-col-status">
                          <span className={`rentals-pill ${getRentalHealthClassName(health)}`}>
                            {getRentalHealthLabel(health)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="rentals-empty">
                      No rental items match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td className="table-row-index">
                    <span className="admin-table-summary-value">{rentalsTableSummary.count}</span>
                  </td>
                  <td className="rentals-col-sku" />
                  <td className="rentals-col-name">
                    <span className="admin-table-summary-value">{rentalsTableSummary.count} items</span>
                  </td>
                  <td className="rentals-col-category" />
                  <td className="rentals-col-rate" />
                  <td className="rentals-col-stock">
                    <span className="admin-table-summary-value">{rentalsTableSummary.stock}</span>
                  </td>
                  <td className="rentals-col-bookings">
                    <span className="admin-table-summary-value">{rentalsTableSummary.upcoming}</span>
                  </td>
                  <td className="rentals-col-maintenance">
                    <span className="admin-table-summary-value">{rentalsTableSummary.maintenance}</span>
                  </td>
                  <td className="rentals-col-documents">
                    <span className="admin-table-summary-value">{rentalsTableSummary.documents}</span>
                  </td>
                  <td className="rentals-col-status" />
                </tr>
              </tfoot>
            </table>
            {renderRentalsPagination()}
          </div>
        </section>

        {detailForm ? (
          <div
            className="admin-modal rentals-lightbox"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rentals-lightbox-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeDetail();
              }
            }}
          >
            <div className="admin-modal-panel rentals-lightbox-panel">
              <header className="rentals-lightbox-head">
                <div className="rentals-lightbox-copy">
                  <p className="admin-eyebrow">Rental Item</p>
                  <h2 id="rentals-lightbox-title">{detailForm.name?.trim() || "New rental"}</h2>
                  <p className="rentals-lightbox-sub">
                    {detailForm.sku
                      ? `${detailForm.sku} · ${getRentalHealthLabel(detailHealth)}`
                      : "Create and manage a rental item, its maintenance, and linked work."}
                  </p>
                </div>
                <div className="rentals-lightbox-actions">
                  {detailForm.id ? (
                    <button
                      type="button"
                      className="admin-secondary rentals-header-action"
                      onClick={handleArchiveRental}
                      disabled={saving}
                    >
                      Archive
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="admin-primary rentals-header-action"
                    onClick={handleSaveRental}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button type="button" className="admin-close rentals-lightbox-close" onClick={closeDetail} aria-label="Close">
                    <AppIcon icon={faXmark} />
                  </button>
                </div>
              </header>

              {detailError ? (
                <ERPFormNotice tone="danger" title="Rental not saved" onDismiss={() => setDetailError("")}>
                  {detailError}
                </ERPFormNotice>
              ) : null}

              <div className="rentals-detail-view rentals-lightbox-body">
            <section className="rentals-detail-summary-grid">
              <article className="bubble-card rentals-summary-card">
                <p className="rentals-summary-label">Units</p>
                <h3 className="rentals-summary-value">{toNumber(detailForm.stock, 0)}</h3>
                <p className="rentals-summary-sub">Units ready for rental</p>
              </article>
              <article className="bubble-card rentals-summary-card">
                <p className="rentals-summary-label">Upcoming</p>
                <h3 className="rentals-summary-value">{detailUpcomingBookings.length}</h3>
                <p className="rentals-summary-sub">Linked upcoming bookings</p>
              </article>
              <article className="bubble-card rentals-summary-card">
                <p className="rentals-summary-label">Maintenance</p>
                <h3 className="rentals-summary-value">{detailOpenMaintenanceCount}</h3>
                <p className="rentals-summary-sub">{formatCurrency(detailMaintenanceSpend / 100)} tracked spend</p>
              </article>
              <article className="bubble-card rentals-summary-card">
                <p className="rentals-summary-label">Customers</p>
                <h3 className="rentals-summary-value">{detailUniqueCustomerCount}</h3>
                <p className="rentals-summary-sub">{detailDocuments.length} linked documents</p>
              </article>
            </section>

            <div className="rentals-detail-grid">
              <div className="rentals-detail-main">
                <section className="glass-card rentals-section">
                  <div className="rentals-section-head">
                    <div>
                      <h3>Rental details</h3>
                      <p className="rentals-section-sub">Edit the rental item itself here.</p>
                    </div>
                    <span className={`rentals-pill ${getRentalHealthClassName(detailHealth)}`}>
                      {getRentalHealthLabel(detailHealth)}
                    </span>
                  </div>

                  <div className="rentals-form-grid">
                    <label className="rentals-field">
                      <span>Name</span>
                      <input
                        type="text"
                        value={detailForm.name}
                        onChange={(event) => setDetailForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Rental item name"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>SKU</span>
                      <div className="rentals-readonly-field">{detailForm.sku || "Generated on save"}</div>
                    </label>

                    <label className="rentals-field">
                      <span>Category</span>
                      <input
                        type="text"
                        list="rentals-category-options"
                        value={detailForm.category}
                        onChange={(event) => setDetailForm((prev) => ({ ...prev, category: event.target.value }))}
                        placeholder="Category"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>Rate</span>
                      <input
                        type="text"
                        value={detailForm.rate}
                        onChange={(event) => setDetailForm((prev) => ({ ...prev, rate: event.target.value }))}
                        placeholder="Per day / Per item / Per head"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>Price</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={detailForm.price}
                        onChange={(event) => setDetailForm((prev) => ({ ...prev, price: event.target.value }))}
                        placeholder="0.00"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>Tracked units</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={detailForm.stock}
                        onChange={(event) => setDetailForm((prev) => ({ ...prev, stock: event.target.value }))}
                        placeholder="0"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>Attendants</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={detailForm.attendantsNeeded}
                        onChange={(event) =>
                          setDetailForm((prev) => ({ ...prev, attendantsNeeded: event.target.value }))
                        }
                        placeholder="0"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>Age / Fit</span>
                      <input
                        type="text"
                        value={detailForm.age}
                        onChange={(event) => setDetailForm((prev) => ({ ...prev, age: event.target.value }))}
                        placeholder="Age range or fit"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>Stock alert</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={detailForm.reorderLevel}
                        onChange={(event) =>
                          setDetailForm((prev) => ({ ...prev, reorderLevel: event.target.value }))
                        }
                        placeholder="2"
                      />
                    </label>

                    <label className="rentals-field">
                      <span>Target add</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={detailForm.reorderQuantity}
                        onChange={(event) =>
                          setDetailForm((prev) => ({ ...prev, reorderQuantity: event.target.value }))
                        }
                        placeholder="0"
                      />
                    </label>

                    <label className="rentals-field rentals-field--wide">
                      <span>Image URL</span>
                      <input
                        type="url"
                        value={detailForm.imageUrl}
                        onChange={(event) => setDetailForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                        placeholder="https://..."
                      />
                    </label>

                    <label className="rentals-field rentals-field--wide">
                      <span>Description</span>
                      <textarea
                        rows="4"
                        value={detailForm.description}
                        onChange={(event) =>
                          setDetailForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder="Short rental notes"
                      />
                    </label>
                  </div>

                  <datalist id="rentals-category-options">
                    {categoryOptions.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </section>

                <section className="glass-card rentals-section">
                  <div className="rentals-section-head">
                    <div>
                      <h3>Linked bookings</h3>
                      <p className="rentals-section-sub">Upcoming and past bookings using this rental.</p>
                    </div>
                    <span className="rentals-section-count">
                      <AppIcon icon={faCalendarDays} /> {detailBookings.length}
                    </span>
                  </div>

                  {detailBookings.length ? (
                    <div className="rentals-linked-list">
                      {detailBookings.map((booking) => (
                        <button
                          key={`${booking.id}-${booking.bookedQuantity}`}
                          type="button"
                          className="rentals-linked-row"
                          onClick={() => openBooking(booking.id)}
                        >
                          <div className="rentals-linked-main">
                            <strong>{booking.customerName || `Booking #${booking.id}`}</strong>
                            <span>
                              #{booking.id} · {formatDate(booking.eventDate)} · {formatTime(booking.startTime)}
                            </span>
                          </div>
                          <div className="rentals-linked-meta">
                            <span>{booking.bookedQuantity} units</span>
                            <span>{booking.venueAddress || "Venue TBD"}</span>
                          </div>
                          <div className="rentals-linked-side">
                            <span className={`rentals-pill is-inline ${normalizeStatus(booking.status) || "pending"}`}>
                              {toTitleCase(booking.status || "pending")}
                            </span>
                            <span className="rentals-linked-doc">
                              {booking.linkedDocument ? getDocumentReference(booking.linkedDocument) : "Draft"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rentals-empty rentals-empty--section">No bookings linked yet.</p>
                  )}
                </section>
              </div>

              <div className="rentals-detail-side">
                <section className="glass-card rentals-section">
                  <div className="rentals-section-head">
                    <div>
                      <h3>Maintenance</h3>
                      <p className="rentals-section-sub">Log repairs, cleaning, and reopen or resolve issues.</p>
                    </div>
                    <span className="rentals-section-count">
                      <AppIcon icon={faWrench} /> {detailMaintenanceLogs.length}
                    </span>
                  </div>

                  {activeDetailId ? (
                    <form className="rentals-maintenance-form" onSubmit={handleSubmitMaintenance}>
                      <label className="rentals-field rentals-field--wide">
                        <span>Issue</span>
                        <input
                          type="text"
                          value={maintenanceForm.issue}
                          onChange={(event) =>
                            setMaintenanceForm((prev) => ({ ...prev, issue: event.target.value }))
                          }
                          placeholder="What needs attention?"
                        />
                      </label>
                      <div className="rentals-maintenance-grid">
                        <label className="rentals-field">
                          <span>Type</span>
                          <SelectField
                            value={maintenanceForm.type}
                            onChange={(event) =>
                              setMaintenanceForm((prev) => ({ ...prev, type: event.target.value }))
                            }
                          >
                            <option value="repair">Repair</option>
                            <option value="cleaning">Cleaning</option>
                            <option value="inspection">Inspection</option>
                          </SelectField>
                        </label>
                        <label className="rentals-field">
                          <span>Cost</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={maintenanceForm.cost}
                            onChange={(event) =>
                              setMaintenanceForm((prev) => ({ ...prev, cost: event.target.value }))
                            }
                            placeholder="0.00"
                          />
                        </label>
                      </div>
                      <label className="rentals-field rentals-field--wide">
                        <span>Notes</span>
                        <textarea
                          rows="3"
                          value={maintenanceForm.notes}
                          onChange={(event) =>
                            setMaintenanceForm((prev) => ({ ...prev, notes: event.target.value }))
                          }
                          placeholder="Extra maintenance notes"
                        />
                      </label>
                      <div className="rentals-maintenance-actions">
                        <button type="submit" className="admin-primary" disabled={maintenanceSaving}>
                          {maintenanceSaving ? "Saving..." : "Log maintenance"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="rentals-empty rentals-empty--section">Save the rental item first to track maintenance.</p>
                  )}

                  {detailMaintenanceLogs.length ? (
                    <div className="rentals-linked-list rentals-linked-list--maintenance">
                      {detailMaintenanceLogs.map((log) => {
                        const logStatus = normalizeStatus(log?.status) || "open";
                        return (
                          <div key={log.id} className="rentals-linked-row rentals-linked-row--static">
                            <div className="rentals-linked-main">
                              <strong>{log.issue || "Maintenance item"}</strong>
                              <span>
                                {toTitleCase(log.type || "repair")} · {formatDate(log.createdAt)}
                              </span>
                            </div>
                            <div className="rentals-linked-meta">
                              <span>{formatCurrency(toNumber(log.cost, 0) / 100)}</span>
                              <span>{log.notes || "No notes"}</span>
                            </div>
                            <div className="rentals-linked-side">
                              <span className={`rentals-pill is-inline ${logStatus}`}>
                                {toTitleCase(logStatus)}
                              </span>
                              <button
                                type="button"
                                className="admin-secondary rentals-inline-action"
                                onClick={() =>
                                  handleUpdateMaintenanceStatus(log, logStatus === "resolved" ? "open" : "resolved")
                                }
                                disabled={maintenanceSaving}
                              >
                                {logStatus === "resolved" ? "Reopen" : "Resolve"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="glass-card rentals-section">
                  <div className="rentals-section-head">
                    <div>
                      <h3>Linked documents</h3>
                      <p className="rentals-section-sub">Receipts and invoices containing this rental.</p>
                    </div>
                    <span className="rentals-section-count">
                      <AppIcon icon={faFileInvoiceDollar} /> {detailDocuments.length}
                    </span>
                  </div>

                  {detailDocuments.length ? (
                    <div className="rentals-linked-list">
                      {detailDocuments.map((document) => (
                        <button
                          key={`${document.id}-${getDocumentReference(document)}`}
                          type="button"
                          className="rentals-linked-row"
                          onClick={() => openDocument(document)}
                        >
                          <div className="rentals-linked-main">
                            <strong>{getDocumentReference(document)}</strong>
                            <span>
                              {toTitleCase(document.documentType || "invoice")} · {formatDate(document.issueDate)}
                            </span>
                          </div>
                          <div className="rentals-linked-meta">
                            <span>{document.customerName || "Walk-in customer"}</span>
                            <span>{getDocumentSourceLabel(document)}</span>
                          </div>
                          <div className="rentals-linked-side">
                            <span className={`rentals-pill is-inline ${normalizeStatus(document.paymentStatus) || "draft"}`}>
                              {toTitleCase(document.paymentStatus || "draft")}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rentals-empty rentals-empty--section">No linked documents yet.</p>
                  )}
                </section>
              </div>
          </div>
            </div>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}

export default AdminRentals;
