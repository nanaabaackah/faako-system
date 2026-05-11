import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SelectField } from "@faako/ui";
import "./AdminDirectory.css";
import { useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import { faPlus, faRotateRight, faXmark, faPen, faEye } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import SearchField from "../../components/SearchField/SearchField";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { normalizeAdminRole } from "../../utils/adminAccess";
import TablePagination from "../../components/TablePagination/TablePagination";
import roleColors from "../../utils/roleColors";

const formatMoney = (value, currency = "GHS") => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${currency} ${Math.round(value || 0)}`;
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

const formatLeadTime = (value) => {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return "Not set";
  return `${days} day${days === 1 ? "" : "s"}`;
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const tabs = [
  { key: "users", label: "Users" },
  { key: "customers", label: "Customers" },
  { key: "vendors", label: "Vendors" },
];

const DIRECTORY_TAB_KEYS = new Set(tabs.map((tab) => tab.key));

const normalizeDirectoryTab = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return DIRECTORY_TAB_KEYS.has(normalized) ? normalized : "users";
};

const buildDirectorySearch = ({ tab = "users", query = "" } = {}) => {
  const params = new URLSearchParams();
  const normalizedTab = normalizeDirectoryTab(tab);
  const trimmedQuery = String(query || "").trim();
  if (normalizedTab !== "users") {
    params.set("tab", normalizedTab);
  }
  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }
  const next = params.toString();
  return next ? `?${next}` : "";
};

const generateEmailFromNames = (firstName, lastName) => {
  const clean = (value) => (value || "").trim().replace(/\s+/g, "").toLowerCase();
  const first = clean(firstName);
  const last = clean(lastName);
  if (!first || !last) return "";
  return `${first}_${last}@reebs.com`;
};

function AdminDirectory() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleKey = normalizeAdminRole(user?.role);
  const isDriverUser = roleKey === "driver";
  const availableTabs = useMemo(
    () => (isDriverUser ? tabs.filter((tab) => tab.key === "customers") : tabs),
    [isDriverUser]
  );
  const [activeTab, setActiveTab] = useState(() => (isDriverUser ? "customers" : "users"));
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailTab, setDetailTab] = useState("");

  const [userForm, setUserForm] = useState({ firstName: "", lastName: "", password: "", role: "Staff" });
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const totalRecords = useMemo(() => {
    if (activeTab === "customers") return customers.length;
    if (activeTab === "users") return users.length;
    if (activeTab === "vendors") return vendors.length;
    return 0;
  }, [activeTab, customers.length, users.length, vendors.length]);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const requests = isDriverUser
        ? [fetch("/.netlify/functions/customers")]
        : [
            fetch("/.netlify/functions/users"),
            fetch("/.netlify/functions/customers"),
            fetch("/.netlify/functions/vendors"),
          ];
      const responses = await Promise.all(requests);
      const payloads = await Promise.all(responses.map((response) => response.json().catch(() => null)));
      const [usersRes, customersRes, vendorsRes] = isDriverUser
        ? [null, responses[0], null]
        : responses;
      const [usersData, customersData, vendorsData] = isDriverUser
        ? [[], payloads[0], []]
        : payloads;
      const errors = [];
      if (usersRes && !usersRes.ok) errors.push(usersData?.error || "Failed to load users.");
      if (customersRes && !customersRes.ok) errors.push(customersData?.error || "Failed to load customers.");
      if (vendorsRes && !vendorsRes.ok) errors.push(vendorsData?.error || "Failed to load vendors.");
      if (errors.length) {
        setError(errors.join(" "));
      }

      const safeUsers = Array.isArray(usersData) ? usersData : [];
      const safeCustomers = Array.isArray(customersData) ? customersData : [];
      const safeVendors = Array.isArray(vendorsData) ? vendorsData : [];
      setUsers([...safeUsers].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "")));
      setCustomers([...safeCustomers].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setVendors([...safeVendors].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    } catch (err) {
      console.error("Directory fetch failed", err);
      setError("We couldn't load directory data right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentList = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = activeTab === "customers" ? customers : activeTab === "vendors" ? vendors : users;
    if (!needle) return list;

    if (activeTab === "customers") {
      return list.filter((customer) => {
        return (
          customer.name?.toLowerCase().includes(needle) ||
          customer.email?.toLowerCase().includes(needle) ||
          customer.phone?.toLowerCase().includes(needle)
        );
      });
    }

    if (activeTab === "vendors") {
      return list.filter((vendor) => {
        return (
          vendor.name?.toLowerCase().includes(needle) ||
          vendor.contactName?.toLowerCase().includes(needle) ||
          vendor.email?.toLowerCase().includes(needle) ||
          vendor.phone?.toLowerCase().includes(needle) ||
          vendor.address?.toLowerCase().includes(needle)
        );
      });
    }

    const filtered = list.filter((user) => {
      const fullName = `${user.fullName || ""} ${user.name || ""} ${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
      return (
        user.email?.toLowerCase().includes(needle) ||
        fullName.includes(needle) ||
        user.role?.toLowerCase().includes(needle)
      );
    });
    return filtered;
  }, [activeTab, customers, users, vendors, query]);

  useEffect(() => {
    setPage(0);
    setDetailOpen(false);
    setDetailRecord(null);
    setDetailLoading(false);
    setDetailError("");
  }, [activeTab, query, customers.length, users.length, vendors.length]);

  const pageCount = Math.max(1, Math.ceil(currentList.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedList = useMemo(() => {
    const start = clampedPage * pageSize;
    return currentList.slice(start, start + pageSize);
  }, [currentList, clampedPage, pageSize]);
  const renderDirectoryPagination = (header = false) => (
    <TablePagination
      total={currentList.length}
      pageIndex={clampedPage}
      pageSize={pageSize}
      pageCount={pageCount}
      onPrevious={() => setPage((p) => Math.max(0, p - 1))}
      onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
      header={header}
    />
  );
  const directoryTableSummary = useMemo(() => {
    if (activeTab === "customers") {
      return paginatedList.reduce(
        (accumulator, row) => {
          accumulator.count += 1;
          accumulator.orders += toNumber(row.orders);
          accumulator.bookings += toNumber(row.bookings);
          accumulator.lifetime += toNumber(row.total_spent) + toNumber(row.total_rented);
          return accumulator;
        },
        { count: 0, orders: 0, bookings: 0, lifetime: 0 }
      );
    }

    if (activeTab === "vendors") {
      const totals = paginatedList.reduce(
        (accumulator, row) => {
          accumulator.count += 1;
          accumulator.products += toNumber(row.products);
          const leadTime = toNumber(row.leadTimeDays);
          if (leadTime > 0) {
            accumulator.leadTimeTotal += leadTime;
            accumulator.leadTimeCount += 1;
          }
          return accumulator;
        },
        { count: 0, products: 0, leadTimeTotal: 0, leadTimeCount: 0 }
      );

      return {
        ...totals,
        averageLeadTime: totals.leadTimeCount ? totals.leadTimeTotal / totals.leadTimeCount : 0,
      };
    }

    return { count: paginatedList.length };
  }, [activeTab, paginatedList]);

  const openCreateModal = useCallback(() => {
    if (isDriverUser) return;
    setEditing(null);
    setSaveError("");
    if (activeTab === "customers") {
      setCustomerForm({ name: "", email: "", phone: "" });
    } else {
      setUserForm({ firstName: "", lastName: "", password: "", role: "Staff" });
    }
    setModalOpen(true);
  }, [activeTab, isDriverUser]);

  const openEditModal = useCallback((row) => {
    if (isDriverUser) return;
    setEditing(row);
    setSaveError("");
    if (activeTab === "customers") {
      setCustomerForm({
        name: row.name || "",
        email: row.email || "",
        phone: row.phone || "",
      });
    } else {
      setUserForm({
        firstName: row.firstName || "",
        lastName: row.lastName || "",
        password: "",
        role: row.role || "Staff",
      });
    }
    setModalOpen(true);
  }, [activeTab, isDriverUser]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setSaveError("");
  };

  const openDetail = useCallback(async (row) => {
    setDetailOpen(true);
    setDetailError("");
    setDetailRecord(null);
    setDetailTab(activeTab);

    if (activeTab === "customers") {
      setDetailLoading(true);
      try {
        const res = await fetch(`/.netlify/functions/customers?id=${row.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load customer details.");
        setDetailRecord(data);
      } catch (err) {
        console.error("Customer detail fetch failed", err);
        setDetailError(err.message || "Failed to load customer details.");
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    if (activeTab === "vendors") {
      setDetailRecord(row);
      setDetailLoading(false);
    }
  }, [activeTab]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRecord(null);
    setDetailLoading(false);
    setDetailError("");
    setDetailTab("");
  };

  const save = async (event) => {
    event.preventDefault();
    setSaveError("");

    if (activeTab === "vendors" || isDriverUser) return;

    const trimmedFirst = userForm.firstName.trim();
    const trimmedLast = userForm.lastName.trim();
    const trimmedPassword = userForm.password.trim();
    const trimmedCustomerName = customerForm.name.trim();
    const trimmedCustomerEmail = customerForm.email.trim();
    const trimmedCustomerPhone = customerForm.phone.trim();

    setSaving(true);
    try {
      if (activeTab === "customers") {
        if (!trimmedCustomerName) {
          throw new Error("Name is required.");
        }

        const isEdit = Boolean(editing?.id);
        const response = await fetch("/.netlify/functions/customers", {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: isEdit ? editing.id : undefined,
            name: trimmedCustomerName,
            email: trimmedCustomerEmail,
            phone: trimmedCustomerPhone,
          }),
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Save failed.");

        setCustomers((prev) => {
          const next = isEdit ? prev.map((item) => (item.id === payload.id ? payload : item)) : [payload, ...prev];
          return [...next].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        });
      } else {
        if (!trimmedFirst || !trimmedLast) {
          throw new Error("First and last name are required.");
        }

        const isEdit = Boolean(editing?.id);
        if (!isEdit && !trimmedPassword) {
          throw new Error("Password is required when creating a user.");
        }

        const requestBody = {
          id: isEdit ? editing.id : undefined,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          role: userForm.role,
        };

        if (!isEdit || trimmedPassword) {
          requestBody.password = trimmedPassword;
        }

        const response = await fetch("/.netlify/functions/users", {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Save failed.");

        setUsers((prev) => {
          const next = isEdit ? prev.map((item) => (item.id === payload.id ? payload : item)) : [payload, ...prev];
          return next;
        });
      }

      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      console.error("Save failed", err);
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const title = activeTab === "customers" ? "Customer Directory" : activeTab === "vendors" ? "Vendor Directory" : "User Directory";
  const subtitle =
    activeTab === "customers"
      ? "Manage client contact details and history."
      : activeTab === "vendors"
        ? "Track vendor contacts, coverage, and lead times."
        : "Manage staff, admin accounts, and roles.";

  const canMutate = !isDriverUser && activeTab !== "vendors";
  const columnCount = activeTab === "customers" ? 9 : activeTab === "vendors" ? 8 : 6;
  const searchPlaceholder =
    activeTab === "customers"
      ? "Search name, email, phone"
      : activeTab === "vendors"
        ? "Search name, contact, email"
        : "Search name, email, role";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextTab = isDriverUser ? "customers" : normalizeDirectoryTab(params.get("tab"));
    const nextQuery = params.get("q") || "";
    setActiveTab((current) => (current === nextTab ? current : nextTab));
    setQuery((current) => (current === nextQuery ? current : nextQuery));
  }, [isDriverUser, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = String(params.get("action") || "").trim().toLowerCase();
    if (!action || loading) return;

    const targetTab = isDriverUser ? "customers" : normalizeDirectoryTab(params.get("tab"));
    if (targetTab !== activeTab) return;

    const resetSearch = () =>
      navigate(
        {
          pathname: location.pathname,
          search: buildDirectorySearch({ tab: targetTab, query: params.get("q") || "" }),
        },
        { replace: true }
      );

    if (action === "create") {
      if (canMutate) {
        openCreateModal();
      }
      resetSearch();
      return;
    }

    const recordId = params.get("id");
    if (!recordId) {
      resetSearch();
      return;
    }

    const sourceList =
      targetTab === "customers" ? customers : targetTab === "vendors" ? vendors : users;
    const targetRow = sourceList.find((item) => String(item.id) === String(recordId));

    if (!targetRow) {
      resetSearch();
      return;
    }

    if (action === "edit" && canMutate) {
      openEditModal(targetRow);
      resetSearch();
      return;
    }

    if (action === "view" && targetTab !== "users") {
      void openDetail(targetRow);
      resetSearch();
      return;
    }

    resetSearch();
  }, [
    activeTab,
    canMutate,
    customers,
    isDriverUser,
    loading,
    location.pathname,
    location.search,
    navigate,
    openCreateModal,
    openDetail,
    openEditModal,
    users,
    vendors,
  ]);

  return (
    <div className="customers-page">
      <div className="customers-shell">
        <AdminBreadcrumb items={[{ label: "Directory" }]} />
        <AdminPageHeader
          eyebrow="Directory"
          title={title}
          subtitle={subtitle}
          actionsClassName="admin-header-actions customers-actions"
          actions={
            <>
              <button type="button" className="customers-secondary" onClick={fetchAll}>
                <AppIcon icon={faRotateRight} />
                Refresh
              </button>
              {canMutate ? (
                <button type="button" className="customers-primary" onClick={openCreateModal}>
                  <AppIcon icon={faPlus} />
                  Add
                </button>
              ) : null}
            </>
          }
        />

        <section className="customers-panel">
          <div className="customers-panel-header">
            <div>
              <h3>Directory</h3>
              <span>{query ? `${currentList.length} match${currentList.length === 1 ? "" : "es"} / ${totalRecords} total` : `${totalRecords} total`}</span>
            </div>
            <div className="directory-tabs">
              {availableTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={tab.key === activeTab ? "directory-tab is-active" : "directory-tab"}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <label className="customers-search">
              Search
              <SearchField
                className="customers-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery("")}
                placeholder={searchPlaceholder}
                clearClassName="customers-search-clear"
              />
            </label>
          </div>

          {loading && <p className="customers-status">Loading directory...</p>}
          {!loading && error && <p className="customers-error">{error}</p>}

          {!loading && !error && (
            <>
              <div className="customers-table-wrapper">
                {renderDirectoryPagination(true)}
                <table className={`customers-table customers-table--${activeTab}`}>
                <thead>
                  {activeTab === "customers" ? (
                    <tr>
                      <th className="table-row-index">#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Orders</th>
                      <th>Bookings</th>
                      <th>Lifetime</th>
                      <th>Created</th>
                      <th aria-label="Actions" />
                    </tr>
                  ) : activeTab === "vendors" ? (
                    <tr>
                      <th className="table-row-index">#</th>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Products</th>
                      <th>Lead time</th>
                      <th aria-label="Actions" />
                    </tr>
                  ) : (
                    <tr>
                      <th className="table-row-index">#</th>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th aria-label="Actions" />
                    </tr>
                  )}
                </thead>
                <tbody>
                  {paginatedList.map((row, index) => {
                    return (
                      <tr key={`${activeTab}-${row.id}`}>
                        <td className="table-row-index">{clampedPage * pageSize + index}</td>
                        {activeTab === "customers" ? (
                          <>
                            <td>{row.name || "-"}</td>
                            <td>{row.email || "-"}</td>
                            <td>{row.phone || "-"}</td>
                            <td>{row.orders ?? 0}</td>
                            <td>{row.bookings ?? 0}</td>
                            <td>{formatMoney(toNumber(row.total_spent) + toNumber(row.total_rented))}</td>
                            <td>{formatDate(row.createdAt)}</td>
                          </>
                        ) : activeTab === "vendors" ? (
                          <>
                            <td>{row.name || "-"}</td>
                            <td>{row.contactName || "-"}</td>
                            <td>{row.email || "-"}</td>
                            <td>{row.phone || "-"}</td>
                            <td>{row.products ?? 0}</td>
                            <td>{formatLeadTime(row.leadTimeDays)}</td>
                          </>
                        ) : (
                          <>
                            {(() => {
                              const displayRole = row.role || "Staff";
                              const roleKey = displayRole.toLowerCase();
                              const colorClass = roleColors[roleKey] || "blue";
                              return (
                                <>
                                  <td>{row.email || "-"}</td>
                                  <td>
                                    {row.fullName || row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || "-"}
                                  </td>
                                  <td>
                                    <span className={`pill ${colorClass}`}>{displayRole}</span>
                                  </td>
                                  <td>{formatDate(row.createdAt)}</td>
                                </>
                              );
                            })()}
                          </>
                        )}
                        <td className="directory-actions">
                          {activeTab === "customers" && (
                            <>
                              <button
                                type="button"
                                className="directory-edit"
                                onClick={() => openDetail(row)}
                              >
                                <AppIcon icon={faEye} />
                              </button>
                              {canMutate ? (
                                <button
                                  type="button"
                                  className="directory-edit"
                                  onClick={() => openEditModal(row)}
                                >
                                  <AppIcon icon={faPen} />
                                  Edit
                                </button>
                              ) : null}
                            </>
                          )}
                          {activeTab === "vendors" && (
                            <button
                              type="button"
                              className="directory-edit"
                              onClick={() => openDetail(row)}
                            >
                              <AppIcon icon={faEye} />
                              View
                            </button>
                          )}
                          {activeTab === "users" && (
                            <button
                              type="button"
                              className="directory-edit"
                              onClick={() => openEditModal(row)}
                            >
                              <AppIcon icon={faPen} />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!currentList.length && (
                    <tr>
                      <td colSpan={columnCount} className="customers-empty">
                        {query ? "No matching records." : "No records found."}
                      </td>
                    </tr>
                  )}
                </tbody>
                {currentList.length > 0 && (
                  <tfoot className="admin-table-footer">
                    {activeTab === "customers" ? (
                      <tr>
                        <td className="admin-table-summary-cell is-count">
                          <span className="admin-table-summary-value">{directoryTableSummary.count} customers</span>
                        </td>
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">{directoryTableSummary.orders}</span>
                        </td>
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">{directoryTableSummary.bookings}</span>
                        </td>
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">{formatMoney(directoryTableSummary.lifetime)}</span>
                        </td>
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                      </tr>
                    ) : activeTab === "vendors" ? (
                      <tr>
                        <td className="admin-table-summary-cell is-count">
                          <span className="admin-table-summary-value">{directoryTableSummary.count} vendors</span>
                        </td>
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">{directoryTableSummary.products}</span>
                        </td>
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">
                            {directoryTableSummary.averageLeadTime
                              ? formatLeadTime(Math.round(directoryTableSummary.averageLeadTime))
                              : "Not set"}
                          </span>
                        </td>
                        <td className="admin-table-summary-cell is-empty" />
                      </tr>
                    ) : (
                      <tr>
                        <td className="admin-table-summary-cell is-count">
                          <span className="admin-table-summary-value">{directoryTableSummary.count} users</span>
                        </td>
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                      </tr>
                    )}
                  </tfoot>
                )}
                </table>
                {renderDirectoryPagination()}
              </div>
            </>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel">
            <header>
              <div>
                <p className="customers-eyebrow">{editing ? "Edit" : "New"}</p>
                <h2>{editing ? "Update" : "Add"} {activeTab === "customers" ? "customer" : "user"}</h2>
              </div>
              <button type="button" className="customers-modal-close" onClick={closeModal} aria-label="Close">
                <AppIcon icon={faXmark} />
              </button>
            </header>

            <form className="customers-form" onSubmit={save}>
              {activeTab === "customers" ? (
                <>
                  <label>
                    Name
                    <input
                      type="text"
                      value={customerForm.name}
                      onChange={(event) =>
                        setCustomerForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="Customer name"
                      required
                    />
                  </label>

                  <label>
                    Email (optional)
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(event) =>
                        setCustomerForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="email@example.com"
                    />
                  </label>

                  <label>
                    Phone (optional)
                    <input
                      type="tel"
                      value={customerForm.phone}
                      onChange={(event) =>
                        setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))
                      }
                      placeholder="+233 ..."
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    First name
                    <input
                      type="text"
                      value={userForm.firstName}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, firstName: event.target.value }))
                      }
                      placeholder="First name"
                      required
                    />
                  </label>

                  <label>
                    Last name
                    <input
                      type="text"
                      value={userForm.lastName}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                      placeholder="Last name"
                      required
                    />
                  </label>

                  <label>
                    Login email (auto)
                    <input
                      type="text"
                      value={generateEmailFromNames(userForm.firstName, userForm.lastName) || editing?.email || ""}
                      readOnly
                    />
                  </label>

                  <label>
                    Role
                    <SelectField
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, role: event.target.value }))
                      }
                    >
                      <option value="Admin">Admin</option>
                      <option value="Staff">Staff</option>
                      <option value="Water">Water</option>
                    </SelectField>
                  </label>

                  <label>
                    Password {editing ? "(leave blank to keep)" : ""}
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder={editing ? "" : "Set password"}
                    />
                  </label>
                </>
              )}

              {saveError && <p className="customers-error">{saveError}</p>}

              <div className="customers-form-actions">
                <button type="button" className="customers-secondary" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="customers-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel crm-detail-panel">
            <header>
              <div>
                <p className="customers-eyebrow">
                  {detailTab === "customers" ? "Customer profile" : "Vendor profile"}
                </p>
                <h2>
                  {detailTab === "customers"
                    ? detailRecord?.customer?.name || "Customer details"
                    : detailRecord?.name || "Vendor details"}
                </h2>
                {detailTab === "customers" && (
                  <p className="crm-muted">
                    {detailRecord?.customer?.email || "No email"} · {detailRecord?.customer?.phone || "No phone"}
                  </p>
                )}
                {detailTab === "vendors" && (
                  <p className="crm-muted">
                    {detailRecord?.contactName || "No contact"} · {detailRecord?.email || "No email"}
                  </p>
                )}
              </div>
              <button type="button" className="customers-modal-close" onClick={closeDetail} aria-label="Close">
                <AppIcon icon={faXmark} />
              </button>
            </header>

            {detailLoading && <p className="crm-muted">Loading details...</p>}
            {!detailLoading && detailError && <p className="crm-error">{detailError}</p>}
            {!detailLoading && !detailError && detailTab === "customers" && detailRecord && (
              <div className="crm-detail-grid">
                <div className="glass-card crm-detail-card">
                  <h4>Customer summary</h4>
                  <p>Orders: {detailRecord.totals?.orders ?? 0}</p>
                  <p>Bookings: {detailRecord.totals?.bookings ?? 0}</p>
                  <p>Retail spent: {formatMoney(detailRecord.totals?.totalSpent ?? 0)}</p>
                  <p>Rental spent: {formatMoney(detailRecord.totals?.totalRented ?? 0)}</p>
                </div>
                <div className="glass-card crm-detail-card">
                  <h4>Recent orders</h4>
                  {detailRecord.orders?.length ? (
                    <ul>
                      {detailRecord.orders.slice(0, 5).map((order) => (
                        <li key={`order-${order.id}`}>
                          {order.orderNumber || `Order #${order.id}`} · {formatDate(order.orderDate)} ·{" "}
                          {formatMoney(order.total_with_delivery ?? order.total_amount)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="crm-muted">No orders yet.</p>
                  )}
                </div>
                <div className="glass-card crm-detail-card">
                  <h4>Recent bookings</h4>
                  {detailRecord.bookings?.length ? (
                    <ul>
                      {detailRecord.bookings.slice(0, 5).map((booking) => (
                        <li key={`booking-${booking.id}`}>
                          Booking #{booking.id} · {formatDate(booking.eventDate)} ·{" "}
                          {formatMoney(booking.totalAmount)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="crm-muted">No bookings yet.</p>
                  )}
                </div>
              </div>
            )}
            {!detailLoading && !detailError && detailTab === "vendors" && detailRecord && (
              <div className="crm-detail-grid">
                <div className="glass-card crm-detail-card">
                  <h4>Vendor summary</h4>
                  <p>Contact: {detailRecord.contactName || "Not set"}</p>
                  <p>Email: {detailRecord.email || "Not set"}</p>
                  <p>Phone: {detailRecord.phone || "Not set"}</p>
                  <p>Lead time: {formatLeadTime(detailRecord.leadTimeDays)}</p>
                </div>
                <div className="glass-card crm-detail-card">
                  <h4>Products</h4>
                  {detailRecord.productNames?.length ? (
                    <ul>
                      {detailRecord.productNames.slice(0, 8).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="crm-muted">No products linked yet.</p>
                  )}
                </div>
                <div className="glass-card crm-detail-card">
                  <h4>Payments & notes</h4>
                  <p>Mobile money: {detailRecord.mobileMoneyNumber || "Not set"}</p>
                  <p>Bank: {detailRecord.bankName || "Not set"}</p>
                  <p>Account: {detailRecord.bankAccount || "Not set"}</p>
                  <p>{detailRecord.notes || "No notes yet."}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDirectory;
