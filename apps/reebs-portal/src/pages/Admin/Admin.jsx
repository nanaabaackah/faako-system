import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SelectField } from "@faako/ui";
import "./Admin.css";
import { Link, useLocation } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { useCart } from "../../components/CartContext/CartContext";
import SearchField from "../../components/SearchField/SearchField";
import { AppIcon } from "../../components/Icon/Icon";
import {
  faEllipsisHorizontal,
  faFolderOpen,
  faPlus,
  faRotateRight,
  faTrash,
  faXmark,
} from "../../icons/iconSet";

const getQuantity = (item) => {
  const raw = item?.quantity ?? item?.stock ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
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

const getCategory = (item) =>
  item?.specificCategory || item?.specificcategory || item?.sourceCategoryCode || "-";

const normalizeSourceCode = (item) =>
  String(item?.sourceCategoryCode || item?.sourcecategorycode || "")
    .trim()
    .toUpperCase();

const getItemVendorIds = (item) => {
  if (Array.isArray(item?.vendorIds)) {
    return item.vendorIds
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(Math.round(value)));
  }

  const vendorId = Number(item?.vendorId);
  return Number.isFinite(vendorId) && vendorId > 0 ? [String(Math.round(vendorId))] : [];
};

const getItemVendorNames = (item, vendorNameById) =>
  getItemVendorIds(item).map((vendorId) => vendorNameById.get(vendorId) || `Vendor #${vendorId}`);

const formatItemVendorLabel = (item, vendorNameById) => {
  const vendorNames = getItemVendorNames(item, vendorNameById);
  if (!vendorNames.length) return "No vendors linked";
  return `Vendors: ${vendorNames.join(", ")}`;
};

const isVendorLinkedInventoryItem = (item) => getItemVendorIds(item).length > 0;

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

const formatStockActivityMonth = (value) => {
  const [year, month] = String(value || "").split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return value || "-";
  }
  const date = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1));
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const formatMoney = (value, currency = "GHS") => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
};

const formatWholeMoney = (value, currency = "GHS") => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(numeric));
  } catch {
    return `${currency} ${Math.round(numeric)}`;
  }
};

const formatWholeMoneyFromCents = (value, currency = "GHS") =>
  formatWholeMoney((Number(value) || 0) / 100, currency);

const capitalizeWords = (value) =>
  String(value || "")
    .replace(/\b([a-z])/gi, (match) => match.toUpperCase())
    .trim();

const normalizeInventoryCategoryName = (value) =>
  capitalizeWords(
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
  );

const formatInventoryItemName = (name, fallback = "Untitled") => {
  const formatted = capitalizeWords(name || "");
  return formatted || fallback;
};

const formatUser = (name) => capitalizeWords(name || "Admin");
const formatUpdatedDetails = (value, name) => {
  const date = formatDateTime(value);
  const user = formatUser(name);
  if (date === "-") return `Updated By ${user}`;
  return `${date} By ${user}`;
};
const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getInventorySegment = (item) => {
  const source = normalizeSourceCode(item);
  if (source === "WATER") return "water";
  if (isVendorLinkedInventoryItem(item)) return "outsourced";
  if (source === "RENTAL") return "rental";
  return "shop";
};

const supportsLowStockLimit = (item) => getInventorySegment(item) !== "rental";

const isLowStockItem = (item) => {
  const quantity = getQuantity(item);
  if (quantity <= 0) return false;
  if (!supportsLowStockLimit(item)) return false;
  return quantity <= getReorderLevel(item);
};

const formatInventorySegment = (segment) => {
  switch (segment) {
    case "rental":
      return "Rentals";
    case "outsourced":
      return "Outsourced";
    case "water":
      return "Water";
    default:
      return "Shop";
  }
};

const getInventoryCostValue = (item) => {
  const explicit = toNumber(item?.stockValue, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const quantity = Math.max(0, getQuantity(item));
  const unitCost =
    toNumber(item?.purchasePriceGhs, NaN) ||
    toNumber(item?.purchasePriceCad, NaN) ||
    toNumber(item?.purchasePriceGbp, NaN) ||
    0;
  return quantity * (Number.isFinite(unitCost) ? unitCost : 0);
};

const getInventorySaleValue = (item) => {
  const explicit = toNumber(item?.saleValue, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Math.max(0, getQuantity(item)) * Math.max(0, toNumber(item?.price, 0));
};

const getInventoryStockValue = (item) =>
  Math.max(0, getQuantity(item)) * Math.max(0, toNumber(item?.price, 0));

const isRecentlyUpdated = (item, windowHours = 24) => {
  const timestamp = new Date(item?.lastUpdatedAt || item?.updatedAt || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return Date.now() - timestamp <= windowHours * 60 * 60 * 1000;
};

const buildInventoryStats = (list = []) => {
  const totalItems = list.length;
  const totalUnits = list.reduce((sum, item) => sum + Math.max(0, getQuantity(item)), 0);
  const lowStock = list.filter(isLowStockItem).length;
  const outOfStock = list.filter((item) => getQuantity(item) <= 0).length;
  const healthyItems = Math.max(0, totalItems - lowStock - outOfStock);
  const costValue = list.reduce((sum, item) => sum + getInventoryCostValue(item), 0);
  const saleValue = list.reduce((sum, item) => sum + getInventorySaleValue(item), 0);
  const missingBarcodes = list.filter((item) => !String(item?.barcode || "").trim()).length;
  const missingReorderRules = list.filter(
    (item) => supportsLowStockLimit(item) && (getReorderLevel(item) <= 0 || getReorderQuantity(item) <= 0)
  ).length;
  const vendorLinked = list.filter((item) => getItemVendorIds(item).length > 0).length;
  const recentlyUpdated = list.filter((item) => isRecentlyUpdated(item)).length;
  const avgUnitsPerSku = totalItems ? (totalUnits / totalItems).toFixed(1) : "0.0";
  return {
    totalItems,
    totalUnits,
    lowStock,
    outOfStock,
    healthyItems,
    healthyRate: totalItems ? Math.round((healthyItems / totalItems) * 100) : 0,
    lowStockRate: totalItems ? Math.round((lowStock / totalItems) * 100) : 0,
    outOfStockRate: totalItems ? Math.round((outOfStock / totalItems) * 100) : 0,
    avgUnitsPerSku,
    costValue,
    saleValue,
    missingBarcodes,
    missingReorderRules,
    vendorLinked,
    recentlyUpdated,
  };
};

const MOBILE_VIEW_QUERY = "(max-width: 720px)";
const LIMITED_INVENTORY_EDIT_FIELDS = new Set(["name", "price", "stock", "description"]);

const getIsMobileView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;

const CAD_TAX_RATE = 0.13;
const INVENTORY_VIEW_MODES = new Set(["table", "cards", "activity"]);
const INVENTORY_SCOPE_FILTERS = new Set(["all", "shop", "rental", "outsourced", "water"]);
const INVENTORY_STOCK_FILTERS = new Set(["all", "in", "out", "low"]);
const INVENTORY_ADD_CATEGORY_VALUE = "__add_category__";

function getInitialViewMode() {
  return getIsMobileView() ? "cards" : "table";
}

const normalizeInventoryViewParam = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return INVENTORY_VIEW_MODES.has(normalized) ? normalized : getInitialViewMode();
};

const normalizeInventoryStockParam = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return INVENTORY_STOCK_FILTERS.has(normalized) ? normalized : "all";
};

const normalizeInventoryScopeParam = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return INVENTORY_SCOPE_FILTERS.has(normalized) ? normalized : "all";
};

const readBooleanParam = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

