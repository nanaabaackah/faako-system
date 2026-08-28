import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLoadingState, ERPConfirmDialog, ERPFormNotice } from "@faako/ui";
import "./AdminCustomers.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faRotateRight, faUserPlus } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import CustomerCreateModal from "./components/CustomerCreateModal";
import CustomerDetailModal from "./components/CustomerDetailModal";
import CustomerResultsSection from "./components/CustomerResultsSection";
import CustomerSummaryPanel from "./components/CustomerSummaryPanel";
import CustomerToolbar from "./components/CustomerToolbar";
import { useLocation, useNavigate } from "react-router-dom";
import {
  EMPTY_CUSTOMER_FORM,
  CUSTOMER_SEGMENTS,
  KANBAN_COLUMNS,
  MOBILE_CARD_VIEW_QUERY,
  buildSearchBlob,
  centsToMoneyAmount,
  getCustomerSegment,
  getDaysSince,
  getIsMobileCardView,
  getLastTouch,
  getQuantile,
  getSegmentLabel,
  readResponseError,
  toNumber,
} from "./crmShared";
import { reebsApiResponse } from "../../api/client";
import { customerMasterDataFormSchema, validationIssues } from "@faako/validation";
import useUnsavedChanges from "../../hooks/useUnsavedChanges";

