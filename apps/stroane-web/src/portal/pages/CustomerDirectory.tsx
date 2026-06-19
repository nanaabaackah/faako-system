import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiOutlineClipboardCopy,
  HiOutlineMail,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineUserGroup,
} from "react-icons/hi";
import {
  ERPFormNotice,
  ERPModal,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPStatusBadge,
  ERPTablePagination,
  ERPTableSearch,
  ERPTextField,
  SelectField,
} from "@faako/ui";
import { portalUrl } from "../../config/appSurface";
import useSEOMeta from "../../hooks/useSEOMeta";
import { isLikelyEmail, isLikelyPhone, PHONE_INPUT_PATTERN } from "../../utils/contactValidation";
import {
  adminCustomersApi,
  type AdminCustomer,
  type AdminCustomerFilters,
  type AdminCustomerPayload,
  type AdminCustomerSummary,
} from "../api/adminCustomers";
import { useAdminPortal } from "../context/AdminPortalContext";
import "../styles/customer-directory.css";

const CUSTOMER_PAGE_SIZE = 12;

const EMPTY_SUMMARY: AdminCustomerSummary = {
  totalCustomers: 0,
  activeAccounts: 0,
  invitedAccounts: 0,
  lockedAccounts: 0,
  linkedOrders: 0,
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active account" },
  { value: "INVITED", label: "Invited" },
  { value: "LOCKED", label: "Locked" },
];

const CONTACT_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
];

const EMPTY_DRAFT: AdminCustomerPayload = {
  name: "",
  email: "",
  phone: "",
  businessName: "",
  preferredContactMethod: "email",
  defaultDeliveryAddress: "",
  deliveryNotes: "",
  createInvite: true,
};

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatDate = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusTone = (status = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  if (status === "active") return "success";
  if (status === "locked") return "danger";
  if (status === "invited") return "warning";
  return "neutral";
};

