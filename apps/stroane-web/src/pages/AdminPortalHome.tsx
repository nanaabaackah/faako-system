import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineArchive,
  HiOutlineBell,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineExclamation,
  HiOutlineLockClosed,
  HiOutlineOfficeBuilding,
  HiOutlineRefresh,
  HiOutlineShoppingBag,
  HiOutlineXCircle,
} from "react-icons/hi";
import { Link } from "react-router-dom";
import {
  ERPFormNotice,
  ERPSecondaryAction,
  ERPStatusBadge,
} from "@faako/ui";
import {
  adminInventoryApi,
  type InventoryAlertSummary,
  type InventoryItem,
  type InventoryMovement,
  type SupplierSummary,
} from "../api/adminInventory";
import { adminProductsApi, type AdminProduct } from "../api/adminProducts";
import { portalUrl } from "../config/appSurface";
import { useAdminPortal } from "../context/AdminPortalContext";
import useSEOMeta from "../hooks/useSEOMeta";
import "../styles/pages/AdminPortal.css";

const EMPTY_ALERT_SUMMARY: InventoryAlertSummary = {
  active: [],
  recentDispatches: [],
  counts: {
    lowStock: 0,
    outOfStock: 0,
    total: 0,
  },
};

const formatLabel = (value = "") =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getProductName = (item: InventoryItem) => item.product?.name || formatLabel(item.productSlug);

const getStockTone = (item: InventoryItem) => {
  if (item.computedStockStatus === "out_of_stock") return "danger";
  if (item.isLowStock || item.needsReorder) return "warning";
  return "neutral";
};

const isAttentionItem = (item: InventoryItem) =>
  item.isLowStock ||
  item.needsReorder ||
  ["out_of_stock", "unavailable", "manual_review"].includes(item.computedStockStatus);

const calculatePercentage = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