export default function AdminCustomers() {
  const location = useLocation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recent");
  const [viewMode, setViewMode] = useState("list");
  const [isMobileCardView, setIsMobileCardView] = useState(getIsMobileCardView);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState(EMPTY_CUSTOMER_FORM);

  const [activeCustomer, setActiveCustomer] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [requestStatusSavingId, setRequestStatusSavingId] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailStatus, setDetailStatus] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailForm, setDetailForm] = useState(EMPTY_CUSTOMER_FORM);
  const [removingCustomerId, setRemovingCustomerId] = useState(null);
  const [pendingArchiveCustomer, setPendingArchiveCustomer] = useState(null);
  const [draggedCustomerId, setDraggedCustomerId] = useState(null);
  const [dragOverSegment, setDragOverSegment] = useState("");
  const [movingCustomerId, setMovingCustomerId] = useState(null);
  const detailRequestRef = useRef(0);
  const createFormDirty = createOpen && Boolean(
    createForm.name || createForm.email || createForm.phone
  );
  const detailFormDirty = Boolean(
    detailOpen &&
    activeCustomer &&
    (detailForm.name !== (activeCustomer.name || "") ||
      detailForm.email !== (activeCustomer.email || "") ||
      detailForm.phone !== (activeCustomer.phone || ""))
  );
  useUnsavedChanges(
    (createFormDirty && !createSaving) || (detailFormDirty && !detailSaving)
  );

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(MOBILE_CARD_VIEW_QUERY);
    const handleChange = () => setIsMobileCardView(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await reebsApiResponse("/api/customers");
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to load customers."));
      }
      const payload = await response.json();
      setCustomers(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error("Failed to load customers", err);
      setError(err.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const enrichedCustomers = useMemo(() => {
    const base = customers.map((customer) => {
      const orders = toNumber(customer.orders);
      const bookings = toNumber(customer.bookings);
      const contactRequests = toNumber(customer.contact_requests);
      const openContactRequests = toNumber(customer.open_contact_requests);
      const totalSpent = centsToMoneyAmount(customer.total_spent);
      const totalRented = centsToMoneyAmount(customer.total_rented);
      const ltv = totalSpent + totalRented;
      const activity = orders + bookings + contactRequests;
      const lastTouch = getLastTouch(customer);
      const daysSince = getDaysSince(lastTouch);

      return {
        ...customer,
        orders,
        bookings,
        contactRequests,
        openContactRequests,
        totalSpent,
        totalRented,
        ltv,
        activity,
        lastTouch,
        daysSince,
      };
    });

    const loyalValue = Math.max(3000, getQuantile(base.map((item) => item.ltv).filter(Boolean), 0.75));
    const loyalActivity = Math.max(
      4,
      Math.round(getQuantile(base.map((item) => item.activity).filter(Boolean), 0.7))
    );

    return base.map((record) => ({
      ...record,
      segment: getCustomerSegment(record, { loyalValue, loyalActivity }),
    }));
  }, [customers]);

  const summary = useMemo(() => {
    const totals = enrichedCustomers.reduce(
      (accumulator, customer) => {
        accumulator.value += customer.ltv;
        accumulator.orders += customer.orders;
        accumulator.bookings += customer.bookings;
        accumulator.contactRequests += customer.contactRequests;
        accumulator.openContactRequests += customer.openContactRequests;
        accumulator.connected += customer.activity > 0 ? 1 : 0;
        accumulator.phone += customer.phone ? 1 : 0;
        accumulator.email += customer.email ? 1 : 0;
        accumulator[customer.segment] += 1;
        return accumulator;
      },
      {
        value: 0,
        orders: 0,
        bookings: 0,
        contactRequests: 0,
        openContactRequests: 0,
        connected: 0,
        phone: 0,
        email: 0,
        active: 0,
        loyal: 0,
        risk: 0,
        prospect: 0,
      }
    );

    return {
      ...totals,
      count: enrichedCustomers.length,
      avgValue: enrichedCustomers.length ? totals.value / enrichedCustomers.length : 0,
      contactGaps: enrichedCustomers.filter((customer) => !customer.phone || !customer.email).length,
    };
  }, [enrichedCustomers]);

  const visibleCustomers = useMemo(() => {
    const terms = searchTerm
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    const nextCustomers = enrichedCustomers.filter((customer) => {
      if (segmentFilter !== "all" && customer.segment !== segmentFilter) return false;
      if (!terms.length) return true;
      const blob = buildSearchBlob(customer);
      return terms.every((term) => blob.includes(term));
    });

    nextCustomers.sort((left, right) => {
      switch (sortKey) {
        case "name":
          return String(left.name || "").localeCompare(String(right.name || ""), undefined, {
            sensitivity: "base",
          });
        case "value":
          return right.ltv - left.ltv;
        case "activity":
          return right.activity - left.activity || right.ltv - left.ltv;
        case "recent":
        default: {
          const leftDate = left.lastTouch ? new Date(left.lastTouch).getTime() : 0;
          const rightDate = right.lastTouch ? new Date(right.lastTouch).getTime() : 0;
          return rightDate - leftDate || String(left.name || "").localeCompare(String(right.name || ""));
        }
      }
    });

    return nextCustomers;
  }, [enrichedCustomers, searchTerm, segmentFilter, sortKey]);

  const selectedCustomer =
    enrichedCustomers.find((customer) => customer.id === activeCustomer?.id) || activeCustomer;
  const activeViewMode = isMobileCardView ? "card" : viewMode;

  const kanbanColumns = useMemo(
    () =>
      KANBAN_COLUMNS.map((column) => {
        const items = visibleCustomers.filter((customer) => customer.segment === column.key);
        const totalValue = items.reduce((sum, customer) => sum + customer.ltv, 0);
        return {
          ...column,
          items,
          totalValue,
        };
      }),
    [visibleCustomers]
  );

  const selectedSegment = selectedCustomer?.segment || "prospect";
  const selectedTotals = {
    orders: toNumber(detail?.totals?.orders ?? selectedCustomer?.orders),
    bookings: toNumber(detail?.totals?.bookings ?? selectedCustomer?.bookings),
    totalSpent: centsToMoneyAmount(detail?.totals?.totalSpent ?? selectedCustomer?.total_spent),
    totalRented: centsToMoneyAmount(detail?.totals?.totalRented ?? selectedCustomer?.total_rented),
  };

  const syncCustomerRow = (updatedCustomer) => {
    setCustomers((current) =>
      current.map((customer) =>
        customer.id === updatedCustomer.id
          ? {
            ...customer,
            ...updatedCustomer,
          }
          : customer
      )
    );
  };

  const moveCustomerToSegment = async (customer, nextSegment) => {
    const customerId = Number(customer?.id);
    if (!Number.isFinite(customerId) || !CUSTOMER_SEGMENTS.has(nextSegment)) return;
    if (movingCustomerId === customerId || customer.segment === nextSegment) {
      setDraggedCustomerId(null);
      setDragOverSegment("");
      return;
    }

    const previousOverride = customer.segmentOverride ?? null;

    setMovingCustomerId(customerId);
    setError("");
    setDetailError("");
    setDetailStatus("");
    setCustomers((current) =>
      current.map((item) =>
        item.id === customerId
          ? {
            ...item,
            segmentOverride: nextSegment,
          }
          : item
      )
    );

    try {
      const response = await reebsApiResponse("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customerId,
          segmentOverride: nextSegment,
        }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to move customer."));
      }

      const updated = await response.json();
      syncCustomerRow(updated);
      setActiveCustomer((current) => (current ? { ...current, ...updated } : current));
      setDetail((current) =>
        current
          ? {
            ...current,
            customer: {
              ...(current.customer || {}),
              ...updated,
            },
          }
          : current
      );

      if (activeCustomer?.id === customerId) {
        setDetailStatus(`Moved to ${getSegmentLabel(nextSegment)}.`);
      }
    } catch (err) {
      console.error("Failed to move customer", err);
      setCustomers((current) =>
        current.map((item) =>
          item.id === customerId
            ? {
              ...item,
              segmentOverride: previousOverride,
            }
            : item
        )
      );

      if (activeCustomer?.id === customerId) {
        setDetailError(err.message || "Failed to move customer.");
      } else {
        setError(err.message || "Failed to move customer.");
      }
    } finally {
      setMovingCustomerId(null);
      setDraggedCustomerId(null);
      setDragOverSegment("");
    }
  };

  const handleKanbanDragStart = (customer) => (event) => {
    setDraggedCustomerId(customer.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(customer.id));
  };

  const handleKanbanDragEnd = () => {
    setDraggedCustomerId(null);
    setDragOverSegment("");
  };

  const handleKanbanDragOver = (segment) => (event) => {
    if (!draggedCustomerId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverSegment !== segment) {
      setDragOverSegment(segment);
    }
  };

  const handleKanbanDragLeave = (segment) => (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (dragOverSegment === segment) {
      setDragOverSegment("");
    }
  };

  const handleKanbanDrop = (segment) => async (event) => {
    event.preventDefault();
    const droppedId = Number(event.dataTransfer.getData("text/plain") || draggedCustomerId);
    if (!Number.isFinite(droppedId)) {
      setDraggedCustomerId(null);
      setDragOverSegment("");
      return;
    }

    const customer = enrichedCustomers.find((item) => item.id === droppedId);
    if (!customer) {
      setDraggedCustomerId(null);
      setDragOverSegment("");
      return;
    }

    await moveCustomerToSegment(customer, segment);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError("");
  };

  const openCreate = () => {
    setCreateError("");
    setCreateForm(EMPTY_CUSTOMER_FORM);
    setCreateOpen(true);
  };

  const handleCreateFormChange = (field, value) => {
    setCreateError("");
    setCreateForm((current) => ({ ...current, [field]: value }));
  };

  const archiveCustomer = async (customer) => {
    const customerId = Number(customer?.id);
    if (!Number.isFinite(customerId) || removingCustomerId === customerId) return;

    setRemovingCustomerId(customerId);
    setError("");
    setDetailError("");
    setDetailStatus("");

    try {
      const response = await reebsApiResponse("/api/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customerId }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to archive customer."));
      }

      setCustomers((current) => current.filter((item) => item.id !== customerId));

      if (activeCustomer?.id === customerId) {
        closeDetail();
      }
      setPendingArchiveCustomer(null);
    } catch (err) {
      console.error("Failed to archive customer", err);
      if (activeCustomer?.id === customerId) {
        setDetailError(err.message || "Failed to archive customer.");
      } else {
        setError(err.message || "Failed to archive customer.");
      }
    } finally {
      setRemovingCustomerId(null);
    }
  };

  const requestArchiveCustomer = (customer) => {
    if (!customer || removingCustomerId) return;
    setPendingArchiveCustomer(customer);
  };

  const closeArchiveConfirmation = () => {
    if (removingCustomerId) return;
    setPendingArchiveCustomer(null);
  };

  const openDetail = async (customer) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    setActiveCustomer(customer);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError("");
    setDetailStatus("");
    setDetail({
      customer,
      orders: [],
      bookings: [],
      totals: {
        orders: customer.orders || 0,
        bookings: customer.bookings || 0,
        totalSpent: customer.total_spent || 0,
        totalRented: customer.total_rented || 0,
      },
    });
    setDetailForm({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
    });

    try {
      const response = await reebsApiResponse(`/api/customers?id=${customer.id}`);
      if (detailRequestRef.current !== requestId) return;
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to load customer."));
      }
      const payload = await response.json();
      if (detailRequestRef.current !== requestId) return;
      setDetail(payload);
      setDetailForm({
        name: payload?.customer?.name || "",
        email: payload?.customer?.email || "",
        phone: payload?.customer?.phone || "",
      });
    } catch (err) {
      if (detailRequestRef.current !== requestId) return;
      console.error("Failed to load customer detail", err);
      setDetailError(err.message || "Failed to load customer.");
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const closeDetail = () => {
    detailRequestRef.current += 1;
    setDetailOpen(false);
    setActiveCustomer(null);
    setDetail(null);
    setDetailError("");
    setDetailStatus("");
    setDetailLoading(false);
    setDetailSaving(false);
    setRequestStatusSavingId(null);
    setDetailForm(EMPTY_CUSTOMER_FORM);
    const params = new URLSearchParams(location.search);
    if (params.has("id")) {
      navigate("/admin/customers", { replace: true });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedId = Number(params.get("id"));
    if (!Number.isFinite(requestedId) || requestedId <= 0 || !customers.length) return;
    if (activeCustomer?.id === requestedId && detailOpen) return;
    const match = customers.find((customer) => Number(customer?.id) === requestedId);
    if (!match) return;
    void openDetail(match);
  }, [activeCustomer?.id, customers, detailOpen, location.search]);

  const handleDetailFormChange = (field, value) => {
    setDetailError("");
    setDetailStatus("");
    setDetailForm((current) => ({ ...current, [field]: value }));
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    if (!selectedCustomer?.id) return;

    setDetailSaving(true);
    setDetailError("");
    setDetailStatus("");

    try {
      const validation = customerMasterDataFormSchema.safeParse(detailForm);
      if (!validation.success) {
        throw new Error(validationIssues(validation.error)[0]?.message || "Customer details are invalid.");
      }
      const response = await reebsApiResponse("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCustomer.id,
          ...validation.data,
        }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to save customer."));
      }

      const updated = await response.json();
      syncCustomerRow(updated);
      setActiveCustomer((current) => (current ? { ...current, ...updated } : current));
      setDetail((current) =>
        current
          ? {
            ...current,
            customer: {
              ...(current.customer || {}),
              ...updated,
            },
          }
          : current
      );
      setDetailStatus("Saved.");
    } catch (err) {
      console.error("Failed to save customer", err);
      setDetailError(err.message || "Failed to save customer.");
    } finally {
      setDetailSaving(false);
    }
  };

  const createCustomer = async (event) => {
    event.preventDefault();
    setCreateSaving(true);
    setCreateError("");

    try {
      const validation = customerMasterDataFormSchema.safeParse(createForm);
      if (!validation.success) {
        throw new Error(validationIssues(validation.error)[0]?.message || "Customer details are invalid.");
      }
      const response = await reebsApiResponse("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to create customer."));
      }

      const created = await response.json();
      setCustomers((current) => [created, ...current.filter((customer) => customer.id !== created.id)]);
      setCreateForm(EMPTY_CUSTOMER_FORM);
      setCreateOpen(false);
    } catch (err) {
      console.error("Failed to create customer", err);
      setCreateError(err.message || "Failed to create customer.");
    } finally {
      setCreateSaving(false);
    }
  };

  const updateContactRequestStatus = async (request, status) => {
    const requestId = Number(request?.id);
    if (!Number.isFinite(requestId) || !status || requestStatusSavingId === requestId) return;

    setRequestStatusSavingId(requestId);
    setDetailError("");
    setDetailStatus("");

    try {
      const response = await reebsApiResponse("/api/contactRequests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId, status }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to update contact request."));
      }

      const payload = await response.json();
      const updatedRequest = payload?.request;
      setDetail((current) =>
        current
          ? {
            ...current,
            contactRequests: (current.contactRequests || []).map((item) =>
              item.id === requestId ? { ...item, ...updatedRequest } : item
            ),
          }
          : current
      );
      setDetailStatus("Contact request updated.");
      await loadCustomers();
    } catch (err) {
      console.error("Failed to update contact request", err);
      setDetailError(err.message || "Failed to update contact request.");
    } finally {
      setRequestStatusSavingId(null);
    }
  };

  return (
    <div className="admin-page crm-page">
      <div className="admin-shell crm-shell">
        <AdminBreadcrumb items={[{ label: "Customers" }]} />

        <AdminPageHeader
          copyClassName="crm-header-copy"
          actionsClassName="admin-header-actions crm-header-actions"
          title="Customers"
          actions={(
            <>
              <button
                type="button"
                className="admin-secondary crm-button"
                onClick={loadCustomers}
                disabled={loading}
              >
                <AppIcon icon={faRotateRight} />
                Refresh
              </button>
              <button type="button" className="admin-primary crm-button" onClick={openCreate}>
                <AppIcon icon={faUserPlus} />
                Add customer
              </button>
            </>
          )}
        />

        <CustomerSummaryPanel
          summary={summary}
          segmentFilter={segmentFilter}
          onSegmentFilterChange={setSegmentFilter}
        />

        <CustomerToolbar
          searchTerm={searchTerm}
          onSearchChange={(event) => setSearchTerm(event.target.value)}
          onSearchClear={() => setSearchTerm("")}
          segmentFilter={segmentFilter}
          onSegmentFilterChange={(event) => setSegmentFilter(event.target.value)}
          sortKey={sortKey}
          onSortKeyChange={(event) => setSortKey(event.target.value)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isMobileCardView={isMobileCardView}
        />

        {loading ? (
          <AnimatedLoadingState
            compact
            className="glass-card crm-loading-state admin-module-loading"
            title="Loading customers"
            message="Preparing customer history and segments."
            variant="dashboard"
          />
        ) : null}
        {!loading && error ? (
          <ERPFormNotice tone="danger" title="Customers unavailable" onDismiss={() => setError("")}>
            {error}
          </ERPFormNotice>
        ) : null}

        {!loading && !error ? (
          <CustomerResultsSection
            activeViewMode={activeViewMode}
            visibleCustomers={visibleCustomers}
            kanbanColumns={kanbanColumns}
            dragOverSegment={dragOverSegment}
            onKanbanDragOver={handleKanbanDragOver}
            onKanbanDragLeave={handleKanbanDragLeave}
            onKanbanDrop={handleKanbanDrop}
            onOpenDetail={openDetail}
            onArchiveCustomer={requestArchiveCustomer}
            removingCustomerId={removingCustomerId}
            draggedCustomerId={draggedCustomerId}
            movingCustomerId={movingCustomerId}
            onKanbanDragStart={handleKanbanDragStart}
            onKanbanDragEnd={handleKanbanDragEnd}
            searchTerm={searchTerm}
          />
        ) : null}
      </div>

      <CustomerCreateModal
        isOpen={createOpen}
        createForm={createForm}
        createError={createError}
        onCreateErrorClear={() => setCreateError("")}
        createSaving={createSaving}
        onClose={closeCreate}
        onSubmit={createCustomer}
        onFormChange={handleCreateFormChange}
      />

      <CustomerDetailModal
        isOpen={detailOpen}
        customer={selectedCustomer}
        detailForm={detailForm}
        detail={detail}
        detailLoading={detailLoading}
        detailSaving={detailSaving}
        detailError={detailError}
        detailStatus={detailStatus}
        onDetailErrorClear={() => setDetailError("")}
        onDetailStatusClear={() => setDetailStatus("")}
        selectedSegment={selectedSegment}
        selectedTotals={selectedTotals}
        removingCustomerId={removingCustomerId}
        requestStatusSavingId={requestStatusSavingId}
        onClose={closeDetail}
        onSave={saveCustomer}
        onArchive={requestArchiveCustomer}
        onFormChange={handleDetailFormChange}
        onRequestStatusChange={updateContactRequestStatus}
      />

      <ERPConfirmDialog
        open={Boolean(pendingArchiveCustomer)}
        title="Archive customer?"
        description="This removes the customer from the active customer list."
        message={
          pendingArchiveCustomer
            ? `Archive ${pendingArchiveCustomer.name || "this customer"}? Existing linked records are not deleted.`
            : ""
        }
        confirmLabel="Archive customer"
        loading={
          removingCustomerId !== null
          && removingCustomerId === Number(pendingArchiveCustomer?.id)
        }
        disabled={!pendingArchiveCustomer}
        onCancel={closeArchiveConfirmation}
        onClose={closeArchiveConfirmation}
        onConfirm={() => archiveCustomer(pendingArchiveCustomer)}
      />
    </div>
  );
}
