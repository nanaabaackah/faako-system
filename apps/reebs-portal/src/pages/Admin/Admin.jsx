/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLoadingState, ERPFormNotice, MonthField, SelectField } from "@faako/ui";
import "./Admin.css";
import { Link, useLocation } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import ModuleTopbarMenu from "../../components/ModuleTopbarMenu/ModuleTopbarMenu";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { useCart } from "../../components/CartContext/CartContext";
import SearchField from "../../components/SearchField/SearchField";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import { AppIcon } from "../../components/Icon/Icon";
import { reebsApiResponse } from "../../api/client.js";
import {
  SYNC_STATES,
  createIndexedDbQueueStorage,
  incrementRetryMetadata,
  useOnlineStatus,
} from "@faako/offline-sync";
import {
  buildQueuedInventoryAdjustment,
  getInventoryAdjustmentFailureState,
  getQueuedInventoryAdjustmentNotice,
  isQueuedInventoryAdjustmentForScope,
} from "./offlineInventoryAdjustmentQueue";
import {
  faEllipsisHorizontal,
  faFolderOpen,
  faFileLines,
  faGear,
  faPlus,
  faRotateRight,
  faTags,
  faTrash,
  faXmark,
  faChevronLeft,
  faChevronRight,
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
  item?.specificCategory ||
  item?.specificcategory ||
  item?.sourceCategoryName ||
  item?.sourcecategoryname ||
  item?.sourceCategoryCode ||
  "-";

const getSourceCategoryId = (item) => {
  const raw = item?.sourceCategoryId ?? item?.source_category_id;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getItemType = (item) =>
  String(item?.itemType || item?.inventoryItemType || "STANDARD").trim().toUpperCase() || "STANDARD";

const isVariantParentItem = (item) => getItemType(item) === "VARIANT_PARENT";

const getItemVariants = (item) => (Array.isArray(item?.variants) ? item.variants : []);

const getVariantAvailableQty = (variant) =>
  Number.isFinite(Number(variant?.availableQty))
    ? Math.max(0, Number(variant.availableQty))
    : Math.max(0, Number(variant?.stockQty ?? 0) - Number(variant?.reservedQty ?? 0));

const isInactiveVariant = (variant) =>
  String(variant?.status || "active").trim().toLowerCase() === "inactive";

const getVariantParentStock = (variants) =>
  (Array.isArray(variants) ? variants : []).reduce((sum, variant) => {
    if (isInactiveVariant(variant)) return sum;
    return sum + Math.max(0, Number(variant?.stockQty) || 0);
  }, 0);

const formatVariantName = (itemName, variant) =>
  [itemName, variant?.variantName, variant?.variantNumber, variant?.color, variant?.size]
    .filter(Boolean)
    .join(" / ");

const parseVariantDimensionInput = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeVariantDraftText = (value) => String(value ?? "").trim();

const getDetailVariantAutosaveSignature = (item) =>
  getItemVariants(item)
    .map((variant) => ({
      id: Number(variant?.id) || 0,
      sku: String(variant?.sku || ""),
      variantName: String(variant?.variantName || ""),
      variantNumber: String(variant?.variantNumber || ""),
      color: String(variant?.color || ""),
      size: String(variant?.size || ""),
      stockQty: String(variant?.stockQty ?? ""),
      status: String(variant?.status || "active"),
      priceOverride:
        variant?.priceOverride === null || typeof variant?.priceOverride === "undefined"
          ? ""
          : String(variant.priceOverride),
    }))
    .sort((a, b) => a.id - b.id);

const buildVariantPersistPayload = (variant) => {
  const priceOverrideRaw =
    variant?.priceOverride === null || typeof variant?.priceOverride === "undefined"
      ? ""
      : String(variant.priceOverride).trim();

  return {
    id: Number(variant?.id),
    sku: normalizeVariantDraftText(variant?.sku),
    variantName: normalizeVariantDraftText(variant?.variantName) || null,
    variantNumber: normalizeVariantDraftText(variant?.variantNumber) || null,
    color: normalizeVariantDraftText(variant?.color) || null,
    size: normalizeVariantDraftText(variant?.size) || null,
    stockQty: Number.parseInt(normalizeVariantDraftText(variant?.stockQty) || "0", 10) || 0,
    status:
      normalizeVariantDraftText(variant?.status || "active").toLowerCase() === "inactive"
        ? "inactive"
        : "active",
    priceOverride: priceOverrideRaw === "" ? null : Number(priceOverrideRaw),
  };
};

const getVariantPersistSignature = (variant) => JSON.stringify(buildVariantPersistPayload(variant));

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
  if (!vendorNames.length) return "-";
  return `${vendorNames.join(", ")}`;
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
const INVENTORY_ITEM_TYPE_OPTIONS = [
  { value: "STANDARD", label: "Standard item" },
  { value: "VARIANT_PARENT", label: "Variant parent" },
  { value: "BUNDLE", label: "Bundle" },
];

const normalizeSourceCategoryOptionKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const getInventorySourceLabel = (value) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getInventorySourceCodeFromValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized;
};

const getInventorySourceAliases = (option) => [
  option.value,
  option.label,
  option.name,
  option.slug,
  option.sourceCategoryCode,
].map(normalizeSourceCategoryOptionKey);

const resolveSpecificCategorySourceCode = (value, fallbackSourceCode = "") => {
  if (!normalizeInventoryCategoryName(value)) return getInventorySourceCodeFromValue(fallbackSourceCode);
  return getInventorySourceCodeFromValue(fallbackSourceCode);
};

const getSpecificCategoryOptionId = (sourceCode, name) =>
  `${sourceCode || "UNASSIGNED"}:${normalizeSourceCategoryOptionKey(name)}`;

function SourceCategoryCombobox({
  categories = [],
  valueId = "",
  valueName = "",
  onSelect,
  onCreate,
  onQueryChange,
  disabled = false,
  placeholder = "Search or add",
  ariaLabel = "Product",
}) {
  const [query, setQuery] = useState(valueName || "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const activeCategories = useMemo(
    () => categories.filter((category) => category?.isActive !== false),
    [categories]
  );
  const options = useMemo(() => {
    const sorted = [...activeCategories].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
    if (!normalizedQuery) return sorted.slice(0, 12);
    return sorted
      .filter((category) => String(category.name || "").toLowerCase().includes(normalizedQuery))
      .slice(0, 12);
  }, [activeCategories, normalizedQuery]);
  const exactMatch = activeCategories.find(
    (category) => {
      const names = [
        category.name,
        category.slug,
        category.sourceCategoryCode,
        ...(Array.isArray(category.aliases) ? category.aliases : []),
      ].map(normalizeSourceCategoryOptionKey);
      return names.includes(normalizeSourceCategoryOptionKey(normalizedQuery));
    }
  );
  const selectedId = String(valueId || "");

  useEffect(() => {
    setQuery(valueName || "");
  }, [valueId, valueName]);

  const selectCategory = (category) => {
    if (!category) return;
    onSelect?.(category);
    setQuery(category.name || "");
    setOpen(false);
  };

  const createCategory = async () => {
    if (!onCreate || !query.trim() || exactMatch) return;
    setCreating(true);
    try {
      const category = await onCreate(query.trim());
      if (category) selectCategory(category);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="source-category-combobox">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          onQueryChange?.(nextQuery);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && exactMatch) {
            event.preventDefault();
            selectCategory(exactMatch);
          } else if (event.key === "Enter" && !exactMatch && query.trim() && onCreate) {
            event.preventDefault();
            void createCategory();
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {open && !disabled && (
        <div className="source-category-options" role="listbox" aria-label={ariaLabel}>
          {options.map((category) => {
            const active = selectedId && String(category.id) === selectedId;
            return (
              <button
                key={category.id}
                type="button"
                className={`source-category-option${active ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCategory(category)}
              >
                <span>{category.name}</span>
                {Number(category.itemCount) > 0 && <small>{category.itemCount} items</small>}
              </button>
            );
          })}
          {!options.length && <span className="source-category-empty">No matching category</span>}
          {query.trim() && !exactMatch && onCreate ? (
            <button
              type="button"
              className="source-category-option source-category-option--create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={createCategory}
              disabled={creating}
            >
              {creating ? `Adding "${query.trim()}"...` : `Add "${query.trim()}"`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

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
    variantId: "",
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
  const [detailAutosaveStatus, setDetailAutosaveStatus] = useState("idle");
  const [detailAutosaveAt, setDetailAutosaveAt] = useState("");
  const detailAutosaveTimerRef = useRef(null);
  const detailAutosaveBaselineRef = useRef("");
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
  const [sourceCategories, setSourceCategories] = useState([]);
  const [specificCategories, setSpecificCategories] = useState([]);
  const [sourceCategoryError, setSourceCategoryError] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [bulkMoveSourceCategory, setBulkMoveSourceCategory] = useState(null);
  const [bulkMoveSourceCategoryDraft, setBulkMoveSourceCategoryDraft] = useState("");
  const [bulkMoveSpecificCategory, setBulkMoveSpecificCategory] = useState(null);
  const [bulkMoveSpecificCategoryDraft, setBulkMoveSpecificCategoryDraft] = useState("");
  const [bulkMoveSaving, setBulkMoveSaving] = useState(false);
  const [bulkArchiveSaving, setBulkArchiveSaving] = useState(false);
  const [variantActionId, setVariantActionId] = useState(null);
  const [variantGenerateSaving, setVariantGenerateSaving] = useState(false);
  const newItemTemplate = {
    name: "",
    barcode: "",
    price: "",
    quantity: "",
    itemType: "STANDARD",
    sourceCategoryCode: "",
    sourceCategoryId: "",
    sourceCategoryName: "",
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
    hasVariants: false,
    variantNames: "",
    variantNumbers: "",
    variantColors: "",
    variantSizes: "",
    variantDefaultStockQty: "0",
    variantDefaultReorderLevel: "2",
    variantPriceOverride: "",
  };
  const [newItemRows, setNewItemRows] = useState([{ ...newItemTemplate }]);
  const { user } = useAuth();
  const { rates } = useCart();
  const isOnline = useOnlineStatus();
  const inventoryQueueStorage = useMemo(() => createIndexedDbQueueStorage(), []);
  const inventoryQueueSyncingRef = useRef(false);
  const [inventoryQueueNotice, setInventoryQueueNotice] = useState(null);
  const userRole = (user?.role || "").toLowerCase();
  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
  const isSystemAdmin = isOwnerOrAdmin;
  const canApproveInventoryEdits = isOwnerOrAdmin || userRole === "manager";
  const canSubmitInventoryEdits = isOwnerOrAdmin || userRole === "manager" || userRole === "staff";
  const canEditAllInventoryFields = isOwnerOrAdmin;
  const canAdjustInventoryStockDirectly = isOwnerOrAdmin || userRole === "manager";
  const canCreateInventoryItems = canAdjustInventoryStockDirectly;
  const canCreateInventoryCategories = isOwnerOrAdmin;
  const canManageInventoryLifecycle = isOwnerOrAdmin;
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
  const inventoryModuleMenuItems = useMemo(
    () => [
      {
        key: "inventory-products",
        label: "Product setup",
        description: "Categories, inventory types, and source links.",
        to: "/admin/inventory/products",
        icon: faTags,
      },
      {
        key: "inventory-templates",
        label: "Templates",
        description: "Email templates, terms, and inventory notes.",
        to: "/admin/inventory/templates",
        icon: faFileLines,
      },
      {
        key: "inventory-settings",
        label: "Admin settings",
        description: "ERP controls and advanced configuration.",
        to: "/admin/settings?tab=advanced",
        icon: faGear,
      },
    ],
    []
  );
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
    if (!canCreateInventoryItems) {
      setNewItemOpen(false);
    }
  }, [canCreateInventoryItems]);

  useEffect(() => {
    setArchivedSelected((prev) => {
      if (!prev.size) return prev;
      const validIds = new Set(archivedItems.map((item) => item.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next;
    });
  }, [archivedItems]);

  useEffect(() => {
    setSelectedItemIds((prev) => {
      if (!prev.size) return prev;
      const validIds = new Set(items.map((item) => item.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

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
      const response = await reebsApiResponse("/api/inventory");
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
      const response = await reebsApiResponse("/api/vendors");
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

  const loadSourceCategories = useCallback(async () => {
    setSourceCategoryError("");
    try {
      const response = await reebsApiResponse("/api/sourceCategories");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to fetch products.");
      }
      setSourceCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products", err);
      setSourceCategoryError(err.message || "Unable to load products.");
      setSourceCategories([]);
    }
  }, []);

  useEffect(() => {
    loadSourceCategories();
  }, [loadSourceCategories]);

  const loadSpecificCategories = useCallback(async () => {
    setSourceCategoryError("");
    try {
      const response = await reebsApiResponse("/api/specificCategories");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to fetch categories.");
      }
      setSpecificCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch categories", err);
      setSourceCategoryError(err.message || "Unable to load categories.");
      setSpecificCategories([]);
    }
  }, []);

  useEffect(() => {
    loadSpecificCategories();
  }, [loadSpecificCategories]);

  const createSourceCategoryFromName = useCallback(async (name) => {
    if (!canCreateInventoryCategories) {
      setSourceCategoryError("Only owners and admins can create products.");
      return null;
    }
    const categoryName = normalizeInventoryCategoryName(name);
    if (!categoryName) return null;
    const existing = sourceCategories.find(
      (category) => String(category.name || "").trim().toLowerCase() === categoryName.toLowerCase()
    );
    if (existing) return existing;

    const response = await reebsApiResponse("/api/sourceCategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error || "Failed to create inventory type.";
      setSourceCategoryError(message);
      throw new Error(message);
    }
    const createdCategory = {
      ...data,
      sourceCategoryCode: getInventorySourceCodeFromValue(data?.sourceCategoryCode || data?.slug || data?.name),
    };
    setSourceCategories((prev) => {
      const exists = prev.some((category) => String(category.id) === String(createdCategory.id));
      return exists ? prev : [...prev, createdCategory].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSourceCategoryError("");
    return createdCategory;
  }, [canCreateInventoryCategories, sourceCategories]);

  const renameSourceCategory = useCallback(async (category) => {
    if (!canCreateInventoryCategories || !category?.id) return;
    const nextName = window.prompt("Rename inventory type", category.name || "");
    const categoryName = normalizeInventoryCategoryName(nextName);
    if (!categoryName || categoryName.toLowerCase() === String(category.name || "").toLowerCase()) return;

    const response = await reebsApiResponse("/api/sourceCategories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id, name: categoryName }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error || "Failed to update inventory type.";
      setSourceCategoryError(message);
      throw new Error(message);
    }
    setSourceCategories((prev) =>
      prev.map((entry) => (Number(entry.id) === Number(payload.id) ? { ...entry, ...payload } : entry))
    );
    setItems((prev) =>
      prev.map((item) =>
        Number(getSourceCategoryId(item)) === Number(payload.id)
          ? {
              ...item,
              sourceCategoryName: payload.name,
              sourceCategorySlug: payload.slug,
            }
          : item
      )
    );
    setDetailForm((prev) =>
      prev && Number(prev.sourceCategoryId) === Number(payload.id)
        ? { ...prev, sourceCategoryName: payload.name }
        : prev
    );
    setSourceCategoryError("");
    setSuccess(`Renamed inventory type to ${payload.name}.`);
  }, [canCreateInventoryCategories]);

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
      const response = await reebsApiResponse("/api/inventory?view=edit-requests");
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
      const response = await reebsApiResponse(`/api/inventory?view=${view}`);
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
      const res = await reebsApiResponse(`/api/stockActivity${query ? `?${query}` : ""}`);
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
      const response = await reebsApiResponse("/api/water");
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
      const response = await reebsApiResponse(`/api/stockActivity?${query}`);
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

  const resolveActorName = useCallback(
    () =>
      user?.fullName ||
      user?.name ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.email ||
      "Updated",
    [user?.email, user?.firstName, user?.fullName, user?.lastName, user?.name]
  );

  const applyStockAdjustmentResult = useCallback(({ productId, payload }) => {
    const normalizedProductId = Number(productId || payload?.productId);
    if (!Number.isFinite(normalizedProductId)) return;
    const actorName = resolveActorName();

    setItems((prev) =>
      prev.map((item) => {
        if (Number(item.id) !== normalizedProductId) return item;
        if (payload.variantId) {
          const nextVariants = getItemVariants(item).map((variant) =>
            Number(variant.id) === Number(payload.variantId)
              ? {
                  ...variant,
                  stockQty: toNumber(payload.newStock, variant.stockQty),
                  availableQty: toNumber(payload.variantAvailableQty, getVariantAvailableQty(variant)),
                }
              : variant
          );
          return {
            ...item,
            variants: nextVariants,
            quantity: getVariantParentStock(nextVariants),
            stock: getVariantParentStock(nextVariants),
            lastUpdatedAt: payload.lastUpdatedAt || new Date().toISOString(),
            lastUpdatedByName: payload.lastUpdatedByName || actorName,
          };
        }
        return {
          ...item,
          quantity: toNumber(payload.newStock, getQuantity(item)),
          lastUpdatedAt: payload.lastUpdatedAt || new Date().toISOString(),
          lastUpdatedByName: payload.lastUpdatedByName || actorName,
        };
      })
    );

    setActiveItem((prev) => {
      if (!prev || Number(prev.id) !== normalizedProductId) return prev;
      if (payload.variantId) {
        const nextVariants = getItemVariants(prev).map((variant) =>
          Number(variant.id) === Number(payload.variantId)
            ? {
                ...variant,
                stockQty: toNumber(payload.newStock, variant.stockQty),
                availableQty: toNumber(payload.variantAvailableQty, getVariantAvailableQty(variant)),
              }
            : variant
        );
        const nextStock = getVariantParentStock(nextVariants);
        return {
          ...prev,
          variants: nextVariants,
          quantity: nextStock,
          stock: nextStock,
          lastUpdatedAt: payload.lastUpdatedAt || new Date().toISOString(),
          lastUpdatedByName: payload.lastUpdatedByName || actorName,
        };
      }
      return {
        ...prev,
        quantity: toNumber(payload.newStock, getQuantity(prev)),
        stock: toNumber(payload.newStock, getQuantity(prev)),
        lastUpdatedAt: payload.lastUpdatedAt || new Date().toISOString(),
        lastUpdatedByName: payload.lastUpdatedByName || actorName,
      };
    });
  }, [resolveActorName]);

  const refreshInventorySurface = useCallback(async () => {
    await Promise.all([
      refreshInventory(),
      loadWaterSnapshot(),
      loadStockActivity(),
      loadSourceCategories(),
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
    loadSourceCategories,
    loadWaterSnapshot,
    refreshInventory,
  ]);

  const loadQueuedInventoryAdjustments = useCallback(async () => {
    if (!user?.organizationId || !user?.id) {
      setInventoryQueueNotice(null);
      return [];
    }

    try {
      const queued = (await inventoryQueueStorage.list()).filter((item) =>
        isQueuedInventoryAdjustmentForScope(item, {
          organizationId: user.organizationId,
          actorId: user.id,
        })
      );
      setInventoryQueueNotice(getQueuedInventoryAdjustmentNotice(queued));
      return queued;
    } catch (queueError) {
      setInventoryQueueNotice({
        status: SYNC_STATES.FAILED,
        tone: "error",
        title: "Sync failed",
        message: queueError.message || "Unable to read the local inventory adjustment queue.",
      });
      return [];
    }
  }, [inventoryQueueStorage, user?.id, user?.organizationId]);

  const syncQueuedInventoryAdjustment = useCallback(async (queueItem) => {
    await inventoryQueueStorage.updateStatus(queueItem.id, SYNC_STATES.SYNCING, {
      lastAttemptAt: new Date().toISOString(),
    });
    setInventoryQueueNotice({
      status: SYNC_STATES.SYNCING,
      tone: "loading",
      title: "Syncing",
      message: "Submitting queued inventory adjustment. The server will validate stock, permissions, and item state.",
    });

    try {
      const endpoint = queueItem.payload?.endpoint || {};
      const adjustment = queueItem.payload?.adjustment || {};
      const response = await reebsApiResponse(endpoint.path || "/api/stock", {
        method: endpoint.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adjustment),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Queued inventory adjustment could not sync.");
      }

      await inventoryQueueStorage.remove(queueItem.id);
      applyStockAdjustmentResult({
        productId: adjustment.productId || queueItem.payload?.targetId,
        payload,
      });
      return true;
    } catch (queueError) {
      const message = queueError.message || "Queued inventory adjustment could not sync.";
      const failureState = getInventoryAdjustmentFailureState(message);
      await inventoryQueueStorage.updateStatus(queueItem.id, failureState.status, {
        conflictStatus: failureState.conflictStatus,
        retry: incrementRetryMetadata(queueItem.retry, {
          now: new Date(),
          lastError: message,
        }),
        lastAttemptAt: new Date().toISOString(),
      });
      setInventoryQueueNotice({
        status: failureState.status,
        tone: "error",
        title: failureState.status === SYNC_STATES.NEEDS_REVIEW ? "Needs review" : "Sync failed",
        message:
          failureState.status === SYNC_STATES.NEEDS_REVIEW
            ? `${message} Review before retrying to avoid duplicate, invalid, or unsafe stock changes.`
            : message,
      });
      return false;
    }
  }, [applyStockAdjustmentResult, inventoryQueueStorage]);

  const syncQueuedInventoryAdjustments = useCallback(async () => {
    if (!isOnline || inventoryQueueSyncingRef.current || !user?.organizationId || !user?.id) return;
    inventoryQueueSyncingRef.current = true;
    try {
      const queued = await loadQueuedInventoryAdjustments();
      const pending = queued.filter((item) => item.status === SYNC_STATES.PENDING);
      let syncedCount = 0;
      for (const queueItem of pending) {
        const didSync = await syncQueuedInventoryAdjustment(queueItem);
        if (didSync) syncedCount += 1;
      }
      if (syncedCount) {
        await refreshInventorySurface();
        setInventoryQueueNotice({
          status: SYNC_STATES.SYNCED,
          tone: "success",
          title: "Synced",
          message: `${syncedCount} queued inventory adjustment${syncedCount === 1 ? "" : "s"} synced. Server stock is current.`,
        });
      } else {
        await loadQueuedInventoryAdjustments();
      }
    } finally {
      inventoryQueueSyncingRef.current = false;
    }
  }, [
    isOnline,
    loadQueuedInventoryAdjustments,
    refreshInventorySurface,
    syncQueuedInventoryAdjustment,
    user?.id,
    user?.organizationId,
  ]);

  const queueOfflineInventoryAdjustment = useCallback(async (adjustmentPayload) => {
    if (!activeItem?.id || !user?.organizationId || !user?.id) {
      setSubmitError("Sign in again before saving an offline inventory adjustment.");
      return false;
    }

    await inventoryQueueStorage.put(
      buildQueuedInventoryAdjustment({
        organizationId: user.organizationId,
        actorId: user.id,
        item: activeItem,
        adjustment: adjustmentPayload,
        source: "admin-inventory-adjustment-form",
      })
    );

    setFormState((prev) => ({
      ...prev,
      quantity: "",
      notes: "",
      reference: "",
    }));
    setSuccess("Offline adjustment saved. Pending sync; server stock has not changed yet.");
    await loadQueuedInventoryAdjustments();
    return true;
  }, [
    activeItem,
    inventoryQueueStorage,
    loadQueuedInventoryAdjustments,
    user?.id,
    user?.organizationId,
  ]);

  useEffect(() => {
    loadQueuedInventoryAdjustments();
  }, [loadQueuedInventoryAdjustments]);

  useEffect(() => {
    if (isOnline) {
      syncQueuedInventoryAdjustments();
    }
  }, [isOnline, syncQueuedInventoryAdjustments]);

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
    if (!canManageInventoryLifecycle) {
      setSubmitError("Only owners and admins can archive inventory items.");
      return;
    }
    if (!window.confirm(`Archive "${formatInventoryItemName(item.name, "This Item")}"?`)) return;
    setActionItemId(item.id);
    try {
      const response = await reebsApiResponse("/api/inventory", {
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
    if (!canManageInventoryLifecycle) {
      setSubmitError("Only owners and admins can restore archived inventory items.");
      return;
    }
    if (!window.confirm(`Restore ${archivedSelected.size} archived item(s)?`)) return;
    setArchivedBulkLoading(true);
    try {
      const restored = [];
      for (const id of archivedSelected) {
        const response = await reebsApiResponse("/api/inventory", {
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
    if (!canManageInventoryLifecycle) {
      setSubmitError("Only owners and admins can delete archived inventory items.");
      return;
    }
    if (!window.confirm(`Delete ${archivedSelected.size} item(s)? This cannot be undone.`)) return;
    setArchivedBulkLoading(true);
    try {
      const deleted = [];
      for (const id of archivedSelected) {
        const response = await reebsApiResponse("/api/inventory", {
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
    const totals = paginatedInventory.reduce(
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
  }, [paginatedInventory]);
  const visibleInventoryIds = useMemo(
    () => paginatedInventory.map((item) => item.id),
    [paginatedInventory]
  );
  const allVisibleSelected =
    visibleInventoryIds.length > 0 && visibleInventoryIds.every((id) => selectedItemIds.has(id));
  const activeItemVariants = useMemo(() => getItemVariants(activeItem), [activeItem]);
  const selectedStockVariant = useMemo(
    () => activeItemVariants.find((variant) => String(variant.id) === String(formState.variantId)) || null,
    [activeItemVariants, formState.variantId]
  );
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
            <AppIcon icon={faChevronLeft} size={12} />
            <span>Previous</span>
          </button>
          <span className="inventory-register-pagination-page">
            Page {paginationDisplayPage} of {paginationDisplayCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPage >= pageCount - 1}
          >
            <AppIcon icon={faChevronRight} size={12} />
            <span>Next</span>
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
    const firstVariant = getItemVariants(item).find((variant) => String(variant.status || "active") === "active");
    setActiveItem(item);
    setFormState({
      type: "StockIn",
      quantity: "",
      variantId: isVariantParentItem(item) && firstVariant ? String(firstVariant.id) : "",
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
      prev.map((row, i) => {
        if (i !== index) return row;

        if (field === "hasVariants") {
          const hasVariants = Boolean(value);
          return {
            ...row,
            hasVariants,
            itemType: hasVariants ? "VARIANT_PARENT" : "STANDARD",
            quantity: hasVariants ? "0" : row.quantity,
          };
        }

        if (field === "itemType") {
          const nextItemType = String(value || "STANDARD");
          const nextHasVariants = nextItemType === "VARIANT_PARENT";
          return {
            ...row,
            itemType: nextItemType,
            hasVariants: nextHasVariants,
            quantity: nextHasVariants ? "0" : row.quantity,
          };
        }

        if (field === "quantity" && row.hasVariants) {
          return {
            ...row,
            quantity: "0",
          };
        }

        return { ...row, [field]: value };
      })
    );
  };

  const addNewItemRow = () => {
    setNewItemRows((prev) => [...prev, { ...newItemTemplate }]);
  };

  const removeNewItemRow = (index) => {
    setNewItemRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const canonicalSourceCategories = useMemo(
    () => {
      const seen = new Set();
      return sourceCategories
        .map((category) => {
          const name = normalizeInventoryCategoryName(
            category?.name || category?.slug || category?.sourceCategoryCode
          );
          const slug = String(category?.slug || name)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          const sourceCategoryCode = getInventorySourceCodeFromValue(
            category?.sourceCategoryCode || slug || name
          );
          if (!name || !sourceCategoryCode || seen.has(sourceCategoryCode)) return null;
          seen.add(sourceCategoryCode);
          const option = {
            value: sourceCategoryCode,
            label: name,
            name,
            slug,
            sourceCategoryCode,
          };
        return {
          id: category?.id ? String(category.id) : option.value,
          name,
          slug,
          aliases: getInventorySourceAliases(option),
          isActive: category?.isActive !== false,
          itemCount: Number(category?.itemCount || 0),
          sourceCategoryCode,
        };
        })
        .filter(Boolean);
    },
    [sourceCategories]
  );
  const defaultSourceCategoryCode = canonicalSourceCategories[0]?.sourceCategoryCode || "";

  const findCanonicalSourceCategory = (value) =>
    canonicalSourceCategories.find((category) => {
      const code = getInventorySourceCodeFromValue(value);
      if (category.sourceCategoryCode === code) return true;
      const key = normalizeSourceCategoryOptionKey(value);
      return key && Array.isArray(category.aliases) && category.aliases.includes(key);
    })
    || null;

  const findCanonicalSourceCategoryByName = (value) => {
    const key = normalizeSourceCategoryOptionKey(value);
    if (!key) return null;
    return canonicalSourceCategories.find((category) => {
      const keys = [
        category.name,
        category.slug,
        category.sourceCategoryCode,
        ...(Array.isArray(category.aliases) ? category.aliases : []),
      ].map(normalizeSourceCategoryOptionKey);
      return keys.includes(key);
    }) || null;
  };

  const getProductDisplayName = (sourceCategoryId, sourceCategoryName, sourceCategoryCode) => {
    const idMatch = sourceCategoryId
      ? canonicalSourceCategories.find((category) => String(category.id) === String(sourceCategoryId))
      : null;
    const codeMatch = findCanonicalSourceCategory(sourceCategoryCode);
    const nameMatch = findCanonicalSourceCategoryByName(sourceCategoryName);
    return idMatch?.name
      || codeMatch?.name
      || nameMatch?.name
      || getInventorySourceLabel(sourceCategoryCode)
      || "";
  };

  const handleNewItemSourceCategorySelect = (index, category) => {
    const nextSourceCategoryCode = getInventorySourceCodeFromValue(
      category?.sourceCategoryCode || category?.slug || category?.name
    );
    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              sourceCategoryCode: nextSourceCategoryCode || row.sourceCategoryCode,
              sourceCategoryId: category?.id ? String(category.id) : "",
              sourceCategoryName: category?.name || "",
              specificCategory:
                getInventorySourceCodeFromValue(row.sourceCategoryCode) === nextSourceCategoryCode
                  ? row.specificCategory
                  : "",
              categoryDraft: "",
              isAddingCategory: false,
            }
          : row
      )
    );
  };

  const handleDetailSourceCategorySelect = (category) => {
    const nextSourceCategoryCode = getInventorySourceCodeFromValue(
      category?.sourceCategoryCode || category?.slug || category?.name
    );
    setDetailForm((prev) =>
      prev
        ? {
            ...prev,
            sourceCategoryCode: nextSourceCategoryCode || prev.sourceCategoryCode,
            sourceCategoryId: category?.id ? String(category.id) : "",
            sourceCategoryName: category?.name || "",
            specificCategory:
              getInventorySourceCodeFromValue(prev.sourceCategoryCode) === nextSourceCategoryCode
                ? prev.specificCategory
                : "",
          }
        : prev
    );
  };

  const createSpecificCategoryOptionForSource = (sourceCode, name) => {
    const categoryName = normalizeInventoryCategoryName(name);
    if (!categoryName) return null;
    const linkedSourceCode = resolveSpecificCategorySourceCode(categoryName, sourceCode);
    return {
      id: getSpecificCategoryOptionId(linkedSourceCode, categoryName),
      name: categoryName,
      sourceCategoryCode: linkedSourceCode,
      isActive: true,
    };
  };

  const saveSpecificCategoryForSource = async (sourceCode, name) => {
    const option = createSpecificCategoryOptionForSource(sourceCode, name);
    if (!option) return null;
    const linkedSource = findCanonicalSourceCategory(option.sourceCategoryCode);
    const sourceCategoryId = Number(linkedSource?.id);
    const response = await reebsApiResponse("/api/specificCategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: option.name,
        sourceCategoryId: Number.isFinite(sourceCategoryId) && sourceCategoryId > 0
          ? sourceCategoryId
          : undefined,
        sourceCategoryName: linkedSource?.name || getInventorySourceLabel(option.sourceCategoryCode),
        sourceCategoryCode: option.sourceCategoryCode,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error || "Failed to create category.";
      setSourceCategoryError(message);
      throw new Error(message);
    }
    setSpecificCategories((prev) => {
      const exists = prev.some((category) => String(category.id) === String(payload.id));
      return exists
        ? prev.map((category) => (String(category.id) === String(payload.id) ? { ...category, ...payload } : category))
        : [...prev, payload].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    });
    setSourceCategoryError("");
    return {
      ...option,
      ...payload,
      id: payload?.id ? String(payload.id) : option.id,
      sourceCategoryCode: payload?.sourceCategoryCode || option.sourceCategoryCode,
    };
  };

  const handleNewItemSpecificCategorySelect = (index, category) => {
    setNewItemRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const linkedSource = findCanonicalSourceCategory(category?.sourceCategoryCode) || findCanonicalSourceCategory(row.sourceCategoryCode);
        return {
          ...row,
          sourceCategoryCode: linkedSource?.sourceCategoryCode || row.sourceCategoryCode,
          sourceCategoryId: linkedSource?.id ? String(linkedSource.id) : row.sourceCategoryId,
          sourceCategoryName: linkedSource?.name || row.sourceCategoryName,
          specificCategory: category?.name || "",
          categoryDraft: "",
          isAddingCategory: false,
        };
      })
    );
  };

  const handleNewItemSpecificCategoryDraftChange = (index, value) => {
    setNewItemRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              specificCategory: value,
              categoryDraft: value,
            }
          : row
      )
    );
  };

  const handleDetailSpecificCategorySelect = (category) => {
    setDetailForm((prev) => {
      if (!prev) return prev;
      const linkedSource = findCanonicalSourceCategory(category?.sourceCategoryCode)
        || findCanonicalSourceCategory(prev.sourceCategoryCode);
      return {
        ...prev,
        sourceCategoryCode: linkedSource?.sourceCategoryCode || prev.sourceCategoryCode,
        sourceCategoryId: linkedSource?.id ? String(linkedSource.id) : prev.sourceCategoryId,
        sourceCategoryName: linkedSource?.name || prev.sourceCategoryName,
        specificCategory: category?.name || "",
      };
    });
  };

  const handleDetailSpecificCategoryDraftChange = (value) => {
    setDetailForm((prev) => (prev ? { ...prev, specificCategory: value } : prev));
  };

  const toggleItemSelection = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleInventoryIds.forEach((id) => next.delete(id));
      } else {
        visibleInventoryIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelectedItems = () => setSelectedItemIds(new Set());

  const createBulkSpecificCategoryOption = async (name) => {
    const effectiveSourceCategory =
      bulkMoveSourceCategory || findCanonicalSourceCategoryByName(bulkMoveSourceCategoryDraft);
    return saveSpecificCategoryForSource(effectiveSourceCategory?.sourceCategoryCode, name);
  };

  const reassignSelectedSpecificCategory = async () => {
    if (!canCreateInventoryCategories) {
      setSubmitError("Only owners and admins can reassign inventory categories.");
      return;
    }
    if (!selectedItemIds.size) {
      setSubmitError("Select at least one item to move.");
      return;
    }
    const effectiveSourceCategory =
      bulkMoveSourceCategory || findCanonicalSourceCategoryByName(bulkMoveSourceCategoryDraft);
    const effectiveSpecificCategory = bulkMoveSpecificCategory
      || createSpecificCategoryOptionForSource(effectiveSourceCategory?.sourceCategoryCode, bulkMoveSpecificCategoryDraft);
    const specificCategoryName = normalizeInventoryCategoryName(
      effectiveSpecificCategory?.name || bulkMoveSpecificCategoryDraft
    );
    const linkedSourceCategory = specificCategoryName
      ? findCanonicalSourceCategory(
        effectiveSpecificCategory?.sourceCategoryCode
          || resolveSpecificCategorySourceCode(specificCategoryName, effectiveSourceCategory?.sourceCategoryCode)
      ) || effectiveSourceCategory
      : effectiveSourceCategory;
    const sourceCategoryName = normalizeInventoryCategoryName(linkedSourceCategory?.name);
    if (!sourceCategoryName && !specificCategoryName) {
      setSubmitError("Choose a product, a category, or both.");
      return;
    }
    const sourceCategoryId = Number(linkedSourceCategory?.id);

    setBulkMoveSaving(true);
    setSubmitError("");
    setSuccess("");
    try {
      const response = await reebsApiResponse("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign-categories",
          productIds: Array.from(selectedItemIds),
          sourceCategoryId: sourceCategoryName && Number.isFinite(sourceCategoryId) && sourceCategoryId > 0
            ? sourceCategoryId
            : undefined,
          sourceCategoryName: sourceCategoryName || undefined,
          sourceCategoryCode: linkedSourceCategory?.sourceCategoryCode || undefined,
          createIfMissing: Boolean(sourceCategoryName),
          specificCategory: specificCategoryName || undefined,
          ...buildActorPayload(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to move selected items.");
      }

      const movedItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems((prev) =>
        prev.map((item) => {
          const moved = movedItems.find((row) => Number(row.id) === Number(item.id));
          return moved
            ? {
                ...item,
                sourceCategoryId: moved.sourceCategoryId ?? item.sourceCategoryId,
                sourceCategoryCode: moved.sourceCategoryCode || item.sourceCategoryCode,
                sourceCategoryName: moved.sourceCategoryName ?? item.sourceCategoryName,
                sourceCategorySlug: moved.sourceCategorySlug ?? item.sourceCategorySlug,
                specificCategory: moved.specificCategory ?? item.specificCategory,
                lastUpdatedAt: moved.lastUpdatedAt || item.lastUpdatedAt,
                lastUpdatedByName: moved.lastUpdatedByName || item.lastUpdatedByName,
              }
            : item;
        })
      );
      clearSelectedItems();
      setBulkMoveSourceCategory(null);
      setBulkMoveSourceCategoryDraft("");
      setBulkMoveSpecificCategory(null);
      setBulkMoveSpecificCategoryDraft("");
      await loadSourceCategories();
      await loadSpecificCategories();
      const movedCount = Number(payload?.movedCount) || movedItems.length;
      setSuccess(`Updated categories on ${movedCount} item${movedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Bulk category move failed", err);
      setSubmitError(err.message || "Failed to move selected items.");
    } finally {
      setBulkMoveSaving(false);
    }
  };

  const archiveSelectedItems = async () => {
    if (!selectedItemIds.size) {
      setSubmitError("Select at least one item to archive.");
      return;
    }
    const selectedItems = items.filter((item) => selectedItemIds.has(item.id));
    if (!selectedItems.length) {
      setSubmitError("No matching selected items found.");
      return;
    }
    if (!window.confirm(`Archive ${selectedItems.length} selected item${selectedItems.length === 1 ? "" : "s"}?`)) {
      return;
    }

    setBulkArchiveSaving(true);
    setSubmitError("");
    setSuccess("");
    try {
      const archived = [];
      for (const item of selectedItems) {
        const response = await reebsApiResponse("/api/inventory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, action: "archive", ...buildActorPayload() }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || `Failed to archive ${formatInventoryItemName(item.name, "item")}.`);
        }
        archived.push({ ...item, ...data, isArchived: true });
      }

      const archivedIds = new Set(archived.map((item) => item.id));
      setItems((prev) => prev.filter((item) => !archivedIds.has(item.id)));
      setArchivedItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        return [...archived.filter((item) => !existingIds.has(item.id)), ...prev];
      });
      clearSelectedItems();
      setSuccess(`Archived ${archived.length} item${archived.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Bulk archive failed", err);
      setSubmitError(err.message || "Failed to archive selected items.");
    } finally {
      setBulkArchiveSaving(false);
    }
  };

  const _handleNewItemCategorySelect = (index, value) => {
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

  const _handleNewItemCategoryDraftChange = (index, value) => {
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

  const _cancelNewItemCategoryCreate = (index) => {
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

  const _saveNewItemCategory = async (index) => {
    if (!canCreateInventoryCategories) {
      setNewItemError("Only owners and admins can create categories.");
      return;
    }

    const row = newItemRows[index];
    const nextCategory = normalizeInventoryCategoryName(row?.categoryDraft);
    if (!nextCategory) {
      setNewItemError(`Row ${index + 1}: Enter a category name.`);
      return;
    }

    const sourceCategory = getInventorySourceCodeFromValue(row?.sourceCategoryCode || defaultSourceCategoryCode);
    const existingOptions = specificCategoriesBySource[sourceCategory] || [];
    const existingMatch = existingOptions.find(
      (value) => value.trim().toLowerCase() === nextCategory.toLowerCase()
    );

    let savedCategory = null;
    if (!existingMatch) {
      try {
        savedCategory = await saveSpecificCategoryForSource(sourceCategory, nextCategory);
      } catch (err) {
        setNewItemError(err.message || "Failed to save category.");
        return;
      }
    }

    setNewItemRows((prev) =>
      prev.map((currentRow, i) =>
        i === index
          ? {
              ...currentRow,
              specificCategory: existingMatch || savedCategory?.name || nextCategory,
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
      const normalizedCategory = normalizeInventoryCategoryName(value);
      if (!normalizedCategory) return;
      const normalizedSource = resolveSpecificCategorySourceCode(normalizedCategory, source);
      if (!grouped.has(normalizedSource)) grouped.set(normalizedSource, new Set());
      grouped.get(normalizedSource).add(normalizedCategory);
    };

    specificCategories.forEach((category) => {
      addCategory(
        category?.sourceCategoryCode || category?.sourcecategorycode || "",
        category?.name || ""
      );
    });

    items.forEach((item) => {
      addCategory(
        normalizeSourceCode(item) || defaultSourceCategoryCode,
        item?.specificCategory || item?.specificcategory || ""
      );
    });

    return Object.fromEntries(
      Array.from(grouped.entries()).map(([source, valueSet]) => [
        source,
        Array.from(valueSet).sort((a, b) => a.localeCompare(b)),
      ])
    );
  }, [defaultSourceCategoryCode, items, specificCategories]);

  const specificCategoryOptionsBySource = useMemo(() => {
    const counts = new Map();
    const persistedByKey = new Map();
    const addCount = (source, value, count = 0) => {
      const name = normalizeInventoryCategoryName(value);
      if (!name) return;
      const sourceCode = resolveSpecificCategorySourceCode(name, source);
      const key = getSpecificCategoryOptionId(sourceCode, name);
      counts.set(key, (counts.get(key) || 0) + count);
    };

    specificCategories.forEach((category) => {
      const name = normalizeInventoryCategoryName(category?.name || "");
      if (!name) return;
      const sourceCode = resolveSpecificCategorySourceCode(
        name,
        category?.sourceCategoryCode || category?.sourcecategorycode || ""
      );
      persistedByKey.set(getSpecificCategoryOptionId(sourceCode, name), category);
    });

    items.forEach((item) => addCount(
      normalizeSourceCode(item) || defaultSourceCategoryCode,
      item?.specificCategory || item?.specificcategory || "",
      1
    ));

    return Object.fromEntries(
      Object.entries(specificCategoriesBySource).map(([source, names]) => [
        source,
        names.map((name) => {
          const key = getSpecificCategoryOptionId(source, name);
          const persisted = persistedByKey.get(key);
          return {
            id: persisted?.id ? String(persisted.id) : key,
            name,
            sourceCategoryCode: source,
            itemCount: counts.get(key) || 0,
            isActive: persisted?.isActive !== false,
          };
        }),
      ])
    );
  }, [defaultSourceCategoryCode, items, specificCategories, specificCategoriesBySource]);

  const specificCategoryOptions = useMemo(
    () =>
      Object.values(specificCategoryOptionsBySource)
        .flat()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [specificCategoryOptionsBySource]
  );

  const bulkMoveEffectiveSourceCategory =
    bulkMoveSourceCategory || findCanonicalSourceCategoryByName(bulkMoveSourceCategoryDraft);
  const bulkMoveSourceCode = bulkMoveEffectiveSourceCategory?.sourceCategoryCode || "";
  const bulkSpecificCategoryOptions = useMemo(() => {
    if (!bulkMoveSourceCode) return specificCategoryOptions;
    return specificCategoryOptionsBySource[bulkMoveSourceCode] || [];
  }, [bulkMoveSourceCode, specificCategoryOptions, specificCategoryOptionsBySource]);

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

  const detailVariantBuilderSummary = useMemo(() => {
    const names = parseVariantDimensionInput(detailForm?.variantNames);
    const numbers = parseVariantDimensionInput(detailForm?.variantNumbers);
    const colors = parseVariantDimensionInput(detailForm?.variantColors);
    const sizes = parseVariantDimensionInput(detailForm?.variantSizes);
    const dimensions = [
      { key: "names", label: "Names", count: names.length },
      { key: "numbers", label: "Numbers", count: numbers.length },
      { key: "colors", label: "Colors", count: colors.length },
      { key: "sizes", label: "Sizes", count: sizes.length },
    ];
    const activeDimensions = dimensions.filter((dimension) => dimension.count > 0);
    const anyInput = activeDimensions.length > 0;
    const comboCount = anyInput
      ? dimensions.reduce((total, dimension) => total * (dimension.count || 1), 1)
      : 0;

    return {
      activeDimensions,
      anyInput,
      comboCount,
    };
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

    if (!canCreateInventoryItems) {
      setNewItemError("Only owners, admins, and managers can create inventory items.");
      return;
    }

    const rows = newItemRows
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        barcode: row.barcode.trim(),
        sourceCategoryName: normalizeInventoryCategoryName(row.sourceCategoryName),
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
      const variantNames = String(row.variantNames || "").split(",").map((entry) => entry.trim()).filter(Boolean);
      const variantNumbers = String(row.variantNumbers || "").split(",").map((entry) => entry.trim()).filter(Boolean);
      const variantColors = String(row.variantColors || "").split(",").map((entry) => entry.trim()).filter(Boolean);
      const variantSizes = String(row.variantSizes || "").split(",").map((entry) => entry.trim()).filter(Boolean);
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
      if (row.hasVariants && !variantNames.length && !variantNumbers.length && !variantColors.length && !variantSizes.length) {
        setNewItemError(`Row ${i + 1}: Add at least one variant dimension or untick variants.`);
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
      const variantGenerationWarnings = [];
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
        const response = await reebsApiResponse("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            barcode: row.barcode || undefined,
            price: Math.round(Number(row.price) * 100),
            stock: Number.parseInt(row.quantity || "0", 10) || 0,
            itemType: row.itemType || "STANDARD",
            sourceCategoryCode: row.sourceCategoryCode,
            sourceCategoryId: row.sourceCategoryId || undefined,
            sourceCategoryName: row.sourceCategoryName || undefined,
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

        if (row.hasVariants && data.id) {
          const vNames = String(row.variantNames || "").split(",").map((s) => s.trim()).filter(Boolean);
          const vNumbers = String(row.variantNumbers || "").split(",").map((s) => s.trim()).filter(Boolean);
          const vColors = String(row.variantColors || "").split(",").map((s) => s.trim()).filter(Boolean);
          const vSizes = String(row.variantSizes || "").split(",").map((s) => s.trim()).filter(Boolean);
          if (vNames.length || vNumbers.length || vColors.length || vSizes.length) {
            const vResponse = await reebsApiResponse("/api/inventoryVariants", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "generate-variants",
                inventoryItemId: data.id,
                names: vNames,
                numbers: vNumbers,
                colors: vColors,
                sizes: vSizes,
                stockQty: Number.parseInt(row.variantDefaultStockQty || "0", 10) || 0,
                reorderLevel: Number.parseInt(row.variantDefaultReorderLevel || "2", 10) || 2,
                priceOverride: row.variantPriceOverride === "" ? null : row.variantPriceOverride,
              }),
            });
            const vData = await vResponse.json().catch(() => null);
            if (vResponse.ok && vData) {
              const nextVariants = Array.isArray(vData.created) ? vData.created : [];
              const variantStock = getVariantParentStock(nextVariants);
              data.itemType = "VARIANT_PARENT";
              data.variants = nextVariants;
              data.stock = variantStock;
              data.quantity = variantStock;
            } else {
              const errorMessage = vData?.error || "Variant generation failed.";
              variantGenerationWarnings.push(`Row ${i + 1}: ${errorMessage}`);
            }
          }
        }

        created.push(data);
      }

      if (created.length) {
        setItems((prev) => [...created, ...prev]);
        await loadSpecificCategories();
      }
      resetNewItemForm();
      setNewItemOpen(false);
      const createdSummary = `Added ${created.length} item${created.length === 1 ? "" : "s"}.`;
      if (variantGenerationWarnings.length === 1) {
        setSuccess(`${createdSummary} ${variantGenerationWarnings[0]}`);
      } else if (variantGenerationWarnings.length > 1) {
        setSuccess(
          `${createdSummary} ${variantGenerationWarnings.length} rows still need variant setup review.`
        );
      } else {
        setSuccess(createdSummary);
      }
    } catch (err) {
      console.error("Create items failed", err);
      setNewItemError(err.message || "Failed to create items.");
    } finally {
      setNewItemSaving(false);
    }
  };

  const buildDetailFormState = (item) => {
    if (!item) return null;
    const itemSourceCategoryId = getSourceCategoryId(item) ? String(getSourceCategoryId(item)) : "";
    const itemSourceCategoryCode = (item.sourceCategoryCode || item.sourcecategorycode || defaultSourceCategoryCode)
      .toString()
      .toUpperCase();
    const itemSourceCategoryName = item.sourceCategoryName || item.sourcecategoryname || "";
    return {
      id: item.id,
      name: item.name || "",
      sku: item.sku || "",
      barcode: item.barcode || "",
      sourceCategoryCode: itemSourceCategoryCode,
      itemType: getItemType(item),
      sourceCategoryId: itemSourceCategoryId,
      sourceCategoryName: getProductDisplayName(
        itemSourceCategoryId,
        itemSourceCategoryName,
        itemSourceCategoryCode
      ),
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
      variants: getItemVariants(item),
      variantNames: "",
      variantNumbers: "1,2,3",
      variantColors: "",
      variantSizes: "",
      variantDefaultStockQty: "0",
      variantDefaultReorderLevel: String(getReorderLevel(item)),
      variantPriceOverride: "",
    };
  };

  const getDetailCoreAutosaveSignature = useCallback((form) => {
    if (!form) return "";
    const vendorIds = Array.isArray(form.vendorIds)
      ? form.vendorIds.map((value) => String(value)).sort()
      : [];
    return JSON.stringify({
      id: form.id,
      name: form.name || "",
      barcode: form.barcode || "",
      itemType: form.itemType || "STANDARD",
      sourceCategoryCode: form.sourceCategoryCode || "",
      sourceCategoryId: form.sourceCategoryId || "",
      sourceCategoryName: form.sourceCategoryName || "",
      specificCategory: form.specificCategory || "",
      vendorIds,
      price: form.price ?? "",
      stock: getItemType(form) === "VARIANT_PARENT" ? "__variant_parent__" : (form.stock ?? ""),
      currency: form.currency || "GHS",
      purchasePriceGbp: form.purchasePriceGbp ?? "",
      purchasePriceGhs: form.purchasePriceGhs ?? "",
      saleValue: form.saleValue ?? "",
      attendantsNeeded: form.attendantsNeeded ?? "",
      reorderLevel: form.reorderLevel ?? "",
      reorderQuantity: form.reorderQuantity ?? "",
      age: form.age || "",
      imageUrl: form.imageUrl || "",
      rate: form.rate || "",
      description: form.description || "",
    });
  }, []);

  const getDetailAutosaveSignature = useCallback((form) => {
    if (!form) return "";
    return JSON.stringify({
      ...JSON.parse(getDetailCoreAutosaveSignature(form)),
      variants: getDetailVariantAutosaveSignature(form),
    });
  }, [getDetailCoreAutosaveSignature]);

  const buildCommittedDetailForm = (formSnapshot, committedItem, variantsOverride) => {
    const committedVariants = Array.isArray(variantsOverride)
      ? variantsOverride
      : getItemVariants(committedItem);
    const committedVariantStock = getVariantParentStock(committedVariants);
    const committedSourceCategoryId = getSourceCategoryId(committedItem)
      ? String(getSourceCategoryId(committedItem))
      : (formSnapshot?.sourceCategoryId || "");
    const committedSourceCategoryCode =
      committedItem?.sourceCategoryCode
      || committedItem?.sourcecategorycode
      || formSnapshot?.sourceCategoryCode
      || defaultSourceCategoryCode;
    const committedSourceCategoryName = getProductDisplayName(
      committedSourceCategoryId,
      committedItem?.sourceCategoryName || committedItem?.sourcecategoryname || formSnapshot?.sourceCategoryName,
      committedSourceCategoryCode
    );

    return {
      ...formSnapshot,
      itemType: committedVariants.length
        ? "VARIANT_PARENT"
        : (committedItem?.itemType || formSnapshot?.itemType || "STANDARD"),
      sku: committedItem?.sku || formSnapshot?.sku || "",
      sourceCategoryCode: committedSourceCategoryCode,
      sourceCategoryId: committedSourceCategoryId,
      sourceCategoryName: committedSourceCategoryName,
      specificCategory:
        committedItem?.specificCategory
        || committedItem?.specificcategory
        || formSnapshot?.specificCategory
        || "",
      variants: committedVariants,
      stock: String(committedVariants.length ? committedVariantStock : getQuantity(committedItem || formSnapshot)),
    };
  };

  const applyCommittedDetailForm = (formSnapshot, committedForm) => {
    if (!committedForm) return;
    const savedCoreSignature = getDetailCoreAutosaveSignature(formSnapshot);
    const savedVariantSignature = getDetailVariantAutosaveSignature(formSnapshot);
    detailAutosaveBaselineRef.current = getDetailAutosaveSignature(committedForm);

    setDetailForm((prev) => {
      if (!prev || prev.id !== committedForm.id) return prev;

      const canApplyCore = getDetailCoreAutosaveSignature(prev) === savedCoreSignature;
      const canApplyVariants = getDetailVariantAutosaveSignature(prev) === savedVariantSignature;

      if (!canApplyCore && !canApplyVariants) {
        return prev;
      }

      const nextForm = { ...prev };

      if (canApplyCore) {
        nextForm.name = committedForm.name;
        nextForm.barcode = committedForm.barcode;
        nextForm.itemType = committedForm.itemType;
        nextForm.sourceCategoryCode = committedForm.sourceCategoryCode;
        nextForm.sourceCategoryId = committedForm.sourceCategoryId;
        nextForm.sourceCategoryName = committedForm.sourceCategoryName;
        nextForm.specificCategory = committedForm.specificCategory;
        nextForm.vendorIds = committedForm.vendorIds;
        nextForm.price = committedForm.price;
        nextForm.currency = committedForm.currency;
        nextForm.purchasePriceGbp = committedForm.purchasePriceGbp;
        nextForm.purchasePriceGhs = committedForm.purchasePriceGhs;
        nextForm.saleValue = committedForm.saleValue;
        nextForm.attendantsNeeded = committedForm.attendantsNeeded;
        nextForm.reorderLevel = committedForm.reorderLevel;
        nextForm.reorderQuantity = committedForm.reorderQuantity;
        nextForm.age = committedForm.age;
        nextForm.imageUrl = committedForm.imageUrl;
        nextForm.rate = committedForm.rate;
        nextForm.description = committedForm.description;

        if (!getItemVariants(committedForm).length && getItemType(committedForm) !== "VARIANT_PARENT") {
          nextForm.stock = committedForm.stock;
        }
      }

      if (canApplyVariants) {
        nextForm.variants = getItemVariants(committedForm);
        if (getItemType(committedForm) === "VARIANT_PARENT" || getItemVariants(committedForm).length) {
          nextForm.stock = committedForm.stock;
        }
      }

      return nextForm;
    });
  };

  const setDetailFromItem = (item) => {
    if (!item) return;
    setDetailItem(item);
    setDetailError("");
    setDetailAutosaveStatus("idle");
    setDetailAutosaveAt("");
    const nextForm = buildDetailFormState(item);
    detailAutosaveBaselineRef.current = getDetailAutosaveSignature(nextForm);
    setDetailForm(nextForm);
  };

  const openItemDetails = (item) => {
    closeMenu();
    setActiveItem(null);
    setDetailFromItem(item);
  };

  const closeItemDetails = () => {
    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }
    setDetailItem(null);
    setDetailForm(null);
    setDetailError("");
    setDetailAutosaveStatus("idle");
    setDetailAutosaveAt("");
    detailAutosaveBaselineRef.current = "";
  };

  const updateDetailForm = (field, value) => {
    setDetailForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const syncItemVariants = (itemId, variants, itemUpdates = {}, options = {}) => {
    const variantList = Array.isArray(variants) ? variants : [];
    const variantStock = getVariantParentStock(variantList);
    setItems((prev) =>
      prev.map((item) =>
        Number(item.id) === Number(itemId)
          ? {
              ...item,
              ...itemUpdates,
              itemType: itemUpdates.itemType || "VARIANT_PARENT",
              variants: variantList,
              stock: variantStock,
              quantity: variantStock,
            }
          : item
      )
    );
    setDetailItem((prev) =>
      prev && Number(prev.id) === Number(itemId)
        ? {
            ...prev,
            ...itemUpdates,
            itemType: itemUpdates.itemType || "VARIANT_PARENT",
            variants: variantList,
            stock: variantStock,
            quantity: variantStock,
          }
        : prev
    );
    setDetailForm((prev) =>
      {
        if (!prev || Number(prev.id) !== Number(itemId)) return prev;
        const nextForm = {
          ...prev,
          ...itemUpdates,
          itemType: itemUpdates.itemType || "VARIANT_PARENT",
          variants: variantList,
          stock: String(variantStock),
        };
        if (options.syncBaseline) {
          detailAutosaveBaselineRef.current = getDetailAutosaveSignature(nextForm);
        }
        return nextForm;
      }
    );
  };

  const fetchItemVariants = async (itemId) => {
    const response = await reebsApiResponse(`/api/inventoryVariants?itemId=${encodeURIComponent(itemId)}`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to load variants.");
    }
    return Array.isArray(payload) ? payload : [];
  };

  const updateDetailVariant = (variantId, field, value) => {
    setDetailForm((prev) =>
      {
        if (!prev) return prev;
        const nextVariants = getItemVariants(prev).map((variant) =>
          Number(variant.id) === Number(variantId) ? { ...variant, [field]: value } : variant
        );
        const nextForm = {
          ...prev,
          variants: nextVariants,
        };
        if (prev.itemType === "VARIANT_PARENT" || nextVariants.length) {
          nextForm.stock = String(getVariantParentStock(nextVariants));
        }
        return nextForm;
      }
    );
  };

  const persistDirtyDetailVariants = async (formSnapshot, savedItemSnapshot) => {
    const currentVariants = getItemVariants(formSnapshot);
    if (!currentVariants.length) return [];

    const savedVariants = getItemVariants(savedItemSnapshot);
    const savedVariantMap = new Map(savedVariants.map((variant) => [Number(variant.id), variant]));
    const savedVariantSignatures = new Map(
      savedVariants.map((variant) => [Number(variant.id), getVariantPersistSignature(variant)])
    );

    const variantsToSave = currentVariants.reduce((list, variant) => {
      const payload = buildVariantPersistPayload(variant);
      const variantLabel =
        formatVariantName(formSnapshot?.name, variant) || payload.sku || `Variant #${variant?.id || "?"}`;

      if (!Number.isFinite(payload.id) || payload.id <= 0) {
        throw new Error(`Unable to save ${variantLabel}. Variant id is missing.`);
      }
      if (!payload.sku) {
        throw new Error(`${variantLabel} needs a SKU.`);
      }
      if (!Number.isFinite(payload.stockQty) || payload.stockQty < 0) {
        throw new Error(`${variantLabel} stock must be zero or higher.`);
      }
      if (payload.priceOverride !== null && (!Number.isFinite(payload.priceOverride) || payload.priceOverride < 0)) {
        throw new Error(`${variantLabel} price override must be zero or higher.`);
      }

      if (savedVariantSignatures.get(payload.id) !== JSON.stringify(payload)) {
        list.push(payload);
      }

      return list;
    }, []);

    const nextVariants = currentVariants.map((variant) => savedVariantMap.get(Number(variant.id)) || variant);
    if (!variantsToSave.length) return nextVariants;

    for (const payload of variantsToSave) {
      const response = await reebsApiResponse("/api/inventoryVariants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updatedVariant = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(updatedVariant?.error || "Failed to save variant changes.");
      }

      const replaceIndex = nextVariants.findIndex((variant) => Number(variant.id) === Number(updatedVariant.id));
      if (replaceIndex >= 0) {
        nextVariants[replaceIndex] = updatedVariant;
      }
    }

    return nextVariants;
  };

  const deleteDetailVariant = async (variantId) => {
    if (!variantId || !detailForm?.id) return;
    setVariantActionId(variantId);
    setDetailError("");
    try {
      const response = await reebsApiResponse(
        `/api/inventoryVariants?id=${encodeURIComponent(variantId)}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to delete variant.");
      const nextVariants = getItemVariants(detailForm).filter((v) => Number(v.id) !== Number(variantId));
      syncItemVariants(
        detailForm.id,
        nextVariants,
        nextVariants.length ? { itemType: "VARIANT_PARENT" } : { itemType: "STANDARD" },
        { syncBaseline: true }
      );
      setSuccess("Variant deleted.");
    } catch (err) {
      console.error("Variant delete failed", err);
      setDetailError(err.message || "Failed to delete variant.");
    } finally {
      setVariantActionId(null);
    }
  };

  const generateDetailVariants = async () => {
    if (!detailForm?.id) return;
    setVariantGenerateSaving(true);
    setDetailError("");
    setSuccess("");
    try {
      const names = String(detailForm.variantNames || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const numbers = String(detailForm.variantNumbers || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const colors = String(detailForm.variantColors || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const sizes = String(detailForm.variantSizes || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (!names.length && !numbers.length && !colors.length && !sizes.length) {
        setDetailError("Enter at least one dimension — names, numbers, colors, or sizes.");
        return;
      }
      const response = await reebsApiResponse("/api/inventoryVariants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-variants",
          productId: detailForm.id,
          names,
          numbers,
          colors,
          sizes,
          stockQty: Number.parseInt(detailForm.variantDefaultStockQty || "0", 10) || 0,
          reorderLevel: Number.parseInt(detailForm.variantDefaultReorderLevel || "0", 10) || 0,
          priceOverride: detailForm.variantPriceOverride === "" ? null : detailForm.variantPriceOverride,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to generate variants.");
      }
      const variants = await fetchItemVariants(detailForm.id);
      syncItemVariants(detailForm.id, variants, { itemType: "VARIANT_PARENT" }, { syncBaseline: true });
      setDetailForm((prev) => prev ? {
        ...prev,
        variantNames: "",
        variantNumbers: "",
        variantColors: "",
        variantSizes: "",
        variantDefaultStockQty: "0",
        variantPriceOverride: "",
      } : prev);
      setSuccess(`Generated ${payload?.createdCount || 0} variant${Number(payload?.createdCount) === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Variant generation failed", err);
      setDetailError(err.message || "Failed to generate variants.");
    } finally {
      setVariantGenerateSaving(false);
    }
  };

  const isDetailFieldEditable = (field) => {
    if (!canSubmitInventoryEdits) return false;
    if (canEditAllInventoryFields) return true;
    return LIMITED_INVENTORY_EDIT_FIELDS.has(field);
  };

  const openItemEditor = (item) => {
    openItemDetails(item);
  };

  const saveItemDetails = async ({ autosave = false } = {}) => {
    const formSnapshot = detailForm;
    if (!formSnapshot || detailSaving) return;
    if (!canSubmitInventoryEdits) {
      setDetailError("You do not have permission to edit inventory items.");
      return;
    }

    const name = formSnapshot.name.trim();
    const savedFormSnapshot = buildDetailFormState(detailItem) || formSnapshot;
    const currentVariants = getItemVariants(formSnapshot);
    const isVariantParent = getItemType(formSnapshot) === "VARIANT_PARENT";
    const derivedVariantStock = currentVariants.length ? getVariantParentStock(currentVariants) : getQuantity(detailItem);
    const enteredStockValue = Number.parseInt(formSnapshot.stock, 10);
    const stockValue = isVariantParent ? derivedVariantStock : enteredStockValue;
    const inventoryStockValue = isVariantParent ? getQuantity(detailItem) : stockValue;
    const priceValue = Number(formSnapshot.price);
    const reorderLevelValue =
      formSnapshot.reorderLevel !== "" ? Number.parseInt(formSnapshot.reorderLevel, 10) : null;
    const reorderQuantityValue =
      formSnapshot.reorderQuantity !== "" ? Number.parseInt(formSnapshot.reorderQuantity, 10) : null;
    const selectedVendorIds = Array.isArray(formSnapshot.vendorIds)
      ? formSnapshot.vendorIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
      : [];
    const hasCoreChanges =
      getDetailCoreAutosaveSignature(formSnapshot) !== getDetailCoreAutosaveSignature(savedFormSnapshot);
    const hasVariantChanges =
      getDetailVariantAutosaveSignature(formSnapshot) !== getDetailVariantAutosaveSignature(savedFormSnapshot);
    const failDetailSave = (message) => {
      setDetailError(message);
      setDetailAutosaveStatus("error");
    };

    if (!name) {
      failDetailSave("Name is required.");
      return;
    }
    if (!Number.isFinite(enteredStockValue) || enteredStockValue < 0) {
      failDetailSave("Stock must be zero or higher.");
      return;
    }

    if (isVariantParent && enteredStockValue !== derivedVariantStock) {
      failDetailSave("Cannot adjust stock directly on variant parent items. Edit individual variant stock instead.");
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue < 0) {
      failDetailSave("Price must be zero or higher.");
      return;
    }
    if (
      formSnapshot.reorderLevel !== "" &&
      (!Number.isFinite(reorderLevelValue) || reorderLevelValue < 0)
    ) {
      failDetailSave("Reorder level must be zero or higher.");
      return;
    }
    if (
      formSnapshot.reorderQuantity !== "" &&
      (!Number.isFinite(reorderQuantityValue) || reorderQuantityValue < 0)
    ) {
      failDetailSave("Reorder quantity must be zero or higher.");
      return;
    }

    if (!hasCoreChanges && !hasVariantChanges) {
      setDetailAutosaveStatus("saved");
      setDetailAutosaveAt(new Date().toISOString());
      setDetailError("");
      return;
    }

    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }
    setDetailSaving(true);
    setDetailAutosaveStatus(autosave ? "saving" : "manual-saving");
    setDetailError("");
    try {
      let response = null;
      let payload = detailItem || {};

      if (hasCoreChanges) {
        response = await reebsApiResponse("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: formSnapshot.id,
            name,
            barcode: formSnapshot.barcode || undefined,
            priceCents: Math.round(priceValue * 100),
            stock: inventoryStockValue,
            itemType: formSnapshot.itemType || "STANDARD",
            sourceCategoryCode: formSnapshot.sourceCategoryCode,
            sourceCategoryId: formSnapshot.sourceCategoryId || undefined,
            sourceCategoryName: formSnapshot.sourceCategoryName || undefined,
            specificCategory: formSnapshot.specificCategory || undefined,
            vendorIds: selectedVendorIds,
            description: formSnapshot.description || undefined,
            currency: formSnapshot.currency || "GHS",
            purchasePriceGbpCents:
              formSnapshot.purchasePriceGbp !== ""
                ? Math.round(Number(formSnapshot.purchasePriceGbp) * 100)
                : undefined,
            purchasePriceGhsCents:
              formSnapshot.purchasePriceGhs !== ""
                ? Math.round(Number(formSnapshot.purchasePriceGhs) * 100)
                : undefined,
            saleValueCents:
              formSnapshot.saleValue !== "" ? Math.round(Number(formSnapshot.saleValue) * 100) : undefined,
            attendantsNeeded:
              formSnapshot.attendantsNeeded !== "" ? Number(formSnapshot.attendantsNeeded) : undefined,
            reorderLevel: Number.isFinite(reorderLevelValue) ? reorderLevelValue : undefined,
            reorderQuantity: Number.isFinite(reorderQuantityValue) ? reorderQuantityValue : undefined,
            age: formSnapshot.age || undefined,
            imageUrl: formSnapshot.imageUrl || undefined,
            rate: formSnapshot.rate || undefined,
            userId: user?.id,
            userName:
              user?.fullName ||
              user?.name ||
              [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
              undefined,
            userEmail: user?.email,
          }),
        });

        payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.detail || payload?.error || "Failed to update item.");
        }
      }

      const nextVariants = hasVariantChanges
        ? await persistDirtyDetailVariants(formSnapshot, detailItem)
        : getItemVariants(savedFormSnapshot);
      const variantStock = getVariantParentStock(nextVariants);
      const mergedPayload = {
        ...(detailItem || {}),
        ...payload,
        variants: nextVariants,
        itemType: nextVariants.length ? "VARIANT_PARENT" : (payload.itemType || formSnapshot.itemType || "STANDARD"),
        quantity: nextVariants.length ? variantStock : getQuantity(payload),
        stock: nextVariants.length ? variantStock : getQuantity(payload),
      };
      const committedForm = buildCommittedDetailForm(formSnapshot, mergedPayload, nextVariants);

      if (response && (response.status === 202 || payload?.status === "pending_approval")) {
        setDetailAutosaveStatus("saved");
        setDetailAutosaveAt(new Date().toISOString());
        setSuccess(payload?.message || "Changes sent for manager approval.");
        
        // Reload the item from the database to prevent stale state since staff changes don't update immediately
        try {
          const refreshed = await reebsApiResponse(`/api/inventory`);
          if (refreshed.ok) {
            const allItems = await refreshed.json();
            const updatedItem = allItems?.find((item) => Number(item.id) === Number(formSnapshot.id));
            if (updatedItem) {
              setDetailItem(updatedItem);
              applyCommittedDetailForm(
                formSnapshot,
                buildCommittedDetailForm(formSnapshot, updatedItem, getItemVariants(updatedItem))
              );
            } else {
              // Fallback: use current form as baseline
              applyCommittedDetailForm(formSnapshot, committedForm);
            }
          } else {
            // Fallback: use current form as baseline if refresh fails
            applyCommittedDetailForm(formSnapshot, committedForm);
          }
        } catch (refreshErr) {
          console.warn("Failed to refresh item data after edit request", refreshErr);
          // Fallback: use current form as baseline if refresh fails
          applyCommittedDetailForm(formSnapshot, committedForm);
        }
        return;
      }

      setItems((prev) => prev.map((row) => (row.id === mergedPayload.id ? { ...row, ...mergedPayload } : row)));
      setDetailItem((prev) => (prev && prev.id === mergedPayload.id ? { ...prev, ...mergedPayload } : prev));
      applyCommittedDetailForm(formSnapshot, committedForm);
      setDetailAutosaveStatus("saved");
      setDetailAutosaveAt(new Date().toISOString());
      setSuccess(`${autosave ? "Autosaved" : "Updated"} ${mergedPayload.name || "item"}.`);
    } catch (err) {
      console.error("Update item failed", err);
      setDetailError(err.message || "Failed to update item.");
      setDetailAutosaveStatus("error");
    } finally {
      setDetailSaving(false);
    }
  };

  useEffect(() => {
    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }

    if (!detailForm || !canSubmitInventoryEdits || detailSaving) return undefined;

    const currentSignature = getDetailAutosaveSignature(detailForm);
    if (!detailAutosaveBaselineRef.current) {
      detailAutosaveBaselineRef.current = currentSignature;
      return undefined;
    }

    if (currentSignature === detailAutosaveBaselineRef.current) {
      if (detailAutosaveStatus === "pending") setDetailAutosaveStatus("idle");
      return undefined;
    }

    setDetailAutosaveStatus("pending");
    detailAutosaveTimerRef.current = setTimeout(() => {
      detailAutosaveTimerRef.current = null;
      void saveItemDetails({ autosave: true });
    }, 1200);

    return () => {
      if (detailAutosaveTimerRef.current) {
        clearTimeout(detailAutosaveTimerRef.current);
        detailAutosaveTimerRef.current = null;
      }
    };
  }, [
    canSubmitInventoryEdits,
    detailAutosaveStatus,
    detailForm,
    detailSaving,
    getDetailAutosaveSignature,
  ]);

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
      const response = await reebsApiResponse("/api/inventory", {
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
      setSubmitError("Only owners, admins, and managers can adjust stock directly.");
      return;
    }
    setSubmitError("");
    setSuccess("");

    const parsedQty = toNumber(formState.quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setSubmitError("Quantity must be a positive number.");
      return;
    }
    if (isVariantParentItem(activeItem) && !formState.variantId) {
      setSubmitError("Choose a variant before adjusting this item.");
      return;
    }

    const stockAdjustmentPayload = {
      productId: activeItem.id,
      variantId: formState.variantId || undefined,
      type: formState.type,
      quantity: parsedQty,
      soldMonth: formState.type === "StockOut" ? formState.soldMonth : null,
      notes: formState.notes.trim() || undefined,
      reference: formState.reference.trim() || undefined,
      userId: user?.id,
      userName:
        user?.fullName ||
        user?.name ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        undefined,
      userEmail: user?.email,
    };

    setSubmitting(true);
    try {
      if (!isOnline) {
        await queueOfflineInventoryAdjustment(stockAdjustmentPayload);
        return;
      }

      const response = await reebsApiResponse("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stockAdjustmentPayload),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Stock update failed.");
      }

      applyStockAdjustmentResult({ productId: activeItem.id, payload });
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
              {canCreateInventoryItems && (
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
                  <span>{newItemOpen ? "Close" : "Add items"}</span>
                </button>
              )}
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
                <span>Archived</span>
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
                <span>Recently deleted</span>
              </button>
              <button
                type="button"
                className="admin-refresh inventory-header-action"
                aria-label="Refresh inventory"
                title="Refresh inventory"
                onClick={refreshInventorySurface}
              >
                <AppIcon icon={faRotateRight} size={16} />
                <span>Refresh</span>
              </button>
              {isOwnerOrAdmin && (
                <ModuleTopbarMenu
                  label="Inventory admin menu"
                  title="Inventory admin"
                  items={inventoryModuleMenuItems}
                  className="inventory-module-topbar-menu"
                />
              )}
            </>
          }
        />

        {inventoryQueueNotice && (
          <InlineNotice
            tone={inventoryQueueNotice.tone}
            title={inventoryQueueNotice.title}
            message={inventoryQueueNotice.message}
            className="inventory-sync-notice"
            compact
          />
        )}

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
            {editRequestsLoading && (
              <AnimatedLoadingState
                compact
                className="glass-card admin-module-loading"
                title="Loading edit requests"
                message="Fetching pending stock approval changes."
                variant="dashboard"
              />
            )}
            {!editRequestsLoading && editRequestsError && (
              <ERPFormNotice tone="danger" title="Edit requests unavailable" onDismiss={() => setEditRequestsError("")}>
                {editRequestsError}
              </ERPFormNotice>
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

        <section>
          <div className="inventory-register-toolbar">
            <div className="inventory-register-head-status">
              {loading && (
                <AnimatedLoadingState
                  compact
                  className="admin-module-loading"
                  title="Loading inventory"
                  message="Fetching stock, variants, and availability."
                  variant="dashboard"
                />
              )}
              {!loading && error && (
                <ERPFormNotice tone="danger" title="Inventory unavailable" onDismiss={() => setError("")}>
                  {error}
                </ERPFormNotice>
              )}
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
          {canCreateInventoryCategories && viewMode !== "activity" && selectedItemIds.size > 0 && (
            <div className="inventory-bulk-move">
              <div>
                <strong>{selectedItemIds.size} selected</strong>
                <span>
                  Set the product, category, or both.
                </span>
              </div>
              <SourceCategoryCombobox
                categories={canonicalSourceCategories}
                valueId={bulkMoveSourceCategory?.id || ""}
                valueName={bulkMoveSourceCategory?.name || bulkMoveSourceCategoryDraft}
                onSelect={(category) => {
                  const previousSourceCode = bulkMoveSourceCategory?.sourceCategoryCode || "";
                  setBulkMoveSourceCategory(category);
                  setBulkMoveSourceCategoryDraft(category?.name || "");
                  if (
                    getInventorySourceCodeFromValue(previousSourceCode)
                    !== getInventorySourceCodeFromValue(category?.sourceCategoryCode)
                  ) {
                    setBulkMoveSpecificCategory(null);
                    setBulkMoveSpecificCategoryDraft("");
                  }
                }}
                onCreate={canCreateInventoryCategories ? createSourceCategoryFromName : undefined}
                onQueryChange={(nextQuery) => {
                  setBulkMoveSourceCategory(null);
                  setBulkMoveSourceCategoryDraft(nextQuery);
                  if (bulkMoveSpecificCategory || bulkMoveSpecificCategoryDraft) {
                    setBulkMoveSpecificCategory(null);
                    setBulkMoveSpecificCategoryDraft("");
                  }
                }}
                placeholder="Product"
                ariaLabel="Bulk product"
                disabled={!selectedItemIds.size || bulkMoveSaving || bulkArchiveSaving}
              />
              <SourceCategoryCombobox
                categories={bulkSpecificCategoryOptions}
                valueId={bulkMoveSpecificCategory?.id || ""}
                valueName={bulkMoveSpecificCategory?.name || bulkMoveSpecificCategoryDraft}
                onSelect={(category) => {
                  setBulkMoveSpecificCategory(category);
                  setBulkMoveSpecificCategoryDraft(category?.name || "");
                  const linkedSource = findCanonicalSourceCategory(category?.sourceCategoryCode);
                  if (linkedSource) {
                    setBulkMoveSourceCategory(linkedSource);
                    setBulkMoveSourceCategoryDraft(linkedSource.name || "");
                  }
                }}
                onCreate={createBulkSpecificCategoryOption}
                onQueryChange={(nextQuery) => {
                  setBulkMoveSpecificCategory(null);
                  setBulkMoveSpecificCategoryDraft(nextQuery);
                }}
                placeholder="Category"
                ariaLabel="Bulk category"
                disabled={!selectedItemIds.size || bulkMoveSaving || bulkArchiveSaving}
              />
              <button
                type="button"
                className="admin-primary"
                onClick={reassignSelectedSpecificCategory}
                disabled={
                  !selectedItemIds.size
                  || (
                    !normalizeInventoryCategoryName(
                      bulkMoveSourceCategory?.name
                      || findCanonicalSourceCategoryByName(bulkMoveSourceCategoryDraft)?.name
                    )
                    && !normalizeInventoryCategoryName(
                      bulkMoveSpecificCategory?.name || bulkMoveSpecificCategoryDraft
                    )
                  )
                  || bulkMoveSaving
                  || bulkArchiveSaving
                }
              >
                {bulkMoveSaving ? "Moving..." : "Move"}
              </button>
              <button
                type="button"
                className="admin-secondary inventory-bulk-archive"
                onClick={archiveSelectedItems}
                disabled={!selectedItemIds.size || bulkMoveSaving || bulkArchiveSaving}
              >
                {bulkArchiveSaving ? "Archiving..." : "Archive"}
              </button>
              <button
                type="button"
                className="admin-secondary"
                onClick={clearSelectedItems}
                disabled={!selectedItemIds.size || bulkMoveSaving || bulkArchiveSaving}
                aria-label="Clear selected items"
                title="Clear selected items"
              >
                <AppIcon icon={faXmark} size={14} />
                Clear selected
              </button>
            </div>
          )}

          {sourceCategoryError && (
            <ERPFormNotice tone="danger" title="Category setup unavailable" onDismiss={() => setSourceCategoryError("")}>
              {sourceCategoryError}
            </ERPFormNotice>
          )}

          {viewMode === "activity" && (
            <div className="stock-activity-grid">
              {stockActivityError && (
                <ERPFormNotice tone="danger" title="Movement history unavailable" onDismiss={() => setStockActivityError("")}>
                  {stockActivityError}
                </ERPFormNotice>
              )}
              {stockActivityLoading && (
                <AnimatedLoadingState
                  compact
                  className="glass-card admin-module-loading"
                  title="Loading movement history"
                  message="Fetching inventory activity and monthly totals."
                  variant="dashboard"
                />
              )}
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
            <div className="admin-table admin-table-scroll inventory-table-scroll">
              <div className="table-pagination inventory-register-pagination-header">
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
                      <AppIcon icon={faChevronLeft} size={12} />
                      <span>Previous</span>
                    </button>
                    <span className="inventory-register-pagination-page">
                      Page {paginationDisplayPage} of {paginationDisplayCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={clampedPage >= pageCount - 1}
                    >
                      <AppIcon icon={faChevronRight} size={12} />
                      <span>Next</span>
                    </button>
                  </div>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th className="inventory-select-cell">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        disabled={!canCreateInventoryCategories}
                        aria-label="Select visible inventory items"
                      />
                    </th>
                    <th className="table-row-index">#</th>
                    <th className="inventory-cell-id">
                      <button type="button" className="sort-header" onClick={() => requestSort("id")}>
                        ID <span className="sort-indicator">{sortIndicator("id")}</span>
                      </button>
                    </th>
                    <th className="inventory-cell-product">
                      <button type="button" className="sort-header" onClick={() => requestSort("name")}>
                        Product <span className="sort-indicator">{sortIndicator("name")}</span>
                      </button>
                    </th>
                    <th className="inventory-cell-vendor">
                      <button type="button" className="sort-header" onClick={() => requestSort("vendorLabel")}>
                        Vendor <span className="sort-indicator">{sortIndicator("vendorLabel")}</span>
                      </button>
                    </th>
                    <th className="inventory-cell-sku">
                      <button type="button" className="sort-header" onClick={() => requestSort("sku")}>
                        SKU <span className="sort-indicator">{sortIndicator("sku")}</span>
                      </button>
                    </th>
                    <th className="inventory-cell-category">
                      <button type="button" className="sort-header" onClick={() => requestSort("category")}>
                        Category <span className="sort-indicator">{sortIndicator("category")}</span>
                      </button>
                    </th>
                    {shouldShowUpdatedColumn && (
                      <th className="inventory-cell-updated">
                        <button type="button" className="sort-header" onClick={() => requestSort("lastUpdatedAt")}>
                          Last Updated <span className="sort-indicator">{sortIndicator("lastUpdatedAt")}</span>
                        </button>
                      </th>
                    )}
                    <th className="inventory-cell-stock">
                      <button type="button" className="sort-header" onClick={() => requestSort("quantity")}>
                        Stock <span className="sort-indicator">{sortIndicator("quantity")}</span>
                      </button>
                    </th>
                    <th className="inventory-cell-price">
                      <button type="button" className="sort-header" onClick={() => requestSort("price")}>
                        Price <span className="sort-indicator">{sortIndicator("price")}</span>
                      </button>
                    </th>
                    <th className="inventory-cell-value">
                      <button type="button" className="sort-header" onClick={() => requestSort("inventoryValue")}>
                        Inventory Value <span className="sort-indicator">{sortIndicator("inventoryValue")}</span>
                      </button>
                    </th>
                    <th className="inventory-cell-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {!loading && inventory.length === 0 && (
                    <tr>
                      <td colSpan={shouldShowUpdatedColumn ? 12 : 11} className="admin-empty">
                        No items found in inventory.
                      </td>
                    </tr>
                  )}
                  {paginatedInventory.map((item, index) => {
                    const quantity = getQuantity(item);
                    const isOut = quantity <= 0;
                    const isLow = isLowStockItem(item);
                    const isMenuOpen = openMenuId === item.id;
                    const vendorLabel = formatItemVendorLabel(item, vendorNameById);
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
                        <td className="inventory-select-cell" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedItemIds.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            disabled={!canCreateInventoryCategories}
                            aria-label={`Select ${formatInventoryItemName(item.name, "item")}`}
                          />
                        </td>
                        <td className="table-row-index">
                          <span className="inventory-table-text">{clampedPage * pageSize + index}</span>
                        </td>
                        <td className="inventory-cell-id">
                          <span className="inventory-table-text">{item.id}</span>
                        </td>
                        <td className="inventory-cell-product">
                          <div className="admin-product">
                            <span className="admin-product-name">{formatInventoryItemName(item.name)}</span>
                            {isVariantParentItem(item) && (
                              <span className="inventory-variant-pill">{getItemVariants(item).length} variants</span>
                            )}
                          </div>
                        </td>
                        <td className="inventory-cell-vendor">
                            <span className="admin-vendor">{vendorLabel || "-"}</span>
                        </td>
                        <td className="inventory-cell-sku">
                          <span className="admin-sku">{item.sku || "-"}</span>
                        </td>
                        <td className="inventory-cell-category">
                          <div className="inventory-table-category">
                            <span>{getCategory(item)}</span>
                          </div>
                        </td>
                        {shouldShowUpdatedColumn && (
                          <td className="inventory-cell-updated">
                            <div className="inventory-table-updated">
                              <span title={formatUpdatedDetails(item.lastUpdatedAt || item.updatedAt, item.lastUpdatedByName)}>
                                {formatDate(item.lastUpdatedAt || item.updatedAt)}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="inventory-cell-stock">
                          <div className="inventory-table-stock">
                            <span className="admin-stock">{quantity}</span>
                          </div>
                        </td>
                        <td className="inventory-cell-price">
                          <div className="inventory-table-value">
                            <strong>{formatMoney(toNumber(item?.price, 0))}</strong>
                          </div>
                        </td>
                        <td className="inventory-cell-value">
                          <div className="inventory-table-value">
                            <strong>{formatMoney(getInventoryStockValue(item))}</strong>
                          </div>
                        </td>
                        <td className="inventory-cell-actions">
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
                                <span>Actions</span>
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
                                  {canAdjustInventoryStockDirectly && getInventorySegment(item) !== "rental" && (
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
                                  {canManageInventoryLifecycle && (
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
                {inventory.length > 0 && (
                  <tfoot className="admin-table-footer">
                    <tr>
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          Total
                        </span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      {shouldShowUpdatedColumn && <td className="admin-table-summary-cell is-empty" />}
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">{inventoryTableSummary.stockTotal}</span>
                      </td>
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          {formatMoney(inventoryTableSummary.priceTotal)}
                        </span>
                      </td>
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          {formatMoney(inventoryTableSummary.inventoryValueTotal)}
                        </span>
                      </td>
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
                          {canCreateInventoryCategories && (
                            <label
                              className="inventory-card-select"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedItemIds.has(item.id)}
                                onChange={() => toggleItemSelection(item.id)}
                                aria-label={`Select ${formatInventoryItemName(item.name, "item")}`}
                              />
                              <span className="sr-only">Select</span>
                            </label>
                          )}
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
                                <span>Actions</span>
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
	                              {canAdjustInventoryStockDirectly && getInventorySegment(item) !== "rental" && (
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
	                              {canManageInventoryLifecycle && (
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
	                    <h4 className="inventory-card-title">
                        {formatInventoryItemName(item.name)}
                        {isVariantParentItem(item) && (
                          <span className="inventory-variant-pill">{getItemVariants(item).length} variants</span>
                        )}
                      </h4>
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
                {canManageInventoryLifecycle && (
                  <button
                    type="button"
                    className="admin-chip"
                    onClick={restoreSelectedArchived}
                    disabled={!archivedSelected.size || archivedBulkLoading}
                  >
                    Restore selected
                  </button>
                )}
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
              {archivedLoading && (
                <AnimatedLoadingState
                  compact
                  className="glass-card admin-module-loading"
                  title="Loading archived items"
                  message="Fetching archived inventory records."
                  variant="detail"
                />
              )}
              {!archivedLoading && archivedError && (
                <ERPFormNotice tone="danger" title="Archived items unavailable" onDismiss={() => setArchivedError("")}>
                  {archivedError}
                </ERPFormNotice>
              )}
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
              {deletedLoading && (
                <AnimatedLoadingState
                  compact
                  className="glass-card admin-module-loading"
                  title="Loading deleted items"
                  message="Fetching recently deleted inventory records."
                  variant="detail"
                />
              )}
              {!deletedLoading && deletedError && (
                <ERPFormNotice tone="danger" title="Deleted items unavailable" onDismiss={() => setDeletedError("")}>
                  {deletedError}
                </ERPFormNotice>
              )}
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
                const sourceCategoryCode = getInventorySourceCodeFromValue(row.sourceCategoryCode || defaultSourceCategoryCode);
                const rowSpecificCategoryOptions = specificCategoryOptionsBySource[sourceCategoryCode] || [];
                const rowSpecificCategorySourceCode = row.specificCategory
                  ? resolveSpecificCategorySourceCode(row.specificCategory, sourceCategoryCode)
                  : sourceCategoryCode;
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
                        {row.hasVariants ? "Parent stock" : "Qty"}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => updateNewItemRow(index, "quantity", e.target.value)}
                          placeholder="0"
                          disabled={row.hasVariants}
                        />
                        {row.hasVariants && (
                          <span className="admin-field-hint">
                            Parent stock is calculated from the generated variants below.
                          </span>
                        )}
                      </label>
                      <label>
                        Item type
                        <SelectField
                          value={row.itemType}
                          onChangeValue={(nextValue) =>
                            updateNewItemRow(index, "itemType", String(nextValue))
                          }
                          ariaLabel={`Item ${index + 1} item type`}
                        >
                          {INVENTORY_ITEM_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                      <label className="admin-new-item-field--wide">
                        Product
                        <SourceCategoryCombobox
                          categories={canonicalSourceCategories}
                          valueId={row.sourceCategoryId}
                          valueName={getProductDisplayName(
                            row.sourceCategoryId,
                            row.sourceCategoryName,
                            row.sourceCategoryCode
                          )}
                          onSelect={(category) => handleNewItemSourceCategorySelect(index, category)}
                          onCreate={canCreateInventoryCategories ? createSourceCategoryFromName : undefined}
                          placeholder="Product"
                          ariaLabel={`Item ${index + 1} product`}
                        />
                      </label>
                      <label className="admin-new-item-field--wide">
                        Category
                        <SourceCategoryCombobox
                          categories={rowSpecificCategoryOptions}
                          valueId={
                            row.specificCategory
                              ? getSpecificCategoryOptionId(rowSpecificCategorySourceCode, row.specificCategory)
                              : ""
                          }
                          valueName={row.specificCategory}
                          onSelect={(category) => handleNewItemSpecificCategorySelect(index, category)}
                          onCreate={
                            canCreateInventoryCategories
                              ? (name) => saveSpecificCategoryForSource(sourceCategoryCode, name)
                              : undefined
                          }
                          onQueryChange={(nextQuery) => handleNewItemSpecificCategoryDraftChange(index, nextQuery)}
                          placeholder={`Category under ${getInventorySourceLabel(sourceCategoryCode) || "product"}`}
                          ariaLabel={`Item ${index + 1} category`}
                        />
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

                      {canAdjustInventoryStockDirectly && (
                        <div className="admin-new-item-field--full admin-new-item-variants-toggle">
                          <label className="admin-checkbox">
                            <input
                              type="checkbox"
                              checked={row.hasVariants}
                              onChange={(e) => updateNewItemRow(index, "hasVariants", e.target.checked)}
                            />
                            This item has variants (names, colors, sizes, numbers)
                          </label>
                          {row.hasVariants && (
                            <div className="inventory-variant-generator admin-new-item-variant-gen">
                              <label>
                                Names
                                <input
                                  type="text"
                                  value={row.variantNames}
                                  onChange={(e) => updateNewItemRow(index, "variantNames", e.target.value)}
                                  placeholder="Kente, Ankara"
                                />
                              </label>
                              <label>
                                Numbers
                                <input
                                  type="text"
                                  value={row.variantNumbers}
                                  onChange={(e) => updateNewItemRow(index, "variantNumbers", e.target.value)}
                                  placeholder="1, 2, 3 or A1, A2"
                                />
                              </label>
                              <label>
                                Colors
                                <input
                                  type="text"
                                  value={row.variantColors}
                                  onChange={(e) => updateNewItemRow(index, "variantColors", e.target.value)}
                                  placeholder="Gold, Silver"
                                />
                              </label>
                              <label>
                                Sizes
                                <input
                                  type="text"
                                  value={row.variantSizes}
                                  onChange={(e) => updateNewItemRow(index, "variantSizes", e.target.value)}
                                  placeholder="S, M, L or 16in"
                                />
                              </label>
                              <label>
                                Starting stock
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={row.variantDefaultStockQty}
                                  onChange={(e) => updateNewItemRow(index, "variantDefaultStockQty", e.target.value)}
                                />
                              </label>
                              <label>
                                Price override
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.variantPriceOverride}
                                  onChange={(e) => updateNewItemRow(index, "variantPriceOverride", e.target.value)}
                                  placeholder="Optional"
                                />
                              </label>
                              <p className="admin-field-hint admin-new-item-field--full">
                                Use names for styles like Kente or Ankara. Fill at least one dimension and every combination will be created.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

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
              {newItemError && (
                <ERPFormNotice tone="danger" title="Items not created" onDismiss={() => setNewItemError("")}>
                  {newItemError}
                </ERPFormNotice>
              )}
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

            {activityDetail.loading && (
              <AnimatedLoadingState
                compact
                className="glass-card admin-module-loading"
                title="Loading item movement"
                message="Opening movement detail rows."
                variant="detail"
              />
            )}
            {!activityDetail.loading && activityDetail.error && (
              <ERPFormNotice
                tone="danger"
                title="Movement detail unavailable"
                onDismiss={() => setActivityDetail((prev) => (prev ? { ...prev, error: "" } : prev))}
              >
                {activityDetail.error}
              </ERPFormNotice>
            )}
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
                <span className={`admin-detail-autosave-status is-${detailAutosaveStatus}`}>
                  {detailAutosaveStatus === "saving" || detailAutosaveStatus === "manual-saving"
                    ? "Saving..."
                    : detailAutosaveStatus === "pending"
                      ? "Autosave pending"
                      : detailAutosaveStatus === "saved"
                        ? `Saved${detailAutosaveAt ? ` ${formatDateTime(detailAutosaveAt)}` : ""}`
                        : detailAutosaveStatus === "error"
                          ? "Save failed"
                          : "Autosave on"}
                </span>
                <button
                  type="button"
                  className="admin-primary admin-detail-save-top"
                  onClick={() => saveItemDetails()}
                  disabled={detailSaving || !canSubmitInventoryEdits}
                >
                  {detailSaving ? (userRole === "staff" ? "Sending..." : "Saving...") : detailSubmitLabel}
                </button>
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
                  Item type
                  <SelectField
                    value={detailForm.itemType}
                    onChangeValue={(nextValue) => updateDetailForm("itemType", String(nextValue))}
                    disabled={!isDetailFieldEditable("itemType")}
                    ariaLabel="Item type"
                  >
                    {INVENTORY_ITEM_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <label>
                  Product
                  <SourceCategoryCombobox
                    categories={canonicalSourceCategories}
                    valueId={detailForm.sourceCategoryId}
                    valueName={getProductDisplayName(
                      detailForm.sourceCategoryId,
                      detailForm.sourceCategoryName,
                      detailForm.sourceCategoryCode
                    )}
                    onSelect={handleDetailSourceCategorySelect}
                    onCreate={canCreateInventoryCategories ? createSourceCategoryFromName : undefined}
                    disabled={!isDetailFieldEditable("sourceCategoryCode")}
                    placeholder="Product"
                    ariaLabel="Product"
                  />
                </label>
                <label className="admin-detail-source-category">
                  Category
                  <SourceCategoryCombobox
                    categories={
                      specificCategoryOptionsBySource[
                        getInventorySourceCodeFromValue(detailForm.sourceCategoryCode) || defaultSourceCategoryCode
                      ] || []
                    }
                    valueId={
                      detailForm.specificCategory
                        ? getSpecificCategoryOptionId(
                          resolveSpecificCategorySourceCode(
                            detailForm.specificCategory,
                            detailForm.sourceCategoryCode
                          ),
                          detailForm.specificCategory
                        )
                        : ""
                    }
                    valueName={detailForm.specificCategory}
                    onSelect={handleDetailSpecificCategorySelect}
                    onCreate={
                      canCreateInventoryCategories
                        ? (name) => saveSpecificCategoryForSource(detailForm.sourceCategoryCode, name)
                        : undefined
                    }
                    onQueryChange={handleDetailSpecificCategoryDraftChange}
                    disabled={!isDetailFieldEditable("specificCategory")}
                    placeholder={`Category under ${getInventorySourceLabel(detailForm.sourceCategoryCode) || "product"}`}
                    ariaLabel="Category"
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
                  {getInventorySegment(detailForm) === "rental" ? "Total units (capacity)" : "Stock on hand"}
                  <input
                    type="number"
                    min="0"
                    step="1"
                  value={detailForm.stock}
                  onChange={(event) => updateDetailForm("stock", event.target.value)}
                    disabled={!isDetailFieldEditable("stock") || detailForm.itemType === "VARIANT_PARENT"}
                  />
                  {detailForm.itemType === "VARIANT_PARENT" && (
                    <span className="admin-field-hint">Parent stock is the sum of its variants.</span>
                  )}
                  {getInventorySegment(detailForm) === "rental" && detailForm.itemType !== "VARIANT_PARENT" && (
                    <span className="admin-field-hint">How many physical units you own. Availability is calculated per booking date.</span>
                  )}
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

              {detailForm.itemType === "VARIANT_PARENT" && (
                <section className="inventory-variant-section">
                  <div className="inventory-variant-section-head">
                    <div className="inventory-variant-section-title">
                      <p className="admin-eyebrow">Variants</p>
                      <h3>{detailForm.name}</h3>
                      <p className="inventory-variant-intro">
                        Build combinations with names, numbers, colors, and sizes. Parent stock updates automatically from the variant rows below.
                      </p>
                    </div>
                    <span className="inventory-variant-count">
                      {getItemVariants(detailForm).length} variant{getItemVariants(detailForm).length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {canAdjustInventoryStockDirectly && (
                    <div className="inventory-variant-builder">
                      <div className="inventory-variant-builder-surface">
                        <div className="inventory-variant-builder-fields inventory-variant-builder-fields--dimensions">
                          <label>
                            Names
                            <input
                              type="text"
                              value={detailForm.variantNames}
                              onChange={(event) => updateDetailForm("variantNames", event.target.value)}
                              placeholder="Kente, Ankara"
                            />
                          </label>
                          <label>
                            Numbers
                            <input
                              type="text"
                              value={detailForm.variantNumbers}
                              onChange={(event) => updateDetailForm("variantNumbers", event.target.value)}
                              placeholder="1, 2, 3 or A1, A2"
                            />
                          </label>
                          <label>
                            Colors
                            <input
                              type="text"
                              value={detailForm.variantColors}
                              onChange={(event) => updateDetailForm("variantColors", event.target.value)}
                              placeholder="Gold, Silver"
                            />
                          </label>
                          <label>
                            Sizes
                            <input
                              type="text"
                              value={detailForm.variantSizes}
                              onChange={(event) => updateDetailForm("variantSizes", event.target.value)}
                              placeholder="S, M, L or 16in"
                            />
                          </label>
                        </div>

                        <div className="inventory-variant-builder-footer">
                          <div className="inventory-variant-builder-fields inventory-variant-builder-fields--defaults">
                            <label>
                              Starting stock
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={detailForm.variantDefaultStockQty}
                                onChange={(event) => updateDetailForm("variantDefaultStockQty", event.target.value)}
                              />
                            </label>
                            <label>
                              Price override
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={detailForm.variantPriceOverride}
                                onChange={(event) => updateDetailForm("variantPriceOverride", event.target.value)}
                                placeholder="Optional"
                              />
                            </label>
                          </div>
                          <div className="inventory-variant-builder-action-block">
                            <button
                              type="button"
                              className="admin-secondary inventory-variant-generate-btn"
                              onClick={generateDetailVariants}
                              disabled={variantGenerateSaving}
                            >
                              <span className="inventory-variant-generate-btn-icon" aria-hidden="true">
                                <AppIcon icon={faRotateRight} size={13} />
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const variantList = getItemVariants(detailForm);
                    if (!variantList.length) return null;
                    const savedVariantList = getItemVariants(detailItem);
                    const showName =
                      variantList.some((v) => v.variantName) || savedVariantList.some((v) => v.variantName);
                    const showNumber =
                      variantList.some((v) => v.variantNumber) || savedVariantList.some((v) => v.variantNumber);
                    const showColor =
                      variantList.some((v) => v.color) || savedVariantList.some((v) => v.color);
                    const showSize =
                      variantList.some((v) => v.size) || savedVariantList.some((v) => v.size);
                    const showVariantActions = canAdjustInventoryStockDirectly;
                    const showPriceOverride =
                      variantList.some(
                        (v) => v.priceOverride !== null && v.priceOverride !== "" && typeof v.priceOverride !== "undefined"
                      ) || savedVariantList.some(
                        (v) => v.priceOverride !== null && v.priceOverride !== "" && typeof v.priceOverride !== "undefined"
                      );
                    return (
                      <div className="inventory-variant-table-wrap">
                        <table className="inventory-variant-table">
                          <colgroup>
                            {showName && <col className="ivcol-dim" />}
                            {showNumber && <col className="ivcol-dim" />}
                            {showColor && <col className="ivcol-dim" />}
                            {showSize && <col className="ivcol-dim" />}
                            <col className="ivcol-sku" />
                            <col className="ivcol-num" />
                            <col className="ivcol-num" />
                            <col className="ivcol-status" />
                            {showPriceOverride && <col className="ivcol-price" />}
                            {showVariantActions && <col className="ivcol-actions" />}
                          </colgroup>
                          <thead>
                            <tr>
                              {showName && <th>Name</th>}
                              {showNumber && <th>Number</th>}
                              {showColor && <th>Color</th>}
                              {showSize && <th>Size</th>}
                              <th>SKU</th>
                              <th>Stock</th>
                              <th>Status</th>
                              {showPriceOverride && <th>Price</th>}
                              {showVariantActions && <th className="inventory-variant-actions-head">Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {variantList.map((variant) => {
                              const savedVariant = savedVariantList.find(
                                (entry) => Number(entry.id) === Number(variant.id)
                              );
                              return (
                                <tr key={variant.id}>
                                  {showName && (
                                    <td>
                                      {variant.variantName || savedVariant?.variantName ? (
                                        <input
                                          type="text"
                                          value={variant.variantName || ""}
                                          onChange={(event) => updateDetailVariant(variant.id, "variantName", event.target.value)}
                                          aria-label="Variant name"
                                          disabled={!canAdjustInventoryStockDirectly}
                                        />
                                      ) : null}
                                    </td>
                                  )}
                                  {showNumber && (
                                    <td>
                                      {variant.variantNumber || savedVariant?.variantNumber ? (
                                        <input
                                          type="text"
                                          value={variant.variantNumber || ""}
                                          onChange={(event) => updateDetailVariant(variant.id, "variantNumber", event.target.value)}
                                          aria-label="Variant number"
                                          disabled={!canAdjustInventoryStockDirectly}
                                        />
                                      ) : null}
                                    </td>
                                  )}
                                  {showColor && (
                                    <td>
                                      {variant.color || savedVariant?.color ? (
                                        <input
                                          type="text"
                                          value={variant.color || ""}
                                          onChange={(event) => updateDetailVariant(variant.id, "color", event.target.value)}
                                          aria-label="Color"
                                          disabled={!canAdjustInventoryStockDirectly}
                                        />
                                      ) : null}
                                    </td>
                                  )}
                                  {showSize && (
                                    <td>
                                      {variant.size || savedVariant?.size ? (
                                        <input
                                          type="text"
                                          value={variant.size || ""}
                                          onChange={(event) => updateDetailVariant(variant.id, "size", event.target.value)}
                                          aria-label="Size"
                                          disabled={!canAdjustInventoryStockDirectly}
                                        />
                                      ) : null}
                                    </td>
                                  )}
                                  <td>
                                    <input
                                      type="text"
                                      value={variant.sku || ""}
                                      onChange={(event) => updateDetailVariant(variant.id, "sku", event.target.value)}
                                      disabled={!canAdjustInventoryStockDirectly}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={variant.stockQty ?? 0}
                                      onChange={(event) => updateDetailVariant(variant.id, "stockQty", event.target.value)}
                                      disabled={!canAdjustInventoryStockDirectly}
                                    />
                                  </td>
                                  <td>
                                    <SelectField
                                      value={variant.status || "active"}
                                      onChangeValue={(nextValue) => updateDetailVariant(variant.id, "status", String(nextValue))}
                                      disabled={!canAdjustInventoryStockDirectly}
                                      ariaLabel="Variant status"
                                    >
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                    </SelectField>
                                  </td>
                                  {showPriceOverride && (
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={variant.priceOverride ?? ""}
                                        onChange={(event) => updateDetailVariant(variant.id, "priceOverride", event.target.value)}
                                        placeholder={String(detailForm.price || "0")}
                                        disabled={!canAdjustInventoryStockDirectly}
                                      />
                                    </td>
                                  )}
                                  {showVariantActions && (
                                    <td className="inventory-variant-row-actions-cell">
                                      <div className="inventory-variant-row-actions">
                                        <button
                                          type="button"
                                          className="inventory-variant-icon-btn inventory-variant-icon-btn--danger"
                                          onClick={() => deleteDetailVariant(variant.id)}
                                          disabled={variantActionId === variant.id}
                                          aria-label="Delete variant"
                                          title="Delete"
                                        >
                                          <AppIcon icon={faTrash} size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                  {getItemVariants(detailForm).length === 0 && (
                    <div className="inventory-variant-empty-state">
                      <strong>No variants yet</strong>
                      <span>
                        Use the builder above to generate the combinations you want. Parent stock will be calculated from the rows you create.
                      </span>
                    </div>
                  )}
                </section>
              )}

              <label className="admin-detail-description">
                Description
                <textarea
                  rows="3"
                  value={detailForm.description}
                  onChange={(event) => updateDetailForm("description", event.target.value)}
                  disabled={!isDetailFieldEditable("description")}
                />
              </label>

              {detailError && (
                <ERPFormNotice tone="danger" title="Item not saved" onDismiss={() => setDetailError("")}>
                  {detailError}
                </ERPFormNotice>
              )}
              <div className="admin-form-actions">
                <button type="button" className="admin-secondary" onClick={closeItemDetails}>
                  Close
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
              <InlineNotice
                tone="info"
                title={isOnline ? "Online - ready to submit" : "Offline"}
                message={
                  isOnline
                    ? "Inventory changes will be sent to the server for validation."
                    : "Inventory adjustments save locally first and sync only after the server validates them."
                }
                compact
              />
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

              {isVariantParentItem(activeItem) && (
                <label>
                  Variant
                  <SelectField
                    value={formState.variantId}
                    onChangeValue={(nextValue) =>
                      setFormState((prev) => ({ ...prev, variantId: String(nextValue) }))
                    }
                    ariaLabel="Stock variant"
                  >
                    <option value="">Select variant</option>
                    {activeItemVariants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {formatVariantName(activeItem.name, variant)} · available {getVariantAvailableQty(variant)}
                      </option>
                    ))}
                  </SelectField>
                  <small className="admin-form-hint">
                    {selectedStockVariant
                      ? `Stock ${selectedStockVariant.stockQty || 0}, reserved ${selectedStockVariant.reservedQty || 0}.`
                      : "Variant parents need a specific stock unit."}
                  </small>
                </label>
              )}

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
                <div>
                  <MonthField
                    label="Month sold"
                    value={formState.soldMonth}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, soldMonth: event.target.value }))
                    }
                    required
                  />
                  <small className="admin-form-hint">Choose the month the item was sold.</small>
                </div>
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

              {submitError && (
                <ERPFormNotice tone="danger" title="Stock not updated" onDismiss={() => setSubmitError("")}>
                  {submitError}
                </ERPFormNotice>
              )}
              {success && (
                <ERPFormNotice tone="success" title="Stock updated" onDismiss={() => setSuccess("")}>
                  {success}
                </ERPFormNotice>
              )}

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
                  {submitting ? "Saving..." : isOnline ? "Confirm update" : "Save offline adjustment"}
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
