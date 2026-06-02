import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineAdjustments,
  HiOutlineBell,
  HiOutlineCube,
  HiOutlineExclamation,
  HiOutlineOfficeBuilding,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineX,
} from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { AnimatedLoadingState } from "@faako/ui";
import {
  adminInventoryApi,
  type InventoryItem,
  type InventoryAlertSummary,
  type InventoryMovement,
  type SupplierDetail,
  type SupplierSummary,
} from "../api/adminInventory";
import { useAdminPortal } from "../context/AdminPortalContext";
import useSEOMeta from "../hooks/useSEOMeta";
import { portalUrl } from "../config/appSurface";
import "../styles/pages/AdminInventory.css";

type AdminInventoryTab = "inventory" | "suppliers" | "activity";
type InventorySort = "product" | "available" | "reserved" | "reorder" | "updated";

const STOCK_STATUS_OPTIONS = [
  { value: "", label: "All stock statuses" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "preorder", label: "Preorder" },
  { value: "unavailable", label: "Unavailable" },
  { value: "manual_review", label: "Manual review" },
];

const MOVEMENT_TYPE_OPTIONS = [
  { value: "RESTOCK", label: "Restock entry" },
  { value: "ADJUSTMENT", label: "Manual adjustment" },
  { value: "DAMAGE", label: "Damage adjustment" },
  { value: "MANUAL_CORRECTION", label: "Manual correction" },
  { value: "RESERVED", label: "Reserve quantity" },
  { value: "RELEASED", label: "Release reserved quantity" },
];

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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const displayQuantity = (value?: number | null) => (value == null ? "Not set" : value);

const getStockBadgeClass = (status = "") =>
  `admin-inventory-badge admin-inventory-badge--${status.replace(/_/g, "-") || "neutral"}`;

const getMovementBadgeClass = (type = "") =>
  `admin-inventory-badge admin-inventory-badge--movement-${type.toLowerCase().replace(/_/g, "-")}`;

const getProductName = (item: InventoryItem) => item.product?.name || formatLabel(item.productSlug);

const calculateMovementPreview = (item: InventoryItem, type: string, quantity: number) => {
  const available = item.availableQuantity ?? 0;
  const magnitude = Math.abs(quantity);

  if (type === "RESTOCK" || type === "RELEASED") return available + magnitude;
  if (type === "DAMAGE" || type === "RESERVED") return available - magnitude;
  return available + quantity;
};

