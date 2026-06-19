import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  HiOutlineArchive,
  HiOutlineChartBar,
  HiOutlineChartPie,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineDatabase,
  HiOutlineExclamationCircle,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineShoppingBag,
  HiOutlineSwitchHorizontal,
  HiOutlineTag,
  HiOutlineTrendingUp,
  HiOutlineTruck,
  HiOutlineX,
} from "react-icons/hi";
import { useSearchParams } from "react-router-dom";
import {
  ERPFormNotice,
  ERPDangerAction,
  ERPModal,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPStatusBadge,
  ERPTableSearch,
  ERPTextareaField,
  ERPTextField,
  SelectField,
} from "@faako/ui";
import {
  SYNC_STATES,
  SYNC_STATE_LABELS,
  getQueueActionLabel,
  getQueueItemDisplayMeta,
} from "@faako/offline-sync";
import { portalUrl } from "../../config/appSurface";
import {
  InventoryManagementProvider,
  useInventoryManagement,
} from "../context/InventoryManagementContext";
import InventoryStockTable from "../components/inventory/InventoryStockTable";
import useSEOMeta from "../../hooks/useSEOMeta";
import {
  buildInventoryEditDraft,
  buildInventoryMovementPayload,
  buildInventoryPatchFromDraft,
  formatInventoryDateTime,
  formatInventoryLabel,
  formatInventoryStatusLabel,
  formatMovementTypeLabel,
  getInventoryComputedStatus,
  getInventoryProductName,
  getInventoryProductSku,
  getInventoryStatusTone,
  getInventoryVariantLabel,
  MOVEMENT_TYPE_OPTIONS,
  resolveInventoryAvailableQuantity,
  resolveInventoryOnHandQuantity,
  resolveInventoryReservedQuantity,
  resolveReorderThreshold,
  STOCK_STATUS_OPTIONS,
} from "../utils/inventoryUtils";
import type {
  AdminProduct,
  InventoryEditDraft,
  InventoryItem,
  InventoryManagementFilters,
  InventoryMovementType,
  InventoryMovementDraft,
  InventoryProductDraft,
  InventoryStockStatus,
} from "../types/inventory";
import "../styles/inventory-management.css";

const STATUS_FILTERS: Array<{ value: InventoryManagementFilters["status"]; label: string }> = [
  { value: "all", label: "All stock" },
  { value: "attention", label: "Attention" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "in_stock", label: "In stock" },
  { value: "unconfirmed", label: "Unconfirmed" },
  { value: "manual_review", label: "Manual review" },
  { value: "preorder", label: "Preorder" },
  { value: "unavailable", label: "Unavailable" },
];

const INVENTORY_TABLE_PAGE_SIZE = 12;

const getSelectValue = (value: string | string[]) => (Array.isArray(value) ? value[0] || "" : value);

type InventoryAnalyticsTone = "success" | "warning" | "danger" | "neutral" | "info";

type InventoryDrilldownEntry = {
  id: string;
  label: string;
  detail: string;
  value?: string | number;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  onSelect?: () => void;
};

type InventoryDrilldown = {
  title: string;
  description: string;
  entries: InventoryDrilldownEntry[];
};

const CHART_TONE_COLORS: Record<InventoryAnalyticsTone, string> = {
  success: "var(--sys-success)",
  warning: "var(--sys-warning)",
  danger: "var(--sys-danger)",
  neutral: "var(--color-text-muted)",
  info: "var(--sys-accent)",
};

const STATUS_ANALYTICS: Array<{
  value: InventoryStockStatus;
  tone: InventoryAnalyticsTone;
}> = [
  { value: "in_stock", tone: "success" },
  { value: "low_stock", tone: "warning" },
  { value: "out_of_stock", tone: "danger" },
  { value: "manual_review", tone: "danger" },
  { value: "preorder", tone: "info" },
  { value: "unavailable", tone: "neutral" },
];

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getPercent = (value: number, total: number) =>
  total > 0 ? clampPercent((value / total) * 100) : 0;

const formatInventoryNumber = (value: number) => Math.round(value).toLocaleString("en-GB");

const formatInventoryMoney = (value: number, currency = "GHS") =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: currency || "GHS",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);

const getPluralLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${formatInventoryNumber(count)} ${count === 1 ? singular : plural}`;

const toMoneyNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getInventoryItemPrice = (item: InventoryItem) => toMoneyNumber(item.product?.price);

const getInventoryItemCurrency = (item: InventoryItem) =>
  item.product?.currency?.trim().toUpperCase() || "GHS";

const getInventoryItemStockValue = (item: InventoryItem) => {
  const price = getInventoryItemPrice(item);
  const available = resolveInventoryAvailableQuantity(item);
  if (price === null || available === null) return null;
  return price * available;
};

const getProductDraftKey = (draft: InventoryProductDraft) =>
  JSON.stringify({
    name: draft.name.trim(),
    sku: draft.sku.trim(),
    price: draft.price.trim(),
    currency: draft.currency.trim().toUpperCase(),
    categorySlug: draft.categorySlug,
    publishingStatus: draft.publishingStatus,
    isFeatured: draft.isFeatured,
    shortDescription: draft.shortDescription.trim(),
  });

const getStockDraftKey = (draft: InventoryEditDraft | null) =>
  draft
    ? JSON.stringify({
        quantityOnHand: draft.quantityOnHand,
        reservedQuantity: draft.reservedQuantity,
        lowStockThreshold: draft.lowStockThreshold,
        reorderThreshold: draft.reorderThreshold,
        stockStatus: draft.stockStatus,
        supplierId: draft.supplierId,
        sku: draft.sku.trim(),
        notes: draft.notes.trim(),
        inventoryTrackingEnabled: draft.inventoryTrackingEnabled,
        allowBackorder: draft.allowBackorder,
        isPurchasable: draft.isPurchasable,
        lastCountedAt: draft.lastCountedAt,
      })
    : "";

const getChartStyle = (percent: number, color: string) =>
  ({
    "--chart-color": color,
    "--chart-value": `${clampPercent(percent)}%`,
  }) as React.CSSProperties;

const getRingStyle = (percent: number, color: string) =>
  ({
    "--ring-color": color,
    "--ring-value": `${clampPercent(percent)}%`,
  }) as React.CSSProperties;

const EMPTY_MOVEMENT_DRAFT: InventoryMovementDraft = {
  movementType: "RESTOCK",
  quantityDelta: "",
  quantityAfter: "",
  reason: "",
  supplierNote: "",
  purchaseNote: "",
};

type ProductCreateDraft = InventoryProductDraft & {
  quantityOnHand: string;
  reservedQuantity: string;
  lowStockThreshold: string;
  reorderThreshold: string;
  stockStatus: InventoryEditDraft["stockStatus"];
  supplierId: string;
  inventoryTrackingEnabled: boolean;
  allowBackorder: boolean;
  isPurchasable: boolean;
  notes: string;
};

const EMPTY_PRODUCT_CREATE_DRAFT: ProductCreateDraft = {
  name: "",
  sku: "",
  price: "",
  currency: "GHS",
  categorySlug: "",
  publishingStatus: "draft",
  isFeatured: false,
  shortDescription: "",
  quantityOnHand: "",
  reservedQuantity: "0",
  lowStockThreshold: "",
  reorderThreshold: "",
  stockStatus: "unavailable",
  supplierId: "",
  inventoryTrackingEnabled: true,
  allowBackorder: false,
  isPurchasable: false,
  notes: "",
};

const buildProductDraft = (
  product: AdminProduct | null,
  item: InventoryItem | null
): InventoryProductDraft => ({
  name: product?.name || item?.product?.name || "",
  sku: product?.sku || item?.product?.sku || item?.sku || "",
  price:
    product?.price === null || product?.price === undefined
      ? item?.product?.price === null || item?.product?.price === undefined
        ? ""
        : String(item.product.price)
      : String(product.price),
  currency: product?.currency || item?.product?.currency || "GHS",
  categorySlug: product?.categorySlug || item?.product?.categorySlug || "",
  publishingStatus: product?.publishingStatus || "draft",
  isFeatured: Boolean(product?.isFeatured),
  shortDescription: product?.shortDescription || "",
});

const isWholeNumberDraft = (value: string, { allowEmpty = true } = {}) => {
  if (allowEmpty && value === "") return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
};

const getQueueStatusLabel = (status = "") =>
  SYNC_STATE_LABELS[status] || formatInventoryLabel(status || "queued");

const getQueueBadgeTone = (status = "") => {
  if (status === SYNC_STATES.FAILED || status === SYNC_STATES.CONFLICT) return "danger" as const;
  if (status === SYNC_STATES.SYNCING || status === SYNC_STATES.RETRYING) return "loading" as const;
  if (status === SYNC_STATES.SYNCED) return "success" as const;
  return "warning" as const;
};

const InventoryManagementContent: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const inventoryState = useInventoryManagement();
  const {
    alerts,
    cachedAt,
    canManageInventory,
    categories,
    clearMessages,
    error,
    filteredInventory,
    filters,
    inventory: inventoryItems,
    isOnline,
    loadWarning,
    loading,
    movements,
    notice,
    products,
    queueCounts,
    queueError,
    queueLoading,
    queueReviewItems,
    recordingMovement,
    refreshInventory,
    refreshing,
    saveInventoryItem,
    saveProductDetails,
    savingInventoryItem,
    savingProduct,
    selectItem,
    selectedItem,
    selectedItemId,
    selectedProduct,
    setFilters,
    suppliers,
    summary,
    updateFilter,
    recordInventoryMovement,
    retryQueueItem,
    cancelQueueItem,
    bulkUpdateProducts,
    resolveQueueItem,
    createProduct,
    syncingQueueItemId,
  } = inventoryState;

  const [stockDraft, setStockDraft] = useState<InventoryEditDraft | null>(null);
  const [movementDraft, setMovementDraft] = useState<InventoryMovementDraft>(EMPTY_MOVEMENT_DRAFT);
  const [productDraft, setProductDraft] = useState<InventoryProductDraft>(
    buildProductDraft(null, null)
  );
  const [formError, setFormError] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ProductCreateDraft>(EMPTY_PRODUCT_CREATE_DRAFT);
  const [inventoryPage, setInventoryPage] = useState(0);
  const [openActionsId, setOpenActionsId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [drilldown, setDrilldown] = useState<InventoryDrilldown | null>(null);
  const [productAutosaveStatus, setProductAutosaveStatus] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [stockAutosaveStatus, setStockAutosaveStatus] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const productDraftSaveKeyRef = useRef(getProductDraftKey(productDraft));
  const stockDraftSaveKeyRef = useRef(getStockDraftKey(stockDraft));

  useSEOMeta({
    title: "Inventory management | Stroane operations",
    description: "Manage Stroane product stock, inventory movements, and catalogue availability.",
    canonical: portalUrl("/admin/inventory"),
    noIndex: true,
  });

  useEffect(() => {
    if (!selectedItem) {
      setStockDraft(null);
      const nextProductDraft = buildProductDraft(null, null);
      setProductDraft(nextProductDraft);
      productDraftSaveKeyRef.current = getProductDraftKey(nextProductDraft);
      stockDraftSaveKeyRef.current = "";
      setProductAutosaveStatus("idle");
      setStockAutosaveStatus("idle");
      return;
    }
    const nextStockDraft = buildInventoryEditDraft(selectedItem);
    const nextProductDraft = buildProductDraft(selectedProduct, selectedItem);
    setStockDraft(nextStockDraft);
    setMovementDraft(EMPTY_MOVEMENT_DRAFT);
    setProductDraft(nextProductDraft);
    stockDraftSaveKeyRef.current = getStockDraftKey(nextStockDraft);
    productDraftSaveKeyRef.current = getProductDraftKey(nextProductDraft);
    setProductAutosaveStatus("idle");
    setStockAutosaveStatus("idle");
    setFormError("");
  }, [selectedItem, selectedProduct]);

  const selectedStatus = selectedItem ? getInventoryComputedStatus(selectedItem) : "unavailable";
  const selectedAvailable = selectedItem ? resolveInventoryAvailableQuantity(selectedItem) : null;
  const selectedOnHand = selectedItem ? resolveInventoryOnHandQuantity(selectedItem) : null;
  const selectedReserved = selectedItem ? resolveInventoryReservedQuantity(selectedItem) : 0;
  const selectedMovements = useMemo(
    () =>
      selectedItem
        ? movements.filter(
            (movement) =>
              movement.inventoryItemId === selectedItem.id ||
              (movement.productSlug === selectedItem.productSlug &&
                (selectedItem.variantId
                  ? movement.variantId === selectedItem.variantId
                  : !movement.variantId))
          )
        : [],
    [movements, selectedItem]
  );
  const categoryNameBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.name])),
    [categories]
  );
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const productsBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
  );
  const resolveItemProduct = useCallback(
    (item: InventoryItem) =>
      (item.productId ? productsById.get(item.productId) : undefined) ||
      productsBySlug.get(item.productSlug) ||
      null,
    [productsById, productsBySlug]
  );
  const getItemCategoryLabel = useCallback(
    (item: InventoryItem) => {
      const product = resolveItemProduct(item);
      const categorySlug = item.product?.categorySlug || product?.categorySlug || "";
      return categorySlug
        ? categoryNameBySlug.get(categorySlug) || formatInventoryLabel(categorySlug)
        : "Uncategorised";
    },
    [categoryNameBySlug, resolveItemProduct]
  );

  const analytics = useMemo(() => {
    const totalItems = inventoryItems.length;
    const categoryNameBySlug = new Map(
      categories.map((category) => [category.slug, category.name])
    );
    const productsById = new Map(products.map((product) => [product.id, product]));
    const productsBySlug = new Map(products.map((product) => [product.slug, product]));
    const statusCounts = new Map<InventoryStockStatus, number>();
    const categoryTotals = new Map<
      string,
      { id: string; label: string; count: number; units: number; attention: number }
    >();
    const supplierTotals = new Map<
      string,
      { id: string; label: string; count: number; units: number; attention: number }
    >();

    let reorderUnits = 0;
    let topAvailableUnits = 0;
    let totalStockValue = 0;
    let pricedStockRecords = 0;
    let pricedStockUnits = 0;

    const stockRows = inventoryItems.map((item) => {
      const status = getInventoryComputedStatus(item);
      const available = resolveInventoryAvailableQuantity(item);
      const availableUnits = available ?? 0;
      const reorderThreshold = resolveReorderThreshold(item);
      const product =
        (item.productId ? productsById.get(item.productId) : undefined) ||
        productsBySlug.get(item.productSlug);
      const price = toMoneyNumber(item.product?.price ?? product?.price);
      const stockValue = price === null || available === null ? null : price * availableUnits;
      const categorySlug = item.product?.categorySlug || product?.categorySlug || "";
      const categoryLabel = categorySlug
        ? categoryNameBySlug.get(categorySlug) || formatInventoryLabel(categorySlug)
        : "Uncategorised";
      const supplierLabel = item.supplier?.name || "Unassigned";
      const isAttention =
        status === "out_of_stock" ||
        status === "low_stock" ||
        status === "manual_review" ||
        item.isLowStock ||
        item.needsReorder;

      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      if (available !== null && reorderThreshold !== null && availableUnits < reorderThreshold) {
        reorderUnits += reorderThreshold - availableUnits;
      }

      if (stockValue !== null) {
        totalStockValue += stockValue;
        pricedStockRecords += 1;
        pricedStockUnits += availableUnits;
      }

      const categoryTotal = categoryTotals.get(categorySlug || "uncategorised") || {
        id: categorySlug || "uncategorised",
        label: categoryLabel,
        count: 0,
        units: 0,
        attention: 0,
      };
      categoryTotal.count += 1;
      categoryTotal.units += availableUnits;
      categoryTotal.attention += isAttention ? 1 : 0;
      categoryTotals.set(categoryTotal.id, categoryTotal);

      const supplierTotal = supplierTotals.get(item.supplierId || "unassigned") || {
        id: item.supplierId || "unassigned",
        label: supplierLabel,
        count: 0,
        units: 0,
        attention: 0,
      };
      supplierTotal.count += 1;
      supplierTotal.units += availableUnits;
      supplierTotal.attention += isAttention ? 1 : 0;
      supplierTotals.set(supplierTotal.id, supplierTotal);

      topAvailableUnits = Math.max(topAvailableUnits, availableUnits);

      return {
        id: item.id,
        label: getInventoryProductName(item),
        sku: getInventoryProductSku(item),
        status,
        statusLabel: formatInventoryStatusLabel(status),
        tone: getInventoryStatusTone(status),
        stockValue,
        units: availableUnits,
      };
    });

    const attentionItems =
      summary.outOfStockItems + summary.lowStockItems + summary.manualReviewItems;
    const stockBaseUnits = summary.availableUnits + summary.reservedUnits;
    const reservedPressurePercent = getPercent(summary.reservedUnits, stockBaseUnits);

    const statusRows = STATUS_ANALYTICS.map(({ value, tone }) => {
      const count = statusCounts.get(value) || 0;
      return {
        id: value,
        label: formatInventoryStatusLabel(value),
        count,
        percent: getPercent(count, totalItems),
        tone,
        color: CHART_TONE_COLORS[tone],
      };
    });

    const categoryRows = Array.from(categoryTotals.values())
      .sort((left, right) => right.units - left.units || right.count - left.count)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        percent: getPercent(row.units, Math.max(summary.availableUnits, 1)),
      }));

    const supplierRows = Array.from(supplierTotals.values())
      .sort((left, right) => right.attention - left.attention || right.units - left.units)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        percent: getPercent(row.count, Math.max(totalItems, 1)),
      }));

    const movementTotals = new Map<
      string,
      { id: string; label: string; count: number; units: number; tone: InventoryAnalyticsTone }
    >();
    movements.forEach((movement) => {
      const id = movement.movementType || "ADJUSTMENT";
      const typedId = id as InventoryMovementType;
      const tone: InventoryAnalyticsTone =
        typedId === "RESTOCK" || typedId === "RELEASED"
          ? "success"
          : typedId === "DAMAGE"
            ? "danger"
            : typedId === "RESERVED"
              ? "warning"
              : "info";
      const current = movementTotals.get(id) || {
        id,
        label: formatMovementTypeLabel(id),
        count: 0,
        units: 0,
        tone,
      };
      current.count += 1;
      current.units += Math.abs(movement.quantityDelta);
      movementTotals.set(id, current);
    });
    const movementCount = Array.from(movementTotals.values()).reduce(
      (total, row) => total + row.count,
      0
    );
    const movementRows = Array.from(movementTotals.values())
      .sort((left, right) => right.count - left.count || right.units - left.units)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        percent: getPercent(row.count, movementCount),
        color: CHART_TONE_COLORS[row.tone],
      }));

    const topStockRows = stockRows
      .sort((left, right) => right.units - left.units || left.label.localeCompare(right.label))
      .slice(0, 5)
      .map((row) => ({
        ...row,
        percent: getPercent(row.units, Math.max(topAvailableUnits, 1)),
      }));

    const countedItems = Math.max(summary.trackedItems - summary.unconfirmedItems, 0);

    return {
      attentionItems,
      attentionPercent: getPercent(attentionItems, totalItems),
      categoryRows,
      countedItems,
      movementRows,
      pricedStockRecords,
      pricedStockUnits,
      reorderUnits,
      statusRows,
      totalStockValue,
      supplierRows,
      topStockRows,
      coverageMetrics: [
        {
          id: "counted",
          label: "Counted stock",
          value: `${summary.countedPercent}%`,
          meta: `${formatInventoryNumber(countedItems)} of ${formatInventoryNumber(
            summary.trackedItems
          )} tracked`,
          percent: summary.countedPercent,
          tone: "success" as const,
          color: CHART_TONE_COLORS.success,
        },
        {
          id: "suppliers",
          label: "Supplier cover",
          value: `${summary.supplierCoveragePercent}%`,
          meta: `${getPluralLabel(summary.supplierLinkedItems, "item")} linked`,
          percent: summary.supplierCoveragePercent,
          tone: "info" as const,
          color: CHART_TONE_COLORS.info,
        },
        {
          id: "products",
          label: "Product links",
          value: `${getPercent(summary.productLinkedItems, totalItems)}%`,
          meta: `${getPluralLabel(summary.productLinkedItems, "record")} matched`,
          percent: getPercent(summary.productLinkedItems, totalItems),
          tone: "success" as const,
          color: CHART_TONE_COLORS.success,
        },
        {
          id: "reserved",
          label: "Reserved pressure",
          value: `${reservedPressurePercent}%`,
          meta: `${getPluralLabel(summary.reservedUnits, "unit")} reserved`,
          percent: reservedPressurePercent,
          tone: reservedPressurePercent >= 35 ? ("warning" as const) : ("neutral" as const),
          color:
            reservedPressurePercent >= 35
              ? CHART_TONE_COLORS.warning
              : CHART_TONE_COLORS.neutral,
        },
      ],
    };
  }, [categories, inventoryItems, movements, products, summary]);

  const saveStockDraft = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!selectedItem || !stockDraft) return;

      clearMessages();
      setFormError("");
      const numberFields = [
        ["Quantity on hand", stockDraft.quantityOnHand],
        ["Reserved quantity", stockDraft.reservedQuantity],
        ["Low stock threshold", stockDraft.lowStockThreshold],
        ["Reorder threshold", stockDraft.reorderThreshold],
      ] as const;
      const invalidField = numberFields.find(([, value]) => !isWholeNumberDraft(value));
      if (invalidField) {
        setFormError(`${invalidField[0]} must be a whole number.`);
        setStockAutosaveStatus(options.silent ? "error" : "idle");
        return;
      }

      const quantityOnHand =
        stockDraft.quantityOnHand === "" ? null : Number(stockDraft.quantityOnHand);
      const reservedQuantity =
        stockDraft.reservedQuantity === "" ? 0 : Number(stockDraft.reservedQuantity);
      if (quantityOnHand !== null && reservedQuantity > quantityOnHand) {
        setFormError("Reserved quantity cannot exceed quantity on hand.");
        setStockAutosaveStatus(options.silent ? "error" : "idle");
        return;
      }

      await saveInventoryItem(
        selectedItem,
        buildInventoryPatchFromDraft(stockDraft),
        options
      );
      stockDraftSaveKeyRef.current = getStockDraftKey(stockDraft);
      setStockAutosaveStatus(options.silent ? "saved" : "idle");
    },
    [clearMessages, saveInventoryItem, selectedItem, stockDraft]
  );

  const handleStockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveStockDraft();
  };

  const handleMovementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem) return;
    clearMessages();
    setFormError("");

    try {
      const payload = buildInventoryMovementPayload(selectedItem, movementDraft);
      await recordInventoryMovement(selectedItem, payload);
      setMovementDraft(EMPTY_MOVEMENT_DRAFT);
    } catch (movementError) {
      setFormError(
        movementError instanceof Error ? movementError.message : "Unable to record movement."
      );
    }
  };

  const saveProductDraft = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const productId = selectedProduct?.id || selectedItem?.product?.id || selectedItem?.productId || "";
      if (!productId) return;

      clearMessages();
      setFormError("");
      if (!productDraft.name.trim()) {
        setFormError("Product name is required.");
        setProductAutosaveStatus(options.silent ? "error" : "idle");
        return;
      }
      if (productDraft.price && Number.isNaN(Number(productDraft.price))) {
        setFormError("Product price must be a valid number.");
        setProductAutosaveStatus(options.silent ? "error" : "idle");
        return;
      }

      await saveProductDetails(
        productId,
        {
          name: productDraft.name.trim(),
          sku: productDraft.sku.trim() || null,
          price: productDraft.price === "" ? null : productDraft.price,
          currency: productDraft.currency.trim().toUpperCase() || "GHS",
          categorySlug: productDraft.categorySlug || null,
          shortDescription: productDraft.shortDescription.trim() || null,
        },
        {
          publishingStatus: productDraft.publishingStatus,
          isFeatured: productDraft.isFeatured,
        },
        options
      );
      productDraftSaveKeyRef.current = getProductDraftKey(productDraft);
      setProductAutosaveStatus(options.silent ? "saved" : "idle");
    },
    [clearMessages, productDraft, saveProductDetails, selectedItem, selectedProduct]
  );

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveProductDraft();
  };

  const handleCreateProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();
    setFormError("");

    if (!createDraft.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (createDraft.price && Number.isNaN(Number(createDraft.price))) {
      setFormError("Product price must be a valid number.");
      return;
    }
    const numberFields = [
      ["Quantity on hand", createDraft.quantityOnHand],
      ["Reserved quantity", createDraft.reservedQuantity],
      ["Low stock threshold", createDraft.lowStockThreshold],
      ["Reorder threshold", createDraft.reorderThreshold],
    ] as const;
    const invalidField = numberFields.find(([, value]) => !isWholeNumberDraft(value));
    if (invalidField) {
      setFormError(`${invalidField[0]} must be a whole number.`);
      return;
    }

    const quantityOnHand =
      createDraft.quantityOnHand === "" ? null : Number(createDraft.quantityOnHand);
    const reservedQuantity =
      createDraft.reservedQuantity === "" ? 0 : Number(createDraft.reservedQuantity);
    if (quantityOnHand !== null && reservedQuantity > quantityOnHand) {
      setFormError("Reserved quantity cannot exceed quantity on hand.");
      return;
    }

    const createdProduct = await createProduct({
      name: createDraft.name.trim(),
      sku: createDraft.sku.trim() || null,
      price: createDraft.price === "" ? null : createDraft.price,
      currency: createDraft.currency.trim().toUpperCase() || "GHS",
      categorySlug: createDraft.categorySlug || null,
      shortDescription: createDraft.shortDescription.trim() || null,
      publishingStatus: createDraft.publishingStatus,
      isFeatured: createDraft.isFeatured,
      quantityOnHand,
      reservedQuantity,
      lowStockThreshold:
        createDraft.lowStockThreshold === "" ? null : Number(createDraft.lowStockThreshold),
      reorderThreshold:
        createDraft.reorderThreshold === "" ? null : Number(createDraft.reorderThreshold),
      stockStatus: createDraft.stockStatus,
      supplierId: createDraft.supplierId || null,
      inventoryTrackingEnabled: createDraft.inventoryTrackingEnabled,
      allowBackorder: createDraft.allowBackorder,
      isPurchasable: createDraft.isPurchasable,
      notes: createDraft.notes.trim() || null,
    });

    if (!createdProduct) return;
    setCreateDraft(EMPTY_PRODUCT_CREATE_DRAFT);
    setCreateProductOpen(false);
  };

  const toggleSelectedItem = useCallback((itemId: string) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const inventoryPageCount = Math.max(
    1,
    Math.ceil(filteredInventory.length / INVENTORY_TABLE_PAGE_SIZE)
  );
  const clampedInventoryPage = Math.min(inventoryPage, inventoryPageCount - 1);
  const paginatedInventory = useMemo(
    () =>
      filteredInventory.slice(
        clampedInventoryPage * INVENTORY_TABLE_PAGE_SIZE,
        clampedInventoryPage * INVENTORY_TABLE_PAGE_SIZE + INVENTORY_TABLE_PAGE_SIZE
      ),
    [clampedInventoryPage, filteredInventory]
  );
  const selectedFilteredIndex = useMemo(
    () => filteredInventory.findIndex((item) => item.id === selectedItemId),
    [filteredInventory, selectedItemId]
  );
  const selectedPositionLabel =
    selectedFilteredIndex >= 0
      ? `${selectedFilteredIndex + 1} of ${filteredInventory.length}`
      : filteredInventory.length
        ? `1 of ${filteredInventory.length}`
        : "0 of 0";
  const pageStart = filteredInventory.length
    ? clampedInventoryPage * INVENTORY_TABLE_PAGE_SIZE + 1
    : 0;
  const pageEnd = Math.min(
    filteredInventory.length,
    (clampedInventoryPage + 1) * INVENTORY_TABLE_PAGE_SIZE
  );
  const paginatedStockValue = paginatedInventory.reduce(
    (total, item) => total + (getInventoryItemStockValue(item) ?? 0),
    0
  );
  const selectedBulkProductIds = useMemo(
    () => [
      ...new Set(
        Array.from(selectedItemIds)
          .map((itemId) => inventoryItems.find((item) => item.id === itemId))
          .map((item) => {
            if (!item) return "";
            const product = resolveItemProduct(item);
            return product?.id || item.product?.id || item.productId || "";
          })
          .filter(Boolean)
      ),
    ],
    [inventoryItems, resolveItemProduct, selectedItemIds]
  );
  const togglePageSelected = useCallback(() => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      const allPageSelected =
        paginatedInventory.length > 0 && paginatedInventory.every((item) => next.has(item.id));
      paginatedInventory.forEach((item) => {
        if (allPageSelected) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      });
      return next;
    });
  }, [paginatedInventory]);
  const runBulkProductAction = useCallback(
    async (
      action: "archive" | "delete_listing" | "activate" | "draft",
      label: string,
      confirm = false
    ) => {
      if (!selectedBulkProductIds.length) {
        setFormError("Select at least one linked catalogue product.");
        return;
      }
      if (
        confirm &&
        typeof window !== "undefined" &&
        !window.confirm(`${label} ${selectedBulkProductIds.length} selected product listing(s)?`)
      ) {
        return;
      }
      clearMessages();
      setFormError("");
      const updatedProducts = await bulkUpdateProducts({
        productIds: selectedBulkProductIds,
        action,
      });
      if (updatedProducts.length) {
        setSelectedItemIds(new Set());
        setOpenActionsId("");
      }
    },
    [bulkUpdateProducts, clearMessages, selectedBulkProductIds]
  );
  const selectedStockValue = selectedItem ? getInventoryItemStockValue(selectedItem) : null;
  const selectedCurrency = selectedItem ? getInventoryItemCurrency(selectedItem) : "GHS";
  const selectedProductId =
    selectedProduct?.id || selectedItem?.product?.id || selectedItem?.productId || "";
  const modalAutosaveLabel =
    productAutosaveStatus === "saving" || stockAutosaveStatus === "saving"
      ? "Saving"
      : productAutosaveStatus === "pending" || stockAutosaveStatus === "pending"
        ? "Autosave pending"
        : productAutosaveStatus === "error" || stockAutosaveStatus === "error"
          ? "Review needed"
          : productAutosaveStatus === "saved" || stockAutosaveStatus === "saved"
            ? "Saved"
            : "Ready";

  const openItemDetail = useCallback(
    (itemId: string) => {
      selectItem(itemId);
      setDetailModalOpen(true);
      setDrilldown(null);
      setOpenActionsId("");
    },
    [selectItem]
  );

  const closeItemDetail = useCallback(() => {
    setDetailModalOpen(false);
    setOpenActionsId("");
  }, []);

  const navigateSelectedItem = useCallback(
    (direction: 1 | -1) => {
      if (!filteredInventory.length) return;
      const currentIndex =
        selectedFilteredIndex >= 0 ? selectedFilteredIndex : 0;
      const nextIndex =
        (currentIndex + direction + filteredInventory.length) % filteredInventory.length;
      selectItem(filteredInventory[nextIndex].id);
    },
    [filteredInventory, selectItem, selectedFilteredIndex]
  );

  useEffect(() => {
    const itemId = searchParams.get("item");
    if (!itemId || !inventoryItems.length) return;
    const matchingItem = inventoryItems.find((item) => item.id === itemId);
    if (!matchingItem) return;

    openItemDetail(matchingItem.id);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("item");
    setSearchParams(nextParams, { replace: true });
  }, [inventoryItems, openItemDetail, searchParams, setSearchParams]);

  const createInventoryEntries = useCallback(
    (items: InventoryItem[]): InventoryDrilldownEntry[] =>
      items.map((item) => {
        const status = getInventoryComputedStatus(item);
        const available = resolveInventoryAvailableQuantity(item);
        return {
          id: item.id,
          label: getInventoryProductName(item),
          detail: [
            getInventoryProductSku(item),
            getItemCategoryLabel(item),
            formatInventoryStatusLabel(status),
          ]
            .filter(Boolean)
            .join(" · "),
          value: available === null ? "Unset" : available,
          tone: getInventoryStatusTone(status),
          onSelect: () => openItemDetail(item.id),
        };
      }),
    [getItemCategoryLabel, openItemDetail]
  );

  const createProductEntries = useCallback(
    (items: AdminProduct[]): InventoryDrilldownEntry[] =>
      items.map((product) => {
        const linkedInventory = inventoryItems.find(
          (item) =>
            item.productId === product.id ||
            item.productSlug === product.slug ||
            item.productSlug === product.id
        );
        return {
          id: product.id,
          label: product.name,
          detail: [
            product.sku || product.slug,
            product.category?.name || product.categorySlug || "Uncategorised",
            product.price == null ? "Price not set" : formatInventoryMoney(Number(product.price), product.currency),
          ]
            .filter(Boolean)
            .join(" · "),
          value: formatInventoryLabel(product.publishingStatus),
          tone:
            product.publishingStatus === "active"
              ? "success"
              : product.publishingStatus === "archived"
                ? "danger"
                : "neutral",
          onSelect: linkedInventory ? () => openItemDetail(linkedInventory.id) : undefined,
        };
      }),
    [inventoryItems, openItemDetail]
  );

  const openInventoryDrilldown = useCallback(
    (title: string, description: string, entries: InventoryDrilldownEntry[]) => {
      setDrilldown({ title, description, entries });
    },
    []
  );

  const inventoryDrilldowns = useMemo(() => {
    const pricedItems = inventoryItems.filter((item) => getInventoryItemStockValue(item) !== null);
    const availableItems = inventoryItems.filter(
      (item) => resolveInventoryAvailableQuantity(item) !== null
    );
    const outOfStockItems = inventoryItems.filter(
      (item) => getInventoryComputedStatus(item) === "out_of_stock"
    );
    const attentionItems = inventoryItems.filter((item) => {
      const status = getInventoryComputedStatus(item);
      return (
        status === "out_of_stock" ||
        status === "low_stock" ||
        status === "manual_review" ||
        item.isLowStock ||
        item.needsReorder
      );
    });
    const reorderItems = inventoryItems.filter((item) => {
      const available = resolveInventoryAvailableQuantity(item);
      const threshold = resolveReorderThreshold(item);
      return available !== null && threshold !== null && available < threshold;
    });
    const countedItems = inventoryItems.filter(
      (item) =>
        item.inventoryTrackingEnabled && resolveInventoryAvailableQuantity(item) !== null
    );
    const uncountedItems = inventoryItems.filter(
      (item) =>
        item.inventoryTrackingEnabled && resolveInventoryAvailableQuantity(item) === null
    );
    const queueEntries = ((queueReviewItems || []) as Array<{
      id: string;
      status?: string;
      createdAt?: string;
    }>).map((item) => {
      const meta = getQueueItemDisplayMeta(item) as {
        title?: string;
        targetType?: string;
        targetId?: string;
        lastError?: string;
      };
      return {
        id: item.id,
        label: formatInventoryLabel(getQueueActionLabel(item)),
        detail: meta.lastError || meta.title || meta.targetType || "Queued portal work",
        value: getQueueStatusLabel(item.status),
        tone:
          item.status === SYNC_STATES.FAILED || item.status === SYNC_STATES.CONFLICT
            ? "danger"
            : "warning",
      } satisfies InventoryDrilldownEntry;
    });

    return {
      pricedStock: createInventoryEntries(pricedItems),
      products: createProductEntries(products),
      available: createInventoryEntries(availableItems),
      outOfStock: createInventoryEntries(outOfStockItems),
      queue: queueEntries,
      attention: createInventoryEntries(attentionItems),
      reorder: createInventoryEntries(reorderItems),
      counted: createInventoryEntries(countedItems),
      uncounted: createInventoryEntries(uncountedItems),
    };
  }, [createInventoryEntries, createProductEntries, inventoryItems, products, queueReviewItems]);

  const savePublishingStatus = useCallback(
    async (
      item: InventoryItem,
      publishingStatus: InventoryProductDraft["publishingStatus"],
      options: { confirm?: boolean; label?: string } = {}
    ) => {
      const product = resolveItemProduct(item);
      const productId = product?.id || item.product?.id || item.productId || "";
      if (!productId) {
        setFormError("This inventory row is not linked to a catalogue product.");
        return;
      }
      if (
        options.confirm &&
        typeof window !== "undefined" &&
        !window.confirm(`${options.label || "Update"} ${getInventoryProductName(item)}?`)
      ) {
        return;
      }

      clearMessages();
      setFormError("");
      setOpenActionsId("");
      await saveProductDetails(
        productId,
        {},
        {
          publishingStatus,
          isFeatured: publishingStatus === "archived" ? false : product?.isFeatured,
        }
      );
    },
    [clearMessages, resolveItemProduct, saveProductDetails]
  );

  useEffect(() => {
    setInventoryPage(0);
  }, [filters.search, filters.status, filters.supplierId]);

  useEffect(() => {
    const visibleIds = new Set(inventoryItems.map((item) => item.id));
    setSelectedItemIds((current) => {
      const next = new Set(Array.from(current).filter((itemId) => visibleIds.has(itemId)));
      return next.size === current.size ? current : next;
    });
  }, [inventoryItems]);

  useEffect(() => {
    if (inventoryPage > inventoryPageCount - 1) {
      setInventoryPage(inventoryPageCount - 1);
    }
  }, [inventoryPage, inventoryPageCount]);

  useEffect(() => {
    if (!detailModalOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeItemDetail();
      if (event.key === "ArrowLeft") navigateSelectedItem(-1);
      if (event.key === "ArrowRight") navigateSelectedItem(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeItemDetail, detailModalOpen, navigateSelectedItem]);

  useEffect(() => {
    if (!detailModalOpen || !canManageInventory || savingProduct) return undefined;
    const productId = selectedProduct?.id || selectedItem?.product?.id || selectedItem?.productId || "";
    if (!productId) return undefined;
    const draftKey = getProductDraftKey(productDraft);
    if (draftKey === productDraftSaveKeyRef.current) {
      return undefined;
    }
    if (!productDraft.name.trim() || (productDraft.price && Number.isNaN(Number(productDraft.price)))) {
      setProductAutosaveStatus("error");
      return undefined;
    }

    setProductAutosaveStatus("pending");
    const timeoutId = window.setTimeout(() => {
      setProductAutosaveStatus("saving");
      void saveProductDraft({ silent: true });
    }, 950);

    return () => window.clearTimeout(timeoutId);
  }, [
    canManageInventory,
    detailModalOpen,
    productDraft,
    saveProductDraft,
    savingProduct,
    selectedItem,
    selectedProduct,
  ]);

  useEffect(() => {
    if (!detailModalOpen || !canManageInventory || savingInventoryItem || !selectedItem || !stockDraft) {
      return undefined;
    }
    const draftKey = getStockDraftKey(stockDraft);
    if (draftKey === stockDraftSaveKeyRef.current) {
      return undefined;
    }
    const numberFields = [
      stockDraft.quantityOnHand,
      stockDraft.reservedQuantity,
      stockDraft.lowStockThreshold,
      stockDraft.reorderThreshold,
    ];
    if (numberFields.some((value) => !isWholeNumberDraft(value))) {
      setStockAutosaveStatus("error");
      return undefined;
    }
    const quantityOnHand =
      stockDraft.quantityOnHand === "" ? null : Number(stockDraft.quantityOnHand);
    const reservedQuantity =
      stockDraft.reservedQuantity === "" ? 0 : Number(stockDraft.reservedQuantity);
    if (quantityOnHand !== null && reservedQuantity > quantityOnHand) {
      setStockAutosaveStatus("error");
      return undefined;
    }

    setStockAutosaveStatus("pending");
    const timeoutId = window.setTimeout(() => {
      setStockAutosaveStatus("saving");
      void saveStockDraft({ silent: true });
    }, 950);

    return () => window.clearTimeout(timeoutId);
  }, [
    canManageInventory,
    detailModalOpen,
    saveStockDraft,
    savingInventoryItem,
    selectedItem,
    stockDraft,
  ]);

  return (
    <section className="stroane-inventory" aria-labelledby="stroane-inventory-title">
      <header className="stroane-inventory__head">
        <div>
          <span>Inventory hub</span>
          <h1 id="stroane-inventory-title">Inventory management</h1>
          <p>Product stock, availability, supplier coverage, and movement history.</p>
        </div>
        <div className="stroane-inventory__actions">
          <ERPPrimaryAction
            icon={<HiOutlineRefresh />}
            onClick={refreshInventory}
            disabled={refreshing}
            loading={refreshing}
            loadingLabel="Refreshing"
          >
          </ERPPrimaryAction>
          <ERPSecondaryAction
          type="button"
            icon={<HiOutlinePlus />}
            onClick={() => {
              setCreateDraft(EMPTY_PRODUCT_CREATE_DRAFT);
              setCreateProductOpen(true);
              setFormError("");
            }}
            disabled={!canManageInventory}
          >
            New product
          </ERPSecondaryAction>
        </div>
      </header>

      {!canManageInventory ? (
        <ERPFormNotice tone="warning" title="View-only access">
          This account can view inventory but cannot save changes.
        </ERPFormNotice>
      ) : null}

      {loadWarning ? (
        <ERPFormNotice
          tone="warning"
          title={isOnline ? "Partial inventory view" : "Offline inventory"}
          onDismiss={clearMessages}
        >
          {loadWarning}
        </ERPFormNotice>
      ) : null}

      {notice ? (
        <ERPFormNotice tone="success" title="Inventory update" onDismiss={clearMessages}>
          {notice}
        </ERPFormNotice>
      ) : null}

      {(error || formError) ? (
        <ERPFormNotice
          tone="danger"
          title="Inventory action"
          onDismiss={() => {
            setFormError("");
            clearMessages();
          }}
        >
          {formError || error}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-inventory__kpis" aria-label="Inventory summary">
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone="info"
          onClick={() =>
            openInventoryDrilldown(
              "Priced stock records",
              "Inventory rows currently contributing to stock value.",
              inventoryDrilldowns.pricedStock
            )
          }
        >
          <HiOutlineChartBar aria-hidden="true" />
          <span>Stock value</span>
          <strong>{formatInventoryMoney(analytics.totalStockValue)}</strong>
          <small>{analytics.pricedStockRecords} priced records · {analytics.pricedStockUnits} units</small>
        </button>
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone="info"
          onClick={() =>
            openInventoryDrilldown(
              "Catalogue products",
              "Products connected to the inventory management workspace.",
              inventoryDrilldowns.products
            )
          }
        >
          <HiOutlineShoppingBag aria-hidden="true" />
          <span>Products</span>
          <strong>{products.length}</strong>
          <small>{summary.activeProducts} active · {summary.draftProducts} draft</small>
        </button>
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone="success"
          onClick={() =>
            openInventoryDrilldown(
              "Available stock",
              "Inventory rows with a confirmed available quantity.",
              inventoryDrilldowns.available
            )
          }
        >
          <HiOutlineCheckCircle aria-hidden="true" />
          <span>Available units</span>
          <strong>{summary.availableUnits}</strong>
          <small>{summary.reservedUnits} reserved</small>
        </button>
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone={summary.outOfStockItems ? "danger" : "success"}
          onClick={() =>
            openInventoryDrilldown(
              "Out of stock",
              "Products that need restock before they can sell normally.",
              inventoryDrilldowns.outOfStock
            )
          }
        >
          <HiOutlineArchive aria-hidden="true" />
          <span>Out of stock</span>
          <strong>{summary.outOfStockItems}</strong>
          <small>{summary.lowStockItems} low stock</small>
        </button>
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone={queueCounts.reviewable ? "warning" : "success"}
          onClick={() =>
            openInventoryDrilldown(
              "Sync queue",
              "Offline or pending inventory work on this device.",
              inventoryDrilldowns.queue
            )
          }
        >
          <HiOutlineSwitchHorizontal aria-hidden="true" />
          <span>Sync queue</span>
          <strong>{queueCounts.reviewable}</strong>
          <small>{isOnline ? "Online" : "Offline"}{cachedAt ? ` · since ${formatInventoryDateTime(cachedAt)}` : ""}</small>
        </button>
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone={analytics.attentionItems ? "warning" : "success"}
          onClick={() =>
            openInventoryDrilldown(
              "Attention items",
              "Inventory records that need counting, restocking, or review.",
              inventoryDrilldowns.attention
            )
          }
        >
          <HiOutlineExclamationCircle aria-hidden="true" />
          <span>Attention items</span>
          <strong>{analytics.attentionItems}</strong>
          <small>{analytics.attentionPercent}% of stock records</small>
        </button>
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone={analytics.reorderUnits ? "warning" : "success"}
          onClick={() =>
            openInventoryDrilldown(
              "Reorder gap",
              "Products sitting below their reorder threshold.",
              inventoryDrilldowns.reorder
            )
          }
        >
          <HiOutlineTrendingUp aria-hidden="true" />
          <span>Reorder gap</span>
          <strong>{analytics.reorderUnits}</strong>
          <small>Units below reorder level</small>
        </button>
        <button
          type="button"
          className="bubble-card stroane-inventory__kpi-card"
          data-tone={summary.countedPercent >= 85 ? "success" : "warning"}
          onClick={() =>
            openInventoryDrilldown(
              summary.countedPercent >= 85 ? "Counted stock" : "Stock counts needed",
              "Tracked inventory records and their count status.",
              summary.countedPercent >= 85
                ? inventoryDrilldowns.counted
                : inventoryDrilldowns.uncounted
            )
          }
        >
          <HiOutlineDatabase aria-hidden="true" />
          <span>Counted stock</span>
          <strong>{summary.countedPercent}%</strong>
          <small>{analytics.countedItems} of {summary.trackedItems} tracked</small>
        </button>
      </section>

      <section className="stroane-inventory__analytics" aria-label="Stock analytics">
        <article className="glass-card stroane-inventory__analytics-card stroane-inventory__analytics-card--wide">
          <div className="stroane-inventory__analytics-head">
            <span>
              <HiOutlineChartPie aria-hidden="true" />
              Stock health
            </span>
            <h2>Status distribution</h2>
          </div>
          {summary.totalItems ? (
            <>
              <div className="stroane-inventory__status-stack" aria-hidden="true">
                {analytics.statusRows
                  .filter((row) => row.count > 0)
                  .map((row) => (
                    <span
                      key={row.id}
                      data-tone={row.tone}
                      style={getChartStyle(row.percent, row.color)}
                    />
                  ))}
              </div>
              <div className="stroane-inventory__bar-list">
                {analytics.statusRows.map((row) => (
                  <div className="stroane-inventory__bar-row" data-tone={row.tone} key={row.id}>
                    <span>
                      <strong>{row.label}</strong>
                      <small>{getPluralLabel(row.count, "item")}</small>
                    </span>
                    <div className="stroane-inventory__bar-track" aria-hidden="true">
                      <span style={getChartStyle(row.percent, row.color)} />
                    </div>
                    <strong>{row.percent}%</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="stroane-inventory__empty-text">No stock records available.</p>
          )}
        </article>

        <article className="glass-card stroane-inventory__analytics-card">
          <div className="stroane-inventory__analytics-head">
            <span>
              <HiOutlineDatabase aria-hidden="true" />
              Coverage
            </span>
            <h2>Stock confidence</h2>
          </div>
          <div className="stroane-inventory__ring-grid">
            {analytics.coverageMetrics.map((metric) => (
              <div className="stroane-inventory__ring-item" data-tone={metric.tone} key={metric.id}>
                <span
                  className="stroane-inventory__ring"
                  style={getRingStyle(metric.percent, metric.color)}
                >
                  <strong>{metric.value}</strong>
                </span>
                <span className="stroane-inventory_meta">
                  <strong>{metric.label}</strong>
                  <small>{metric.meta}</small>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card stroane-inventory__analytics-card">
          <div className="stroane-inventory__analytics-head">
            <span>
              <HiOutlineTag aria-hidden="true" />
              Categories
            </span>
            <h2>Stock mix</h2>
          </div>
          {analytics.categoryRows.length ? (
            <div className="stroane-inventory__rank-list">
              {analytics.categoryRows.map((row) => (
                <div className="stroane-inventory__rank-row" key={row.id}>
                  <span>
                    <strong>{row.label}</strong>
                    <small>
                      {formatInventoryNumber(row.units)} units · {row.attention} attention
                    </small>
                  </span>
                  <div className="stroane-inventory__bar-track" aria-hidden="true">
                    <span style={getChartStyle(row.percent, CHART_TONE_COLORS.info)} />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="stroane-inventory__empty-text">No category stock available.</p>
          )}
        </article>

        <article className="glass-card stroane-inventory__analytics-card">
          <div className="stroane-inventory__analytics-head">
            <span>
              <HiOutlineTruck aria-hidden="true" />
              Suppliers
            </span>
            <h2>Exposure</h2>
          </div>
          {analytics.supplierRows.length ? (
            <div className="stroane-inventory__rank-list">
              {analytics.supplierRows.map((row) => (
                <div className="stroane-inventory__rank-row" key={row.id}>
                  <span>
                    <strong>{row.label}</strong>
                    <small>
                      {getPluralLabel(row.count, "record")} · {row.attention} attention
                    </small>
                  </span>
                  <div className="stroane-inventory__bar-track" aria-hidden="true">
                    <span
                      style={getChartStyle(
                        row.percent,
                        row.attention ? CHART_TONE_COLORS.warning : CHART_TONE_COLORS.success
                      )}
                    />
                  </div>
                  <strong>{formatInventoryNumber(row.units)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="stroane-inventory__empty-text">No supplier stock available.</p>
          )}
        </article>

        <article className="glass-card stroane-inventory__analytics-card">
          <div className="stroane-inventory__analytics-head">
            <span>
              <HiOutlineChartBar aria-hidden="true" />
              Movements
            </span>
            <h2>Activity mix</h2>
          </div>
          {analytics.movementRows.length ? (
            <div className="stroane-inventory__rank-list">
              {analytics.movementRows.map((row) => (
                <div className="stroane-inventory__rank-row" key={row.id}>
                  <span>
                    <strong>{row.label}</strong>
                    <small>{formatInventoryNumber(row.units)} units moved</small>
                  </span>
                  <div className="stroane-inventory__bar-track" aria-hidden="true">
                    <span style={getChartStyle(row.percent, row.color)} />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="stroane-inventory__empty-text">No recent stock movements.</p>
          )}
        </article>

        <article className="glass-card stroane-inventory__analytics-card stroane-inventory__analytics-card--stock-depth">
          <div className="stroane-inventory__analytics-head">
            <span>
              <HiOutlineCube aria-hidden="true" />
              Stock depth
            </span>
            <h2>Highest available</h2>
          </div>
          {analytics.topStockRows.length ? (
            <div className="stroane-inventory__stock-rank-list">
              {analytics.topStockRows.map((row) => (
                <button
                  className="stroane-inventory__stock-rank"
                  key={row.id}
                  type="button"
                  onClick={() => openItemDetail(row.id)}
                >
                  <span>
                    <strong>{row.label}</strong>
                    <small>{row.sku || row.statusLabel}</small>
                  </span>
                  <div className="stroane-inventory__bar-track" aria-hidden="true">
                    <span style={getChartStyle(row.percent, CHART_TONE_COLORS.success)} />
                  </div>
                  <ERPStatusBadge tone={row.tone}>
                    {formatInventoryNumber(row.units)}
                  </ERPStatusBadge>
                </button>
              ))}
            </div>
          ) : (
            <p className="stroane-inventory__empty-text">No available stock records.</p>
          )}
        </article>
      </section>

      <section className="stroane-inventory__workspace">
        <div className="stroane-inventory__table-panel">
          <div className="stroane-inventory__table-head">
            <h2>Stock Table</h2>
          </div>
          <div className="stroane-inventory__toolbar">
            <div className="stroane-inventory__filters">
              <ERPTableSearch
                label="Search inventory"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Search product, SKU, supplier"
              />
              <SelectField
                label="Status"
                value={filters.status}
                onChangeValue={(value) => updateFilter("status", getSelectValue(value) as InventoryManagementFilters["status"])}
                options={STATUS_FILTERS}
              />
              <SelectField
                label="Supplier"
                value={filters.supplierId}
                onChangeValue={(value) => updateFilter("supplierId", getSelectValue(value))}
                options={[
                  { value: "", label: "All suppliers" },
                  ...suppliers.map((supplier) => ({
                    value: supplier.id,
                    label: supplier.name,
                  })),
                ]}
              />
              {(filters.search || filters.status !== "all" || filters.supplierId) ? (
                <ERPSecondaryAction
                  size="sm"
                  onClick={() => setFilters({
                    search: "",
                    status: "all",
                    supplierId: "",
                  })}
                >
                  Clear
                </ERPSecondaryAction>
              ) : null}
            </div>
          </div>

          {selectedItemIds.size ? (
            <div className="stroane-inventory__bulk-bar" role="region" aria-label="Bulk actions">
              <span>
                <strong>{selectedItemIds.size}</strong> selected
              </span>
              <ERPSecondaryAction
                size="sm"
                onClick={() => void runBulkProductAction("activate", "Activate")}
                disabled={!canManageInventory || savingProduct || !selectedBulkProductIds.length}
              >
                Make active
              </ERPSecondaryAction>
              <ERPSecondaryAction
                size="sm"
                onClick={() => void runBulkProductAction("draft", "Move to draft")}
                disabled={!canManageInventory || savingProduct || !selectedBulkProductIds.length}
              >
                Draft
              </ERPSecondaryAction>
              <ERPSecondaryAction
                size="sm"
                onClick={() => void runBulkProductAction("archive", "Archive", true)}
                disabled={!canManageInventory || savingProduct || !selectedBulkProductIds.length}
              >
                Archive
              </ERPSecondaryAction>
              <ERPDangerAction
                size="sm"
                onClick={() => void runBulkProductAction("delete_listing", "Delete listings", true)}
                disabled={!canManageInventory || savingProduct || !selectedBulkProductIds.length}
              >
                Delete
              </ERPDangerAction>
              <ERPSecondaryAction
                size="sm"
                onClick={() => setSelectedItemIds(new Set())}
                disabled={savingProduct}
              >
                Clear selection
              </ERPSecondaryAction>
            </div>
          ) : null}

          <InventoryStockTable
            loading={loading}
            error={error}
            filteredInventory={filteredInventory}
            paginatedInventory={paginatedInventory}
            selectedItemId={selectedItemId}
            selectedItemIds={selectedItemIds}
            openActionsId={openActionsId}
            canManageInventory={canManageInventory}
            savingProduct={savingProduct}
            pageStart={pageStart}
            pageEnd={pageEnd}
            pageIndex={clampedInventoryPage}
            pageCount={inventoryPageCount}
            paginatedStockValue={paginatedStockValue}
            resolveItemProduct={resolveItemProduct}
            getItemCategoryLabel={getItemCategoryLabel}
            getItemStockValue={getInventoryItemStockValue}
            formatMoney={formatInventoryMoney}
            toMoneyNumber={toMoneyNumber}
            onOpenItemDetail={openItemDetail}
            onToggleSelected={toggleSelectedItem}
            onTogglePageSelected={togglePageSelected}
            onToggleActions={(itemId) =>
              setOpenActionsId((current) => (current === itemId ? "" : itemId))
            }
            onSavePublishingStatus={savePublishingStatus}
            onPreviousPage={() => setInventoryPage((page) => Math.max(0, page - 1))}
            onNextPage={() =>
              setInventoryPage((page) => Math.min(inventoryPageCount - 1, page + 1))
            }
          />
        </div>

        <aside
          className={`stroane-inventory__side ${
            detailModalOpen && selectedItem ? "is-open" : ""
          }`}
          aria-hidden={!(detailModalOpen && selectedItem)}
        >
          <button
            type="button"
            className="stroane-inventory__lightbox-backdrop"
            aria-label="Close product management"
            onClick={closeItemDetail}
            tabIndex={detailModalOpen && selectedItem ? 0 : -1}
          />
          <div
            className="stroane-inventory__lightbox-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stroane-inventory-modal-title"
          >
            <div className="stroane-inventory__modal-bar">
              <button
                type="button"
                onClick={() => navigateSelectedItem(-1)}
                disabled={filteredInventory.length < 2}
                aria-label="Previous product"
              >
                <HiOutlineChevronLeft aria-hidden="true" />
              </button>
              <span>{selectedPositionLabel}</span>
              <button
                type="button"
                onClick={() => navigateSelectedItem(1)}
                disabled={filteredInventory.length < 2}
                aria-label="Next product"
              >
                <HiOutlineChevronRight aria-hidden="true" />
              </button>
              <strong>{modalAutosaveLabel}</strong>
              <button type="button" onClick={closeItemDetail} aria-label="Close">
                <HiOutlineX aria-hidden="true" />
              </button>
            </div>
          <div className="glass-card stroane-inventory__detail">
            {selectedItem ? (
              <>
                <div className="stroane-inventory__detail-head">
                  <div>
                    <span>Selected product</span>
                    <h2 id="stroane-inventory-modal-title">
                      {getInventoryProductName(selectedItem)}
                    </h2>
                    <small>
                      {[
                        getInventoryProductSku(selectedItem),
                        selectedItem.variantId
                          ? `Variant: ${getInventoryVariantLabel(selectedItem)}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    </small>
                  </div>
                  <ERPStatusBadge tone={getInventoryStatusTone(selectedStatus)}>
                    {formatInventoryStatusLabel(selectedStatus)}
                  </ERPStatusBadge>
                </div>

                <div className="stroane-inventory__mini-stats" aria-label="Selected stock summary">
                  <span>
                    <strong>{selectedAvailable === null ? "Not set" : selectedAvailable}</strong>
                    <small>Available</small>
                  </span>
                  <span>
                    <strong>{selectedOnHand === null ? "Not set" : selectedOnHand}</strong>
                    <small>On hand</small>
                  </span>
                  <span>
                    <strong>{selectedReserved}</strong>
                    <small>Reserved</small>
                  </span>
                  <span>
                    <strong>
                      {selectedStockValue === null
                        ? "Not set"
                        : formatInventoryMoney(selectedStockValue, selectedCurrency)}
                    </strong>
                    <small>Stock value</small>
                  </span>
                </div>

                {stockDraft ? (
                  <form className="stroane-inventory__form" onSubmit={handleStockSubmit}>
                    <div className="stroane-inventory__form-head">
                      <span>Stock controls</span>
                      <h3>Availability</h3>
                    </div>
                    <div className="stroane-inventory__field-grid">
                      <ERPTextField
                        label="Quantity on hand"
                        type="number"
                        min="0"
                        step="1"
                        value={stockDraft.quantityOnHand}
                        onChange={(event) =>
                          setStockDraft((current) =>
                            current ? { ...current, quantityOnHand: event.target.value } : current
                          )
                        }
                        disabled={!canManageInventory}
                      />
                      <ERPTextField
                        label="Reserved"
                        type="number"
                        min="0"
                        step="1"
                        value={stockDraft.reservedQuantity}
                        onChange={(event) =>
                          setStockDraft((current) =>
                            current ? { ...current, reservedQuantity: event.target.value } : current
                          )
                        }
                        disabled={!canManageInventory}
                      />
                      <ERPTextField
                        label="Low threshold"
                        type="number"
                        min="0"
                        step="1"
                        value={stockDraft.lowStockThreshold}
                        onChange={(event) =>
                          setStockDraft((current) =>
                            current ? { ...current, lowStockThreshold: event.target.value } : current
                          )
                        }
                        disabled={!canManageInventory}
                      />
                      <ERPTextField
                        label="Reorder threshold"
                        type="number"
                        min="0"
                        step="1"
                        value={stockDraft.reorderThreshold}
                        onChange={(event) =>
                          setStockDraft((current) =>
                            current ? { ...current, reorderThreshold: event.target.value } : current
                          )
                        }
                        disabled={!canManageInventory}
                      />
                      <SelectField
                        label="Stock status"
                        value={stockDraft.stockStatus}
                        onChangeValue={(value) =>
                          setStockDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  stockStatus: getSelectValue(value) as InventoryEditDraft["stockStatus"],
                                }
                              : current
                          )
                        }
                        disabled={!canManageInventory}
                        options={STOCK_STATUS_OPTIONS}
                      />
                      <SelectField
                        label="Supplier"
                        value={stockDraft.supplierId}
                        onChangeValue={(value) =>
                          setStockDraft((current) =>
                            current ? { ...current, supplierId: getSelectValue(value) } : current
                          )
                        }
                        disabled={!canManageInventory}
                        options={[
                          { value: "", label: "Unassigned" },
                          ...suppliers.map((supplier) => ({
                            value: supplier.id,
                            label: supplier.name,
                          })),
                        ]}
                      />
                      <ERPTextField
                        label="SKU"
                        value={stockDraft.sku}
                        onChange={(event) =>
                          setStockDraft((current) =>
                            current ? { ...current, sku: event.target.value } : current
                          )
                        }
                        disabled={!canManageInventory}
                      />
                      <ERPTextField
                        label="Last counted"
                        type="datetime-local"
                        value={stockDraft.lastCountedAt}
                        onChange={(event) =>
                          setStockDraft((current) =>
                            current ? { ...current, lastCountedAt: event.target.value } : current
                          )
                        }
                        disabled={!canManageInventory}
                      />
                    </div>
                    <div className="stroane-inventory__toggles">
                      <label>
                        <input
                          type="checkbox"
                          checked={stockDraft.inventoryTrackingEnabled}
                          onChange={(event) =>
                            setStockDraft((current) =>
                              current
                                ? { ...current, inventoryTrackingEnabled: event.target.checked }
                                : current
                            )
                          }
                          disabled={!canManageInventory}
                        />
                        <span>Track inventory</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={stockDraft.isPurchasable}
                          onChange={(event) =>
                            setStockDraft((current) =>
                              current ? { ...current, isPurchasable: event.target.checked } : current
                            )
                          }
                          disabled={!canManageInventory}
                        />
                        <span>Purchasable</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={stockDraft.allowBackorder}
                          onChange={(event) =>
                            setStockDraft((current) =>
                              current ? { ...current, allowBackorder: event.target.checked } : current
                            )
                          }
                          disabled={!canManageInventory}
                        />
                        <span>Backorders</span>
                      </label>
                    </div>
                    <ERPTextareaField
                      className="stroane-inventory__wide-field"
                      label="Notes"
                      value={stockDraft.notes}
                      onChange={(event) =>
                        setStockDraft((current) =>
                          current ? { ...current, notes: event.target.value } : current
                        )
                      }
                      disabled={!canManageInventory}
                    />
                    <div className="stroane-inventory__form-actions">
                      <ERPPrimaryAction
                        type="submit"
                        icon={<HiOutlineSave />}
                        loading={savingInventoryItem}
                        disabled={!canManageInventory}
                      >
                        Save stock
                      </ERPPrimaryAction>
                    </div>
                  </form>
                ) : null}
              </>
            ) : (
              <div className="stroane-inventory__empty-selection">
                <HiOutlineCube aria-hidden="true" />
                <strong>No inventory item selected</strong>
              </div>
            )}
          </div>

          {selectedItem ? (
            <div className="glass-card stroane-inventory__detail stroane-inventory__catalogue-detail">
              <form className="stroane-inventory__form" onSubmit={handleProductSubmit}>
                <div className="stroane-inventory__form-head">
                  <span>Product management</span>
                  <h3>Catalogue details</h3>
                </div>
                <div className="stroane-inventory__field-grid">
                  <ERPTextField
                    label="Name"
                    value={productDraft.name}
                    onChange={(event) =>
                      setProductDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    disabled={!canManageInventory || !selectedProductId}
                    required
                  />
                  <ERPTextField
                    label="Product SKU"
                    value={productDraft.sku}
                    onChange={(event) =>
                      setProductDraft((current) => ({ ...current, sku: event.target.value }))
                    }
                    disabled={!canManageInventory || !selectedProductId}
                  />
                  <ERPTextField
                    label="Price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productDraft.price}
                    onChange={(event) =>
                      setProductDraft((current) => ({ ...current, price: event.target.value }))
                    }
                    disabled={!canManageInventory || !selectedProductId}
                  />
                  <ERPTextField
                    label="Currency"
                    value={productDraft.currency}
                    maxLength={3}
                    onChange={(event) =>
                      setProductDraft((current) => ({
                        ...current,
                        currency: event.target.value.toUpperCase(),
                      }))
                    }
                    disabled={!canManageInventory || !selectedProductId}
                  />
                  <SelectField
                    label="Category"
                    value={productDraft.categorySlug}
                    onChangeValue={(value) =>
                      setProductDraft((current) => ({
                        ...current,
                        categorySlug: getSelectValue(value),
                      }))
                    }
                    disabled={!canManageInventory || !selectedProductId}
                    options={[
                      { value: "", label: "Unassigned" },
                      ...categories.map((category) => ({
                        value: category.slug,
                        label: category.name,
                      })),
                    ]}
                  />
                  <SelectField
                    label="Publishing"
                    value={productDraft.publishingStatus}
                    onChangeValue={(value) =>
                      setProductDraft((current) => ({
                        ...current,
                        publishingStatus: getSelectValue(
                          value
                        ) as InventoryProductDraft["publishingStatus"],
                      }))
                    }
                    disabled={!canManageInventory || !selectedProductId}
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "active", label: "Active" },
                      { value: "archived", label: "Archived" },
                    ]}
                  />
                </div>
                <div className="stroane-inventory__toggles">
                  <label>
                    <input
                      type="checkbox"
                      checked={productDraft.isFeatured}
                      onChange={(event) =>
                        setProductDraft((current) => ({
                          ...current,
                          isFeatured: event.target.checked,
                        }))
                      }
                      disabled={!canManageInventory || !selectedProductId}
                    />
                    <span>Featured product</span>
                  </label>
                </div>
                <ERPTextareaField
                  className="stroane-inventory__wide-field"
                  label="Short description"
                  value={productDraft.shortDescription}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      shortDescription: event.target.value,
                    }))
                  }
                  disabled={!canManageInventory || !selectedProductId}
                />
                <div className="stroane-inventory__form-actions">
                  <ERPPrimaryAction
                    type="submit"
                    icon={<HiOutlineSave />}
                    loading={savingProduct}
                    disabled={!canManageInventory || !selectedProductId}
                  >
                    Save product
                  </ERPPrimaryAction>
                </div>
              </form>
            </div>
          ) : null}

          {selectedItem ? (
            <div className="glass-card stroane-inventory__detail">
              <form className="stroane-inventory__form" onSubmit={handleMovementSubmit}>
                <div className="stroane-inventory__form-head">
                  <span>Stock movement</span>
                  <h3>Record activity</h3>
                </div>
                <div className="stroane-inventory__field-grid">
                  <SelectField
                    label="Movement type"
                    value={movementDraft.movementType}
                    onChangeValue={(value) =>
                      setMovementDraft((current) => ({
                        ...current,
                        movementType: getSelectValue(value) as InventoryMovementDraft["movementType"],
                      }))
                    }
                    disabled={!canManageInventory}
                    options={MOVEMENT_TYPE_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                  <ERPTextField
                    label="Quantity"
                    type="number"
                    step="1"
                    value={movementDraft.quantityDelta}
                    onChange={(event) =>
                      setMovementDraft((current) => ({
                        ...current,
                        quantityDelta: event.target.value,
                      }))
                    }
                    disabled={!canManageInventory}
                    required
                  />
                  <ERPTextField
                    label="Counted quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={movementDraft.quantityAfter}
                    onChange={(event) =>
                      setMovementDraft((current) => ({
                        ...current,
                        quantityAfter: event.target.value,
                      }))
                    }
                    disabled={!canManageInventory}
                  />
                </div>
                <ERPTextareaField
                  className="stroane-inventory__wide-field"
                  label="Reason"
                  value={movementDraft.reason}
                  onChange={(event) =>
                    setMovementDraft((current) => ({ ...current, reason: event.target.value }))
                  }
                  disabled={!canManageInventory}
                />
                <div className="stroane-inventory__form-actions">
                  <ERPPrimaryAction
                    type="submit"
                    icon={<HiOutlineClipboardList />}
                    loading={recordingMovement}
                    disabled={!canManageInventory}
                  >
                    Record movement
                  </ERPPrimaryAction>
                </div>
              </form>
            </div>
          ) : null}
          </div>
        </aside>
      </section>

      <ERPModal
        open={createProductOpen}
        title="New product"
        description="Create a catalogue product and its base inventory record."
        onClose={() => setCreateProductOpen(false)}
        closeOnBackdrop
        size="xl"
        className="stroane-inventory__create-modal"
      >
        <form className="stroane-inventory__form" onSubmit={handleCreateProductSubmit}>
          <div className="stroane-inventory__form-head">
            <span>Catalogue setup</span>
            <h3>Product details</h3>
          </div>
          <div className="stroane-inventory__field-grid">
            <ERPTextField
              label="Name"
              value={createDraft.name}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, name: event.target.value }))
              }
              disabled={!canManageInventory || savingProduct}
              required
            />
            <ERPTextField
              label="Product SKU"
              value={createDraft.sku}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, sku: event.target.value }))
              }
              disabled={!canManageInventory || savingProduct}
            />
            <ERPTextField
              label="Price"
              type="number"
              min="0"
              step="0.01"
              value={createDraft.price}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, price: event.target.value }))
              }
              disabled={!canManageInventory || savingProduct}
            />
            <ERPTextField
              label="Currency"
              value={createDraft.currency}
              maxLength={3}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  currency: event.target.value.toUpperCase(),
                }))
              }
              disabled={!canManageInventory || savingProduct}
            />
            <SelectField
              label="Category"
              value={createDraft.categorySlug}
              onChangeValue={(value) =>
                setCreateDraft((current) => ({
                  ...current,
                  categorySlug: getSelectValue(value),
                }))
              }
              disabled={!canManageInventory || savingProduct}
              options={[
                { value: "", label: "Unassigned" },
                ...categories.map((category) => ({
                  value: category.slug,
                  label: category.name,
                })),
              ]}
            />
            <SelectField
              label="Publishing"
              value={createDraft.publishingStatus}
              onChangeValue={(value) =>
                setCreateDraft((current) => ({
                  ...current,
                  publishingStatus: getSelectValue(value) as InventoryProductDraft["publishingStatus"],
                }))
              }
              disabled={!canManageInventory || savingProduct}
              options={[
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
              ]}
            />
          </div>
          <ERPTextareaField
            className="stroane-inventory__wide-field"
            label="Short description"
            value={createDraft.shortDescription}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                shortDescription: event.target.value,
              }))
            }
            disabled={!canManageInventory || savingProduct}
          />

          <div className="stroane-inventory__form-head">
            <span>Initial stock</span>
            <h3>Availability</h3>
          </div>
          <div className="stroane-inventory__field-grid">
            <ERPTextField
              label="Quantity on hand"
              type="number"
              min="0"
              step="1"
              value={createDraft.quantityOnHand}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  quantityOnHand: event.target.value,
                }))
              }
              disabled={!canManageInventory || savingProduct}
            />
            <ERPTextField
              label="Reserved"
              type="number"
              min="0"
              step="1"
              value={createDraft.reservedQuantity}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  reservedQuantity: event.target.value,
                }))
              }
              disabled={!canManageInventory || savingProduct}
            />
            <ERPTextField
              label="Low threshold"
              type="number"
              min="0"
              step="1"
              value={createDraft.lowStockThreshold}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  lowStockThreshold: event.target.value,
                }))
              }
              disabled={!canManageInventory || savingProduct}
            />
            <ERPTextField
              label="Reorder threshold"
              type="number"
              min="0"
              step="1"
              value={createDraft.reorderThreshold}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  reorderThreshold: event.target.value,
                }))
              }
              disabled={!canManageInventory || savingProduct}
            />
            <SelectField
              label="Stock status"
              value={createDraft.stockStatus}
              onChangeValue={(value) =>
                setCreateDraft((current) => ({
                  ...current,
                  stockStatus: getSelectValue(value) as InventoryEditDraft["stockStatus"],
                }))
              }
              disabled={!canManageInventory || savingProduct}
              options={STOCK_STATUS_OPTIONS}
            />
            <SelectField
              label="Supplier"
              value={createDraft.supplierId}
              onChangeValue={(value) =>
                setCreateDraft((current) => ({ ...current, supplierId: getSelectValue(value) }))
              }
              disabled={!canManageInventory || savingProduct}
              options={[
                { value: "", label: "Unassigned" },
                ...suppliers.map((supplier) => ({
                  value: supplier.id,
                  label: supplier.name,
                })),
              ]}
            />
          </div>
          <div className="stroane-inventory__toggles">
            <label>
              <input
                type="checkbox"
                checked={createDraft.inventoryTrackingEnabled}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    inventoryTrackingEnabled: event.target.checked,
                  }))
                }
                disabled={!canManageInventory || savingProduct}
              />
              <span>Track inventory</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={createDraft.isPurchasable}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    isPurchasable: event.target.checked,
                  }))
                }
                disabled={!canManageInventory || savingProduct}
              />
              <span>Purchasable</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={createDraft.allowBackorder}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    allowBackorder: event.target.checked,
                  }))
                }
                disabled={!canManageInventory || savingProduct}
              />
              <span>Backorders</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={createDraft.isFeatured}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    isFeatured: event.target.checked,
                  }))
                }
                disabled={!canManageInventory || savingProduct}
              />
              <span>Featured product</span>
            </label>
          </div>
          <ERPTextareaField
            className="stroane-inventory__wide-field"
            label="Stock notes"
            value={createDraft.notes}
            onChange={(event) =>
              setCreateDraft((current) => ({ ...current, notes: event.target.value }))
            }
            disabled={!canManageInventory || savingProduct}
          />
          <div className="stroane-inventory__form-actions">
            <ERPSecondaryAction
              type="button"
              onClick={() => setCreateProductOpen(false)}
              disabled={savingProduct}
            >
              Cancel
            </ERPSecondaryAction>
            <ERPPrimaryAction
              type="submit"
              icon={<HiOutlineSave />}
              loading={savingProduct}
              disabled={!canManageInventory}
            >
              Create product
            </ERPPrimaryAction>
          </div>
        </form>
      </ERPModal>

      <section className="stroane-inventory__lower-grid">
        <div className="glass-card stroane-inventory__detail stroane-inventory__legacy-product-detail">
          <form className="stroane-inventory__form" onSubmit={handleProductSubmit}>
            <div className="stroane-inventory__form-head">
              <span>Product management</span>
              <h3>Catalogue details</h3>
            </div>
            <div className="stroane-inventory__field-grid">
              <ERPTextField
                label="Name"
                value={productDraft.name}
                onChange={(event) =>
                  setProductDraft((current) => ({ ...current, name: event.target.value }))
                }
                disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
                required
              />
              <ERPTextField
                label="Product SKU"
                value={productDraft.sku}
                onChange={(event) =>
                  setProductDraft((current) => ({ ...current, sku: event.target.value }))
                }
                disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
              />
              <ERPTextField
                label="Price"
                type="number"
                min="0"
                step="0.01"
                value={productDraft.price}
                onChange={(event) =>
                  setProductDraft((current) => ({ ...current, price: event.target.value }))
                }
                disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
              />
              <ERPTextField
                label="Currency"
                value={productDraft.currency}
                maxLength={3}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
                disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
              />
              <SelectField
                label="Category"
                value={productDraft.categorySlug}
                onChangeValue={(value) =>
                  setProductDraft((current) => ({
                    ...current,
                    categorySlug: getSelectValue(value),
                  }))
                }
                disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
                options={[
                  { value: "", label: "Unassigned" },
                  ...categories.map((category) => ({
                    value: category.slug,
                    label: category.name,
                  })),
                ]}
              />
              <SelectField
                label="Publishing"
                value={productDraft.publishingStatus}
                onChangeValue={(value) =>
                  setProductDraft((current) => ({
                    ...current,
                    publishingStatus: getSelectValue(value) as InventoryProductDraft["publishingStatus"],
                  }))
                }
                disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "archived", label: "Archived" },
                ]}
              />
            </div>
            <div className="stroane-inventory__toggles">
              <label>
                <input
                  type="checkbox"
                  checked={productDraft.isFeatured}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      isFeatured: event.target.checked,
                    }))
                  }
                  disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
                />
                <span>Featured product</span>
              </label>
            </div>
            <ERPTextareaField
              className="stroane-inventory__wide-field"
              label="Short description"
              value={productDraft.shortDescription}
              onChange={(event) =>
                setProductDraft((current) => ({
                  ...current,
                  shortDescription: event.target.value,
                }))
              }
              disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
            />
            <div className="stroane-inventory__form-actions">
              <ERPPrimaryAction
                type="submit"
                icon={<HiOutlineSave />}
                loading={savingProduct}
                disabled={!canManageInventory || (!selectedProduct && !selectedItem?.product?.id)}
              >
                Save product
              </ERPPrimaryAction>
            </div>
          </form>
        </div>

        <div className="glass-card stroane-inventory__activity">
          <div className="stroane-inventory__panel-head">
            <div>
              <span>Recent movements</span>
              <h2>{selectedItem ? getInventoryProductName(selectedItem) : "Inventory activity"}</h2>
            </div>
          </div>
          {selectedMovements.length ? (
            <div className="stroane-inventory__activity-list">
              {selectedMovements.slice(0, 8).map((movement) => (
                <article key={movement.id}>
                  <span>
                    <strong>{formatMovementTypeLabel(movement.movementType)}</strong>
                    <small>{formatInventoryDateTime(movement.createdAt)}</small>
                  </span>
                  <span>
                    <ERPStatusBadge tone={movement.quantityDelta < 0 ? "warning" : "success"}>
                      {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}
                    </ERPStatusBadge>
                    <small>{movement.reason || movement.createdByName || "Inventory movement"}</small>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="stroane-inventory__empty-text">
              {selectedItem ? "No movement records for this product." : "Select a product to view movements."}
            </p>
          )}
        </div>

        <div className="glass-card stroane-inventory__sync">
          <div className="stroane-inventory__panel-head">
            <div>
              <span>Offline sync</span>
              <h2>Queue</h2>
            </div>
            <ERPStatusBadge tone={queueCounts.reviewable ? "warning" : "success"}>
              {queueCounts.reviewable} queued
            </ERPStatusBadge>
          </div>
          {queueError ? (
            <p className="stroane-inventory__sync-error">{queueError}</p>
          ) : null}
          {queueReviewItems.length ? (
            <div className="stroane-inventory__queue-list">
              {queueReviewItems.slice(0, 6).map((item) => {
                const meta = getQueueItemDisplayMeta(item);
                const canRetry = isOnline && item.status !== SYNC_STATES.SYNCING;
                return (
                  <article key={item.id}>
                    <div>
                      <strong>{formatInventoryLabel(getQueueActionLabel(item))}</strong>
                      <small>{meta.title || meta.targetId || "Queued inventory work"}</small>
                    </div>
                    <ERPStatusBadge tone={getQueueBadgeTone(item.status)}>
                      {getQueueStatusLabel(item.status)}
                    </ERPStatusBadge>
                    {meta.lastError ? <p>{meta.lastError}</p> : null}
                    <div className="stroane-inventory__queue-actions">
                      <ERPSecondaryAction
                        size="sm"
                        onClick={() => retryQueueItem(item)}
                        disabled={!canRetry || syncingQueueItemId === item.id || queueLoading}
                      >
                        {syncingQueueItemId === item.id ? "Syncing" : "Retry"}
                      </ERPSecondaryAction>
                      <ERPSecondaryAction
                        size="sm"
                        onClick={() => resolveQueueItem(item)}
                        disabled={syncingQueueItemId === item.id}
                      >
                        Resolve
                      </ERPSecondaryAction>
                      <ERPDangerAction
                        size="sm"
                        onClick={() => cancelQueueItem(item)}
                        disabled={syncingQueueItemId === item.id}
                      >
                        Cancel
                      </ERPDangerAction>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="stroane-inventory__sync-empty">
              <HiOutlineCheckCircle aria-hidden="true" />
              <span>
                <strong>No queued inventory work</strong>
                <small>{alerts.counts.total} active stock alert(s)</small>
              </span>
            </div>
          )}
        </div>
      </section>

      <ERPModal
        open={Boolean(drilldown)}
        title={drilldown?.title || "Inventory details"}
        description={drilldown?.description}
        onClose={() => setDrilldown(null)}
        closeOnBackdrop
        size="lg"
        className="stroane-inventory__drilldown-modal"
      >
        {drilldown?.entries.length ? (
          <div className="stroane-inventory__drilldown-list">
            {drilldown.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="stroane-inventory__drilldown-item"
                data-tone={entry.tone || "neutral"}
                onClick={entry.onSelect}
                disabled={!entry.onSelect}
              >
                <span>
                  <strong>{entry.label}</strong>
                  <small>{entry.detail}</small>
                </span>
                {entry.value !== undefined ? (
                  <ERPStatusBadge tone={entry.tone || "neutral"}>{entry.value}</ERPStatusBadge>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="stroane-inventory__empty-text">No matching records right now.</p>
        )}
      </ERPModal>
    </section>
  );
};

const InventoryManagement: React.FC = () => (
  <InventoryManagementProvider>
    <InventoryManagementContent />
  </InventoryManagementProvider>
);

export default InventoryManagement;