const CustomerDirectory: React.FC = () => {
  const { session } = useAdminPortal();
  const canManageCustomers = String(session?.role || "").toUpperCase() === "ADMIN";
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [summary, setSummary] = useState<AdminCustomerSummary>(EMPTY_SUMMARY);
  const [filters, setFilters] = useState<AdminCustomerFilters>({
    search: "",
    status: "",
    limit: 180,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteAction, setInviteAction] = useState("");
  const [draft, setDraft] = useState<AdminCustomerPayload>(EMPTY_DRAFT);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useSEOMeta({
    title: "CRM Directory | Stroane operations",
    description: "Manage Stroane customers, account creation links, and customer directory records.",
    canonical: portalUrl("/admin/crm"),
    noIndex: true,
  });

  const pageCount = Math.max(1, Math.ceil(customers.length / CUSTOMER_PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedCustomers = useMemo(
    () =>
      customers.slice(
        clampedPageIndex * CUSTOMER_PAGE_SIZE,
        clampedPageIndex * CUSTOMER_PAGE_SIZE + CUSTOMER_PAGE_SIZE
      ),
    [clampedPageIndex, customers]
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );
  const toggleCustomerSelection = useCallback((customerId: string) => {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }, []);
  const toggleCustomerPageSelection = useCallback(() => {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      const allPageSelected =
        paginatedCustomers.length > 0 &&
        paginatedCustomers.every((customer) => next.has(customer.id));
      paginatedCustomers.forEach((customer) => {
        if (allPageSelected) {
          next.delete(customer.id);
        } else {
          next.add(customer.id);
        }
      });
      return next;
    });
  }, [paginatedCustomers]);

  const loadCustomers = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminCustomersApi.listCustomers(session, filters);
      setCustomers(data.customers);
      setSummary(data.summary);
      setPageIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }, [filters, session]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const customerIds = new Set(customers.map((customer) => customer.id));
    setSelectedCustomerIds((current) => {
      const next = new Set(Array.from(current).filter((customerId) => customerIds.has(customerId)));
      return next.size === current.size ? current : next;
    });
    if (selectedCustomerId && !customerIds.has(selectedCustomerId)) setSelectedCustomerId("");
  }, [customers, selectedCustomerId]);

  const copyInviteLink = async (url: string) => {
    await navigator.clipboard?.writeText(url);
    setNotice("Account creation link copied.");
  };

  const validateDraft = () => {
    if (!draft.name.trim()) return "Customer name is required.";
    if (!isLikelyEmail(draft.email)) return "Add a valid email address.";
    if (draft.phone?.trim() && !isLikelyPhone(draft.phone)) return "Add a valid phone number.";
    return "";
  };

  const handleCreateCustomer = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    const validationMessage = validateDraft();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const result = await adminCustomersApi.createCustomer(session, {
        ...draft,
        email: draft.email.trim().toLowerCase(),
      });
      setCustomers((current) => [result.customer, ...current.filter((c) => c.id !== result.customer.id)]);
      setDraft(EMPTY_DRAFT);
      setCreateOpen(false);
      setNotice(result.invite ? "Customer saved and invite link created." : "Customer saved.");
      if (result.invite?.signupUrl) await copyInviteLink(result.invite.signupUrl);
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (customer: AdminCustomer) => {
    if (!session) return;
    setInviteAction(customer.id);
    setError("");
    setNotice("");
    try {
      const result = await adminCustomersApi.createInvite(session, customer.id);
      setCustomers((current) =>
        current.map((item) => (item.id === result.customer.id ? result.customer : item))
      );
      await copyInviteLink(result.invite.signupUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create invite.");
    } finally {
      setInviteAction("");
    }
  };

  const updateFilter = <Key extends keyof AdminCustomerFilters>(
    key: Key,
    value: AdminCustomerFilters[Key]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="stroane-crm">
      <header className="stroane-crm__head">
        <div>
          <span>CRM directory</span>
          <h1>Customers</h1>
          <p>Manage customer records, account status, and secure profile creation links.</p>
        </div>
        <div className="stroane-crm__head-actions">
          <ERPSecondaryAction
            type="button"
            icon={<HiOutlineRefresh />}
            onClick={() => void loadCustomers()}
            disabled={loading}
          >
            Refresh
          </ERPSecondaryAction>
          <ERPPrimaryAction
            type="button"
            icon={<HiOutlinePlus />}
            onClick={() => setCreateOpen(true)}
            disabled={!canManageCustomers}
          >
            New customer
          </ERPPrimaryAction>
        </div>
      </header>

      <section className="stroane-crm__kpis" aria-label="Customer KPIs">
        <article className="bubble-card">
          <HiOutlineUserGroup aria-hidden="true" />
          <span>Total customers</span>
          <strong>{summary.totalCustomers}</strong>
        </article>
        <article className="bubble-card" data-tone="success">
          <HiOutlineUserGroup aria-hidden="true" />
          <span>Active accounts</span>
          <strong>{summary.activeAccounts}</strong>
        </article>
        <article className="bubble-card" data-tone="warning">
          <HiOutlineMail aria-hidden="true" />
          <span>Invited</span>
          <strong>{summary.invitedAccounts}</strong>
        </article>
        <article className="bubble-card" data-tone="info">
          <HiOutlineClipboardCopy aria-hidden="true" />
          <span>Linked orders</span>
          <strong>{summary.linkedOrders}</strong>
        </article>
      </section>

      {notice ? (
        <ERPFormNotice tone="success" onDismiss={() => setNotice("")}>
          {notice}
        </ERPFormNotice>
      ) : null}
      {error ? (
        <ERPFormNotice tone="danger" onDismiss={() => setError("")}>
          {error}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-crm__table-panel">
        <div className="stroane-crm__toolbar">
          <ERPTableSearch
            value={filters.search || ""}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search name, email, phone, business..."
          />
          <SelectField
            fieldClassName="stroane-crm__filter"
            label="Status"
            value={filters.status || ""}
            ariaLabel="Filter by customer status"
            onChangeValue={(value) => updateFilter("status", getSelectValue(value))}
            options={STATUS_OPTIONS}
          />
        </div>

        {selectedCustomerIds.size ? (
          <div className="stroane-crm__bulk-bar" role="region" aria-label="Selected customers">
            <span>
              <strong>{selectedCustomerIds.size}</strong> selected
            </span>
            <ERPSecondaryAction size="sm" onClick={() => setSelectedCustomerIds(new Set())}>
              Clear selection
            </ERPSecondaryAction>
          </div>
        ) : null}

        <div className="admin-table-shell stroane-crm__admin-table">
          <table className="stroane-crm__table">
            <colgroup>
              <col className="stroane-crm__col-select" />
              <col className="stroane-crm__col-number" />
              <col className="stroane-crm__col-customer" />
              <col className="stroane-crm__col-email" />
              <col className="stroane-crm__col-status" />
              <col className="stroane-crm__col-contact" />
              <col className="stroane-crm__col-orders" />
              <col className="stroane-crm__col-last" />
              <col className="stroane-crm__col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="portal-table-select-cell" aria-label="Select customers">
                  <input
                    type="checkbox"
                    className="portal-table-checkbox"
                    checked={
                      paginatedCustomers.length > 0 &&
                      paginatedCustomers.every((customer) => selectedCustomerIds.has(customer.id))
                    }
                    onChange={toggleCustomerPageSelection}
                    disabled={!paginatedCustomers.length}
                    aria-label="Select all customers on this page"
                  />
                </th>
                <th className="portal-table-number-cell">#</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Status</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Last order</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length ? (
                paginatedCustomers.map((customer, index) => (
                  <tr
                    key={customer.id}
                    className={[
                      selectedCustomerIds.has(customer.id) ? "is-bulk-selected" : "",
                      selectedCustomerId === customer.id ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCustomerId(customer.id);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td
                      className="portal-table-select-cell"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="portal-table-checkbox"
                        checked={selectedCustomerIds.has(customer.id)}
                        onChange={() => toggleCustomerSelection(customer.id)}
                        aria-label={`Select ${customer.name}`}
                      />
                    </td>
                    <td className="portal-table-number-cell" data-label="#">
                      {clampedPageIndex * CUSTOMER_PAGE_SIZE + index + 1}
                    </td>
                    <td data-label="Customer">
                      <span className="stroane-crm__customer-cell">
                        <strong>{customer.name}</strong>
                      </span>
                    </td>
                    <td data-label="Email">{customer.email}</td>
                    <td data-label="Status">
                      <ERPStatusBadge tone={getStatusTone(customer.status)}>
                        {customer.hasAccount ? "Account active" : customer.status}
                      </ERPStatusBadge>
                    </td>
                    <td data-label="Phone">{customer.phone || customer.preferredContactMethod || "Not recorded"}</td>
                    <td data-label="Orders">
                      {customer.orderCount} · {formatMoney(customer.totalSpend)}
                    </td>
                    <td data-label="Last order">
                      {customer.lastOrder
                        ? `${customer.lastOrder.orderNumber} · ${formatDate(customer.lastOrder.createdAt)}`
                        : "No orders"}
                    </td>
                    <td
                      className="stroane-crm__actions-cell"
                      data-label="Actions"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="stroane-crm__icon-button"
                        onClick={() => void handleInvite(customer)}
                        disabled={!canManageCustomers || inviteAction === customer.id}
                        title="Create and copy account link"
                        aria-label={`Create account link for ${customer.name}`}
                      >
                        <HiOutlineClipboardCopy aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="stroane-crm__table-empty" colSpan={9}>
                    {loading ? "Loading customers..." : "No customers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <ERPTablePagination
            className="stroane-crm__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={CUSTOMER_PAGE_SIZE}
            totalItems={customers.length}
            onPageChange={setPageIndex}
          />
        </div>
      </section>

      <ERPModal
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomerId("")}
        title={selectedCustomer?.name || "Customer"}
        description={
          selectedCustomer
            ? `${selectedCustomer.email} · ${
                selectedCustomer.hasAccount ? "Account active" : "Account not active"
              }`
            : undefined
        }
        className="stroane-crm__modal stroane-crm__detail-modal"
        closeOnBackdrop
      >
        {selectedCustomer ? (
          <div className="stroane-crm__detail">
            <div className="stroane-crm__detail-grid">
              <section className="stroane-crm__detail-card">
                <h3>Customer</h3>
                <dl className="stroane-crm__detail-list">
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedCustomer.email}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selectedCustomer.phone || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Business</dt>
                    <dd>{selectedCustomer.businessName || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Preferred contact</dt>
                    <dd>{selectedCustomer.preferredContactMethod || "Email"}</dd>
                  </div>
                </dl>
              </section>
              <section className="stroane-crm__detail-card">
                <h3>Account</h3>
                <dl className="stroane-crm__detail-list">
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <ERPStatusBadge tone={getStatusTone(selectedCustomer.status)}>
                        {selectedCustomer.hasAccount ? "Account active" : selectedCustomer.status}
                      </ERPStatusBadge>
                    </dd>
                  </div>
                  <div>
                    <dt>Invited</dt>
                    <dd>{formatDate(selectedCustomer.invitedAt)}</dd>
                  </div>
                  <div>
                    <dt>Activated</dt>
                    <dd>{formatDate(selectedCustomer.activatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Last login</dt>
                    <dd>{formatDate(selectedCustomer.lastLoginAt)}</dd>
                  </div>
                </dl>
              </section>
              <section className="stroane-crm__detail-card">
                <h3>Orders</h3>
                <dl className="stroane-crm__detail-list">
                  <div>
                    <dt>Linked orders</dt>
                    <dd>{selectedCustomer.orderCount}</dd>
                  </div>
                  <div>
                    <dt>Total spend</dt>
                    <dd>{formatMoney(selectedCustomer.totalSpend)}</dd>
                  </div>
                  <div>
                    <dt>Last order</dt>
                    <dd>
                      {selectedCustomer.lastOrder
                        ? `${selectedCustomer.lastOrder.orderNumber} · ${formatDate(
                            selectedCustomer.lastOrder.createdAt
                          )}`
                        : "No orders"}
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="stroane-crm__detail-card">
                <h3>Delivery</h3>
                <dl className="stroane-crm__detail-list">
                  <div>
                    <dt>Address</dt>
                    <dd>{selectedCustomer.defaultDeliveryAddress || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Notes</dt>
                    <dd>{selectedCustomer.deliveryNotes || "Not recorded"}</dd>
                  </div>
                </dl>
              </section>
            </div>
            <div className="stroane-crm__detail-actions">
              <ERPSecondaryAction type="button" onClick={() => setSelectedCustomerId("")}>
                Close
              </ERPSecondaryAction>
              <ERPPrimaryAction
                type="button"
                icon={<HiOutlineClipboardCopy />}
                onClick={() => void handleInvite(selectedCustomer)}
                loading={inviteAction === selectedCustomer.id}
                disabled={!canManageCustomers || inviteAction === selectedCustomer.id}
              >
                Copy account link
              </ERPPrimaryAction>
            </div>
          </div>
        ) : null}
      </ERPModal>

      <ERPModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create customer"
        description="Add a CRM record and optionally copy an account creation link."
        className="stroane-crm__modal"
      >
        <form className="stroane-crm__form" onSubmit={handleCreateCustomer}>
          <ERPTextField
            label="Name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <ERPTextField
            label="Email"
            helperText="Email is the customer account ID. One email can only belong to one customer record."
            type="email"
            value={draft.email}
            onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            onBlur={() =>
              setDraft((current) => ({ ...current, email: current.email.trim().toLowerCase() }))
            }
            required
          />
          <ERPTextField
            label="Phone"
            type="tel"
            inputMode="tel"
            pattern={PHONE_INPUT_PATTERN}
            value={draft.phone || ""}
            onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
          />
          <ERPTextField
            label="Business"
            value={draft.businessName || ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, businessName: event.target.value }))
            }
          />
          <SelectField
            label="Preferred contact"
            value={draft.preferredContactMethod || "email"}
            onChangeValue={(value) =>
              setDraft((current) => ({
                ...current,
                preferredContactMethod: getSelectValue(value),
              }))
            }
            options={CONTACT_OPTIONS}
          />
          <ERPTextField
            label="Default address"
            value={draft.defaultDeliveryAddress || ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaultDeliveryAddress: event.target.value,
              }))
            }
          />
          <label className="stroane-crm__checkbox">
            <input
              type="checkbox"
              checked={draft.createInvite !== false}
              onChange={(event) =>
                setDraft((current) => ({ ...current, createInvite: event.target.checked }))
              }
            />
            <span>Create and copy account link</span>
          </label>
          <div className="stroane-crm__modal-actions">
            <ERPSecondaryAction type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </ERPSecondaryAction>
            <ERPPrimaryAction type="submit" icon={<HiOutlineSave />} loading={saving}>
              Save customer
            </ERPPrimaryAction>
          </div>
        </form>
      </ERPModal>
    </div>
  );
};

export default CustomerDirectory;