const AdminInventory: React.FC<{ initialTab?: AdminInventoryTab }> = ({
  initialTab = "inventory",
}) => {
  const navigate = useNavigate();
  const { session } = useAdminPortal();
  const [activeTab, setActiveTab] = useState<AdminInventoryTab>(initialTab);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDetail | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortBy, setSortBy] = useState<InventorySort>("updated");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [alertSummary, setAlertSummary] = useState<InventoryAlertSummary>(EMPTY_ALERT_SUMMARY);
  const [alertStatus, setAlertStatus] = useState("");
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementDraft, setMovementDraft] = useState({
    movementType: "RESTOCK",
    quantityDelta: "1",
    reason: "",
    supplierNote: "",
    purchaseNote: "",
  });

  const isAdmin = session?.role === "ADMIN";

  useSEOMeta({
    title: "Inventory operations | Stroane",
    description: "Private Stroane inventory and supplier operations.",
    canonical: portalUrl("/admin/inventory"),
    noIndex: true,
  });

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [nextInventory, nextSuppliers, nextMovements] = await Promise.all([
        adminInventoryApi.listInventory(session, { limit: 100 }),
        adminInventoryApi.listSuppliers(session),
        adminInventoryApi.listMovements(session, { limit: 60 }),
      ]);
      setInventory(nextInventory);
      setSuppliers(nextSuppliers);
      setMovements(nextMovements);
      try {
        setAlertSummary(await adminInventoryApi.getAlertSummary(session));
        setAlertStatus("");
      } catch {
        setAlertSummary(EMPTY_ALERT_SUMMARY);
        setAlertStatus("Inventory alert status is temporarily unavailable.");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const filteredInventory = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...inventory]
      .filter((item) => {
        const matchesSearch =
          !query ||
          getProductName(item).toLowerCase().includes(query) ||
          item.productSlug.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.supplier?.name.toLowerCase().includes(query);
        const matchesStatus = !statusFilter || item.computedStockStatus === statusFilter;
        const matchesSupplier = !supplierFilter || item.supplierId === supplierFilter;
        const matchesLowStock = !lowStockOnly || item.isLowStock || item.needsReorder;
        return matchesSearch && matchesStatus && matchesSupplier && matchesLowStock;
      })
      .sort((left, right) => {
        if (sortBy === "product") return getProductName(left).localeCompare(getProductName(right));
        if (sortBy === "available") return (left.availableQuantity ?? -1) - (right.availableQuantity ?? -1);
        if (sortBy === "reserved") return left.reservedQuantity - right.reservedQuantity;
        if (sortBy === "reorder") return (left.reorderThreshold ?? -1) - (right.reorderThreshold ?? -1);
        return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
      });
  }, [inventory, lowStockOnly, search, sortBy, statusFilter, supplierFilter]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.location, supplier.email, supplier.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, suppliers]);

  const summary = useMemo(
    () => ({
      tracked: inventory.length,
      lowStock: inventory.filter((item) => item.isLowStock || item.needsReorder).length,
      unavailable: inventory.filter((item) =>
        ["out_of_stock", "unavailable", "manual_review"].includes(item.computedStockStatus)
      ).length,
      suppliers: suppliers.length,
    }),
    [inventory, suppliers]
  );

  const openSupplier = async (supplierId: string) => {
    if (!session) return;
    setSupplierLoading(true);
    setError("");
    try {
      setSelectedSupplier(await adminInventoryApi.getSupplier(session, supplierId));
    } catch (supplierError) {
      setError(supplierError instanceof Error ? supplierError.message : "Unable to load supplier.");
    } finally {
      setSupplierLoading(false);
    }
  };

  const openMovement = (item: InventoryItem, movementType = "RESTOCK") => {
    setMovementItem(item);
    setMovementDraft({
      movementType,
      quantityDelta: "1",
      reason: "",
      supplierNote: "",
      purchaseNote: "",
    });
    setError("");
    setNotice("");
  };

  const runAlertCheck = async () => {
    if (!session || !isAdmin) return;
    setCheckingAlerts(true);
    setError("");
    setNotice("");
    try {
      const result = await adminInventoryApi.runAlertCheck(session);
      setAlertSummary(await adminInventoryApi.getAlertSummary(session));
      setAlertStatus("");
      setNotice(
        `Inventory alert check completed: ${result.detected} active warning(s), ${result.restocked} recovery update(s).`
      );
    } catch (alertError) {
      setError(
        alertError instanceof Error ? alertError.message : "Unable to run inventory alert check."
      );
    } finally {
      setCheckingAlerts(false);
    }
  };

  const submitMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !movementItem || !isAdmin) return;
    const quantityDelta = Number(movementDraft.quantityDelta);
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
      setError("Quantity must be a whole number other than zero.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await adminInventoryApi.createMovement(session, {
        inventoryItemId: movementItem.id,
        movementType: movementDraft.movementType,
        quantityDelta,
        reason: movementDraft.reason,
        supplierNote: movementDraft.supplierNote,
        purchaseNote: movementDraft.purchaseNote,
      });
      setInventory((items) =>
        items.map((item) => (item.id === result.inventoryItem.id ? result.inventoryItem : item))
      );
      setMovements((items) => [result.movement, ...items].slice(0, 60));
      adminInventoryApi
        .getAlertSummary(session)
        .then(setAlertSummary)
        .catch(() => setAlertStatus("Inventory alert status is temporarily unavailable."));
      setMovementItem(null);
      setNotice(
        `${formatLabel(result.movement.movementType)} recorded for ${getProductName(
          result.inventoryItem
        )}.`
      );
    } catch (movementError) {
      setError(
        movementError instanceof Error ? movementError.message : "Unable to record movement."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!session) return null;

  return (
    <>
      <section className="admin-inventory-page">
        <div className="admin-inventory-shell">
          <header className="admin-inventory-head">
            <div>
              <span className="admin-inventory-kicker">
                <HiOutlineCube aria-hidden="true" />
                Stroane admin
              </span>
              <h1>Inventory operations</h1>
              <p>Track stock, review suppliers, and record accountable quantity changes.</p>
            </div>
          </header>

          <div className="admin-inventory-summary" aria-label="Inventory summary">
            <span><small>Tracked items</small><strong>{summary.tracked}</strong></span>
            <span><small>Low stock</small><strong>{summary.lowStock}</strong></span>
            <span><small>Unavailable</small><strong>{summary.unavailable}</strong></span>
            <span><small>Suppliers</small><strong>{summary.suppliers}</strong></span>
          </div>

          <div className="admin-inventory-alert-summary" aria-label="Inventory alert summary">
            <div>
              <span className="admin-inventory-kicker">
                <HiOutlineBell aria-hidden="true" />
                Owner alerts
              </span>
              <p>
                {alertSummary.counts.total
                  ? `${alertSummary.counts.total} product alert(s) need attention.`
                  : "No active low-stock or out-of-stock alerts."}
              </p>
              {alertStatus ? <small>{alertStatus}</small> : null}
            </div>
            <div className="admin-inventory-alert-summary__counts">
              <span><small>Low stock</small><strong>{alertSummary.counts.lowStock}</strong></span>
              <span><small>Out of stock</small><strong>{alertSummary.counts.outOfStock}</strong></span>
            </div>
            {isAdmin ? (
              <button type="button" onClick={runAlertCheck} disabled={checkingAlerts}>
                <HiOutlineRefresh aria-hidden="true" />
                {checkingAlerts ? "Checking..." : "Check alerts"}
              </button>
            ) : null}
          </div>

          <div className="admin-inventory-viewbar">
            <div className="admin-inventory-tabs" role="tablist" aria-label="Inventory views">
              <button
                type="button"
                className={activeTab === "inventory" ? "active" : ""}
                onClick={() => {
                  setActiveTab("inventory");
                  navigate("/admin/inventory");
                }}
              >
                Stock
              </button>
              <button
                type="button"
                className={activeTab === "suppliers" ? "active" : ""}
                onClick={() => {
                  setActiveTab("suppliers");
                  navigate("/admin/suppliers");
                }}
              >
                Suppliers
              </button>
              <button
                type="button"
                className={activeTab === "activity" ? "active" : ""}
                onClick={() => setActiveTab("activity")}
              >
                Activity
              </button>
            </div>
            <button type="button" className="admin-inventory-refresh" onClick={loadDashboard} disabled={loading}>
              <HiOutlineRefresh aria-hidden="true" />
              Refresh
            </button>
          </div>

          {error ? <p className="admin-inventory-error">{error}</p> : null}
          {notice ? <p className="admin-inventory-notice">{notice}</p> : null}

          {activeTab !== "activity" ? (
            <label className="admin-inventory-search">
              <HiOutlineSearch aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={activeTab === "suppliers" ? "Search suppliers" : "Search products, SKU, suppliers"}
              />
            </label>
          ) : null}

          {activeTab === "inventory" ? (
            <>
              <div className="admin-inventory-filters">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {STOCK_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
                  <option value="">All suppliers</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as InventorySort)}>
                  <option value="updated">Recently updated</option>
                  <option value="product">Product name</option>
                  <option value="available">Available quantity</option>
                  <option value="reserved">Reserved quantity</option>
                  <option value="reorder">Reorder threshold</option>
                </select>
                <label className="admin-inventory-toggle">
                  <input
                    type="checkbox"
                    checked={lowStockOnly}
                    onChange={(event) => setLowStockOnly(event.target.checked)}
                  />
                  Low stock only
                </label>
              </div>

              <div className="admin-inventory-table-wrap">
                {loading && !inventory.length ? (
                  <AnimatedLoadingState
                    compact
                    title="Loading inventory"
                    message="Pulling current stock records."
                  />
                ) : (
                  <>
                    <table className="admin-inventory-table admin-inventory-table--desktop-stock">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Available</th>
                          <th>Reserved</th>
                          <th>Reorder at</th>
                          <th>Status</th>
                          <th>Supplier</th>
                          <th>Updated</th>
                          <th><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{getProductName(item)}</strong><small>{item.sku || item.productSlug}</small></td>
                            <td>{displayQuantity(item.availableQuantity)}</td>
                            <td>{displayQuantity(item.reservedQuantity)}</td>
                            <td>{displayQuantity(item.reorderThreshold)}</td>
                            <td>
                              <span className={getStockBadgeClass(item.computedStockStatus)}>{formatLabel(item.computedStockStatus)}</span>
                              {item.computedStockStatus === "out_of_stock" ? <small>Restock required</small> : null}
                              {item.computedStockStatus !== "out_of_stock" && item.needsReorder ? <small>Reorder recommended</small> : null}
                            </td>
                            <td>{item.supplier?.name || "Not linked"}</td>
                            <td>{formatDateTime(item.updatedAt)}</td>
                            <td>
                              {isAdmin ? (
                                <button type="button" className="admin-inventory-row-action" onClick={() => openMovement(item)}>
                                  <HiOutlineAdjustments aria-hidden="true" />
                                  Adjust
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="admin-inventory-mobile-list" aria-label="Mobile inventory list">
                      {filteredInventory.map((item) => (
                        <article className="admin-inventory-mobile-item" key={item.id}>
                          <header>
                            <div>
                              <strong>{getProductName(item)}</strong>
                              <small>{item.sku || item.productSlug}</small>
                            </div>
                            <span className={getStockBadgeClass(item.computedStockStatus)}>
                              {formatLabel(item.computedStockStatus)}
                            </span>
                          </header>
                          <dl>
                            <div><dt>Available</dt><dd>{displayQuantity(item.availableQuantity)}</dd></div>
                            <div><dt>Reserved</dt><dd>{displayQuantity(item.reservedQuantity)}</dd></div>
                            <div><dt>Reorder at</dt><dd>{displayQuantity(item.reorderThreshold)}</dd></div>
                          </dl>
                          <p>
                            {item.computedStockStatus === "out_of_stock"
                              ? "Restock required"
                              : item.needsReorder
                                ? "Reorder recommended"
                                : item.supplier?.name || "Supplier not linked"}
                          </p>
                          <footer>
                            <small>Updated {formatDateTime(item.updatedAt)}</small>
                            {isAdmin ? (
                              <button type="button" className="admin-inventory-row-action" onClick={() => openMovement(item)}>
                                <HiOutlineAdjustments aria-hidden="true" />
                                Adjust quantity
                              </button>
                            ) : null}
                          </footer>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                {!loading && !filteredInventory.length ? (
                  <div className="admin-inventory-empty">
                    <HiOutlineExclamation aria-hidden="true" />
                    <h2>No inventory items found</h2>
                    <p>Try another filter. Catalogue products appear here after the one-time inventory bootstrap; quantities remain unavailable until a physical count or restock is recorded.</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {activeTab === "suppliers" ? (
            <div className="admin-inventory-supplier-grid">
              <div className="admin-inventory-supplier-list">
                {loading && !suppliers.length ? (
                  <AnimatedLoadingState
                    compact
                    title="Loading suppliers"
                    message="Pulling linked supplier records."
                  />
                ) : null}
                {!loading && !filteredSuppliers.length ? (
                  <div className="admin-inventory-empty">
                    <HiOutlineOfficeBuilding aria-hidden="true" />
                    <h2>No suppliers found</h2>
                    <p>Supplier records will appear here as they are added through the admin API.</p>
                  </div>
                ) : null}
                {filteredSuppliers.map((supplier) => (
                  <button type="button" key={supplier.id} onClick={() => openSupplier(supplier.id)}>
                    <span><strong>{supplier.name}</strong><small>{supplier.location || "Location not set"}</small></span>
                    <span><strong>{supplier.productCount ?? 0}</strong><small>linked products</small></span>
                  </button>
                ))}
              </div>
              <aside className="admin-inventory-supplier-detail">
                {supplierLoading ? (
                  <AnimatedLoadingState
                    compact
                    title="Loading supplier"
                    message="Pulling private supplier details."
                  />
                ) : selectedSupplier ? (
                  <>
                    <span className="admin-inventory-kicker">Supplier detail</span>
                    <h2>{selectedSupplier.name}</h2>
                    <dl>
                      <div><dt>Status</dt><dd>{formatLabel(selectedSupplier.status)}</dd></div>
                      <div><dt>Phone</dt><dd>{selectedSupplier.phone || "Not set"}</dd></div>
                      <div><dt>Email</dt><dd>{selectedSupplier.email || "Not set"}</dd></div>
                      <div><dt>Linked products</dt><dd>{selectedSupplier.productCount ?? 0}</dd></div>
                    </dl>
                    <section>
                      <h3>Admin notes</h3>
                      <p>{selectedSupplier.notes || "No internal supplier notes recorded."}</p>
                    </section>
                    <section>
                      <h3>Contacts</h3>
                      {!selectedSupplier.contacts.length ? <p>No supplier contacts recorded.</p> : null}
                      {selectedSupplier.contacts.map((contact) => (
                        <div className="admin-inventory-contact" key={contact.id}>
                          <strong>{contact.name}{contact.isPrimary ? " · Primary" : ""}</strong>
                          <small>{contact.role || "Contact"}</small>
                          <span>{contact.email || contact.phone || contact.whatsapp || "No contact details"}</span>
                        </div>
                      ))}
                    </section>
                  </>
                ) : (
                  <div className="admin-inventory-empty">
                    <HiOutlineOfficeBuilding aria-hidden="true" />
                    <h2>Select a supplier</h2>
                    <p>View contacts, linked product counts, and private supplier notes.</p>
                  </div>
                )}
              </aside>
            </div>
          ) : null}

          {activeTab === "activity" ? (
            <div className="admin-inventory-table-wrap">
              {loading && !movements.length ? (
                <AnimatedLoadingState
                  compact
                  title="Loading activity"
                  message="Pulling accountable stock movements."
                />
              ) : (
                <>
                  <table className="admin-inventory-table admin-inventory-table--desktop-activity">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Product</th>
                        <th>Movement</th>
                        <th>Delta</th>
                        <th>Before / after</th>
                        <th>Notes</th>
                        <th>Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => (
                        <tr key={movement.id}>
                          <td>{formatDateTime(movement.createdAt)}</td>
                          <td><strong>{formatLabel(movement.productSlug)}</strong></td>
                          <td><span className={getMovementBadgeClass(movement.movementType)}>{formatLabel(movement.movementType)}</span></td>
                          <td className={movement.quantityDelta < 0 ? "admin-inventory-negative" : "admin-inventory-positive"}>
                            {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}
                          </td>
                          <td>{movement.quantityBefore} / {movement.quantityAfter}</td>
                          <td>{movement.reason || "No notes"}</td>
                          <td>{movement.createdByName || "System"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="admin-inventory-mobile-list" aria-label="Mobile inventory activity">
                    {movements.map((movement) => (
                      <article className="admin-inventory-mobile-item admin-inventory-mobile-item--activity" key={movement.id}>
                        <header>
                          <div>
                            <strong>{formatLabel(movement.productSlug)}</strong>
                            <small>{formatDateTime(movement.createdAt)}</small>
                          </div>
                          <span className={getMovementBadgeClass(movement.movementType)}>
                            {formatLabel(movement.movementType)}
                          </span>
                        </header>
                        <dl>
                          <div>
                            <dt>Delta</dt>
                            <dd className={movement.quantityDelta < 0 ? "admin-inventory-negative" : "admin-inventory-positive"}>
                              {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}
                            </dd>
                          </div>
                          <div><dt>Before</dt><dd>{movement.quantityBefore}</dd></div>
                          <div><dt>After</dt><dd>{movement.quantityAfter}</dd></div>
                        </dl>
                        <p>{movement.reason || "No notes"}</p>
                        <footer>
                          <small>Recorded by {movement.createdByName || "System"}</small>
                        </footer>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {!loading && !movements.length ? (
                <div className="admin-inventory-empty">
                  <HiOutlineAdjustments aria-hidden="true" />
                  <h2>No inventory activity yet</h2>
                  <p>Recorded restocks, corrections, and damage entries will appear here.</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {movementItem ? (
        <div className="admin-inventory-modal-backdrop" role="presentation">
          <section className="admin-inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-movement-title">
            <button type="button" className="admin-inventory-modal__close" onClick={() => setMovementItem(null)} aria-label="Close stock adjustment">
              <HiOutlineX aria-hidden="true" />
            </button>
            <span className="admin-inventory-kicker"><HiOutlinePlus aria-hidden="true" />Stock movement</span>
            <h2 id="inventory-movement-title">{getProductName(movementItem)}</h2>
            <p>Available now: <strong>{displayQuantity(movementItem.availableQuantity)}</strong>. Movement history keeps the accountable before and after values.</p>
            <form onSubmit={submitMovement}>
              <label>
                <span>Movement type</span>
                <select value={movementDraft.movementType} onChange={(event) => setMovementDraft({ ...movementDraft, movementType: event.target.value })}>
                  {MOVEMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Quantity</span>
                <input type="number" step="1" value={movementDraft.quantityDelta} onChange={(event) => setMovementDraft({ ...movementDraft, quantityDelta: event.target.value })} required />
              </label>
              <p className="admin-inventory-preview">
                Estimated available quantity: <strong>{calculateMovementPreview(movementItem, movementDraft.movementType, Number(movementDraft.quantityDelta) || 0)}</strong>
              </p>
              <label>
                <span>Inventory notes</span>
                <textarea value={movementDraft.reason} onChange={(event) => setMovementDraft({ ...movementDraft, reason: event.target.value })} placeholder="Reason for this change" />
              </label>
              {movementDraft.movementType === "RESTOCK" ? (
                <label>
                  <span>Supplier / purchase notes</span>
                  <textarea value={movementDraft.purchaseNote} onChange={(event) => setMovementDraft({ ...movementDraft, purchaseNote: event.target.value })} placeholder="Restock reference or supplier note" />
                </label>
              ) : null}
              <button type="submit" className="admin-inventory-submit" disabled={saving}>
                {saving ? "Recording..." : "Record movement"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default AdminInventory;
