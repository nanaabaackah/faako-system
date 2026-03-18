import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Admin.css";
import { useLocation } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { useCart } from "../../components/CartContext/CartContext";
import SearchField from "../../components/SearchField/SearchField";

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

const formatUser = (name) => name || "Admin";
const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const MOBILE_VIEW_QUERY = "(max-width: 720px)";
const LIMITED_INVENTORY_EDIT_FIELDS = new Set(["name", "price", "stock", "description"]);

const getIsMobileView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;

const CAD_TAX_RATE = 0.13;

function getInitialViewMode() {
  return "cards";
}

function Admin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [viewMode, setViewMode] = useState(getInitialViewMode); // table | cards | activity
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [reorderOnly, setReorderOnly] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [stockActivity, setStockActivity] = useState([]);
  const [stockActivityError, setStockActivityError] = useState("");
  const [stockActivityLoading, setStockActivityLoading] = useState(false);
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
  const [updatingStockId, setUpdatingStockId] = useState(null);
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
    description: "",
    purchasePriceGbp: "",
    purchasePriceCad: "",
    conversionAccepted: false,
    conversionRate: null,
    cadConversionAccepted: false,
    cadConversionRate: null,
  };
  const [newItemRows, setNewItemRows] = useState([{ ...newItemTemplate }]);
  const { user } = useAuth();
  const { rates } = useCart();
  const userRole = (user?.role || "").toLowerCase();
  const isSystemAdmin = userRole === "admin";
  const canApproveInventoryEdits = userRole === "admin" || userRole === "manager";
  const canSubmitInventoryEdits = userRole === "admin" || userRole === "manager" || userRole === "staff";
  const canEditAllInventoryFields = userRole === "admin";
  const canAdjustInventoryStockDirectly = userRole === "admin" || userRole === "manager";
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
    const seededSearch = params.get("search");
    if (seededSearch !== null) {
      setSearch(seededSearch);
      setPage(0);
    }
  }, [location.search]);

  useEffect(() => {
    setArchivedSelected((prev) => {
      if (!prev.size) return prev;
      const validIds = new Set(archivedItems.map((item) => item.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next;
    });
  }, [archivedItems]);

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

  const loadStockActivity = useCallback(async () => {
    setStockActivityLoading(true);
    setStockActivityError("");
    try {
      const res = await fetch("/.netlify/functions/stockActivity");
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
  }, []);

  const refreshInventorySurface = useCallback(async () => {
    await Promise.all([
      refreshInventory(),
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
    refreshInventory,
  ]);

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
    if (!window.confirm(`Archive "${item.name || "this item"}"?`)) return;
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
      setSuccess(`${item.name || "Item"} archived.`);
    } catch (err) {
      console.error("Archive failed", err);
      setSubmitError(err.message || "Archive failed.");
    } finally {
      setActionItemId(null);
    }
  };

  const deleteItem = async (item) => {
    if (!item?.id) return;
    if (!window.confirm(`Delete "${item.name || "this item"}"? This cannot be undone.`)) return;
    setActionItemId(item.id);
    try {
      const response = await fetch("/.netlify/functions/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...buildActorPayload() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to delete item.");
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setDeletedItems((prev) => [data, ...prev]);
      setSuccess(`${item.name || "Item"} deleted.`);
    } catch (err) {
      console.error("Delete failed", err);
      setSubmitError(err.message || "Delete failed.");
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
    loadStockActivity();
  }, [loadStockActivity]);

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
  }, [search, categoryFilter, inStockOnly, outOfStockOnly, reorderOnly, viewMode, items.length]);

  const sortValue = (item, key) => {
    switch (key) {
      case "id":
        return Number(item.id) || 0;
      case "name":
        return (item.name || "").toLowerCase();
      case "sku":
        return (item.sku || "").toLowerCase();
      case "category":
        return (getCategory(item) || "").toLowerCase();
      case "quantity":
        return getQuantity(item);
      case "reorderLevel":
        return getReorderLevel(item);
      case "lastUpdatedAt":
        return new Date(item.lastUpdatedAt || item.updatedAt || 0).getTime();
      case "lastUpdatedByName":
        return (item.lastUpdatedByName || "").toLowerCase();
      default:
        return item[key] ?? "";
    }
  };

  const inventory = useMemo(() => {
    const list = [...items];
    const needle = search.trim().toLowerCase();
    const filterCategory = categoryFilter.toLowerCase();
    const filtered = list.filter((item) => {
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
      if (reorderOnly && quantity > getReorderLevel(item)) return false;
      return true;
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
  }, [items, sortConfig, search, categoryFilter, inStockOnly, outOfStockOnly, reorderOnly]);

  const pageCount = Math.max(1, Math.ceil(inventory.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedInventory = useMemo(() => {
    const start = clampedPage * pageSize;
    return inventory.slice(start, start + pageSize);
  }, [inventory, clampedPage, pageSize]);

  const totalItems = inventory.length;
  const totalUnits = inventory.reduce((sum, item) => sum + getQuantity(item), 0);
  const lowStock = inventory.filter((item) => getQuantity(item) <= getReorderLevel(item)).length;
  const outOfStock = inventory.filter((item) => getQuantity(item) <= 0).length;
  const healthyItems = Math.max(0, totalItems - lowStock);
  const healthyRate = totalItems ? Math.round((healthyItems / totalItems) * 100) : 0;
  const lowStockRate = totalItems ? Math.round((lowStock / totalItems) * 100) : 0;
  const outOfStockRate = totalItems ? Math.round((outOfStock / totalItems) * 100) : 0;
  const avgUnitsPerSku = totalItems ? (totalUnits / totalItems).toFixed(1) : "0.0";
  const stockHealthSegments = useMemo(() => {
    let healthy = 0;
    let low = 0;
    let out = 0;
    inventory.forEach((item) => {
      const quantity = getQuantity(item);
      const reorderLevel = getReorderLevel(item);
      if (quantity <= 0) {
        out += 1;
      } else if (quantity <= reorderLevel) {
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
  }, [inventory]);
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
    inventory.forEach((item) => {
      const key = String(getCategory(item) || "Uncategorized");
      const quantity = Math.max(0, getQuantity(item));
      totals.set(key, (totals.get(key) || 0) + quantity);
    });
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [inventory]);
  const categoryUnitsMax = useMemo(
    () => Math.max(1, ...categoryUnits.map((entry) => entry.value)),
    [categoryUnits]
  );
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
        specificCategory: row.specificCategory.trim(),
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

  const adjustStockInline = async (item, delta) => {
    if (!canAdjustInventoryStockDirectly) {
      setSubmitError("Only admins and managers can adjust stock directly.");
      return;
    }
    if (!delta) return;
    const currentQty = getQuantity(item);
    if (delta < 0 && currentQty <= 0) {
      setSubmitError("Cannot reduce stock below zero.");
      return;
    }

    setUpdatingStockId(item.id);
    setSubmitError("");
    setSuccess("");
    const type = delta > 0 ? "StockIn" : "StockOut";
    const quantity = Math.abs(delta);

    try {
      const response = await fetch("/.netlify/functions/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.id,
          type,
          quantity,
          notes: undefined,
          reference: undefined,
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
        throw new Error(payload?.error || "Stock update failed.");
      }

      const actorName =
        user?.fullName ||
        user?.name ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Updated";

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                quantity: toNumber(payload.newStock, getQuantity(row)),
                lastUpdatedAt: payload.lastUpdatedAt || new Date().toISOString(),
                lastUpdatedByName: payload.lastUpdatedByName || actorName,
              }
            : row
        )
      );
      await loadStockActivity();
      setSuccess(payload?.message || "Stock updated.");
    } catch (err) {
      console.error("Inline stock update failed", err);
      setSubmitError(err.message || "Stock update failed.");
    } finally {
      setUpdatingStockId(null);
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
    <div className="admin-page">
      <div className="admin-shell">
        <AdminBreadcrumb items={[{ label: "Inventory" }]} />
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Inventory Control</p>
            <h1>Stock Admin</h1>
            <p className="admin-subtitle">
              Track live stock, spot low inventory, and adjust quantities in seconds.
            </p>
            <div className="admin-simple-steps" aria-label="Quick stock entry steps">
              <span>1. Search an item</span>
              <span>2. Click it</span>
              <span>3. Update and save</span>
            </div>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-chip"
              onClick={() => {
                setNewItemError("");
                setSuccess("");
                setNewItemOpen((open) => !open);
              }}
            >
              {newItemOpen ? "Close" : "Add items"}
            </button>
            <button
              type="button"
              className="admin-chip"
              onClick={() => {
                setArchivedOpen(true);
                clearArchivedSelection();
                loadStatusItems("archived");
              }}
            >
              Archived
            </button>
            <button
              type="button"
              className="admin-chip"
              onClick={() => {
                setDeletedOpen(true);
                loadStatusItems("deleted");
              }}
            >
              Recently deleted
            </button>
            <button type="button" className="admin-refresh" onClick={refreshInventorySurface}>
              Refresh
            </button>
          </div>
        </header>

        <section className="inventory-kpi-panel" aria-label="Inventory KPIs">
          <div className="inventory-kpi-grid">
            <article className="inventory-kpi-card">
              <p className="inventory-kpi-label">Total items</p>
              <h2 className="inventory-kpi-value">{totalItems}</h2>
              <p className="inventory-kpi-meta">{healthyItems} healthy SKUs</p>
              <div className="inventory-kpi-meter" aria-hidden="true">
                <span style={{ width: `${healthyRate}%` }} />
              </div>
              <p className="inventory-kpi-foot">{healthyRate}% above reorder level</p>
            </article>
            <article className="inventory-kpi-card">
              <p className="inventory-kpi-label">Units on hand</p>
              <h2 className="inventory-kpi-value">{totalUnits}</h2>
              <p className="inventory-kpi-meta">Average {avgUnitsPerSku} units per SKU</p>
              <div className="inventory-kpi-meter inventory-kpi-meter--accent" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.round(Number(avgUnitsPerSku) * 10))}%` }} />
              </div>
              <p className="inventory-kpi-foot">Live stock in current filtered view</p>
            </article>
            <article className="inventory-kpi-card">
              <p className="inventory-kpi-label">Low stock risk</p>
              <h2 className="inventory-kpi-value">{lowStock}</h2>
              <p className="inventory-kpi-meta">{outOfStock} fully out of stock</p>
              <div className="inventory-kpi-meter inventory-kpi-meter--danger" aria-hidden="true">
                <span style={{ width: `${lowStockRate}%` }} />
              </div>
              <p className="inventory-kpi-foot">{outOfStockRate}% are out of stock</p>
            </article>
          </div>

          <div className="inventory-kpi-visuals">
            <article className="inventory-kpi-chart-card">
              <div className="inventory-kpi-chart-head">
                <h3>Stock health</h3>
                <span>{stockHealthTotal} SKUs</span>
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

            <article className="inventory-kpi-chart-card">
              <div className="inventory-kpi-chart-head">
                <h3>Units by category</h3>
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
              <div>
                <p className="admin-eyebrow">Approvals</p>
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
          <div className="admin-table-header">
            <h3>Current inventory</h3>
            {loading && <span className="admin-status">Loading inventory...</span>}
            {!loading && error && <span className="admin-error">{error}</span>}
          </div>
          <div className="admin-controls">
            <div className="admin-control-group">
              <label className="admin-search">
                Search
                <SearchField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onClear={() => setSearch("")}
                  placeholder="Name, SKU, or barcode"
                  aria-label="Search inventory"
                />
              </label>
              <label className="admin-select">
                Category
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">All</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setInStockOnly(checked);
                    if (checked) setOutOfStockOnly(false);
                  }}
                />
                In stock only
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={outOfStockOnly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOutOfStockOnly(checked);
                    if (checked) setInStockOnly(false);
                  }}
                />
                Out of stock only
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={reorderOnly}
                  onChange={(e) => setReorderOnly(e.target.checked)}
                />
                Needs reorder
              </label>
            </div>
            <div className="admin-view-toggle" role="group" aria-label="Toggle inventory view">
              {!isMobileView && (
                <button
                  type="button"
                  className={`admin-chip ${viewMode === "table" ? "is-active" : ""}`}
                  onClick={() => setViewMode("table")}
                >
                  Table view
                </button>
              )}
              <button
                type="button"
                className={`admin-chip ${viewMode === "cards" ? "is-active" : ""}`}
                onClick={() => setViewMode("cards")}
              >
                Card view
              </button>
              <button
                type="button"
                className={`admin-chip ${viewMode === "activity" ? "is-active" : ""}`}
                onClick={() => setViewMode("activity")}
              >
                Activity view
              </button>
            </div>
          </div>

          {viewMode === "activity" && (
            <div className="stock-activity-grid">
              {stockActivityError && <p className="admin-error">{stockActivityError}</p>}
              {stockActivityLoading && <p className="admin-status">Loading movement history...</p>}
              {!stockActivityLoading && stockActivity.length === 0 && !stockActivityError && (
                <p className="admin-empty">No movement history.</p>
              )}
              {stockActivity.map((row) => (
                <div key={row.month_key} className="stock-activity-row">
                  <div>
                    <p className="stock-activity-month">{row.month_key}</p>
                    <p className="stock-activity-meta">Stock in / out</p>
                  </div>
                  <div className="stock-activity-bars">
                    <div className="stock-activity-bar in" style={getStockActivityBarStyle(row.stock_in)}>
                      <span>+{row.stock_in || 0}</span>
                    </div>
                    <div className="stock-activity-bar out" style={getStockActivityBarStyle(row.stock_out)}>
                      <span>-{row.stock_out || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === "table" && !isMobileView && (
            <div className="admin-table-scroll">
              <table>
                <thead>
                  <tr>
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
                      <button type="button" className="sort-header" onClick={() => requestSort("reorderLevel")}>
                        Reorder <span className="sort-indicator">{sortIndicator("reorderLevel")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("lastUpdatedAt")}>
                        Last updated <span className="sort-indicator">{sortIndicator("lastUpdatedAt")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("lastUpdatedByName")}>
                        Updated by <span className="sort-indicator">{sortIndicator("lastUpdatedByName")}</span>
                      </button>
                    </th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {!loading && inventory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="admin-empty">
                        No items found in inventory.
                      </td>
                    </tr>
                  )}
                  {paginatedInventory.map((item) => {
                    const quantity = getQuantity(item);
                    const isLow = quantity <= getReorderLevel(item);
                    const isMenuOpen = openMenuId === item.id;
                    const vendorLabel = formatItemVendorLabel(item, vendorNameById);
                    return (
                      <tr
                        key={item.id}
                        className={[isLow ? "is-low" : "", isMenuOpen ? "menu-open" : ""].filter(Boolean).join(" ")}
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
                        <td>{item.id}</td>
                        <td>
                          <div className="admin-product">
                            <span className="admin-product-name">{item.name || "Untitled"}</span>
                            <span className="admin-product-id">{vendorLabel}</span>
                          </div>
                        </td>
                        <td>
                          <span>{item.sku || "-"}</span>
                          {item.barcode && (
                            <>
                              <br />
                              <span>Barcode {item.barcode}</span>
                            </>
                          )}
                        </td>
                        <td>{getCategory(item)}</td>
                        <td>
                          {canAdjustInventoryStockDirectly ? (
                            <div
                              className="admin-stock-ctrl"
                              onClick={(e) => e.stopPropagation()}
                              role="group"
                              aria-label={`Adjust stock for ${item.name || "item"}`}
                            >
                              <button
                                type="button"
                                className="admin-stock-btn"
                                onClick={() => adjustStockInline(item, -1)}
                                disabled={updatingStockId === item.id}
                              >
                                −
                              </button>
                              <span className="admin-stock">
                                {updatingStockId === item.id ? "…" : quantity}
                              </span>
                              <button
                                type="button"
                                className="admin-stock-btn"
                                onClick={() => adjustStockInline(item, 1)}
                                disabled={updatingStockId === item.id}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="admin-stock">{quantity}</span>
                          )}
                        </td>
                        <td>
                          <div className="admin-reorder">
                            <span>Level {getReorderLevel(item)}</span>
                            <span>Qty {getReorderQuantity(item)}</span>
                          </div>
                        </td>
                        <td>{formatDateTime(item.lastUpdatedAt || item.updatedAt)}</td>
                        <td>{formatUser(item.lastUpdatedByName)}</td>
                        <td>
                          {!isMobileView && (
                            <div className="bookings-menu inventory-menu">
                              <button
                                type="button"
                                className="bookings-edit inventory-menu-trigger"
                                aria-haspopup="true"
                                aria-expanded={openMenuId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowMenu(item.id, e);
                                }}
                              >
                                ⋮
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
                                  {isSystemAdmin && (
                                    <button
                                      type="button"
                                      className="inventory-menu-delete"
                                      onClick={() => {
                                        closeMenu();
                                        deleteItem(item);
                                      }}
                                      disabled={actionItemId === item.id}
                                    >
                                      Delete item
                                    </button>
                                  )}
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
              </table>
              <div className="table-pagination">
                <span>
                  Showing {inventory.length === 0 ? 0 : clampedPage * pageSize + 1}-
                  {Math.min(inventory.length, (clampedPage + 1) * pageSize)} of {inventory.length}
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
                const isLow = !isOut && quantity <= getReorderLevel(item);
                const isInteractive = true;
                const isMenuOpen = openMenuId === `card-${item.id}`;
                const vendorLabel = formatItemVendorLabel(item, vendorNameById);
                return (
                  <div
                    key={item.id}
                    className={`inventory-card ${isOut ? "is-out" : isLow ? "is-low" : ""} ${isMenuOpen ? "menu-open" : ""}`}
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
	                        <span className={`inventory-card-state ${isOut ? "is-out" : isLow ? "is-low" : "is-healthy"}`}>
	                          {isOut ? "Out of stock" : isLow ? "Low stock" : "In stock"}
	                        </span>
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
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              toggleRowMenu(`card-${item.id}`, e);
	                            }}
	                          >
	                            ⋮
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
	                              {isSystemAdmin && (
	                                <button
	                                  type="button"
	                                  className="inventory-menu-delete"
	                                  onClick={() => {
	                                    closeMenu();
	                                    deleteItem(item);
	                                  }}
	                                  disabled={actionItemId === item.id}
	                                >
	                                  Delete item
	                                </button>
	                              )}
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
	                    <h4 className="inventory-card-title">{item.name || "Untitled"}</h4>
	                    <div className="inventory-card-details">
	                      <p className="inventory-card-sub">
	                        {item.sku ? `SKU ${item.sku}` : "No SKU"}
	                      </p>
	                      {item.barcode && (
	                        <p className="inventory-card-sub">Barcode {item.barcode}</p>
	                      )}
	                      <p className="inventory-card-sub">{getCategory(item)}</p>
                        <p className="inventory-card-sub inventory-card-subtle">{vendorLabel}</p>
	                    </div>
	                    <div className="inventory-card-footer">
	                      <div className="inventory-card-meta">
	                        <p className="inventory-card-sub inventory-card-subtle">
	                          Reorder at {getReorderLevel(item)} · Restock {getReorderQuantity(item)}
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
              <div className="table-pagination">
                <span>
                  Showing {inventory.length === 0 ? 0 : clampedPage * pageSize + 1}-
                  {Math.min(inventory.length, (clampedPage + 1) * pageSize)} of {inventory.length}
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
                            <span>{item.name || "Untitled"}</span>
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
                          <span>{item.name || "Untitled"}</span>
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
                <p className="admin-eyebrow">Quick add inventory</p>
                <h2>Add new items</h2>
                <p className="admin-subtitle">We’ll auto-generate SKUs and mark items active.</p>
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
                ✕
              </button>
            </header>

            <form className="admin-new-item-form" onSubmit={createInventoryItems}>
              {newItemRows.map((row, index) => (
                <div key={index} className="admin-new-item-row">
                  <div className="admin-new-item-row-head">
                    <span className="pill purple">Item {index + 1}</span>
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

                  <div className="admin-form-grid">
                    <label>
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
                        placeholder="Scan code (optional)"
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
                    Purchase price (GBP)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={row.purchasePriceCad !== "" && row.purchasePriceCad !== null}
                      value={row.purchasePriceGbp}
                      onChange={(e) => handlePurchasePriceGbpChange(index, e.target.value)}
                      placeholder="0.00"
                    />
                    {row.purchasePriceGbp !== "" && row.purchasePriceGbp !== null && (
                      <span className="admin-purchase-cedis">
                        <span>Purchase price (GHS)</span>
                        <strong>
                          {gbpRate
                            ? formatMoney(Number(row.purchasePriceGbp) * gbpRate, "GHS")
                            : "Rate unavailable"}
                        </strong>
                      </span>
                    )}
                  </label>
                  {row.purchasePriceGbp !== "" && row.purchasePriceGbp !== null && (
                    <>
                      {gbpRate ? (
                        <label className="admin-checkbox admin-purchase-accept">
                          <input
                            type="checkbox"
                            checked={row.conversionAccepted && row.conversionRate === gbpRate}
                            onChange={(e) => handleConversionAccept(index, e.target.checked)}
                          />
                          Accept conversion at 1 GBP = GHS {gbpRate.toFixed(2)}
                        </label>
                      ) : (
                        <p className="admin-purchase-note">
                          Conversion rate unavailable. Try again in a moment.
                        </p>
                      )}
                    </>
                  )}
                  <label>
                    Purchase price (CAD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.purchasePriceCad}
                      onChange={(e) => handlePurchasePriceCadChange(index, e.target.value)}
                      placeholder="0.00"
                    />
                    {row.purchasePriceCad !== "" && row.purchasePriceCad !== null && (
                      <span className="admin-purchase-cedis">
                        <span>Converted price (GBP)</span>
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
                  </label>
                  {row.purchasePriceCad !== "" && row.purchasePriceCad !== null && (
                    <>
                      {cadToGbpWithTaxRate ? (
                        <label className="admin-checkbox admin-purchase-accept">
                          <input
                            type="checkbox"
                            checked={
                              row.cadConversionAccepted &&
                              row.cadConversionRate === cadToGbpWithTaxRate
                            }
                            onChange={(e) => handleCadConversionAccept(index, e.target.checked)}
                          />
                          Accept conversion at 1 CAD (+13% tax) = GBP{" "}
                          {cadToGbpWithTaxRate.toFixed(4)}
                        </label>
                      ) : (
                        <p className="admin-purchase-note">
                          Conversion rate unavailable. Try again in a moment.
                        </p>
                      )}
                    </>
                  )}
                  <label>
                    Quantity on hand
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
                      Source category
                      <select
                        value={row.sourceCategoryCode}
                        onChange={(e) => updateNewItemRow(index, "sourceCategoryCode", e.target.value)}
                      >
                        <option value="CLOTHES">CLOTHES</option>
                        <option value="TOYS">TOYS</option>
                        <option value="RENTAL">RENTAL</option>
                        <option value="WATER">WATER</option>
                      </select>
                    </label>
                    <label>
                      Specific category
                      <input
                        type="text"
                        value={row.specificCategory}
                        onChange={(e) => updateNewItemRow(index, "specificCategory", e.target.value)}
                        placeholder="e.g., Balloons"
                      />
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea
                      rows="2"
                      value={row.description}
                      onChange={(e) => updateNewItemRow(index, "description", e.target.value)}
                      placeholder="Short description (optional)"
                    />
                  </label>
                </div>
              ))}

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
                  <select
                    value={detailForm.sourceCategoryCode}
                    onChange={(event) => updateDetailForm("sourceCategoryCode", event.target.value)}
                    disabled={!isDetailFieldEditable("sourceCategoryCode")}
                  >
                    <option value="CLOTHES">CLOTHES</option>
                    <option value="TOYS">TOYS</option>
                    <option value="RENTAL">RENTAL</option>
                    <option value="WATER">WATER</option>
                  </select>
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
                  <select
                    multiple
                    size={Math.min(Math.max(vendors.length || 2, 2), 6)}
                    value={detailForm.vendorIds}
                    onChange={(event) => {
                      const values = Array.from(event.target.selectedOptions, (option) => option.value);
                      updateDetailForm("vendorIds", values);
                    }}
                    disabled={!isDetailFieldEditable("vendorIds")}
                  >
                    {!vendors.length && <option value="">No vendors available</option>}
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
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
                <h2>{activeItem.name || "Untitled"}</h2>
                <span className="admin-modal-meta">ID {activeItem.id}</span>
              </div>
              {activeItem.image && (
                <div className="admin-modal-thumb">
                  <img src={activeItem.image} alt={activeItem.name || "Product image"} />
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
                <select
                  value={formState.type}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, type: event.target.value }))
                  }
                >
                  <option value="StockIn">Add stock</option>
                  <option value="StockOut">Remove stock</option>
                </select>
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