function Admin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [viewMode, setViewMode] = useState(getInitialViewMode); // table | cards | activity
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [reorderOnly, setReorderOnly] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 49;
  const [stockActivity, setStockActivity] = useState([]);
  const [stockActivityError, setStockActivityError] = useState("");
  const [stockActivityLoading, setStockActivityLoading] = useState(false);
  const [activityDetail, setActivityDetail] = useState(null);
  const [waterSnapshot, setWaterSnapshot] = useState(null);
  const [formState, setFormState] = useState({
    type: "StockIn",
    quantity: "",
    notes: "",
    reference: "",
    soldMonth: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [editRequests, setEditRequests] = useState([]);
  const [editRequestsLoading, setEditRequestsLoading] = useState(false);
  const [editRequestsError, setEditRequestsError] = useState("");
  const [activeEditRequestId, setActiveEditRequestId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemSaving, setNewItemSaving] = useState(false);
  const [newItemError, setNewItemError] = useState("");
  const [archivedItems, setArchivedItems] = useState([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState("");
  const [deletedError, setDeletedError] = useState("");
  const [archivedSelected, setArchivedSelected] = useState(new Set());
  const [archivedBulkLoading, setArchivedBulkLoading] = useState(false);
  const [actionItemId, setActionItemId] = useState(null);
  const [vendors, setVendors] = useState([]);
  const newItemTemplate = {
    name: "",
    barcode: "",
    price: "",
    quantity: "",
    sourceCategoryCode: "CLOTHES",
    specificCategory: "",
    categoryDraft: "",
    isAddingCategory: false,
    description: "",
    purchasePriceGbp: "",
    purchasePriceCad: "",
    conversionAccepted: false,
    conversionRate: null,
    cadConversionAccepted: false,
    cadConversionRate: null,
  };
  const [newItemRows, setNewItemRows] = useState([{ ...newItemTemplate }]);
  const [customInventoryCategories, setCustomInventoryCategories] = useState({});
  const { user } = useAuth();
  const { rates } = useCart();
  const userRole = (user?.role || "").toLowerCase();
  const isSystemAdmin = userRole === "admin";
  const canApproveInventoryEdits = userRole === "admin" || userRole === "manager";
  const canSubmitInventoryEdits = userRole === "admin" || userRole === "manager" || userRole === "staff";
  const canEditAllInventoryFields = userRole === "admin";
  const canAdjustInventoryStockDirectly = userRole === "admin" || userRole === "manager";
  const canCreateInventoryCategories = userRole === "admin" || userRole === "manager";
  const canViewUpdatedColumn = isSystemAdmin || userRole === "manager";
  const shouldShowUpdatedColumn = canViewUpdatedColumn;
  const detailAccessMessage = canEditAllInventoryFields
    ? "Admins can update every editable field on this item."
    : userRole === "manager"
      ? "Managers can update the name, stock, price, and description."
      : userRole === "staff"
        ? "Staff can edit the name, stock, price, and description. A manager must approve the changes before they apply."
        : "This item is read only for your role.";
  const detailSubmitLabel = userRole === "staff" ? "Send for approval" : "Save changes";
  const location = useLocation();
  const gbpRate = useMemo(() => {
    const rawRate = Number(rates?.GBP);
    if (!Number.isFinite(rawRate) || rawRate <= 0) return null;
    return 1 / rawRate;
  }, [rates]);
  const cadToGbpRate = useMemo(() => {
    const cadRate = Number(rates?.CAD);
    const gbpRateRaw = Number(rates?.GBP);
    if (!Number.isFinite(cadRate) || cadRate <= 0) return null;
    if (!Number.isFinite(gbpRateRaw) || gbpRateRaw <= 0) return null;
    return (1 / cadRate) * gbpRateRaw;
  }, [rates]);
  const cadToGbpWithTaxRate = useMemo(() => {
    if (!cadToGbpRate) return null;
    return cadToGbpRate * (1 + CAD_TAX_RATE);
  }, [cadToGbpRate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(MOBILE_VIEW_QUERY);
    const handleChange = () => {
      const matches = mediaQuery.matches;
      setIsMobileView(matches);
      if (matches) {
        setViewMode((prev) => (prev === "table" ? "cards" : prev));
        setActiveItem(null);
        setDetailItem(null);
        setDetailForm(null);
        setNewItemOpen(false);
        setArchivedOpen(false);
        setDeletedOpen(false);
        setOpenMenuId(null);
        setMenuPosition(null);
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
    const params = new URLSearchParams(location.search);
    const nextSearch = params.get("search") || "";
    const nextView = normalizeInventoryViewParam(params.get("view"));
    const nextStockFilter = normalizeInventoryStockParam(params.get("stock"));
    const nextScopeFilter = normalizeInventoryScopeParam(params.get("scope"));
    const nextInStockOnly = nextStockFilter === "in";
    const nextOutOfStockOnly = nextStockFilter === "out";
    const nextReorderOnly = readBooleanParam(params.get("reorder")) || nextStockFilter === "low";
    const resolvedView = isMobileView && nextView === "table" ? "cards" : nextView;

    setSearch((current) => (current === nextSearch ? current : nextSearch));
    setScopeFilter((current) => (current === nextScopeFilter ? current : nextScopeFilter));
    setCategoryFilter((current) => (current === "all" ? current : "all"));
    setInStockOnly((current) => (current === nextInStockOnly ? current : nextInStockOnly));
    setOutOfStockOnly((current) => (current === nextOutOfStockOnly ? current : nextOutOfStockOnly));
    setReorderOnly((current) => (current === nextReorderOnly ? current : nextReorderOnly));
    setViewMode((current) => (current === resolvedView ? current : resolvedView));
    setPage(0);
  }, [isMobileView, location.search]);

  useEffect(() => {
    setArchivedSelected((prev) => {
      if (!prev.size) return prev;
      const validIds = new Set(archivedItems.map((item) => item.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next;
    });
  }, [archivedItems]);

  useEffect(() => {
    if (canViewUpdatedColumn) return;
    setSortConfig((current) =>
      current.key === "lastUpdatedAt" ? { key: "id", direction: "asc" } : current
    );
  }, [canViewUpdatedColumn]);

  const refreshInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/inventory");
      if (!response.ok) {
        throw new Error("Unable to fetch inventory.");
      }
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch inventory", err);
      setError("We couldn't load inventory right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  const loadVendors = useCallback(async () => {
    try {
      const response = await fetch("/.netlify/functions/vendors");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to fetch vendors.");
      }
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch vendors", err);
      setVendors([]);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const vendorNameById = useMemo(
    () =>
      new Map(
        vendors
          .map((vendor) => [String(vendor.id), vendor.name || `Vendor #${vendor.id}`])
      ),
    [vendors]
  );

  const loadEditRequests = useCallback(async () => {
    if (!canApproveInventoryEdits) {
      setEditRequests([]);
      setEditRequestsError("");
      return;
    }

    setEditRequestsLoading(true);
    setEditRequestsError("");
    try {
      const response = await fetch("/.netlify/functions/inventory?view=edit-requests");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load edit requests.");
      }
      setEditRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load inventory edit requests", err);
      setEditRequestsError(err.message || "Unable to load edit requests.");
    } finally {
      setEditRequestsLoading(false);
    }
  }, [canApproveInventoryEdits]);

  useEffect(() => {
    loadEditRequests();
  }, [loadEditRequests]);

  const loadStatusItems = useCallback(async (view) => {
    const setter = view === "archived" ? setArchivedItems : setDeletedItems;
    const setLoading = view === "archived" ? setArchivedLoading : setDeletedLoading;
    const setErrorState = view === "archived" ? setArchivedError : setDeletedError;
    setLoading(true);
    setErrorState("");
    try {
      const response = await fetch(`/.netlify/functions/inventory?view=${view}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load items.");
      setter(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Failed to load ${view} items`, err);
      setErrorState(err.message || "Unable to load items.");
    } finally {
      setLoading(false);
    }
  }, []);

  const buildStockActivityQuery = useCallback((extraParams = {}) => {
    const params = new URLSearchParams();
    const trimmedSearch = search.trim();
    const currentStockFocus = outOfStockOnly ? "out" : reorderOnly ? "low" : inStockOnly ? "in" : "all";

    if (scopeFilter !== "all") params.set("scope", scopeFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (currentStockFocus !== "all") params.set("stock", currentStockFocus);
    if (trimmedSearch) params.set("search", trimmedSearch);

    Object.entries(extraParams || {}).forEach(([key, value]) => {
      if (value === null || typeof value === "undefined" || value === "") return;
      params.set(key, String(value));
    });

    return params.toString();
  }, [categoryFilter, inStockOnly, outOfStockOnly, reorderOnly, scopeFilter, search]);

  const loadStockActivity = useCallback(async () => {
    setStockActivityLoading(true);
    setStockActivityError("");
    try {
      const query = buildStockActivityQuery();
      const res = await fetch(`/.netlify/functions/stockActivity${query ? `?${query}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to load stock history.");
      setStockActivity(Array.isArray(data?.months) ? data.months : []);
    } catch (err) {
      console.error("Failed to load stock activity", err);
      setStockActivity([]);
      setStockActivityError(err.message || "Unable to load stock history.");
    } finally {
      setStockActivityLoading(false);
    }
  }, [buildStockActivityQuery]);

  const loadWaterSnapshot = useCallback(async () => {
    try {
      const response = await fetch("/.netlify/functions/water");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load water summary.");
      }
      const summary = data?.summary && typeof data.summary === "object" ? data.summary : {};
      setWaterSnapshot({
        stock: Math.max(0, Number(summary.stockOnHand) || 0),
        revenue: Number(summary.revenue) || 0,
        profit: Number(summary.netProfit) || 0,
      });
    } catch (err) {
      console.error("Failed to load water snapshot", err);
      setWaterSnapshot(null);
    }
  }, []);

  const closeActivityDetail = useCallback(() => {
    setActivityDetail(null);
  }, []);

  const openActivityDetail = useCallback(async (row, movementType) => {
    const monthKey = String(row?.month_key || "").trim();
    if (!monthKey || !["in", "out"].includes(movementType)) return;

    setActivityDetail({
      monthKey,
      movementType,
      items: [],
      loading: true,
      error: "",
    });

    try {
      const query = buildStockActivityQuery({ month: monthKey, movementType });
      const response = await fetch(`/.netlify/functions/stockActivity?${query}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load movement items.");
      }

      setActivityDetail({
        monthKey,
        movementType,
        items: Array.isArray(data?.items) ? data.items : [],
        loading: false,
        error: "",
      });
    } catch (err) {
      console.error("Failed to load movement detail", err);
      setActivityDetail({
        monthKey,
        movementType,
        items: [],
        loading: false,
        error: err.message || "Unable to load movement items.",
      });
    }
  }, [buildStockActivityQuery]);

  const refreshInventorySurface = useCallback(async () => {
    await Promise.all([
      refreshInventory(),
      loadWaterSnapshot(),
      loadStockActivity(),
      canApproveInventoryEdits ? loadEditRequests() : Promise.resolve(),
      archivedOpen ? loadStatusItems("archived") : Promise.resolve(),
      deletedOpen ? loadStatusItems("deleted") : Promise.resolve(),
    ]);
  }, [
    archivedOpen,
    canApproveInventoryEdits,
    deletedOpen,
    loadEditRequests,
    loadStatusItems,
    loadStockActivity,
    loadWaterSnapshot,
    refreshInventory,
  ]);

  useEffect(() => {
    loadWaterSnapshot();
  }, [loadWaterSnapshot]);

  useEffect(() => {
    if (viewMode === "activity") return;
    setActivityDetail(null);
  }, [viewMode]);

  const toggleArchivedSelection = (id) => {
    setArchivedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearArchivedSelection = () => setArchivedSelected(new Set());

  const buildActorPayload = () => ({
    userId: user?.id,
    userName:
      user?.fullName ||
      user?.name ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      undefined,
    userEmail: user?.email,
  });

  const archiveItem = async (item) => {
    if (!item?.id) return;
    if (!window.confirm(`Archive "${formatInventoryItemName(item.name, "This Item")}"?`)) return;
    setActionItemId(item.id);
    try {
      const response = await fetch("/.netlify/functions/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "archive", ...buildActorPayload() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to archive item.");
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setArchivedItems((prev) => [data, ...prev]);
      setSuccess(`${formatInventoryItemName(item.name, "Item")} archived.`);
    } catch (err) {
      console.error("Archive failed", err);
      setSubmitError(err.message || "Archive failed.");
    } finally {
      setActionItemId(null);
    }
  };

  const restoreSelectedArchived = async () => {
    if (!archivedSelected.size) return;
    if (!window.confirm(`Restore ${archivedSelected.size} archived item(s)?`)) return;
    setArchivedBulkLoading(true);
    try {
      const restored = [];
      for (const id of archivedSelected) {
        const response = await fetch("/.netlify/functions/inventory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "unarchive", ...buildActorPayload() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Failed to restore item.");
        restored.push(data);
      }
      if (restored.length) {
        setArchivedItems((prev) => prev.filter((item) => !archivedSelected.has(item.id)));
        setItems((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const next = restored.filter((item) => !existingIds.has(item.id));
          return [...next, ...prev];
        });
        clearArchivedSelection();
        setSuccess(`Restored ${restored.length} item(s).`);
      }
    } catch (err) {
      console.error("Restore failed", err);
      setSubmitError(err.message || "Restore failed.");
    } finally {
      setArchivedBulkLoading(false);
    }
  };

  const deleteSelectedArchived = async () => {
    if (!archivedSelected.size) return;
    if (!window.confirm(`Delete ${archivedSelected.size} item(s)? This cannot be undone.`)) return;
    setArchivedBulkLoading(true);
    try {
      const deleted = [];
      for (const id of archivedSelected) {
        const response = await fetch("/.netlify/functions/inventory", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...buildActorPayload() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Failed to delete item.");
        deleted.push(data);
      }
      if (deleted.length) {
        setArchivedItems((prev) => prev.filter((item) => !archivedSelected.has(item.id)));
        setItems((prev) => prev.filter((item) => !archivedSelected.has(item.id)));
        setDeletedItems((prev) => [...deleted, ...prev]);
        clearArchivedSelection();
        setSuccess(`Deleted ${deleted.length} item(s).`);
      }
    } catch (err) {
      console.error("Bulk delete failed", err);
      setSubmitError(err.message || "Bulk delete failed.");
    } finally {
      setArchivedBulkLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode !== "activity") return;
    loadStockActivity();
  }, [loadStockActivity, viewMode]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    const handleClickAway = (event) => {
      if (!event.target.closest(".inventory-menu")) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  useEffect(() => {
    if (!openMenuId) return undefined;

    const closeOnLayoutChange = () => {
      setOpenMenuId(null);
      setMenuPosition(null);
    };

    window.addEventListener("resize", closeOnLayoutChange);
    window.addEventListener("scroll", closeOnLayoutChange, true);

    return () => {
      window.removeEventListener("resize", closeOnLayoutChange);
      window.removeEventListener("scroll", closeOnLayoutChange, true);
    };
  }, [openMenuId]);

  useEffect(() => {
    setPage(0);
  }, [search, scopeFilter, categoryFilter, inStockOnly, outOfStockOnly, reorderOnly, viewMode, items.length]);

  const sortValue = (item, key) => {
    switch (key) {
      case "id":
        return Number(item.id) || 0;
      case "name":
        return (item.name || "").toLowerCase();
      case "sku":
        return (item.sku || "").toLowerCase();
      case "segment":
        return getInventorySegment(item);
      case "category":
        return (getCategory(item) || "").toLowerCase();
      case "quantity":
        return getQuantity(item);
      case "price":
        return Math.max(0, toNumber(item?.price, 0));
      case "reorderLevel":
        return getReorderLevel(item);
      case "costValue":
        return getInventoryCostValue(item);
      case "inventoryValue":
        return getInventoryStockValue(item);
      case "saleValue":
        return getInventorySaleValue(item);
      case "lastUpdatedAt":
        return new Date(item.lastUpdatedAt || item.updatedAt || 0).getTime();
      case "lastUpdatedByName":
        return (item.lastUpdatedByName || "").toLowerCase();
      default:
        return item[key] ?? "";
    }
  };

  const stockFocus = outOfStockOnly ? "out" : reorderOnly ? "low" : inStockOnly ? "in" : "all";

  const applyStockFocus = useCallback((next) => {
    setInStockOnly(next === "in");
    setOutOfStockOnly(next === "out");
    setReorderOnly(next === "low");
  }, []);

  const baseFilteredInventory = useMemo(() => {
    const list = [...items];
    const needle = search.trim().toLowerCase();
    const filterCategory = categoryFilter.toLowerCase();
    return list.filter((item) => {
      const quantity = getQuantity(item);
      if (needle) {
        const name = (item.name || "").toLowerCase();
        const sku = (item.sku || "").toLowerCase();
        const barcode = (item.barcode || "").toLowerCase();
        if (!name.includes(needle) && !sku.includes(needle) && !barcode.includes(needle)) {
          return false;
        }
      }
      if (filterCategory !== "all") {
        const cat = (getCategory(item) || "").toLowerCase();
        if (!cat.includes(filterCategory)) return false;
      }
      if (inStockOnly && quantity <= 0) return false;
      if (outOfStockOnly && quantity > 0) return false;
      if (reorderOnly && !isLowStockItem(item)) return false;
      return true;
    });
  }, [items, search, categoryFilter, inStockOnly, outOfStockOnly, reorderOnly]);

  const inventory = useMemo(() => {
    const filtered = baseFilteredInventory.filter((item) => {
      if (scopeFilter === "all") return true;
      return getInventorySegment(item) === scopeFilter;
    });
    const { key, direction } = sortConfig;
    filtered.sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va < vb) return direction === "asc" ? -1 : 1;
      if (va > vb) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [baseFilteredInventory, scopeFilter, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(inventory.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedInventory = useMemo(() => {
    const start = clampedPage * pageSize;
    return inventory.slice(start, start + pageSize);
  }, [inventory, clampedPage, pageSize]);
  const inventoryTableSummary = useMemo(() => {
    const totals = inventory.reduce(
      (accumulator, item) => {
        accumulator.count += 1;
        accumulator.stockTotal += getQuantity(item);
        accumulator.priceTotal += Math.max(0, toNumber(item?.price, 0));
        accumulator.inventoryValueTotal += getInventoryStockValue(item);
        return accumulator;
      },
      { count: 0, stockTotal: 0, priceTotal: 0, inventoryValueTotal: 0 }
    );

    return {
      ...totals,
      averagePrice: totals.count ? totals.priceTotal / totals.count : 0,
    };
  }, [inventory]);
  const paginationStart = inventory.length === 0 ? 0 : clampedPage * pageSize + 1;
  const paginationEnd = Math.min(inventory.length, (clampedPage + 1) * pageSize);
  const paginationDisplayPage = inventory.length === 0 ? 0 : clampedPage + 1;
  const paginationDisplayCount = inventory.length === 0 ? 0 : pageCount;
  const inventoryPagination = (
    <div className="table-pagination inventory-register-pagination">
      <div className="inventory-register-pagination-copy">
        <strong className="inventory-register-pagination-range">
          Showing {paginationStart}-{paginationEnd} of {inventory.length}
        </strong>
      </div>
      <div className="inventory-register-pagination-meta">
        <div className="table-pagination-controls inventory-register-pagination-controls">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
          >
            Previous
          </button>
          <span className="inventory-register-pagination-page">
            Page {paginationDisplayPage} of {paginationDisplayCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPage >= pageCount - 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const coreInventory = useMemo(() => {
    if (scopeFilter === "water") return inventory;
    return inventory.filter((item) => getInventorySegment(item) !== "water");
  }, [inventory, scopeFilter]);
  const waterInventory = useMemo(() => {
    if (scopeFilter === "water") return inventory;
    return baseFilteredInventory.filter((item) => getInventorySegment(item) === "water");
  }, [baseFilteredInventory, inventory, scopeFilter]);
  const primaryInventoryStats = useMemo(() => buildInventoryStats(coreInventory), [coreInventory]);
  const waterInventoryStats = useMemo(() => buildInventoryStats(waterInventory), [waterInventory]);
  const waterSnapshotProfitLabel = (Number(waterSnapshot?.profit) || 0) < 0 ? "Loss" : "Profit";
  const waterSnapshotProfitDisplayValue = Math.abs(Number(waterSnapshot?.profit) || 0);
  const stockHealthInventory = scopeFilter === "water" ? inventory : coreInventory;
  const scopeSummaries = useMemo(() => {
    const summaryMap = new Map(
      ["shop", "rental", "outsourced", "water"].map((key) => [
        key,
        { key, label: formatInventorySegment(key), count: 0, units: 0, lowStock: 0 },
      ])
    );
    baseFilteredInventory.forEach((item) => {
      const key = getInventorySegment(item);
      const entry = summaryMap.get(key);
      if (!entry) return;
      entry.count += 1;
      entry.units += Math.max(0, getQuantity(item));
      if (isLowStockItem(item)) entry.lowStock += 1;
    });
    return [
      {
        key: "all",
        label: "All inventory",
        count: baseFilteredInventory.length,
        units: baseFilteredInventory.reduce((sum, item) => sum + Math.max(0, getQuantity(item)), 0),
        lowStock: baseFilteredInventory.filter(isLowStockItem).length,
      },
      ...Array.from(summaryMap.values()).filter((entry) => entry.key !== "water"),
    ];
  }, [baseFilteredInventory]);
  const stockHealthSegments = useMemo(() => {
    let healthy = 0;
    let low = 0;
    let out = 0;
    stockHealthInventory.forEach((item) => {
      const quantity = getQuantity(item);
      if (quantity <= 0) {
        out += 1;
      } else if (isLowStockItem(item)) {
        low += 1;
      } else {
        healthy += 1;
      }
    });
    return [
      { key: "healthy", label: "Healthy", value: healthy, color: "#22c55e" },
      { key: "low", label: "Low stock", value: low, color: "#f59e0b" },
      { key: "out", label: "Out of stock", value: out, color: "#ef4444" },
    ];
  }, [stockHealthInventory]);
  const stockHealthTotal = stockHealthSegments.reduce((sum, segment) => sum + segment.value, 0);
  const stockActivityMax = useMemo(
    () =>
      Math.max(
        1,
        ...stockActivity.flatMap((row) => [
          Math.abs(Number(row?.stock_in) || 0),
          Math.abs(Number(row?.stock_out) || 0),
        ])
      ),
    [stockActivity]
  );
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const stockHealthDonut = useMemo(() => {
    let consumed = 0;
    return stockHealthSegments.map((segment) => {
      const fraction = stockHealthTotal ? segment.value / stockHealthTotal : 0;
      const dash = fraction * donutCircumference;
      const offset = donutCircumference - consumed;
      consumed += dash;
      return { ...segment, dash, offset };
    });
  }, [stockHealthSegments, stockHealthTotal, donutCircumference]);
  const categoryUnits = useMemo(() => {
    const totals = new Map();
    stockHealthInventory.forEach((item) => {
      const key = String(getCategory(item) || "Uncategorized");
      const quantity = Math.max(0, getQuantity(item));
      totals.set(key, (totals.get(key) || 0) + quantity);
    });
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [stockHealthInventory]);
  const categoryUnitsMax = useMemo(
    () => Math.max(1, ...categoryUnits.map((entry) => entry.value)),
    [categoryUnits]
  );
  const activityFilterSummary = useMemo(() => {
    const parts = [];
    if (scopeFilter !== "all") parts.push(formatInventorySegment(scopeFilter));
    if (categoryFilter !== "all") parts.push(capitalizeWords(categoryFilter));
    if (stockFocus === "in") parts.push("In Stock");
    if (stockFocus === "low") parts.push("Low Stock");
    if (stockFocus === "out") parts.push("Out Of Stock");
    if (search.trim()) parts.push(`Search: ${search.trim()}`);
    return parts.length ? parts.join(" · ") : "All Inventory";
  }, [categoryFilter, scopeFilter, search, stockFocus]);
  const activityDetailMonthLabel = activityDetail ? formatStockActivityMonth(activityDetail.monthKey) : "";
  const activityDetailTypeLabel =
    activityDetail?.movementType === "out" ? "Stock Out" : "Stock In";
  const primaryAttentionCount = primaryInventoryStats.lowStock + primaryInventoryStats.outOfStock;
  const primaryAttentionRate = primaryInventoryStats.totalItems
    ? Math.round((primaryAttentionCount / primaryInventoryStats.totalItems) * 100)
    : 0;
  const stockHealthTitle = scopeFilter === "water" ? "Water stock health" : "Core stock health";
  const categoryUnitsTitle = scopeFilter === "water" ? "Water units by category" : "Core units by category";
  const detailIndex = useMemo(() => {
    if (!detailItem) return -1;
    return inventory.findIndex((item) => item.id === detailItem.id);
  }, [inventory, detailItem]);
  const detailHasPrev = detailIndex > 0;
  const detailHasNext = detailIndex >= 0 && detailIndex < inventory.length - 1;

  const navigateDetailItem = (direction) => {
    if (detailIndex === -1) return;
    const nextIndex = detailIndex + direction;
    if (nextIndex < 0 || nextIndex >= inventory.length) return;
    setDetailFromItem(inventory[nextIndex]);
  };

  const activeIndex = useMemo(() => {
    if (!activeItem) return -1;
    return inventory.findIndex((item) => item.id === activeItem.id);
  }, [inventory, activeItem]);
  const activeHasPrev = activeIndex > 0;
  const activeHasNext = activeIndex >= 0 && activeIndex < inventory.length - 1;

  const navigateActiveItem = (direction) => {
    if (activeIndex === -1) return;
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= inventory.length) return;
    openAdjustForm(inventory[nextIndex]);
  };

  const openAdjustForm = (item) => {
    if (!canAdjustInventoryStockDirectly) return;
    closeMenu();
    setDetailItem(null);
    setDetailForm(null);
    setDetailError("");
    const currentMonth = new Date().toISOString().slice(0, 7);
    setActiveItem(item);
    setFormState({
      type: "StockIn",
      quantity: "",
      notes: "",
      reference: "",
      soldMonth: currentMonth,
    });
    setSubmitError("");
    setSuccess("");
  };

  const closeAdjustForm = () => {
    setActiveItem(null);
    setSubmitError("");
    setSuccess("");
  };

  const buildMenuPosition = (rect) => {
    const gutter = 12;
    const isMobile = typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;
    const width = isMobile ? Math.min(240, window.innerWidth - gutter * 2) : 320;
    const spacing = 8;
    const maxPanelHeight = isMobile ? 320 : 420;
    const minPanelHeight = isMobile ? 120 : 160;
    const initialTop = rect.bottom + spacing;
    const maxBelow = window.innerHeight - initialTop - gutter;
    const maxAbove = rect.top - gutter - spacing;
    let maxHeight = Math.min(maxPanelHeight, Math.max(minPanelHeight, maxBelow));
    let top = initialTop;
    if (maxBelow < minPanelHeight && maxAbove > maxBelow) {
      maxHeight = Math.min(maxPanelHeight, Math.max(minPanelHeight, maxAbove));
      top = Math.max(gutter, rect.top - maxHeight - spacing);
    }
    let left = rect.right - width;
    if (left + width > window.innerWidth - gutter) {
      left = window.innerWidth - width - gutter;
    }
    left = Math.min(Math.max(gutter, left), window.innerWidth - width - gutter);
    return { top, left, maxHeight };
  };

  const toggleRowMenu = (id, event) => {
    const rect = event?.currentTarget?.getBoundingClientRect();
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }
    setOpenMenuId(id);
    setMenuPosition(rect ? buildMenuPosition(rect) : null);
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const getStockActivityBarStyle = (value) => {
    const amount = Math.abs(Number(value) || 0);
    if (!amount) return { width: "0%" };
    const ratio = Math.min(100, (amount / stockActivityMax) * 100);
    return { width: `max(${ratio}%, 4.5rem)` };
  };

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const updateNewItemRow = (index, field, value) => {
    setNewItemRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addNewItemRow = () => {
    setNewItemRows((prev) => [...prev, { ...newItemTemplate }]);
  };

  const removeNewItemRow = (index) => {
    setNewItemRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleNewItemSourceCategoryChange = (index, value) => {
    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              sourceCategoryCode: value,
              specificCategory: "",
              categoryDraft: "",
              isAddingCategory: false,
            }
          : row
      )
    );
  };

  const handleNewItemCategorySelect = (index, value) => {
    if (value === INVENTORY_ADD_CATEGORY_VALUE) {
      if (!canCreateInventoryCategories) return;
      setNewItemRows((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                isAddingCategory: true,
                categoryDraft: "",
              }
            : row
        )
      );
      return;
    }

    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              specificCategory: value,
              categoryDraft: "",
              isAddingCategory: false,
            }
          : row
      )
    );
  };

  const handleNewItemCategoryDraftChange = (index, value) => {
    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              categoryDraft: value,
            }
          : row
      )
    );
  };

  const cancelNewItemCategoryCreate = (index) => {
    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              categoryDraft: "",
              isAddingCategory: false,
            }
          : row
      )
    );
  };

  const saveNewItemCategory = (index) => {
    if (!canCreateInventoryCategories) {
      setNewItemError("Only admins and managers can create categories.");
      return;
    }

    const row = newItemRows[index];
    const nextCategory = normalizeInventoryCategoryName(row?.categoryDraft);
    if (!nextCategory) {
      setNewItemError(`Row ${index + 1}: Enter a category name.`);
      return;
    }

    const sourceCategory = String(row?.sourceCategoryCode || "CLOTHES").toUpperCase();
    const existingOptions = specificCategoriesBySource[sourceCategory] || [];
    const existingMatch = existingOptions.find(
      (value) => value.trim().toLowerCase() === nextCategory.toLowerCase()
    );

    setCustomInventoryCategories((prev) => {
      if (existingMatch) return prev;
      const current = Array.isArray(prev[sourceCategory]) ? prev[sourceCategory] : [];
      if (current.some((value) => value.trim().toLowerCase() === nextCategory.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        [sourceCategory]: [...current, nextCategory],
      };
    });

    setNewItemRows((prev) =>
      prev.map((currentRow, i) =>
        i === index
          ? {
              ...currentRow,
              specificCategory: existingMatch || nextCategory,
              categoryDraft: "",
              isAddingCategory: false,
            }
          : currentRow
      )
    );
    setNewItemError("");
  };

  const handlePurchasePriceGbpChange = (index, value) => {
    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              purchasePriceGbp: value,
              conversionAccepted: false,
              conversionRate: null,
            }
          : row
      )
    );
  };

  const handleConversionAccept = (index, accepted) => {
    setNewItemRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (!accepted || !gbpRate) {
          return {
            ...row,
            conversionAccepted: false,
            conversionRate: null,
          };
        }
        return {
          ...row,
          conversionAccepted: true,
          conversionRate: gbpRate,
        };
      })
    );
  };

  const handlePurchasePriceCadChange = (index, value) => {
    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              purchasePriceCad: value,
              cadConversionAccepted: false,
              cadConversionRate: null,
              purchasePriceGbp:
                value !== "" && cadToGbpWithTaxRate
                  ? (Number(value) * cadToGbpWithTaxRate).toFixed(2)
                  : row.purchasePriceGbp,
              conversionAccepted: false,
              conversionRate: null,
            }
          : row
      )
    );
  };

  const handleCadConversionAccept = (index, accepted) => {
    setNewItemRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (!accepted || !cadToGbpWithTaxRate) {
          return {
            ...row,
            cadConversionAccepted: false,
            cadConversionRate: null,
          };
        }
        return {
          ...row,
          cadConversionAccepted: true,
          cadConversionRate: cadToGbpWithTaxRate,
        };
      })
    );
  };

  const specificCategoriesBySource = useMemo(() => {
    const grouped = new Map();
    const addCategory = (source, value) => {
      const normalizedSource = String(source || "CLOTHES").trim().toUpperCase() || "CLOTHES";
      const normalizedCategory = normalizeInventoryCategoryName(value);
      if (!normalizedCategory) return;
      if (!grouped.has(normalizedSource)) grouped.set(normalizedSource, new Set());
      grouped.get(normalizedSource).add(normalizedCategory);
    };

    items.forEach((item) => {
      addCategory(
        normalizeSourceCode(item) || "CLOTHES",
        item?.specificCategory || item?.specificcategory || ""
      );
    });

    Object.entries(customInventoryCategories).forEach(([source, values]) => {
      values.forEach((value) => addCategory(source, value));
    });

    return Object.fromEntries(
      Array.from(grouped.entries()).map(([source, valueSet]) => [
        source,
        Array.from(valueSet).sort((a, b) => a.localeCompare(b)),
      ])
    );
  }, [customInventoryCategories, items]);

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      const cat = getCategory(item);
      if (cat && cat !== "-") set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const detailStockValue = useMemo(() => {
    if (!detailForm) return null;
    const priceValue = Number(detailForm.price);
    const stockValue = Number(detailForm.stock);
    if (!Number.isFinite(priceValue) || !Number.isFinite(stockValue)) return null;
    return priceValue * stockValue;
  }, [detailForm]);

  const resetNewItemForm = () => {
    setNewItemRows([{ ...newItemTemplate }]);
    setNewItemError("");
  };

  useEffect(() => {
    setNewItemRows((prev) => {
      if (!prev.some((row) => row.conversionAccepted)) return prev;
      return prev.map((row) =>
        row.conversionAccepted
          ? {
              ...row,
              conversionAccepted: false,
              conversionRate: null,
            }
          : row
      );
    });
  }, [gbpRate]);

  useEffect(() => {
    setNewItemRows((prev) => {
      if (!prev.some((row) => row.cadConversionAccepted)) return prev;
      return prev.map((row) =>
        row.cadConversionAccepted
          ? {
              ...row,
              cadConversionAccepted: false,
              cadConversionRate: null,
            }
          : row
      );
    });
  }, [cadToGbpWithTaxRate]);

  const detailPurchasePriceGbp = detailForm?.purchasePriceGbp;
  useEffect(() => {
    if (!detailForm) return;
    if (detailPurchasePriceGbp === "" || detailPurchasePriceGbp == null) return;
    if (!gbpRate) return;
    const gbpValue = Number(detailPurchasePriceGbp);
    if (!Number.isFinite(gbpValue) || gbpValue < 0) return;
    const nextGhsValue = Math.round(gbpValue * gbpRate * 100) / 100;
    const currentGhsValue = Number(detailForm.purchasePriceGhs);
    if (Number.isFinite(currentGhsValue) && Math.abs(currentGhsValue - nextGhsValue) < 0.005) {
      return;
    }
    setDetailForm((prev) =>
      prev ? { ...prev, purchasePriceGhs: nextGhsValue.toFixed(2) } : prev
    );
  }, [detailForm, detailPurchasePriceGbp, gbpRate]);

  const copyToClipboard = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
    } catch (err) {
      console.warn("Clipboard copy failed", err);
    }
  };

  const createInventoryItems = async (event) => {
    event.preventDefault();
    setNewItemError("");
    setSuccess("");

    const rows = newItemRows
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        barcode: row.barcode.trim(),
        specificCategory: normalizeInventoryCategoryName(row.specificCategory),
        categoryDraft: normalizeInventoryCategoryName(row.categoryDraft),
        description: row.description.trim(),
      }))
      .filter((row) => row.name);

    if (rows.length === 0) {
      setNewItemError("Add at least one item with a name.");
      return;
    }

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const priceValue = Number(row.price);
      const quantityValue = Number.parseInt(row.quantity || "0", 10) || 0;
      const hasPurchasePrice = row.purchasePriceGbp !== "" && row.purchasePriceGbp !== null;
      const purchasePriceValue = hasPurchasePrice ? Number(row.purchasePriceGbp) : null;
      const hasCadPrice = row.purchasePriceCad !== "" && row.purchasePriceCad !== null;
      const purchasePriceCadValue = hasCadPrice ? Number(row.purchasePriceCad) : null;
      if (row.isAddingCategory) {
        setNewItemError(`Row ${i + 1}: Save or cancel the new category first.`);
        return;
      }
      if (!Number.isFinite(priceValue) || priceValue < 0) {
        setNewItemError(`Row ${i + 1}: Price must be zero or higher.`);
        return;
      }
      if (!Number.isFinite(quantityValue) || quantityValue < 0) {
        setNewItemError(`Row ${i + 1}: Quantity must be zero or higher.`);
        return;
      }
      if (hasPurchasePrice && (!Number.isFinite(purchasePriceValue) || purchasePriceValue < 0)) {
        setNewItemError(`Row ${i + 1}: Purchase price (GBP) must be zero or higher.`);
        return;
      }
      if (hasPurchasePrice && !gbpRate) {
        setNewItemError(`Row ${i + 1}: GBP conversion rate is unavailable.`);
        return;
      }
      if (hasPurchasePrice && (!row.conversionAccepted || !row.conversionRate)) {
        setNewItemError(`Row ${i + 1}: Accept the GBP to GHS conversion.`);
        return;
      }
      if (
        hasPurchasePrice &&
        row.conversionRate &&
        gbpRate &&
        Math.abs(row.conversionRate - gbpRate) > 0.0001
      ) {
        setNewItemError(`Row ${i + 1}: Conversion rate changed. Please accept again.`);
        return;
      }
      if (hasCadPrice && (!Number.isFinite(purchasePriceCadValue) || purchasePriceCadValue < 0)) {
        setNewItemError(`Row ${i + 1}: Purchase price (CAD) must be zero or higher.`);
        return;
      }
      if (hasCadPrice && !cadToGbpWithTaxRate) {
        setNewItemError(`Row ${i + 1}: CAD conversion rate is unavailable.`);
        return;
      }
      if (hasCadPrice && (!row.cadConversionAccepted || !row.cadConversionRate)) {
        setNewItemError(`Row ${i + 1}: Accept the CAD to GBP conversion.`);
        return;
      }
      if (
        hasCadPrice &&
        row.cadConversionRate &&
        cadToGbpWithTaxRate &&
        Math.abs(row.cadConversionRate - cadToGbpWithTaxRate) > 0.0001
      ) {
        setNewItemError(`Row ${i + 1}: CAD conversion rate changed. Please accept again.`);
        return;
      }
    }

    setNewItemSaving(true);
    try {
      const created = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const hasPurchasePrice = row.purchasePriceGbp !== "" && row.purchasePriceGbp !== null;
        const purchasePriceGbpValue = hasPurchasePrice ? Number(row.purchasePriceGbp) : null;
        const purchasePriceGhsValue =
          hasPurchasePrice && gbpRate ? purchasePriceGbpValue * gbpRate : null;
        const hasCadPrice = row.purchasePriceCad !== "" && row.purchasePriceCad !== null;
        const purchasePriceCadValue = hasCadPrice ? Number(row.purchasePriceCad) : null;
        const purchasePriceGbpFromCadValue =
          hasCadPrice && cadToGbpWithTaxRate
            ? purchasePriceCadValue * cadToGbpWithTaxRate
            : null;
        const response = await fetch("/.netlify/functions/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            barcode: row.barcode || undefined,
            price: Math.round(Number(row.price) * 100),
            stock: Number.parseInt(row.quantity || "0", 10) || 0,
            sourceCategoryCode: row.sourceCategoryCode,
            specificCategory: row.specificCategory || undefined,
            description: row.description || undefined,
            purchasePriceGbp: hasPurchasePrice
              ? Math.round(Number(purchasePriceGbpValue) * 100)
              : undefined,
            purchasePriceGhs: hasPurchasePrice
              ? Math.round(Number(purchasePriceGhsValue) * 100)
              : undefined,
            purchasePriceGbpFromCad: hasCadPrice
              ? Math.round(Number(purchasePriceGbpFromCadValue) * 100)
              : undefined,
            currency: "GHS",
            userId: user?.id,
            userName:
              user?.fullName ||
              user?.name ||
              [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
              undefined,
            userEmail: user?.email,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || `Row ${i + 1}: Failed to create item.`);
        }
        created.push(data);
      }

      if (created.length) {
        setItems((prev) => [...created, ...prev]);
      }
      resetNewItemForm();
      setNewItemOpen(false);
      setSuccess(`Added ${created.length} item${created.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Create items failed", err);
      setNewItemError(err.message || "Failed to create items.");
    } finally {
      setNewItemSaving(false);
    }
  };

  const setDetailFromItem = (item) => {
    if (!item) return;
    setDetailItem(item);
    setDetailError("");
    setDetailForm({
      id: item.id,
      name: item.name || "",
      sku: item.sku || "",
      barcode: item.barcode || "",
      sourceCategoryCode: (item.sourceCategoryCode || item.sourcecategorycode || "CLOTHES")
        .toString()
        .toUpperCase(),
      specificCategory: item.specificCategory || item.specificcategory || "",
      vendorIds: getItemVendorIds(item),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : "",
      stock: String(getQuantity(item)),
      currency: item.currency || "GHS",
      purchasePriceGbp: Number.isFinite(Number(item.purchasePriceGbp)) ? Number(item.purchasePriceGbp) : "",
      purchasePriceGhs: Number.isFinite(Number(item.purchasePriceGhs)) ? Number(item.purchasePriceGhs) : "",
      saleValue: Number.isFinite(Number(item.saleValue)) ? Number(item.saleValue) : "",
      attendantsNeeded: Number.isFinite(Number(item.attendantsNeeded)) ? Number(item.attendantsNeeded) : "",
      reorderLevel: String(getReorderLevel(item)),
      reorderQuantity: String(getReorderQuantity(item)),
      age: item.age || "",
      imageUrl: item.imageUrl || item.image || "",
      rate: item.rate || "",
      description: item.description || "",
    });
  };

  const openItemDetails = (item) => {
    closeMenu();
    setActiveItem(null);
    setDetailFromItem(item);
  };

  const closeItemDetails = () => {
    setDetailItem(null);
    setDetailForm(null);
    setDetailError("");
  };

  const updateDetailForm = (field, value) => {
    setDetailForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const isDetailFieldEditable = (field) => {
    if (!canSubmitInventoryEdits) return false;
    if (canEditAllInventoryFields) return true;
    return LIMITED_INVENTORY_EDIT_FIELDS.has(field);
  };

  const openItemEditor = (item) => {
    openItemDetails(item);
  };

  const saveItemDetails = async () => {
    if (!detailForm) return;
    if (!canSubmitInventoryEdits) {
      setDetailError("You do not have permission to edit inventory items.");
      return;
    }

    const name = detailForm.name.trim();
    const stockValue = Number.parseInt(detailForm.stock, 10);
    const priceValue = Number(detailForm.price);
    const reorderLevelValue =
      detailForm.reorderLevel !== "" ? Number.parseInt(detailForm.reorderLevel, 10) : null;
    const reorderQuantityValue =
      detailForm.reorderQuantity !== "" ? Number.parseInt(detailForm.reorderQuantity, 10) : null;
    const selectedVendorIds = Array.isArray(detailForm.vendorIds)
      ? detailForm.vendorIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
      : [];

    if (!name) {
      setDetailError("Name is required.");
      return;
    }
    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setDetailError("Stock must be zero or higher.");
      return;
    }
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setDetailError("Price must be zero or higher.");
      return;
    }
    if (
      detailForm.reorderLevel !== "" &&
      (!Number.isFinite(reorderLevelValue) || reorderLevelValue < 0)
    ) {
      setDetailError("Reorder level must be zero or higher.");
      return;
    }
    if (
      detailForm.reorderQuantity !== "" &&
      (!Number.isFinite(reorderQuantityValue) || reorderQuantityValue < 0)
    ) {
      setDetailError("Reorder quantity must be zero or higher.");
      return;
    }

    setDetailSaving(true);
    setDetailError("");
    try {
      const response = await fetch("/.netlify/functions/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailForm.id,
          name,
          barcode: detailForm.barcode || undefined,
          priceCents: Math.round(priceValue * 100),
          stock: stockValue,
          sourceCategoryCode: detailForm.sourceCategoryCode,
          specificCategory: detailForm.specificCategory || undefined,
          vendorIds: selectedVendorIds,
          description: detailForm.description || undefined,
          currency: detailForm.currency || "GHS",
          purchasePriceGbpCents:
            detailForm.purchasePriceGbp !== ""
              ? Math.round(Number(detailForm.purchasePriceGbp) * 100)
              : undefined,
          purchasePriceGhsCents:
            detailForm.purchasePriceGhs !== ""
              ? Math.round(Number(detailForm.purchasePriceGhs) * 100)
              : undefined,
          saleValueCents:
            detailForm.saleValue !== "" ? Math.round(Number(detailForm.saleValue) * 100) : undefined,
          attendantsNeeded:
            detailForm.attendantsNeeded !== "" ? Number(detailForm.attendantsNeeded) : undefined,
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

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "Failed to update item.");
      }

      if (response.status === 202 || payload?.status === "pending_approval") {
        closeItemDetails();
        setSuccess(payload?.message || "Changes sent for manager approval.");
        return;
      }

      setItems((prev) => prev.map((row) => (row.id === payload.id ? { ...row, ...payload } : row)));
      closeItemDetails();
      setSuccess(`Updated ${payload.name || "item"}.`);
    } catch (err) {
      console.error("Update item failed", err);
      setDetailError(err.message || "Failed to update item.");
    } finally {
      setDetailSaving(false);
    }
  };

  const formatEditRequestSummary = (request) => {
    const requestedFields =
      request?.requestedFields && typeof request.requestedFields === "object"
        ? request.requestedFields
        : {};
    const parts = [];
    if (Object.prototype.hasOwnProperty.call(requestedFields, "name")) {
      parts.push(`Name: ${requestedFields.name || "Untitled"}`);
    }
    if (Object.prototype.hasOwnProperty.call(requestedFields, "priceCents")) {
      parts.push(`Price: ${formatMoney(Number(requestedFields.priceCents) / 100, "GHS")}`);
    }
    if (Object.prototype.hasOwnProperty.call(requestedFields, "stock")) {
      parts.push(`Qty: ${requestedFields.stock}`);
    }
    if (Object.prototype.hasOwnProperty.call(requestedFields, "description")) {
      parts.push(
        `Description: ${requestedFields.description ? "Update requested" : "Clear description"}`
      );
    }
    return parts.join(" • ") || "Pending item changes";
  };

  const reviewEditRequest = async (request, action) => {
    if (!request?.id || activeEditRequestId) return;
    const approve = action === "approve-edit-request";
    setActiveEditRequestId(request.id);
    setEditRequestsError("");
    setSuccess("");
    try {
      const response = await fetch("/.netlify/functions/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, action }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to review edit request.");
      }

      setEditRequests((prev) => prev.filter((row) => row.id !== request.id));
      if (approve && data?.item?.id) {
        setItems((prev) =>
          prev.map((row) => (row.id === data.item.id ? { ...row, ...data.item } : row))
        );
        if (detailItem?.id === data.item.id) {
          setDetailFromItem({ ...detailItem, ...data.item });
        }
        setSuccess(`Approved changes for ${data?.item?.name || request.productName || "item"}.`);
      } else {
        setSuccess(`Rejected changes for ${request.productName || "item"}.`);
      }
    } catch (err) {
      console.error("Review edit request failed", err);
      setEditRequestsError(err.message || "Unable to review edit request.");
    } finally {
      setActiveEditRequestId(null);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!activeItem) return;
    if (!canAdjustInventoryStockDirectly) {
      setSubmitError("Only admins and managers can adjust stock directly.");
      return;
    }
    setSubmitError("");
    setSuccess("");

    const parsedQty = toNumber(formState.quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setSubmitError("Quantity must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/.netlify/functions/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: activeItem.id,
          type: formState.type,
          quantity: parsedQty,
          soldMonth: formState.type === "StockOut" ? formState.soldMonth : null,
          notes: formState.notes.trim() || undefined,
          reference: formState.reference.trim() || undefined,
          userId: user?.id,
          userName: user?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
          userEmail: user?.email,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Stock update failed.");
      }

      const actorName =
        user?.fullName ||
        user?.name ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Updated";

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== activeItem.id) return item;
          return {
            ...item,
            quantity: toNumber(payload.newStock, getQuantity(item)),
            lastUpdatedAt: payload.lastUpdatedAt || new Date().toISOString(),
            lastUpdatedByName: payload.lastUpdatedByName || actorName,
          };
        })
      );
      await loadStockActivity();
      setSuccess(payload?.message || "Stock updated.");
    } catch (err) {
      console.error("Stock update failed", err);
      setSubmitError(err.message || "Stock update failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-page inventory-page">
      <div className="admin-shell">
        <AdminBreadcrumb items={[{ label: "Inventory" }]} />
        <AdminPageHeader
          copyClassName="inventory-hub-copy"
          actionsClassName="admin-header-actions inventory-header-actions"
          title="Stock Management"
          actions={
            <>
              <button
                type="button"
                className="admin-chip inventory-header-action"
                aria-label={newItemOpen ? "Close add items" : "Add items"}
                title={newItemOpen ? "Close add items" : "Add items"}
                onClick={() => {
                  setNewItemError("");
                  setSuccess("");
                  setNewItemOpen((open) => !open);
                }}
              >
                <AppIcon icon={newItemOpen ? faXmark : faPlus} size={16} />
                <span className="sr-only">{newItemOpen ? "Close" : "Add items"}</span>
              </button>
              <button
                type="button"
                className="admin-chip inventory-header-action"
                aria-label="Open archived items"
                title="Archived items"
                onClick={() => {
                  setArchivedOpen(true);
                  clearArchivedSelection();
                  loadStatusItems("archived");
                }}
              >
                <AppIcon icon={faFolderOpen} size={16} />
                <span className="sr-only">Archived</span>
              </button>
              <button
                type="button"
                className="admin-chip inventory-header-action"
                aria-label="Open recently deleted items"
                title="Recently deleted"
                onClick={() => {
                  setDeletedOpen(true);
                  loadStatusItems("deleted");
                }}
              >
                <AppIcon icon={faTrash} size={16} />
                <span className="sr-only">Recently deleted</span>
              </button>
              <button
                type="button"
                className="admin-refresh inventory-header-action"
                aria-label="Refresh inventory"
                title="Refresh inventory"
                onClick={refreshInventorySurface}
              >
                <AppIcon icon={faRotateRight} size={16} />
                <span className="sr-only">Refresh</span>
              </button>
            </>
          }
        />

        <section className="inventory-scope-grid" aria-label="Inventory type scope">
          {scopeSummaries.map((summary) => {
            const isActive = scopeFilter === summary.key;
            return (
              <button
                key={summary.key}
                type="button"
                className={`inventory-scope-card bubble-card ${isActive ? "is-active" : ""}`}
                onClick={() => setScopeFilter(summary.key)}
              >
                <span className="inventory-scope-label">{summary.label}</span>
                <strong className="inventory-scope-value">{summary.count}</strong>
                <span className="inventory-scope-meta">
                  {summary.units} units · {summary.lowStock} low
                </span>
              </button>
            );
          })}
        </section>

        <section className="inventory-kpi-panel" aria-label="Inventory hub KPIs">
          <div className="inventory-kpi-panel-head">
            <div className="inventory-kpi-panel-aside">
            </div>
          </div>

          <div className="inventory-kpi-grid inventory-kpi-grid--primary">
            <article className="inventory-kpi-card bubble-card">
              <p className="inventory-kpi-label">Units on hand</p>
              <h2 className="inventory-kpi-value">{primaryInventoryStats.totalUnits}</h2>
              <p className="inventory-kpi-meta">
                Average {primaryInventoryStats.avgUnitsPerSku} units per SKU
              </p>
              <div className="inventory-kpi-meter inventory-kpi-meter--accent" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(Number(primaryInventoryStats.avgUnitsPerSku) * 10)
                    )}%`,
                  }}
                />
              </div>
            </article>
            <article className="inventory-kpi-card bubble-card">
              <p className="inventory-kpi-label">Inventory value</p>
              <h2 className="inventory-kpi-value inventory-kpi-value--money">
                {formatMoney(primaryInventoryStats.costValue)}
              </h2>
              <p className="inventory-kpi-meta">
                {formatMoney(primaryInventoryStats.saleValue)} at selling price
              </p>
            </article>
            <article className="inventory-kpi-card bubble-card">
              <p className="inventory-kpi-label">Needs attention</p>
              <h2 className="inventory-kpi-value">{primaryAttentionCount}</h2>
              <p className="inventory-kpi-meta">
                {primaryInventoryStats.outOfStock} out of stock · {primaryInventoryStats.lowStock} low stock
              </p>
              <div className="inventory-kpi-meter inventory-kpi-meter--danger" aria-hidden="true">
                <span style={{ width: `${primaryAttentionRate}%` }} />
              </div>
            </article>
          </div>

          {waterInventoryStats.totalItems > 0 && scopeFilter !== "water" && waterSnapshot && (
            <Link className="inventory-water-strip bubble-card" to="/admin/water" aria-label="Open water module">
              <div className="inventory-water-strip-head">
                <div className="inventory-water-strip-copy">
                  <h3>GWater</h3>
                </div>
              </div>
              <div className="inventory-water-strip-stats">
                <div className="inventory-water-stat bubble-card">
                  <span>Stock</span>
                  <strong>{waterSnapshot.stock}</strong>
                </div>
                <div className="inventory-water-stat bubble-card">
                  <span>Revenue</span>
                  <strong>{formatWholeMoneyFromCents(waterSnapshot.revenue)}</strong>
                </div>
                <div className="inventory-water-stat bubble-card">
                  <span>{waterSnapshotProfitLabel}</span>
                  <strong>{formatWholeMoneyFromCents(waterSnapshotProfitDisplayValue)}</strong>
                </div>
              </div>
            </Link>
          )}

          <div className="inventory-kpi-visuals">
            <article className="inventory-kpi-chart-card bubble-card">
              <div className="inventory-kpi-chart-head">
                <h3>{stockHealthTitle}</h3>
              </div>
              <div className="inventory-kpi-donut-wrap">
                <div className="inventory-kpi-donut-shell" role="img" aria-label="Stock health breakdown chart">
                  <svg viewBox="0 0 112 112" aria-hidden="true">
                    <circle
                      className="inventory-kpi-donut-track"
                      cx="56"
                      cy="56"
                      r={donutRadius}
                      fill="none"
                      strokeWidth="10"
                    />
                    {stockHealthDonut
                      .filter((segment) => segment.value > 0)
                      .map((segment) => (
                        <circle
                          key={segment.key}
                          cx="56"
                          cy="56"
                          r={donutRadius}
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${segment.dash} ${Math.max(
                            0,
                            donutCircumference - segment.dash
                          )}`}
                          strokeDashoffset={segment.offset}
                          transform="rotate(-90 56 56)"
                        />
                      ))}
                  </svg>
                  <div className="inventory-kpi-donut-center">
                    <strong>{stockHealthTotal}</strong>
                    <span>SKUs</span>
                  </div>
                </div>
                <ul className="inventory-kpi-legend">
                  {stockHealthSegments.map((segment) => (
                    <li key={segment.key}>
                      <span
                        className="inventory-kpi-dot"
                        style={{ "--dot-color": segment.color }}
                        aria-hidden="true"
                      />
                      <span>{segment.label}</span>
                      <strong>{segment.value}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="inventory-kpi-chart-card bubble-card">
              <div className="inventory-kpi-chart-head">
                <h3>{categoryUnitsTitle}</h3>
                <span>Top 5</span>
              </div>
              {categoryUnits.length === 0 ? (
                <p className="inventory-kpi-empty">No category data available.</p>
              ) : (
                <div className="inventory-kpi-bars">
                  {categoryUnits.map((entry) => {
                    const width =
                      entry.value > 0
                        ? Math.max(8, Math.round((entry.value / categoryUnitsMax) * 100))
                        : 0;
                    return (
                      <div key={entry.label} className="inventory-kpi-bar-row">
                        <span className="inventory-kpi-bar-label" title={entry.label}>
                          {entry.label}
                        </span>
                        <div className="inventory-kpi-bar-track" aria-hidden="true">
                          <span style={{ width: `${width}%` }} />
                        </div>
                        <span className="inventory-kpi-bar-value">{entry.value}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </div>
        </section>

        {canApproveInventoryEdits && (
          <section className="admin-card inventory-edit-approvals" aria-label="Inventory edit approvals">
            <div className="admin-focus-header">
              <div >
                <h3>Pending stock item edits</h3>
              </div>
              <span className="admin-focus-count">{editRequests.length} waiting</span>
            </div>
            {editRequestsLoading && <p className="admin-focus-muted">Loading edit requests...</p>}
            {!editRequestsLoading && editRequestsError && (
              <p className="admin-focus-error">{editRequestsError}</p>
            )}
            {!editRequestsLoading && !editRequestsError && editRequests.length === 0 && (
              <p className="admin-focus-muted">No staff edit requests waiting.</p>
            )}
            {!editRequestsLoading && !editRequestsError && editRequests.length > 0 && (
              <ul className="admin-approvals-list">
                {editRequests.map((request) => (
                  <li key={request.id} className="admin-approval-item">
                    <div>
                      <strong className="admin-approval-title">
                        {request.productName || `Item #${request.productId}`}
                      </strong>
                      <p className="admin-approval-meta">
                        Requested by {request.submittedByName || "Staff"} on{" "}
                        {formatDateTime(request.createdAt)}
                      </p>
                      <p className="admin-approval-meta">{formatEditRequestSummary(request)}</p>
                    </div>
                    <div className="admin-approval-actions">
                      <button
                        type="button"
                        className="admin-approval-btn"
                        onClick={() => reviewEditRequest(request, "approve-edit-request")}
                        disabled={activeEditRequestId === request.id}
                      >
                        {activeEditRequestId === request.id ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="admin-chip"
                        onClick={() => reviewEditRequest(request, "reject-edit-request")}
                        disabled={activeEditRequestId === request.id}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="admin-table">
          <div className="inventory-register-toolbar">
            <div className="inventory-register-head-status">
              {loading && <span className="admin-status">Loading inventory...</span>}
              {!loading && error && <span className="admin-error">{error}</span>}
            </div>
            <div className="inventory-register-search-row">
              <div className="inventory-register-filter-controls">
                <label className="admin-search">
                  <SearchField
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onClear={() => setSearch("")}
                    placeholder="Search by Name, SKU, or barcode"
                    aria-label="Search inventory"
                  />
                </label>
              </div>
              <div className="inventory-register-view-controls">
                <div
                  className="inventory-tab-menu inventory-tab-menu--view"
                  role="group"
                  aria-label="Toggle inventory view"
                >
                  {!isMobileView && (
                    <button
                      type="button"
                      className={`inventory-tab-button ${viewMode === "table" ? "is-active" : ""}`}
                      onClick={() => setViewMode("table")}
                    >
                      List
                    </button>
                  )}
                  <button
                    type="button"
                    className={`inventory-tab-button ${viewMode === "cards" ? "is-active" : ""}`}
                    onClick={() => setViewMode("cards")}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    className={`inventory-tab-button ${viewMode === "activity" ? "is-active" : ""}`}
                    onClick={() => setViewMode("activity")}
                  >
                    Activity
                  </button>
                </div>
              </div>
            </div>
            <div className="inventory-register-stock-controls">
              <label className="inventory-register-filter-select">
                <span className="inventory-register-filter-kicker">Stock</span>
                <SelectField
                  value={stockFocus}
                  onChangeValue={(nextValue) => applyStockFocus(String(nextValue))}
                  ariaLabel="Filter stock"
                  fieldClassName="inventory-register-filter-control"
                  inputClassName="inventory-register-filter-trigger"
                >
                  <option value="all">All stock</option>
                  <option value="in">In stock</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                </SelectField>
              </label>
              <label className="inventory-register-filter-select">
                <span className="inventory-register-filter-kicker">Category</span>
                <SelectField
                  value={categoryFilter}
                  onChangeValue={(nextValue) => setCategoryFilter(String(nextValue))}
                  ariaLabel="Filter category"
                  fieldClassName="inventory-register-filter-control"
                  inputClassName="inventory-register-filter-trigger"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </SelectField>
              </label>
            </div>
          </div>

          {viewMode === "activity" && (
            <div className="stock-activity-grid">
              {stockActivityError && <p className="admin-error">{stockActivityError}</p>}
              {stockActivityLoading && <p className="admin-status">Loading movement history...</p>}
              {!stockActivityLoading && stockActivity.length === 0 && !stockActivityError && inventory.length === 0 && (
                <p className="admin-empty">No items match the current filters.</p>
              )}
              {!stockActivityLoading && stockActivity.length === 0 && !stockActivityError && inventory.length > 0 && (
                <p className="admin-empty">No movement history for the current filters.</p>
              )}
              {stockActivity.map((row) => (
                <div key={row.month_key} className="stock-activity-row">
                  <div>
                    <p className="stock-activity-month">{formatStockActivityMonth(row.month_key)}</p>
                    <p className="stock-activity-meta">
                      {`${Number(row.stock_in) || 0} in · ${Number(row.stock_out) || 0} out`}
                    </p>
                  </div>
                  <div className="stock-activity-bars">
                    <button
                      type="button"
                      className="stock-activity-bar in is-interactive"
                      style={getStockActivityBarStyle(row.stock_in)}
                      onClick={() => openActivityDetail(row, "in")}
                      disabled={!Number(row.stock_in)}
                      aria-label={`Open stock in items for ${formatStockActivityMonth(row.month_key)}`}
                    >
                      <span>+{row.stock_in || 0}</span>
                    </button>
                    <button
                      type="button"
                      className="stock-activity-bar out is-interactive"
                      style={getStockActivityBarStyle(row.stock_out)}
                      onClick={() => openActivityDetail(row, "out")}
                      disabled={!Number(row.stock_out)}
                      aria-label={`Open stock out items for ${formatStockActivityMonth(row.month_key)}`}
                    >
                      <span>-{row.stock_out || 0}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === "table" && !isMobileView && (
            <div className="admin-table-scroll inventory-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="table-row-index">#</th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("id")}>
                        ID <span className="sort-indicator">{sortIndicator("id")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("name")}>
                        Product <span className="sort-indicator">{sortIndicator("name")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("sku")}>
                        SKU <span className="sort-indicator">{sortIndicator("sku")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("category")}>
                        Category <span className="sort-indicator">{sortIndicator("category")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("quantity")}>
                        Stock <span className="sort-indicator">{sortIndicator("quantity")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("price")}>
                        Price <span className="sort-indicator">{sortIndicator("price")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("inventoryValue")}>
                        Inventory value <span className="sort-indicator">{sortIndicator("inventoryValue")}</span>
                      </button>
                    </th>
                    {shouldShowUpdatedColumn && (
                      <th>
                        <button type="button" className="sort-header" onClick={() => requestSort("lastUpdatedAt")}>
                          Updated <span className="sort-indicator">{sortIndicator("lastUpdatedAt")}</span>
                        </button>
                      </th>
                    )}
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {!loading && inventory.length === 0 && (
                    <tr>
                      <td colSpan={shouldShowUpdatedColumn ? 10 : 9} className="admin-empty">
                        No items found in inventory.
                      </td>
                    </tr>
                  )}
                  {paginatedInventory.map((item, index) => {
                    const quantity = getQuantity(item);
                    const isOut = quantity <= 0;
                    const isLow = isLowStockItem(item);
                    const isMenuOpen = openMenuId === item.id;
                    const segment = getInventorySegment(item);
                    const vendorLabel = formatItemVendorLabel(item, vendorNameById);
                    const productMeta = item.barcode ? `Barcode ${item.barcode}` : "";
                    const stockStateClass = isOut ? "is-out" : isLow ? "is-low" : "is-healthy";
                    return (
                      <tr
                        key={item.id}
                        className={[stockStateClass, isMenuOpen ? "menu-open" : ""].filter(Boolean).join(" ")}
                        onClick={() => openItemEditor(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openItemEditor(item);
                          }
                        }}
                      >
                        <td className="table-row-index">
                          <span className="inventory-table-text">{clampedPage * pageSize + index}</span>
                        </td>
                        <td>
                          <span className="inventory-table-text">{item.id}</span>
                        </td>
                        <td>
                          <div className="admin-product">
                            <span className="admin-product-name">{formatInventoryItemName(item.name)}</span>
                            {productMeta ? (
                              <span className="admin-product-id">{productMeta}</span>
                            ) : null}
                            {segment === "outsourced" && (
                              <span className="admin-product-id">{vendorLabel}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="inventory-table-text">{item.sku || "-"}</span>
                        </td>
                        <td>
                          <div className="inventory-table-category">
                            <span>{getCategory(item)}</span>
                            {segment === "rental" && Number(item.attendantsNeeded) > 0 && (
                              <small>{item.attendantsNeeded} attendants</small>
                            )}
                            {segment === "outsourced" && (
                              <small>{vendorLabel}</small>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="inventory-table-stock">
                            <span className="admin-stock">{quantity}</span>
                          </div>
                        </td>
                        <td>
                          <div className="inventory-table-value">
                            <strong>{formatMoney(toNumber(item?.price, 0))}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="inventory-table-value">
                            <strong>{formatMoney(getInventoryStockValue(item))}</strong>
                          </div>
                        </td>
                        {shouldShowUpdatedColumn && (
                          <td>
                            <div className="inventory-table-updated">
                              <span title={formatUpdatedDetails(item.lastUpdatedAt || item.updatedAt, item.lastUpdatedByName)}>
                                {formatDate(item.lastUpdatedAt || item.updatedAt)}
                              </span>
                            </div>
                          </td>
                        )}
                        <td>
                          {!isMobileView && (
                            <div className="bookings-menu inventory-menu">
                              <button
                                type="button"
                                className="bookings-edit inventory-menu-trigger"
                                aria-haspopup="true"
                                aria-expanded={openMenuId === item.id}
                                aria-label={`Open actions for ${formatInventoryItemName(item.name, "Item")}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowMenu(item.id, e);
                                }}
                              >
                                <AppIcon icon={faEllipsisHorizontal} size={14} />
                                <span className="sr-only">Actions</span>
                              </button>
                              <div
                                className={`bookings-menu-list inventory-menu-list ${openMenuId === item.id ? "open" : ""}`}
                                style={openMenuId === item.id ? menuPosition : undefined}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="bookings-menu-actions inventory-menu-actions">
                                  <button
                                    type="button"
                                    className="inventory-menu-edit"
                                  onClick={() => {
                                    openItemDetails(item);
                                    closeMenu();
                                  }}
                                >
                                  Edit item
                                </button>
                                  {canAdjustInventoryStockDirectly && (
                                    <button
                                      type="button"
                                      className="inventory-menu-adjust"
                                      onClick={() => {
                                        openAdjustForm(item);
                                        closeMenu();
                                      }}
                                    >
                                      Adjust stock
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="inventory-menu-archive"
                                    onClick={() => {
                                      closeMenu();
                                      archiveItem(item);
                                    }}
                                    disabled={actionItemId === item.id}
                                  >
                                    Archive item
                                  </button>
                                  <button
                                    type="button"
                                    className="inventory-menu-copy"
                                    onClick={() => copyToClipboard(item.sku || item.id)}
                                  >
                                    Copy SKU
                                  </button>
                                  {item.barcode && (
                                    <button
                                      type="button"
                                      className="inventory-menu-copy"
                                      onClick={() => copyToClipboard(item.barcode)}
                                    >
                                      Copy barcode
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="inventory-menu-copy"
                                    onClick={() => copyToClipboard(item.id)}
                                  >
                                    Copy ID
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {inventory.length > 0 && (
                  <tfoot className="admin-table-footer">
                    <tr>
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">{inventoryTableSummary.stockTotal}</span>
                      </td>
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          {formatMoney(inventoryTableSummary.averagePrice)}
                        </span>
                      </td>
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          {formatMoney(inventoryTableSummary.inventoryValueTotal)}
                        </span>
                      </td>
                      {shouldShowUpdatedColumn && <td className="admin-table-summary-cell is-empty" />}
                      <td className="admin-table-summary-cell is-empty" />
                    </tr>
                  </tfoot>
                )}
              </table>
              {inventoryPagination}
            </div>
          )}

          {viewMode === "cards" && (
            <>
              <div className="inventory-card-grid">
                {!loading && paginatedInventory.length === 0 && (
                  <p className="admin-empty">No items found in inventory.</p>
                )}
                {paginatedInventory.map((item) => {
                const quantity = getQuantity(item);
                const isOut = quantity <= 0;
                const isLow = isLowStockItem(item);
                const isInteractive = true;
                const isMenuOpen = openMenuId === `card-${item.id}`;
                const segment = getInventorySegment(item);
                const segmentLabel = formatInventorySegment(segment);
                const vendorLabel = formatItemVendorLabel(item, vendorNameById);
                return (
                  <div
                    key={item.id}
                    className={`inventory-card bubble-card ${isOut ? "is-out" : isLow ? "is-low" : ""} ${isMenuOpen ? "menu-open" : ""}`}
                    role={isInteractive ? "button" : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                    onClick={isInteractive ? () => openItemEditor(item) : undefined}
                    onKeyDown={
                      isInteractive
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openItemEditor(item);
                            }
                          }
                        : undefined
                    }
	                  >
	                    <div className="inventory-card-head">
	                      <div className="inventory-card-head-main">
	                        <span className="admin-product-id">ID {item.id}</span>
                          <div className="inventory-card-badges">
                            <span className={`inventory-type-pill is-${segment}`}>{segmentLabel}</span>
                          </div>
	                      </div>
	                      <div className="inventory-card-head-actions">
	                        <span className="admin-stock">Qty {quantity}</span>
	                        <div
	                          className="bookings-menu inventory-menu inventory-card-menu"
	                          onClick={(e) => e.stopPropagation()}
	                        >
	                          <button
	                            type="button"
	                            className="bookings-edit inventory-menu-trigger"
	                            aria-haspopup="true"
	                            aria-expanded={openMenuId === `card-${item.id}`}
                                aria-label={`Open actions for ${formatInventoryItemName(item.name, "Item")}`}
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              toggleRowMenu(`card-${item.id}`, e);
	                            }}
	                          >
	                            <AppIcon icon={faEllipsisHorizontal} size={14} />
                                <span className="sr-only">Actions</span>
	                          </button>
	                          <div
	                            className={`bookings-menu-list inventory-menu-list inventory-card-menu-list ${openMenuId === `card-${item.id}` ? "open" : ""}`}
	                            onClick={(e) => e.stopPropagation()}
	                          >
	                            <div className="bookings-menu-actions inventory-menu-actions">
	                              <button
	                                type="button"
	                                className="inventory-menu-edit"
	                                onClick={() => {
	                                  openItemDetails(item);
	                                  closeMenu();
	                                }}
	                              >
	                                Edit item
	                              </button>
	                              {canAdjustInventoryStockDirectly && (
	                                <button
	                                  type="button"
	                                  className="inventory-menu-adjust"
	                                  onClick={() => {
	                                    openAdjustForm(item);
	                                    closeMenu();
	                                  }}
	                                >
	                                  Adjust stock
	                                </button>
	                              )}
	                              <button
	                                type="button"
	                                className="inventory-menu-archive"
	                                onClick={() => {
	                                  closeMenu();
	                                  archiveItem(item);
	                                }}
	                                disabled={actionItemId === item.id}
	                              >
	                                Archive item
	                              </button>
	                              <button
	                                type="button"
	                                className="inventory-menu-copy"
	                                onClick={() => copyToClipboard(item.sku || item.id)}
	                              >
	                                Copy SKU
	                              </button>
	                              {item.barcode && (
	                                <button
	                                  type="button"
	                                  className="inventory-menu-copy"
	                                  onClick={() => copyToClipboard(item.barcode)}
	                                >
	                                  Copy barcode
	                                </button>
	                              )}
	                              <button
	                                type="button"
	                                className="inventory-menu-copy"
	                                onClick={() => copyToClipboard(item.id)}
	                              >
	                                Copy ID
	                              </button>
	                            </div>
	                          </div>
	                        </div>
	                      </div>
	                    </div>
	                    <h4 className="inventory-card-title">{formatInventoryItemName(item.name)}</h4>
	                    <div className="inventory-card-details">
	                      <p className="inventory-card-sub">
	                        {item.sku ? `SKU ${item.sku}` : "No SKU"}
	                      </p>
	                      {item.barcode && (
	                        <p className="inventory-card-sub">Barcode {item.barcode}</p>
	                      )}
	                      <p className="inventory-card-sub">{getCategory(item)}</p>
                        {segment === "rental" && Number(item.attendantsNeeded) > 0 && (
                          <p className="inventory-card-sub inventory-card-subtle">
                            {item.attendantsNeeded} attendants needed
                          </p>
                        )}
                        {segment === "outsourced" && (
                          <p className="inventory-card-sub inventory-card-subtle">{vendorLabel}</p>
                        )}
	                    </div>
	                    <div className="inventory-card-footer">
	                      <div className="inventory-card-meta">
	                        <p className="inventory-card-sub inventory-card-subtle">
                            Cost {formatMoney(getInventoryCostValue(item))} · Sell {formatMoney(getInventorySaleValue(item))}
	                        </p>
	                        <p className="inventory-card-sub inventory-card-subtle">
	                          Updated {formatDateTime(item.lastUpdatedAt || item.updatedAt)}
	                        </p>
	                      </div>
	                      <div className="inventory-card-actions" onClick={(e) => e.stopPropagation()}>
	                        <button
	                          type="button"
	                          className="inventory-card-quick inventory-card-quick-secondary"
	                          onClick={() => openItemDetails(item)}
	                        >
	                          Edit
	                        </button>
	                        {canAdjustInventoryStockDirectly && (
	                          <button
	                            type="button"
	                            className="inventory-card-quick inventory-card-quick-primary"
	                            onClick={() => openAdjustForm(item)}
	                          >
	                            Adjust
	                          </button>
	                        )}
	                      </div>
	                    </div>
	                  </div>
	                );
	              })}
              </div>
              {inventoryPagination}
            </>
          )}
        </section>
      </div>

      {archivedOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel">
            <header className="admin-overlay-header">
              <div>
                <p className="customers-eyebrow">Inventory</p>
                <h2>Archived items</h2>
              </div>
              <div className="admin-overlay-actions">
                <label className="admin-overlay-select">
                  <input
                    type="checkbox"
                    checked={archivedItems.length > 0 && archivedSelected.size === archivedItems.length}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setArchivedSelected(new Set(archivedItems.map((item) => item.id)));
                      } else {
                        clearArchivedSelection();
                      }
                    }}
                  />
                  Select all
                </label>
                <button
                  type="button"
                  className="admin-chip"
                  onClick={restoreSelectedArchived}
                  disabled={!archivedSelected.size || archivedBulkLoading}
                >
                  Restore selected
                </button>
                {isSystemAdmin && (
                  <button
                    type="button"
                    className="admin-chip"
                    onClick={deleteSelectedArchived}
                    disabled={!archivedSelected.size || archivedBulkLoading}
                  >
                    Delete selected
                  </button>
                )}
              </div>
              <button
                type="button"
                className="customers-modal-close"
                onClick={() => setArchivedOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <div className="admin-kpi-detail-body">
              {archivedLoading && <p className="admin-status">Loading archived items...</p>}
              {!archivedLoading && archivedError && <p className="admin-error">{archivedError}</p>}
              {!archivedLoading && !archivedError && (
                <>
                  {archivedItems.length ? (
                    <ul className="admin-kpi-list">
                      {archivedItems.map((item) => (
                        <li key={item.id}>
                          <label className="admin-overlay-row">
                            <input
                              type="checkbox"
                              checked={archivedSelected.has(item.id)}
                              onChange={() => toggleArchivedSelection(item.id)}
                            />
                            <span>{formatInventoryItemName(item.name)}</span>
                          </label>
                          <span>Stock {getQuantity(item)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-kpi-sub">No archived items.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {deletedOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel">
            <header>
              <div>
                <p className="customers-eyebrow">Inventory</p>
                <h2>Recently deleted</h2>
              </div>
              <button
                type="button"
                className="customers-modal-close"
                onClick={() => setDeletedOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <div className="admin-kpi-detail-body">
              {deletedLoading && <p className="admin-status">Loading deleted items...</p>}
              {!deletedLoading && deletedError && <p className="admin-error">{deletedError}</p>}
              {!deletedLoading && !deletedError && (
                <>
                  {deletedItems.length ? (
                    <ul className="admin-kpi-list">
                      {deletedItems.map((item) => (
                        <li key={item.id}>
                          <span>{formatInventoryItemName(item.name)}</span>
                          <span>Stock {getQuantity(item)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-kpi-sub">No deleted items.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {newItemOpen && (
        <div className="customers-modal admin-new-item-overlay" role="dialog" aria-modal="true">
          <div className="customers-modal-panel admin-new-item-panel">
            <header className="admin-new-item-header">
              <div className="admin-new-item-title">
                <h2>Add items</h2>
                <div className="admin-new-item-meta">
                  <span className="pill blue">Items {newItemRows.length}</span>
                </div>
              </div>
              <button
                type="button"
                className="customers-modal-close"
                onClick={() => {
                  setNewItemOpen(false);
                  setNewItemError("");
                }}
                aria-label="Close"
              >
                <AppIcon icon={faXmark} size={18} />
                <span className="sr-only">Close</span>
              </button>
            </header>

            <form className="admin-new-item-form" onSubmit={createInventoryItems}>
              {newItemRows.map((row, index) => {
                const sourceCategoryCode = String(row.sourceCategoryCode || "CLOTHES").toUpperCase();
                const rowCategoryOptions = specificCategoriesBySource[sourceCategoryCode] || [];
                const hasPurchasePriceGbp = row.purchasePriceGbp !== "" && row.purchasePriceGbp !== null;
                const hasPurchasePriceCad = row.purchasePriceCad !== "" && row.purchasePriceCad !== null;
                const isGbpLockedToCad = hasPurchasePriceCad;
                const isGbpDerivedFromCad = hasPurchasePriceCad && Boolean(cadToGbpWithTaxRate);

                return (
                  <div key={index} className="admin-new-item-row bubble-card">
                    <div className="admin-new-item-row-head">
                      <h3 className="admin-new-item-row-index">Item {index + 1}</h3>
                      {newItemRows.length > 1 && (
                        <button
                          type="button"
                          className="admin-chip"
                          onClick={() => removeNewItemRow(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="admin-new-item-grid">
                      <label className="admin-new-item-field--wide">
                        Name
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateNewItemRow(index, "name", e.target.value)}
                          placeholder="e.g., Blue Party Cups"
                        />
                      </label>
                      <label>
                        Barcode
                        <input
                          type="text"
                          value={row.barcode}
                          onChange={(e) => updateNewItemRow(index, "barcode", e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                      <label>
                        Price (GHS)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price}
                          onChange={(e) => updateNewItemRow(index, "price", e.target.value)}
                          placeholder="0.00"
                        />
                      </label>
                      <label>
                        Qty
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => updateNewItemRow(index, "quantity", e.target.value)}
                          placeholder="0"
                        />
                      </label>
                      <label>
                        Type
                        <SelectField
                          value={row.sourceCategoryCode}
                          onChangeValue={(nextValue) =>
                            handleNewItemSourceCategoryChange(index, String(nextValue))
                          }
                          ariaLabel={`Item ${index + 1} source category`}
                        >
                          <option value="CLOTHES">CLOTHES</option>
                          <option value="TOYS">TOYS</option>
                          <option value="RENTAL">RENTAL</option>
                          <option value="WATER">WATER</option>
                        </SelectField>
                      </label>
                      <label className="admin-new-item-field--wide">
                        Category
                        <div className="admin-new-item-category-stack">
                          <SelectField
                            value={row.isAddingCategory ? INVENTORY_ADD_CATEGORY_VALUE : row.specificCategory}
                            onChangeValue={(nextValue) =>
                              handleNewItemCategorySelect(index, String(nextValue))
                            }
                            ariaLabel={`Item ${index + 1} specific category`}
                          >
                            <option value="">Select category</option>
                            {rowCategoryOptions.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                            {canCreateInventoryCategories && (
                              <option value={INVENTORY_ADD_CATEGORY_VALUE}>+ Add category</option>
                            )}
                          </SelectField>

                          {row.isAddingCategory && canCreateInventoryCategories ? (
                            <div className="admin-new-item-category-creator">
                              <input
                                type="text"
                                value={row.categoryDraft}
                                onChange={(e) => handleNewItemCategoryDraftChange(index, e.target.value)}
                                placeholder="Enter new category"
                              />
                              <div className="admin-new-item-category-actions">
                                <button
                                  type="button"
                                  className="admin-chip"
                                  onClick={() => saveNewItemCategory(index)}
                                >
                                  Save category
                                </button>
                                <button
                                  type="button"
                                  className="admin-chip"
                                  onClick={() => cancelNewItemCategoryCreate(index)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </label>

                      <div className="admin-new-item-price-section admin-new-item-field--full">
                        <div className="admin-new-item-price-section-head">
                          <span className="admin-new-item-price-kicker">Purchase Pricing</span>
                        </div>

                        <div className="admin-new-item-price-grid">
                          <div
                            className={[
                              "admin-new-item-price-card",
                              hasPurchasePriceGbp ? "is-active" : "",
                              isGbpDerivedFromCad ? "is-derived" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <label
                              htmlFor={`admin-new-item-gbp-${index}`}
                              className="admin-new-item-price-heading"
                            >
                              <span className="admin-new-item-price-name">GBP</span>
                            </label>
                            <input
                              id={`admin-new-item-gbp-${index}`}
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={isGbpLockedToCad}
                              value={row.purchasePriceGbp}
                              onChange={(e) => handlePurchasePriceGbpChange(index, e.target.value)}
                              placeholder="0.00"
                            />
                            {hasPurchasePriceGbp && (
                              <span className="admin-purchase-cedis">
                                <span>Estimated GHS</span>
                                <strong>
                                  {gbpRate
                                    ? formatMoney(Number(row.purchasePriceGbp) * gbpRate, "GHS")
                                    : "Rate unavailable"}
                                </strong>
                              </span>
                            )}
                            {hasPurchasePriceGbp &&
                              (gbpRate ? (
                                <label className="admin-checkbox admin-purchase-accept">
                                  <input
                                    type="checkbox"
                                    checked={row.conversionAccepted && row.conversionRate === gbpRate}
                                    onChange={(e) => handleConversionAccept(index, e.target.checked)}
                                  />
                                  Use 1 GBP = GHS {gbpRate.toFixed(2)}
                                </label>
                              ) : (
                                <p className="admin-purchase-note">GBP to GHS rate unavailable.</p>
                              ))}
                          </div>

                          <div
                            className={[
                              "admin-new-item-price-card",
                              hasPurchasePriceCad ? "is-active" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <label
                              htmlFor={`admin-new-item-cad-${index}`}
                              className="admin-new-item-price-heading"
                            >
                              <span className="admin-new-item-price-name">CAD</span>
                            </label>
                            <input
                              id={`admin-new-item-cad-${index}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.purchasePriceCad}
                              onChange={(e) => handlePurchasePriceCadChange(index, e.target.value)}
                              placeholder="0.00"
                            />
                            {hasPurchasePriceCad && (
                              <span className="admin-purchase-cedis">
                                <span>GBP Base</span>
                                <strong>
                                  {cadToGbpWithTaxRate
                                    ? formatMoney(
                                        Number(row.purchasePriceCad) * cadToGbpWithTaxRate,
                                        "GBP"
                                      )
                                    : "Rate unavailable"}
                                </strong>
                              </span>
                            )}
                            {hasPurchasePriceCad &&
                              (cadToGbpWithTaxRate ? (
                                <label className="admin-checkbox admin-purchase-accept">
                                  <input
                                    type="checkbox"
                                    checked={
                                      row.cadConversionAccepted &&
                                      row.cadConversionRate === cadToGbpWithTaxRate
                                    }
                                    onChange={(e) => handleCadConversionAccept(index, e.target.checked)}
                                  />
                                  Use 1 CAD = GBP {cadToGbpWithTaxRate.toFixed(4)}
                                </label>
                              ) : (
                                <p className="admin-purchase-note">CAD to GBP rate unavailable.</p>
                              ))}
                          </div>
                        </div>
                      </div>

                      <label className="admin-new-item-field--full">
                        Description
                        <textarea
                          rows="2"
                          value={row.description}
                          onChange={(e) => updateNewItemRow(index, "description", e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              <div className="admin-new-item-actions">
                <button type="button" className="admin-secondary" onClick={addNewItemRow}>
                  + Add another item
                </button>
                <div className="admin-new-item-actions-right">
                  <button
                    type="button"
                    className="bookings-secondary"
                    onClick={resetNewItemForm}
                    disabled={newItemSaving}
                  >
                    Reset
                  </button>
                  <button type="submit" className="bookings-primary" disabled={newItemSaving}>
                    {newItemSaving ? "Saving..." : "Create items"}
                  </button>
                </div>
              </div>
              {newItemError && <p className="admin-error">{newItemError}</p>}
            </form>
          </div>
        </div>
      )}

      {activityDetail && (
        <div className="admin-modal" role="dialog" aria-modal="true">
          <div className="admin-modal-panel inventory-activity-modal">
            <header>
              <div>
                <p className="admin-eyebrow">Movement items</p>
                <h2>{activityDetailTypeLabel} · {activityDetailMonthLabel}</h2>
                <span className="admin-modal-meta">{activityFilterSummary}</span>
              </div>
              <button className="admin-close" onClick={closeActivityDetail} aria-label="Close">
                Close
              </button>
            </header>

            {activityDetail.loading && <p className="admin-status">Loading item movement...</p>}
            {!activityDetail.loading && activityDetail.error && <p className="admin-error">{activityDetail.error}</p>}
            {!activityDetail.loading && !activityDetail.error && activityDetail.items.length === 0 && (
              <p className="admin-empty">No items recorded for this movement.</p>
            )}

            {!activityDetail.loading && !activityDetail.error && activityDetail.items.length > 0 && (
              <div className="inventory-activity-modal-list">
                {activityDetail.items.map((item) => (
                  <article key={item.id} className="inventory-activity-modal-item bubble-card">
                    <div className="inventory-activity-modal-item-main">
                      {item.image ? (
                        <div className="inventory-activity-modal-item-thumb">
                          <img
                            src={item.image}
                            alt={formatInventoryItemName(item.name, "Inventory item")}
                          />
                        </div>
                      ) : null}
                      <div className="inventory-activity-modal-item-copy">
                        <h3>{formatInventoryItemName(item.name)}</h3>
                        <p>
                          {item.sku ? `SKU ${item.sku}` : "No SKU"} · {item.movement_count || 0} movement
                          {Number(item.movement_count) === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <div className="inventory-activity-modal-item-summary">
                      <strong>
                        {activityDetail.movementType === "out" ? "-" : "+"}
                        {item.total_quantity || 0}
                      </strong>
                      <span>{formatDate(item.latest_date)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detailItem && detailForm && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel admin-detail-panel">
            <header>
              <div>
                <p className="admin-eyebrow">Inventory item</p>
                <h2>{detailForm.name || "Edit item"}</h2>
                <p className="admin-modal-meta">
                  ID {detailForm.id} · SKU {detailForm.sku || "-"}
                  {detailForm.barcode ? ` · Barcode ${detailForm.barcode}` : ""}
                </p>
              </div>
              <div className="admin-detail-actions">
                {detailIndex !== -1 && inventory.length > 1 && (
                  <div className="admin-detail-nav" aria-label="Inventory item navigation">
                    <button
                      type="button"
                      onClick={() => navigateDetailItem(-1)}
                      disabled={!detailHasPrev}
                      aria-label="Previous item"
                    >
                      ‹
                    </button>
                    <span className="admin-detail-nav-count">
                      {detailIndex + 1} / {inventory.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigateDetailItem(1)}
                      disabled={!detailHasNext}
                      aria-label="Next item"
                    >
                      ›
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="customers-modal-close"
                  onClick={closeItemDetails}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </header>

            <form
              className="admin-detail-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveItemDetails();
              }}
            >
              <p className="admin-form-tip">{detailAccessMessage}</p>
              <div className="admin-detail-grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={detailForm.name}
                    onChange={(event) => updateDetailForm("name", event.target.value)}
                    disabled={!isDetailFieldEditable("name")}
                  />
                </label>
                <label>
                  Source category
                  <SelectField
                    value={detailForm.sourceCategoryCode}
                    onChangeValue={(nextValue) => updateDetailForm("sourceCategoryCode", String(nextValue))}
                    disabled={!isDetailFieldEditable("sourceCategoryCode")}
                    ariaLabel="Source category"
                  >
                    <option value="CLOTHES">CLOTHES</option>
                    <option value="TOYS">TOYS</option>
                    <option value="RENTAL">RENTAL</option>
                    <option value="WATER">WATER</option>
                  </SelectField>
                </label>
                <label>
                  Specific category
                  <input
                    type="text"
                    value={detailForm.specificCategory}
                    onChange={(event) => updateDetailForm("specificCategory", event.target.value)}
                    disabled={!isDetailFieldEditable("specificCategory")}
                  />
                </label>
                <label>
                  Vendors
                  <SelectField
                    multiple
                    size={Math.min(Math.max(vendors.length || 2, 2), 6)}
                    value={detailForm.vendorIds}
                    onChangeValue={(nextValue) =>
                      updateDetailForm("vendorIds", Array.isArray(nextValue) ? nextValue : [String(nextValue)])
                    }
                    disabled={!isDetailFieldEditable("vendorIds")}
                    placeholder={vendors.length ? "Select vendors" : "No vendors available"}
                    ariaLabel="Linked vendors"
                  >
                    {!vendors.length && <option value="" disabled>No vendors available</option>}
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </SelectField>
                  <span className="admin-field-hint">Select one or more suppliers for this item.</span>
                </label>
                <label>
                  Barcode
                  <input
                    type="text"
                    value={detailForm.barcode}
                    onChange={(event) => updateDetailForm("barcode", event.target.value)}
                    placeholder="Scan code (optional)"
                    disabled={!isDetailFieldEditable("barcode")}
                  />
                </label>
                <label>
                  Price (GHS)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailForm.price}
                    onChange={(event) => updateDetailForm("price", event.target.value)}
                    disabled={!isDetailFieldEditable("price")}
                  />
                </label>
                <label>
                  Stock on hand
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={detailForm.stock}
                    onChange={(event) => updateDetailForm("stock", event.target.value)}
                    disabled={!isDetailFieldEditable("stock")}
                  />
                </label>
                <label>
                  Reorder level
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={detailForm.reorderLevel}
                    onChange={(event) => updateDetailForm("reorderLevel", event.target.value)}
                    disabled={!isDetailFieldEditable("reorderLevel")}
                  />
                </label>
                <label>
                  Reorder quantity
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={detailForm.reorderQuantity}
                    onChange={(event) => updateDetailForm("reorderQuantity", event.target.value)}
                    disabled={!isDetailFieldEditable("reorderQuantity")}
                  />
                </label>
                <label>
                  Purchase price (GBP)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailForm.purchasePriceGbp}
                    onChange={(event) => updateDetailForm("purchasePriceGbp", event.target.value)}
                    disabled={!isDetailFieldEditable("purchasePriceGbp")}
                  />
                </label>
                <label>
                  Purchase price (GHS)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailForm.purchasePriceGhs}
                    readOnly
                    disabled={!canEditAllInventoryFields}
                  />
                </label>
                <label>
                  Sales value (GHS)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailForm.saleValue}
                    onChange={(event) => updateDetailForm("saleValue", event.target.value)}
                    disabled={!isDetailFieldEditable("saleValue")}
                  />
                </label>
                <label>
                  Attendants needed
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={detailForm.attendantsNeeded}
                    onChange={(event) => updateDetailForm("attendantsNeeded", event.target.value)}
                    disabled={!isDetailFieldEditable("attendantsNeeded")}
                  />
                </label>
                <label>
                  Rate
                  <input
                    type="text"
                    value={detailForm.rate}
                    onChange={(event) => updateDetailForm("rate", event.target.value)}
                    disabled={!isDetailFieldEditable("rate")}
                  />
                </label>
                <label>
                  Age
                  <input
                    type="text"
                    value={detailForm.age}
                    onChange={(event) => updateDetailForm("age", event.target.value)}
                    disabled={!isDetailFieldEditable("age")}
                  />
                </label>
                <label>
                  Image URL
                  <input
                    type="text"
                    value={detailForm.imageUrl}
                    onChange={(event) => updateDetailForm("imageUrl", event.target.value)}
                    disabled={!isDetailFieldEditable("imageUrl")}
                  />
                </label>
              </div>

              <div className="admin-detail-stats">
                <div className="admin-detail-stat">
                  <span>Stock value</span>
                  <strong>
                    {detailStockValue !== null ? formatMoney(detailStockValue, "GHS") : "-"}
                  </strong>
                </div>
              </div>

              <label className="admin-detail-description">
                Description
                <textarea
                  rows="3"
                  value={detailForm.description}
                  onChange={(event) => updateDetailForm("description", event.target.value)}
                  disabled={!isDetailFieldEditable("description")}
                />
              </label>

              {detailError && <p className="admin-error">{detailError}</p>}
              <div className="admin-form-actions">
                <button type="button" className="admin-secondary" onClick={closeItemDetails}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-primary"
                  disabled={detailSaving || !canSubmitInventoryEdits}
                >
                  {detailSaving ? (userRole === "staff" ? "Sending..." : "Saving...") : detailSubmitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeItem && (
        <div className="admin-modal" role="dialog" aria-modal="true">
          <div className="admin-modal-panel">
            <header>
              <div>
                <p className="admin-eyebrow">Adjust stock</p>
                <h2>{formatInventoryItemName(activeItem.name)}</h2>
                <span className="admin-modal-meta">ID {activeItem.id}</span>
              </div>
              {activeItem.image && (
                <div className="admin-modal-thumb">
                  <img src={activeItem.image} alt={formatInventoryItemName(activeItem.name, "Product Image")} />
                </div>
              )}
              <button className="admin-close" onClick={closeAdjustForm} aria-label="Close">
                Close
              </button>
            </header>

            {activeIndex !== -1 && inventory.length > 1 && (
              <div className="admin-modal-nav-row" aria-label="Inventory item navigation">
                <div className="admin-detail-nav">
                  <button
                    type="button"
                    onClick={() => navigateActiveItem(-1)}
                    disabled={!activeHasPrev}
                    aria-label="Previous item"
                  >
                    ‹
                  </button>
                  <span className="admin-detail-nav-count">
                    {activeIndex + 1} / {inventory.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateActiveItem(1)}
                    disabled={!activeHasNext}
                    aria-label="Next item"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="admin-form">
              <p className="admin-form-tip">
                Choose Add or Remove, enter the number of items, then confirm.
              </p>
              <label>
                Stock change
                <SelectField
                  value={formState.type}
                  onChangeValue={(nextValue) =>
                    setFormState((prev) => ({ ...prev, type: String(nextValue) }))
                  }
                  ariaLabel="Stock change type"
                >
                  <option value="StockIn">Add stock</option>
                  <option value="StockOut">Remove stock</option>
                </SelectField>
                <small className="admin-form-hint">
                  Add for new deliveries, remove for sales or damage.
                </small>
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  value={formState.quantity}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                  placeholder="e.g., 5"
                  required
                />
                <small className="admin-form-hint">Enter the number of items added or removed.</small>
              </label>

              {formState.type === "StockOut" && (
                <label>
                  Month sold
                  <input
                    type="month"
                    value={formState.soldMonth}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, soldMonth: event.target.value }))
                    }
                    required
                  />
                  <small className="admin-form-hint">Choose the month the item was sold.</small>
                </label>
              )}

              <details className="admin-form-optional">
                <summary>Add notes (optional)</summary>
                <label>
                  Reference
                  <input
                    type="text"
                    value={formState.reference}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, reference: event.target.value }))
                    }
                    placeholder="PO number, event, etc."
                  />
                </label>

                <label>
                  Notes
                  <textarea
                    rows="3"
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="Add any context..."
                  />
                </label>
              </details>

              {submitError && <p className="admin-error">{submitError}</p>}
              {success && <p className="admin-success">{success}</p>}

              <div className="admin-form-actions">
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={closeAdjustForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-primary" disabled={submitting}>
                  {submitting ? "Updating..." : "Confirm update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
