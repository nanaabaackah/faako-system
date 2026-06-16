import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiOutlineArchive,
  HiOutlineChartBar,
  HiOutlineChartPie,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineDatabase,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineShoppingBag,
  HiOutlineSwitchHorizontal,
  HiOutlineTag,
  HiOutlineTrendingUp,
  HiOutlineTruck,
} from "react-icons/hi";
import {
  ERPFormNotice,
  ERPDangerAction,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPStatusBadge,
  ERPTable,
  ERPTableSearch,
  ERPTextareaField,
  ERPTextField,
  SelectField,
  type ERPTableColumn,
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

const getSelectValue = (value: string | string[]) => (Array.isArray(value) ? value[0] || "" : value);

type InventoryAnalyticsTone = "success" | "warning" | "danger" | "neutral" | "info";

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

const getPluralLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${formatInventoryNumber(count)} ${count === 1 ? singular : plural}`;

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
    resolveQueueItem,
    syncingQueueItemId,
  } = inventoryState;

  const [stockDraft, setStockDraft] = useState<InventoryEditDraft | null>(null);
  const [movementDraft, setMovementDraft] = useState<InventoryMovementDraft>(EMPTY_MOVEMENT_DRAFT);
  const [productDraft, setProductDraft] = useState<InventoryProductDraft>(
    buildProductDraft(null, null)
  );
  const [formError, setFormError] = useState("");

  useSEOMeta({
    title: "Inventory management | Stroane operations",
    description: "Manage Stroane product stock, inventory movements, and catalogue availability.",
    canonical: portalUrl("/admin/inventory"),
    noIndex: true,
  });

  useEffect(() => {
    if (!selectedItem) {
      setStockDraft(null);
      setProductDraft(buildProductDraft(null, null));
      return;
    }
    setStockDraft(buildInventoryEditDraft(selectedItem));
    setMovementDraft(EMPTY_MOVEMENT_DRAFT);
    setProductDraft(buildProductDraft(selectedProduct, selectedItem));
    setFormError("");
  }, [selectedItem, selectedProduct]);

  const columns = useMemo<Array<ERPTableColumn<InventoryItem>>>(
    () => [
      {
        id: "product",
        header: "Product",
        width: "32%",
        mobileLabel: "Product",
        render: (item) => (
          <span className="stroane-inventory__product-cell">
            <strong>{getInventoryProductName(item)}</strong>
            {item.variantId ? <small>Variant: {getInventoryVariantLabel(item)}</small> : null}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        mobileLabel: "Status",
        render: (item) => {
          const status = getInventoryComputedStatus(item);
          return (
            <ERPStatusBadge tone={getInventoryStatusTone(status)}>
              {formatInventoryStatusLabel(status)}
            </ERPStatusBadge>
          );
        },
      },
      {
        id: "quantities",
        header: "Stock",
        mobileLabel: "Stock",
        render: (item) => {
          const available = resolveInventoryAvailableQuantity(item);
          return (
            <span className="stroane-inventory__quantity-cell">
              <strong>{available === null ? "Not set" : `${available}`}</strong>
            </span>
          );
        },
      },
      {
        id: "supplier",
        header: "Supplier",
        mobileLabel: "Supplier",
        render: (item) => item.supplier?.name || "Unassigned",
      },
      {
        id: "updated",
        header: "Updated",
        mobileLabel: "Updated",
        render: (item) => formatInventoryDateTime(item.updatedAt),
      },
    ],
    []
  );

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

    const stockRows = inventoryItems.map((item) => {
      const status = getInventoryComputedStatus(item);
      const available = resolveInventoryAvailableQuantity(item);
      const availableUnits = available ?? 0;
      const reorderThreshold = resolveReorderThreshold(item);
      const product =
        (item.productId ? productsById.get(item.productId) : undefined) ||
        productsBySlug.get(item.productSlug);
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
      reorderUnits,
      statusRows,
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

  const handleStockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      return;
    }

    const quantityOnHand = stockDraft.quantityOnHand === "" ? null : Number(stockDraft.quantityOnHand);
    const reservedQuantity = stockDraft.reservedQuantity === "" ? 0 : Number(stockDraft.reservedQuantity);
    if (quantityOnHand !== null && reservedQuantity > quantityOnHand) {
      setFormError("Reserved quantity cannot exceed quantity on hand.");
      return;
    }

    await saveInventoryItem(selectedItem, buildInventoryPatchFromDraft(stockDraft));
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

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const productId = selectedProduct?.id || selectedItem?.product?.id || "";
    if (!productId) return;

    clearMessages();
    setFormError("");
    if (!productDraft.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (productDraft.price && Number.isNaN(Number(productDraft.price))) {
      setFormError("Product price must be a valid number.");
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
      }
    );
  };

  const tableState = loading
    ? "loading"
    : error && !filteredInventory.length
      ? "error"
      : filteredInventory.length
        ? "ready"
        : "empty";

  return (
    <section className="stroane-inventory" aria-labelledby="stroane-inventory-title">
      <header className="stroane-inventory__head">
        <div>
          <span>Inventory hub</span>
          <h1 id="stroane-inventory-title">Inventory management</h1>
          <p>Product stock, availability, supplier coverage, and movement history.</p>
        </div>
        <ERPSecondaryAction
          icon={<HiOutlineRefresh />}
          onClick={refreshInventory}
          disabled={refreshing}
          loading={refreshing}
          loadingLabel="Refreshing"
        >
          Refresh
        </ERPSecondaryAction>
      </header>

      {!canManageInventory ? (
        <ERPFormNotice tone="warning" title="View-only access">
          This account can view inventory but cannot save changes.
        </ERPFormNotice>
      ) : null}

      {loadWarning ? (
        <ERPFormNotice tone="warning" title={isOnline ? "Partial inventory view" : "Offline inventory"}>
          {loadWarning}
        </ERPFormNotice>
      ) : null}

      {notice ? (
        <ERPFormNotice tone="success" title="Inventory update">
          {notice}
        </ERPFormNotice>
      ) : null}

      {(error || formError) ? (
        <ERPFormNotice tone="danger" title="Inventory action">
          {formError || error}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-inventory__kpis" aria-label="Inventory summary">
        <article className="bubble-card" data-tone="info">
          <HiOutlineShoppingBag aria-hidden="true" />
          <span>Products</span>
          <strong>{products.length}</strong>
          <small>{summary.activeProducts} active · {summary.draftProducts} draft</small>
        </article>
        <article className="bubble-card" data-tone="success">
          <HiOutlineCheckCircle aria-hidden="true" />
          <span>Available units</span>
          <strong>{summary.availableUnits}</strong>
          <small>{summary.reservedUnits} reserved</small>
        </article>
        <article className="bubble-card" data-tone={summary.outOfStockItems ? "danger" : "success"}>
          <HiOutlineArchive aria-hidden="true" />
          <span>Out of stock</span>
          <strong>{summary.outOfStockItems}</strong>
          <small>{summary.lowStockItems} low stock</small>
        </article>
        <article className="bubble-card" data-tone={queueCounts.reviewable ? "warning" : "success"}>
          <HiOutlineSwitchHorizontal aria-hidden="true" />
          <span>Sync queue</span>
          <strong>{queueCounts.reviewable}</strong>
          <small>{isOnline ? "Online" : "Offline"}{cachedAt ? ` · since ${formatInventoryDateTime(cachedAt)}` : ""}</small>
        </article>
        <article className="bubble-card" data-tone={analytics.attentionItems ? "warning" : "success"}>
          <HiOutlineExclamationCircle aria-hidden="true" />
          <span>Attention items</span>
          <strong>{analytics.attentionItems}</strong>
          <small>{analytics.attentionPercent}% of stock records</small>
        </article>
        <article className="bubble-card" data-tone={analytics.reorderUnits ? "warning" : "success"}>
          <HiOutlineTrendingUp aria-hidden="true" />
          <span>Reorder gap</span>
          <strong>{analytics.reorderUnits}</strong>
          <small>Units below reorder level</small>
        </article>
        <article className="bubble-card" data-tone={summary.countedPercent >= 85 ? "success" : "warning"}>
          <HiOutlineDatabase aria-hidden="true" />
          <span>Counted stock</span>
          <strong>{summary.countedPercent}%</strong>
          <small>{analytics.countedItems} of {summary.trackedItems} tracked</small>
        </article>
        <article className="bubble-card" data-tone={summary.supplierCoveragePercent >= 85 ? "success" : "info"}>
          <HiOutlineTruck aria-hidden="true" />
          <span>Supplier cover</span>
          <strong>{summary.supplierCoveragePercent}%</strong>
          <small>{summary.supplierLinkedItems} linked items</small>
        </article>
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

        <article className="glass-card stroane-inventory__analytics-card">
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
                  onClick={() => selectItem(row.id)}
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

          <ERPTable
            className="stroane-inventory__table"
            columns={columns}
            rows={filteredInventory}
            rowKey="id"
            state={tableState}
            loadingMessage="Loading inventory..."
            emptyTitle="No inventory records"
            emptyMessage="No products match the current filters."
            errorMessage={error || "Unable to load inventory."}
            dense
            mobileMode="cards"
            rowClassName={(item) => (item.id === selectedItemId ? "is-selected" : "")}
            getRowProps={(item) => ({
              onClick: () => selectItem(item.id),
              tabIndex: 0,
              onKeyDown: (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectItem(item.id);
                }
              },
            })}
          />
        </div>

        <aside className="stroane-inventory__side">
          <div className="glass-card stroane-inventory__detail">
            {selectedItem ? (
              <>
                <div className="stroane-inventory__detail-head">
                  <div>
                    <span>Selected product</span>
                    <h2>{getInventoryProductName(selectedItem)}</h2>
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
        </aside>
      </section>

      <section className="stroane-inventory__lower-grid">
        <div className="glass-card stroane-inventory__detail">
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
    </section>
  );
};

const InventoryManagement: React.FC = () => (
  <InventoryManagementProvider>
    <InventoryManagementContent />
  </InventoryManagementProvider>
);

export default InventoryManagement;