const AdminPortalHome: React.FC = () => {
  const { session } = useAdminPortal();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlertSummary>(EMPTY_ALERT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loadWarning, setLoadWarning] = useState("");

  useSEOMeta({
    title: "Operations portal | Stroane",
    description: "Private Stroane operations overview.",
    canonical: portalUrl("/admin"),
    noIndex: true,
  });

  const loadOverview = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setLoadWarning("");

    const [inventoryResult, supplierResult, movementResult, alertResult, productResult] =
      await Promise.allSettled([
        adminInventoryApi.listInventory(session, { limit: 100 }),
        adminInventoryApi.listSuppliers(session),
        adminInventoryApi.listMovements(session, { limit: 8 }),
        adminInventoryApi.getAlertSummary(session),
        adminProductsApi.listProducts(session, { limit: 200 }),
      ]);

    if (inventoryResult.status === "fulfilled") setInventory(inventoryResult.value);
    if (supplierResult.status === "fulfilled") setSuppliers(supplierResult.value);
    if (movementResult.status === "fulfilled") setMovements(movementResult.value);
    if (alertResult.status === "fulfilled") setAlerts(alertResult.value);
    if (productResult.status === "fulfilled") setProducts(productResult.value.products);

    const failedLoads = [
      inventoryResult,
      supplierResult,
      movementResult,
      alertResult,
      productResult,
    ].filter((result) => result.status === "rejected").length;

    if (failedLoads) {
      setLoadWarning(
        failedLoads === 5
          ? "Operational data is temporarily unavailable. Check the API connection and try again."
          : "Some operational data could not be refreshed. Available portal data is shown below."
      );
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const attentionItems = useMemo(
    () =>
      inventory
        .filter(isAttentionItem)
        .sort((left, right) => {
          const leftOut = left.computedStockStatus === "out_of_stock" ? 1 : 0;
          const rightOut = right.computedStockStatus === "out_of_stock" ? 1 : 0;
          if (leftOut !== rightOut) return rightOut - leftOut;
          return (left.availableQuantity ?? Number.MAX_SAFE_INTEGER) -
            (right.availableQuantity ?? Number.MAX_SAFE_INTEGER);
        })
        .slice(0, 6),
    [inventory]
  );

  const summary = useMemo(
    () => {
      const trackedItems = inventory.filter((item) => item.inventoryTrackingEnabled).length;
      const countedStockItems = inventory.filter(
        (item) => item.inventoryTrackingEnabled && item.availableQuantity != null
      ).length;
      const availableUnits = inventory.reduce(
        (total, item) => total + (item.availableQuantity == null ? 0 : item.availableQuantity),
        0
      );
      const reservedUnits = inventory.reduce(
        (total, item) => total + (item.reservedQuantity || 0),
        0
      );
      const activeProducts = products.filter(
        (product) => product.publishingStatus === "active"
      ).length;
      const draftProducts = products.filter(
        (product) => product.publishingStatus === "draft"
      ).length;
      const linkedProducts = products.filter(
        (product) => product.preferredSupplier || product.supplierLinks.length
      ).length;
      const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active").length;
      const lowStockItems = inventory.filter(
        (item) => item.computedStockStatus !== "out_of_stock" && (item.isLowStock || item.needsReorder)
      ).length;
      const outOfStockItems = inventory.filter(
        (item) => item.computedStockStatus === "out_of_stock"
      ).length;

      return {
        trackedItems,
        countedStockItems,
        availableUnits,
        reservedUnits,
        products: products.length,
        activeProducts,
        draftProducts,
        linkedProducts,
        activeSuppliers,
        suppliers: suppliers.length,
        lowStockItems: Math.max(alerts.counts.lowStock, lowStockItems),
        outOfStockItems: Math.max(alerts.counts.outOfStock, outOfStockItems),
      };
    },
    [alerts.counts.lowStock, alerts.counts.outOfStock, inventory, products, suppliers]
  );

  const dashboardKpis = useMemo(
    () => [
      {
        label: "Catalogue products",
        value: summary.products,
        detail: `${summary.activeProducts} published`,
        to: "/admin/products",
        tone: "accent",
        icon: <HiOutlineShoppingBag aria-hidden="true" />,
      },
      {
        label: "Tracked stock",
        value: summary.trackedItems,
        detail: `${inventory.length} inventory records`,
        to: "/admin/inventory",
        tone: "neutral",
        icon: <HiOutlineCube aria-hidden="true" />,
      },
      {
        label: "Available units",
        value: summary.countedStockItems ? summary.availableUnits : "Not set",
        detail: summary.countedStockItems
          ? `${summary.countedStockItems} of ${summary.trackedItems} counts recorded`
          : summary.trackedItems
            ? `${summary.trackedItems} stock counts awaiting entry`
            : "No inventory records yet",
        to: "/admin/inventory",
        tone: "success",
        icon: <HiOutlineCheckCircle aria-hidden="true" />,
      },
      {
        label: "Reserved units",
        value: summary.reservedUnits,
        detail: "Held from available stock",
        to: "/admin/inventory",
        tone: "neutral",
        icon: <HiOutlineLockClosed aria-hidden="true" />,
      },
      {
        label: "Low stock",
        value: summary.lowStockItems,
        detail: "Reorder threshold reached",
        to: "/admin/inventory",
        tone: summary.lowStockItems ? "warning" : "success",
        icon: <HiOutlineExclamation aria-hidden="true" />,
      },
      {
        label: "Out of stock",
        value: summary.outOfStockItems,
        detail: summary.outOfStockItems ? "Restock required" : "No blocked stock",
        to: "/admin/inventory",
        tone: summary.outOfStockItems ? "danger" : "success",
        icon: <HiOutlineXCircle aria-hidden="true" />,
      },
      {
        label: "Draft products",
        value: summary.draftProducts,
        detail: "Awaiting publication",
        to: "/admin/products",
        tone: "neutral",
        icon: <HiOutlineArchive aria-hidden="true" />,
      },
      {
        label: "Active suppliers",
        value: summary.activeSuppliers,
        detail: `${summary.suppliers} supplier records`,
        to: "/admin/suppliers",
        tone: "accent",
        icon: <HiOutlineOfficeBuilding aria-hidden="true" />,
      },
    ],
    [inventory.length, summary]
  );

  const readiness = useMemo(
    () => [
      {
        label: "Published catalogue",
        value: calculatePercentage(summary.activeProducts, summary.products),
        detail: `${summary.activeProducts} of ${summary.products} products active`,
      },
      {
        label: "Stock tracking",
        value: calculatePercentage(summary.trackedItems, summary.products),
        detail: `${summary.trackedItems} of ${summary.products} products tracked`,
      },
      {
        label: "Supplier coverage",
        value: calculatePercentage(summary.linkedProducts, summary.products),
        detail: `${summary.linkedProducts} of ${summary.products} products linked`,
      },
    ],
    [summary]
  );

  if (!session) return null;

  return (
    <section className="stroane-portal-overview">
      <header className="stroane-portal-overview__head">
        <div>
          <span>Internal operations</span>
          <h1>Good to see you, {session.username}</h1>
          <p>Monitor the catalogue, stock posture, and supplier coverage before moving into the relevant workspace.</p>
        </div>
        <ERPSecondaryAction
          icon={<HiOutlineRefresh />}
          onClick={loadOverview}
          disabled={loading}
        >
          {loading ? "Refreshing" : "Refresh"}
        </ERPSecondaryAction>
      </header>

      {loadWarning ? (
        <ERPFormNotice tone="warning" title="Partial operational view">
          {loadWarning}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-portal-overview__kpis" aria-label="Operations key performance indicators">
        {dashboardKpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.to} data-tone={kpi.tone}>
            <span>{kpi.icon}</span>
            <small>{kpi.label}</small>
            <strong>{kpi.value}</strong>
            <em>{kpi.detail}</em>
          </Link>
        ))}
      </section>

      <section className="stroane-portal-overview__readiness" aria-labelledby="stroane-readiness-title">
        <header>
          <span>Operational readiness</span>
          <h2 id="stroane-readiness-title">Catalogue coverage</h2>
        </header>
        <div>
          {readiness.map((item) => (
            <article key={item.label}>
              <span>
                <strong>{item.label}</strong>
                <small>{item.value}%</small>
              </span>
              <i
                role="progressbar"
                aria-label={item.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.value}
              >
                <b style={{ width: `${item.value}%` }} />
              </i>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="stroane-portal-overview__grid">
        <section className="stroane-portal-overview__panel">
          <div className="stroane-portal-overview__panel-head">
            <div>
              <span><HiOutlineBell aria-hidden="true" /> Stock attention</span>
              <h2>{alerts.counts.total || attentionItems.length} item(s) need a closer look</h2>
            </div>
            <Link to="/admin/inventory">Open inventory</Link>
          </div>
          {attentionItems.length ? (
            <div className="stroane-portal-overview__attention-list">
              {attentionItems.map((item) => (
                <Link key={item.id} to="/admin/inventory">
                  <span>
                    <strong>{getProductName(item)}</strong>
                    <small>{item.sku || item.productSlug}</small>
                  </span>
                  <span>
                    <ERPStatusBadge tone={getStockTone(item)}>
                      {formatLabel(item.computedStockStatus)}
                    </ERPStatusBadge>
                    <small>
                      {item.availableQuantity == null
                        ? "Quantity not confirmed"
                        : `${item.availableQuantity} available`}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="stroane-portal-overview__empty">
              {loading ? "Checking inventory signals..." : "No tracked stock warnings right now."}
            </p>
          )}
        </section>

        <section className="stroane-portal-overview__panel">
          <div className="stroane-portal-overview__panel-head">
            <div>
              <span><HiOutlineClipboardList aria-hidden="true" /> Recent activity</span>
              <h2>Latest inventory movements</h2>
            </div>
            <Link to="/admin/inventory">View history</Link>
          </div>
          {movements.length ? (
            <div className="stroane-portal-overview__activity-list">
              {movements.slice(0, 6).map((movement) => (
                <div key={movement.id}>
                  <span>
                    <strong>{formatLabel(movement.productSlug)}</strong>
                    <small>{formatDateTime(movement.createdAt)}</small>
                  </span>
                  <span>
                    <ERPStatusBadge tone={movement.quantityDelta < 0 ? "warning" : "success"}>
                      {formatLabel(movement.movementType)}
                    </ERPStatusBadge>
                    <small>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta} units</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="stroane-portal-overview__empty">
              {loading ? "Loading recent movements..." : "No inventory movements have been recorded yet."}
            </p>
          )}
        </section>
      </div>

      <section className="stroane-portal-overview__workspaces" aria-labelledby="stroane-workspaces-title">
        <header>
          <span>Workspaces</span>
          <h2 id="stroane-workspaces-title">Move the work forward</h2>
        </header>
        <div className="stroane-portal-overview__links">
          <Link to="/admin/inventory">
            <HiOutlineCube aria-hidden="true" />
            <span><strong>Inventory</strong><small>Review stock levels and record movements</small></span>
          </Link>
          <Link to="/admin/suppliers">
            <HiOutlineOfficeBuilding aria-hidden="true" />
            <span><strong>Suppliers</strong><small>Check contacts and linked catalogue products</small></span>
          </Link>
          <Link to="/admin/products">
            <HiOutlineShoppingBag aria-hidden="true" />
            <span><strong>Products</strong><small>Prepare catalogue media and publishing state</small></span>
          </Link>
          <Link to="/admin/operations">
            <HiOutlineClipboardList aria-hidden="true" />
            <span><strong>Operations</strong><small>Review lightweight order operations</small></span>
          </Link>
        </div>
      </section>
    </section>
  );
};

export default AdminPortalHome;
