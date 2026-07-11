import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FINANCE_STATUS_LABELS,
  calculateBalanceDueMajor,
  calculateFinanceStatusFromMajor,
} from "@faako/finance";
import {
  FiArchive,
  FiCreditCard,
  FiDownload,
  FiEdit3,
  FiMail,
  FiMoreVertical,
  FiPlus,
  FiSlash,
  FiTrash2,
} from "react-icons/fi";
import { AnimatedLoadingState, DateField, SelectField } from "@faako/ui";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client";
import { readStoredSessionUser } from "../../utils/authSession";
import {
  DISPLAY_CURRENCY_CODE,
  convertAmountToDisplayGhs,
  formatAmountAsGhs,
  formatGhsAmount,
} from "../../utils/displayCurrency";
import { buildInvoiceNotes } from "../../utils/invoiceNotes";
import { calculateInvoiceTotals, downloadInvoicePdf } from "../../utils/invoicePdf";

const INVOICE_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "QUOTATION", label: "Quotation" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VOID", label: "Void" },
];

const FILTER_STATUS_OPTIONS = [{ value: "all", label: "All" }, ...INVOICE_STATUS_OPTIONS];
const FORM_STATUS_OPTIONS = INVOICE_STATUS_OPTIONS.filter(
  (option) => !["PAID", "VOID"].includes(option.value)
);

const STATUS_TONE = {
  DRAFT: "info",
  QUOTATION: "warning",
  SENT: "warning",
  ACCEPTED: "success",
  DECLINED: "danger",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "danger",
};

const PAYMENT_STATUS_TONE = {
  unpaid: "warning",
  part_paid: "info",
  paid: "success",
  overpaid: "warning",
};

const CURRENCY_OPTIONS = ["CAD", "GHS"];
const DEFAULT_QUANTITY_UNIT = "unit";
const QUANTITY_UNITS = ["unit", "hours", "days", "weeks", "months", "sessions", "units", "projects"];
const UNIT_MARKER = "[unit:";
const UNIT_SINGULAR_OVERRIDES = {
  hours: "hour",
  days: "day",
  weeks: "week",
  months: "month",
  sessions: "session",
  projects: "project",
  units: "unit",
};

const normalizeQuantityUnit = (value) => {
  const normalized = String(value || DEFAULT_QUANTITY_UNIT).trim();
  return normalized || DEFAULT_QUANTITY_UNIT;
};

const formatQuantityUnit = (quantity, unit) => {
  const normalizedUnit = normalizeQuantityUnit(unit);
  const normalizedQuantity = Number(quantity);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity !== 1) {
    return normalizedUnit;
  }

  const unitOverride = UNIT_SINGULAR_OVERRIDES[normalizedUnit.toLowerCase()];
  if (unitOverride) return unitOverride;
  if (normalizedUnit.endsWith("s")) {
    return normalizedUnit.slice(0, -1);
  }
  return normalizedUnit;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatAmount = (amount, currency) => formatAmountAsGhs(amount, currency);

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const buildFutureDate = (offsetDays = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const createLineItemId = () =>
  `invoice-line-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const MONTHLY_CHARGE_MARKER = "↳ ";

const parseLineItemDescription = (rawDescription = "") => {
  const raw = String(rawDescription || "");
  const isMonthlyCharge = raw.startsWith(MONTHLY_CHARGE_MARKER);
  const withoutMarker = isMonthlyCharge
    ? raw.slice(MONTHLY_CHARGE_MARKER.length).trimStart()
    : raw;

  const unitMatch = withoutMarker.match(/\s*\[unit:\s*([^\]]+)\]\s*$/);
  if (!unitMatch) {
    return {
      isMonthlyCharge,
      description: withoutMarker.trim(),
      unit: DEFAULT_QUANTITY_UNIT,
    };
  }

  return {
    isMonthlyCharge,
    description: withoutMarker.slice(0, unitMatch.index).trim(),
    unit: String(unitMatch[1] || "").trim() || DEFAULT_QUANTITY_UNIT,
  };
};

const serializeLineItemDescription = (lineItem) => {
  const rawDescription = String(lineItem?.description || "").trim();
  const unit = normalizeQuantityUnit(lineItem?.unit);
  const prefix = lineItem?.parentLineId ? `${MONTHLY_CHARGE_MARKER}` : "";
  const unitSuffix =
    unit && unit !== DEFAULT_QUANTITY_UNIT ? `${UNIT_MARKER} ${unit}]` : "";
  return `${prefix}${rawDescription}${unitSuffix}`.trim();
};

const buildFormLineItems = (lineItems = []) => {
  let parentId = null;
  return lineItems.map((lineItem) => {
    const lineId = createLineItemId();
    const parsedLineItem = parseLineItemDescription(lineItem?.description || "");
    const isMonthlyCharge = parsedLineItem.isMonthlyCharge;
    const description = parsedLineItem.description;
    const unit = normalizeQuantityUnit(parsedLineItem.unit);
    const nextLineItem = {
      id: lineId,
      description,
      unit,
      quantity: String(lineItem?.quantity ?? "1"),
      rate: String(lineItem?.unitPrice ?? "0"),
      parentLineId: null,
    };

    if (isMonthlyCharge && parentId) {
      nextLineItem.parentLineId = parentId;
    }
    if (!isMonthlyCharge) {
      parentId = lineId;
    }

    return nextLineItem;
  });
};

const buildInvoiceLineViewItems = (lineItems = []) =>
  (lineItems || []).map((lineItem, index) => {
    const parsedLineItem = parseLineItemDescription(lineItem?.description || "");
    const isMonthlyCharge = parsedLineItem.isMonthlyCharge;
    const description = parsedLineItem.description;
    const quantity = Number(lineItem?.quantity || 0);
    const rate = Number(lineItem?.unitPrice ?? lineItem?.rate ?? 0);
    return {
      id: lineItem?.id ?? `line-${index + 1}`,
      description,
      unit: normalizeQuantityUnit(parsedLineItem.unit),
      isMonthlyCharge,
      quantity,
      rate,
      amount: quantity * rate,
    };
  });

const createLineItem = ({ parentLineId = null, quantity = "1", rate = "" } = {}) => ({
  id: createLineItemId(),
  description: "",
  unit: DEFAULT_QUANTITY_UNIT,
  quantity,
  rate,
  parentLineId: parentLineId || null,
});

const buildInvoiceForm = ({ organizationId = "", invoice = null } = {}) => ({
  organizationId,
  invoiceNumber: invoice?.invoiceNumber || "",
  status: invoice?.status || "DRAFT",
  currency: invoice?.currency || "CAD",
  issueDate: invoice?.issueDate ? toDateInput(invoice.issueDate) : buildTodayDate(),
  dueDate: invoice?.dueDate ? toDateInput(invoice.dueDate) : buildFutureDate(14),
  clientName: invoice?.clientName || "",
  clientEmail: invoice?.clientEmail || "",
  clientAddress: invoice?.clientAddress || "",
  notes: typeof invoice?.notes === "string" && invoice.notes.trim() ? invoice.notes : buildInvoiceNotes(),
  taxRate: invoice?.taxRate !== undefined ? String(invoice.taxRate) : "0",
  discount: invoice?.discount !== undefined ? String(invoice.discount) : "0",
  lineItems:
    Array.isArray(invoice?.lineItems) && invoice.lineItems.length
      ? buildFormLineItems(invoice.lineItems)
      : [createLineItem()],
});

const getInvoicePaymentSummary = (invoice = {}) => {
  const total = Number(invoice?.total || 0);
  const paidAmount = Number(invoice?.paidAmount || 0);
  return {
    paidAmount,
    balanceDue:
      invoice?.balanceDue !== undefined
        ? Number(invoice.balanceDue)
        : calculateBalanceDueMajor({ total, paid: paidAmount }),
    paymentStatus:
      invoice?.paymentStatus || calculateFinanceStatusFromMajor({ total, paid: paidAmount }),
  };
};

const buildPaymentForm = (invoice = null) => {
  const payment = getInvoicePaymentSummary(invoice || {});
  const amount = payment.balanceDue > 0 ? payment.balanceDue.toFixed(2) : "";
  return {
    amount,
    paidAt: buildTodayDate(),
    note: "",
  };
};

const canRecordInvoicePayment = (invoice = {}) => {
  const payment = getInvoicePaymentSummary(invoice);
  return (
    payment.balanceDue > 0 &&
    !["PAID", "VOID", "DECLINED", "QUOTATION"].includes(invoice?.status)
  );
};

const Invoicing = () => {
  const storedUser = useMemo(() => readStoredSessionUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const userOrgId = storedUser?.organizationId ? String(storedUser.organizationId) : "";

  const [organizations, setOrganizations] = useState([]);
  const [organizationError, setOrganizationError] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    isAdmin ? "all" : userOrgId || ""
  );
  const [statusFilter, setStatusFilter] = useState("all");

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [formState, setFormState] = useState(() =>
    buildInvoiceForm({ organizationId: userOrgId || "" })
  );
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isSendingQuotation, setIsSendingQuotation] = useState(false);
  const [isRespondingToQuote, setIsRespondingToQuote] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState(() => buildPaymentForm());
  const [paymentError, setPaymentError] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [openActionId, setOpenActionId] = useState(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(() => new Set());
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);

  const loadOrganizations = useCallback(async () => {
    if (!isAdmin) return;

    setOrganizationError("");
    try {
      const payload = await apiGet("/api/organizations", {
        fallbackMessage: "Unable to load organizations",
      });

      setOrganizations(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setOrganizationError(loadError.message || "Unable to load organizations");
    }
  }, [isAdmin]);

  const loadInvoices = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const query = new URLSearchParams();
        if (statusFilter !== "all") {
          query.set("status", statusFilter);
        }
        if (selectedOrganizationId) {
          if (isAdmin && selectedOrganizationId === "all") {
            query.set("organizationId", "all");
          } else if (selectedOrganizationId !== "all") {
            query.set("organizationId", selectedOrganizationId);
          }
        }

        const payload = await apiGet(`/api/invoices?${query.toString()}`, {
          fallbackMessage: "Unable to load invoices",
        });

        setInvoices(Array.isArray(payload?.invoices) ? payload.invoices : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load invoices");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAdmin, selectedOrganizationId, statusFilter]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    setOpenActionId(null);
    setSelectedInvoiceIds((current) => {
      const visibleIds = new Set(invoices.map((invoice) => String(invoice.id)));
      const next = new Set([...current].filter((id) => visibleIds.has(String(id))));
      return next.size === current.size ? current : next;
    });
  }, [invoices]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!showForm && !selectedInvoice && !paymentInvoice) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [paymentInvoice, showForm, selectedInvoice]);

  const invoiceTotals = useMemo(
    () =>
      calculateInvoiceTotals({
        lineItems: formState.lineItems,
        taxRate: formState.taxRate,
        discount: formState.discount,
      }),
    [formState.lineItems, formState.taxRate, formState.discount]
  );

  const selectedInvoiceLineItems = useMemo(
    () => buildInvoiceLineViewItems(selectedInvoice?.lineItems || []),
    [selectedInvoice]
  );
  const selectedInvoiceTotals = useMemo(
    () =>
      calculateInvoiceTotals({
        lineItems: selectedInvoiceLineItems.map((lineItem) => ({
          description: lineItem.description,
          quantity: lineItem.quantity,
          rate: lineItem.rate,
        })),
        taxRate: selectedInvoice?.taxRate || 0,
        discount: selectedInvoice?.discount || 0,
      }),
    [selectedInvoice, selectedInvoiceLineItems]
  );
  const selectedMonthlyChargeTotal = useMemo(
    () =>
      selectedInvoiceLineItems.reduce(
        (acc, lineItem) => (lineItem.isMonthlyCharge ? acc + lineItem.amount : acc),
        0
      ),
    [selectedInvoiceLineItems]
  );
  const selectedRegularSubtotal = useMemo(
    () =>
      Math.max((selectedInvoiceTotals.subtotal ?? 0) - (selectedMonthlyChargeTotal || 0), 0),
    [selectedInvoiceTotals.subtotal, selectedMonthlyChargeTotal]
  );
  const selectedInvoicePayment = useMemo(
    () => getInvoicePaymentSummary(selectedInvoice || {}),
    [selectedInvoice]
  );
  const paymentInvoiceSummary = useMemo(
    () => getInvoicePaymentSummary(paymentInvoice || {}),
    [paymentInvoice]
  );

  const formItemTotals = useMemo(() => {
    let regularSubtotal = 0;
    let monthlyChargeSubtotal = 0;

    formState.lineItems.forEach((lineItem) => {
      const quantity = Number(lineItem.quantity || 0);
      const rate = Number(lineItem.rate || 0);
      const amount = Number.isFinite(quantity) && Number.isFinite(rate) ? quantity * rate : 0;
      if (lineItem.parentLineId) {
        monthlyChargeSubtotal += amount;
      } else {
        regularSubtotal += amount;
      }
    });

    return {
      regularSubtotal,
      monthlyChargeSubtotal,
    };
  }, [formState.lineItems]);

  const summary = useMemo(() => {
    const base = {
      openCount: 0,
      overdueCount: 0,
      paidCount: 0,
      openTotalGhs: 0,
      paidTotalGhs: 0,
    };

    invoices.forEach((invoice) => {
      const payment = getInvoicePaymentSummary(invoice);
      const displayPaidAmount = convertAmountToDisplayGhs(payment.paidAmount, invoice.currency);
      const displayBalanceDue = convertAmountToDisplayGhs(payment.balanceDue, invoice.currency);

      if (invoice.status === "OVERDUE") {
        base.overdueCount += 1;
      }
      if (invoice.status === "PAID") {
        base.paidCount += 1;
        base.paidTotalGhs += displayPaidAmount;
      } else if (invoice.status !== "VOID") {
        base.openCount += 1;
        base.openTotalGhs += displayBalanceDue;
      }
    });

    return base;
  }, [invoices]);

  const invoiceRowColumnClass = isAdmin ? "is-10" : "is-9";
  const selectedInvoiceCount = selectedInvoiceIds.size;
  const allVisibleInvoicesSelected =
    isAdmin &&
    invoices.length > 0 &&
    invoices.every((invoice) => selectedInvoiceIds.has(String(invoice.id)));

  const openCreateModal = () => {
    const defaultOrgId =
      selectedOrganizationId && selectedOrganizationId !== "all"
        ? selectedOrganizationId
        : userOrgId || "";
    setFormState(buildInvoiceForm({ organizationId: defaultOrgId }));
    setEditingInvoiceId(null);
    setFormError("");
    setShowForm(true);
  };

  const openEditModal = (invoice) => {
    const invoiceOrganizationId = invoice.organization?.id ? String(invoice.organization.id) : userOrgId || "";
    setFormState(buildInvoiceForm({ organizationId: invoiceOrganizationId, invoice }));
    setEditingInvoiceId(invoice.id);
    setFormError("");
    setShowForm(true);
  };

  const closeFormModal = () => {
    setShowForm(false);
    setEditingInvoiceId(null);
    setFormError("");
  };

  const openInvoiceModal = (invoice) => {
    setSelectedInvoice(invoice);
    setError("");
  };

  const closeInvoiceModal = () => {
    setSelectedInvoice(null);
  };

  const openEditFromInvoiceModal = () => {
    if (!selectedInvoice || !isAdmin) return;
    const invoiceToEdit = selectedInvoice;
    setSelectedInvoice(null);
    openEditModal(invoiceToEdit);
  };

  const openPaymentModal = (invoice) => {
    if (!invoice || !isAdmin || !canRecordInvoicePayment(invoice)) return;
    setPaymentInvoice(invoice);
    setPaymentForm(buildPaymentForm(invoice));
    setPaymentError("");
    setSelectedInvoice(null);
  };

  const closePaymentModal = () => {
    if (isRecordingPayment) return;
    setPaymentInvoice(null);
    setPaymentForm(buildPaymentForm());
    setPaymentError("");
  };

  const updateFormField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const updatePaymentField = (field, value) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (lineId, field, value) => {
    setFormState((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((lineItem) =>
        lineItem.id === lineId ? { ...lineItem, [field]: value } : lineItem
      ),
    }));
  };

  const addLineItem = () => {
    setFormState((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, createLineItem()],
    }));
  };

  const addMonthlyChargeLine = (parentLineId) => {
    setFormState((prev) => {
      const parentIndex = prev.lineItems.findIndex((lineItem) => lineItem.id === parentLineId);
      if (parentIndex === -1) return prev;

      const lastChildIndex = prev.lineItems.reduce((current, lineItem, index) => {
        if (lineItem.parentLineId === parentLineId) return index;
        return current;
      }, parentIndex);

      const nextLineItems = [...prev.lineItems];
      nextLineItems.splice(lastChildIndex + 1, 0, createLineItem({ parentLineId, rate: "" }));
      return {
        ...prev,
        lineItems: nextLineItems,
      };
    });
  };

  const removeLineItem = (lineId) => {
    setFormState((prev) => {
      if (prev.lineItems.length <= 1) return prev;

      const targetLine = prev.lineItems.find((lineItem) => lineItem.id === lineId);
      if (!targetLine) return prev;

      const idsToRemove =
        targetLine.parentLineId === null
          ? [
              targetLine.id,
              ...prev.lineItems
                .filter((lineItem) => lineItem.parentLineId === targetLine.id)
                .map((lineItem) => lineItem.id),
            ]
          : [targetLine.id];

      const nextLineItems = prev.lineItems.filter(
        (lineItem) => !idsToRemove.includes(lineItem.id)
      );
      if (!nextLineItems.length) {
        return {
          ...prev,
          lineItems: [createLineItem()],
        };
      }

      return {
        ...prev,
        lineItems: nextLineItems,
      };
    });
  };

  const handleSaveInvoice = async (event) => {
    event.preventDefault();
    setFormError("");

    const clientName = formState.clientName.trim();
    if (!clientName) {
      setFormError("Client name is required.");
      return;
    }

    if (!formState.issueDate) {
      setFormError("Issue date is required.");
      return;
    }

    if (!formState.lineItems.length) {
      setFormError("Add at least one line item.");
      return;
    }

    const missingDescription = formState.lineItems.some(
      (lineItem) => !String(lineItem.description || "").trim()
    );
    if (missingDescription) {
      setFormError("Each line item needs a description.");
      return;
    }

    if (!invoiceTotals.items.length) {
      setFormError("Add at least one valid line item.");
      return;
    }
    const payload = {
      invoiceNumber: formState.invoiceNumber.trim() || undefined,
      status: ["PAID", "VOID"].includes(formState.status) ? undefined : formState.status,
      currency: formState.currency,
      issueDate: formState.issueDate,
      dueDate: formState.dueDate || null,
      clientName,
      clientEmail: formState.clientEmail.trim() || null,
      clientAddress: formState.clientAddress.trim() || null,
      notes: formState.notes.trim() || null,
      taxRate: Number(formState.taxRate || 0),
      discount: Number(formState.discount || 0),
      lineItems: formState.lineItems.map((lineItem) => ({
        description: serializeLineItemDescription(lineItem),
        quantity: Number(lineItem.quantity || 0),
        unitPrice: Number(lineItem.rate || 0),
        parentLineId: lineItem.parentLineId || null,
      })),
      organizationId:
        isAdmin && formState.organizationId ? Number(formState.organizationId) : undefined,
    };

    setIsSaving(true);
    try {
      const endpoint = editingInvoiceId
        ? `/api/invoices/${editingInvoiceId}`
        : "/api/invoices";
      const method = editingInvoiceId ? "PATCH" : "POST";

      method === "PATCH"
        ? await apiPatch(endpoint, payload, { fallbackMessage: "Unable to save invoice" })
        : await apiPost(endpoint, payload, { fallbackMessage: "Unable to save invoice" });

      closeFormModal();
      await loadInvoices({ silent: true });
      setNotice(editingInvoiceId ? "Invoice updated." : "Invoice created.");
    } catch (saveError) {
      setFormError(saveError.message || "Unable to save invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (invoice, nextStatus) => {
    try {
      setError("");
      const payload = await apiPatch(`/api/invoices/${invoice.id}`, { status: nextStatus }, {
        fallbackMessage: "Unable to update invoice status",
      });
      const nextInvoice = payload?.id ? payload : { ...invoice, status: nextStatus };

      setInvoices((prev) =>
        prev.map((existingInvoice) =>
          existingInvoice.id === nextInvoice.id ? nextInvoice : existingInvoice
        )
      );
      setSelectedInvoice((prev) => (prev?.id === nextInvoice.id ? nextInvoice : prev));
      await loadInvoices({ silent: true });
      setNotice(`Invoice ${invoice.invoiceNumber} marked ${nextStatus.toLowerCase()}.`);
    } catch (statusError) {
      setError(statusError.message || "Unable to update invoice status");
    }
  };

  const toggleInvoiceSelection = (invoiceId) => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      const key = String(invoiceId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllVisibleInvoices = () => {
    setSelectedInvoiceIds((current) => {
      if (allVisibleInvoicesSelected) return new Set();
      const next = new Set(current);
      invoices.forEach((invoice) => next.add(String(invoice.id)));
      return next;
    });
  };

  const removeInvoicesFromLedger = (ids) => {
    const idSet = new Set(ids.map(String));
    setInvoices((prev) => prev.filter((invoice) => !idSet.has(String(invoice.id))));
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      idSet.forEach((id) => next.delete(id));
      return next;
    });
    setSelectedInvoice((prev) => (prev && idSet.has(String(prev.id)) ? null : prev));
  };

  const handleArchiveInvoice = async (invoice, { confirmAction = true } = {}) => {
    if (!invoice?.id) return;
    if (
      confirmAction &&
      !window.confirm(`Archive invoice ${invoice.invoiceNumber}? It will be hidden from the active ledger.`)
    ) {
      return;
    }

    try {
      setError("");
      setOpenActionId(null);
      await apiPost(`/api/invoices/${invoice.id}/archive`, {}, {
        fallbackMessage: "Unable to archive invoice",
      });
      removeInvoicesFromLedger([invoice.id]);
      await loadInvoices({ silent: true });
      setNotice(`Invoice ${invoice.invoiceNumber} archived.`);
    } catch (archiveError) {
      setError(archiveError.message || "Unable to archive invoice.");
    }
  };

  const handleDeleteInvoice = async (invoice, { confirmAction = true } = {}) => {
    if (!invoice?.id) return;
    if (
      confirmAction &&
      !window.confirm(`Delete invoice ${invoice.invoiceNumber}? This permanently removes the invoice and its line items.`)
    ) {
      return;
    }

    try {
      setError("");
      setOpenActionId(null);
      await apiDelete(`/api/invoices/${invoice.id}`, {
        fallbackMessage: "Unable to delete invoice",
      });
      removeInvoicesFromLedger([invoice.id]);
      await loadInvoices({ silent: true });
      setNotice(`Invoice ${invoice.invoiceNumber} deleted.`);
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete invoice.");
    }
  };

  const handleBulkArchiveInvoices = async () => {
    const selectedInvoices = invoices.filter((invoice) => selectedInvoiceIds.has(String(invoice.id)));
    if (!selectedInvoices.length) return;
    if (
      !window.confirm(
        `Archive ${selectedInvoices.length} selected invoice${selectedInvoices.length === 1 ? "" : "s"}?`
      )
    ) {
      return;
    }

    setIsBulkActionRunning(true);
    setError("");
    try {
      await Promise.all(
        selectedInvoices.map((invoice) =>
          apiPost(`/api/invoices/${invoice.id}/archive`, {}, {
            fallbackMessage: "Unable to archive selected invoices",
          })
        )
      );
      removeInvoicesFromLedger(selectedInvoices.map((invoice) => invoice.id));
      await loadInvoices({ silent: true });
      setNotice(`${selectedInvoices.length} invoice${selectedInvoices.length === 1 ? "" : "s"} archived.`);
    } catch (bulkError) {
      setError(bulkError.message || "Unable to archive selected invoices.");
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const handleBulkDeleteInvoices = async () => {
    const selectedInvoices = invoices.filter((invoice) => selectedInvoiceIds.has(String(invoice.id)));
    if (!selectedInvoices.length) return;
    if (
      !window.confirm(
        `Delete ${selectedInvoices.length} selected invoice${selectedInvoices.length === 1 ? "" : "s"}? This permanently removes their line items too.`
      )
    ) {
      return;
    }

    setIsBulkActionRunning(true);
    setError("");
    try {
      await Promise.all(
        selectedInvoices.map((invoice) =>
          apiDelete(`/api/invoices/${invoice.id}`, {
            fallbackMessage: "Unable to delete selected invoices",
          })
        )
      );
      removeInvoicesFromLedger(selectedInvoices.map((invoice) => invoice.id));
      await loadInvoices({ silent: true });
      setNotice(`${selectedInvoices.length} invoice${selectedInvoices.length === 1 ? "" : "s"} deleted.`);
    } catch (bulkError) {
      setError(bulkError.message || "Unable to delete selected invoices.");
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    if (!paymentInvoice) return;

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a payment amount greater than 0.");
      return;
    }
    if (amount > paymentInvoiceSummary.balanceDue + 0.005) {
      setPaymentError(
        `Payment cannot exceed the balance due of ${formatAmount(
          paymentInvoiceSummary.balanceDue,
          paymentInvoice.currency
        )}.`
      );
      return;
    }
    if (!paymentForm.paidAt) {
      setPaymentError("Payment date is required.");
      return;
    }

    setIsRecordingPayment(true);
    setPaymentError("");
    setError("");
    try {
      const payload = await apiPost(
        `/api/invoices/${paymentInvoice.id}/payments`,
        {
          amount,
          paidAt: paymentForm.paidAt,
          note: paymentForm.note.trim() || null,
        },
        { fallbackMessage: "Unable to record invoice payment" }
      );
      const nextInvoice = payload?.invoice || null;
      if (nextInvoice?.id) {
        setInvoices((prev) =>
          prev.map((invoice) => (invoice.id === nextInvoice.id ? nextInvoice : invoice))
        );
      }
      setPaymentInvoice(null);
      setPaymentForm(buildPaymentForm());
      setPaymentError("");
      await loadInvoices({ silent: true });
      setNotice(`Payment recorded for invoice ${paymentInvoice.invoiceNumber}.`);
    } catch (paymentSaveError) {
      setPaymentError(paymentSaveError.message || "Unable to record invoice payment.");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedInvoice) return;
    if (selectedInvoice.status !== "DRAFT") {
      setError("Only draft invoices can be sent.");
      return;
    }
    if (!selectedInvoice.clientEmail) {
      setError("Add a valid client email before sending the invoice.");
      return;
    }

    setIsSendingInvoice(true);
    setError("");
    try {
      const payload = await apiPost(`/api/invoices/${selectedInvoice.id}/send`, undefined, {
        fallbackMessage: "Unable to send invoice",
      });

      const nextInvoice = payload?.id ? payload : { ...selectedInvoice, status: "SENT" };
      const deliveryRecipient = String(
        payload?.deliveryRecipient || nextInvoice?.clientEmail || selectedInvoice.clientEmail || ""
      ).trim();
      const intendedRecipient = String(payload?.intendedRecipient || "").trim();
      const recipientLabel =
        payload?.emailRerouted && intendedRecipient && deliveryRecipient
          ? `${deliveryRecipient} (rerouted from ${intendedRecipient})`
          : deliveryRecipient || selectedInvoice.clientEmail;
      setSelectedInvoice(nextInvoice);
      await loadInvoices({ silent: true });
      setNotice(`Invoice ${nextInvoice.invoiceNumber} sent to ${recipientLabel}.`);
    } catch (sendError) {
      setError(sendError.message || "Unable to send invoice");
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleSendQuotation = async () => {
    if (!selectedInvoice) return;
    if (!["DRAFT", "SENT"].includes(selectedInvoice.status)) {
      setError("Only draft or sent invoices can be sent as a quotation.");
      return;
    }
    if (!selectedInvoice.clientEmail) {
      setError("Add a valid client email before sending the quotation.");
      return;
    }
    setIsSendingQuotation(true);
    setError("");
    try {
      const payload = await apiPost(`/api/invoices/${selectedInvoice.id}/send-quotation`, undefined, {
        fallbackMessage: "Unable to send quotation",
      });
      const nextInvoice = payload?.id ? payload : { ...selectedInvoice, status: "QUOTATION" };
      setSelectedInvoice(nextInvoice);
      await loadInvoices({ silent: true });
      setNotice(`Quotation ${nextInvoice.invoiceNumber} sent to ${selectedInvoice.clientEmail}.`);
    } catch (sendError) {
      setError(sendError.message || "Unable to send quotation");
    } finally {
      setIsSendingQuotation(false);
    }
  };

  const handleAcceptQuotation = async () => {
    if (!selectedInvoice) return;
    setIsRespondingToQuote(true);
    setError("");
    try {
      const payload = await apiPost(`/api/invoices/${selectedInvoice.id}/accept`, undefined, {
        fallbackMessage: "Unable to accept quotation",
      });
      const nextInvoice = payload?.id ? payload : { ...selectedInvoice, status: "ACCEPTED" };
      setSelectedInvoice(nextInvoice);
      await loadInvoices({ silent: true });
      setNotice(`Quotation ${nextInvoice.invoiceNumber} marked as accepted.`);
    } catch (err) {
      setError(err.message || "Unable to accept quotation");
    } finally {
      setIsRespondingToQuote(false);
    }
  };

  const handleDeclineQuotation = async () => {
    if (!selectedInvoice) return;
    setIsRespondingToQuote(true);
    setError("");
    try {
      const payload = await apiPost(`/api/invoices/${selectedInvoice.id}/decline`, undefined, {
        fallbackMessage: "Unable to decline quotation",
      });
      const nextInvoice = payload?.id ? payload : { ...selectedInvoice, status: "DECLINED" };
      setSelectedInvoice(nextInvoice);
      await loadInvoices({ silent: true });
      setNotice(`Quotation ${nextInvoice.invoiceNumber} marked as declined.`);
    } catch (err) {
      setError(err.message || "Unable to decline quotation");
    } finally {
      setIsRespondingToQuote(false);
    }
  };

  const handleDownloadPdf = async (invoice) => {
    if (isPdfDownloading) return;
    setIsPdfDownloading(true);
    setError("");

    try {
      await downloadInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        billFrom: "By Nana",
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        clientAddress: invoice.clientAddress,
        currency: invoice.currency,
        lineItems: (invoice.lineItems || []).map((lineItem) => ({
          description: lineItem.description,
          quantity: lineItem.quantity,
          rate: lineItem.unitPrice,
          parentLineId: lineItem.parentLineId || null,
        })),
        taxRate: invoice.taxRate,
        discount: invoice.discount,
        paidAmount: invoice.paidAmount,
        notes: invoice.notes || "",
      });
      setNotice(`Invoice ${invoice.invoiceNumber} PDF downloaded.`);
    } catch (downloadError) {
      setError(downloadError.message || "Unable to download invoice PDF.");
    } finally {
      setIsPdfDownloading(false);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Invoicing</h1>
          <p className="muted">Create invoices, track payment status, and export PDFs.</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadInvoices({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          {isAdmin ? (
            <button className="button button-primary" type="button" onClick={openCreateModal}>
              <FiPlus aria-hidden="true" />
              <span>New invoice</span>
            </button>
          ) : null}
        </div>
      </header>

      {organizationError ? <div className="notice">{organizationError}</div> : null}
      {error ? <div className="notice is-error">{error}</div> : null}
      {notice ? <div className="notice is-success">{notice}</div> : null}
      {!isAdmin ? (
        <div className="notice">Read-only mode: only admins can create or update invoices.</div>
      ) : null}

      <section className="panel">
        <div className="invoice-grid">
          <SelectField
              fieldClassName="form-field"
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {FILTER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </SelectField>

          {isAdmin ? (
            <SelectField
                fieldClassName="form-field"
                label="Organization"
                value={selectedOrganizationId}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
              >
                <option value="all">All organizations</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={String(organization.id)}>
                    {organization.name}
                  </option>
                ))}
            </SelectField>
          ) : null}
        </div>
      </section>

      <div className="panel-grid">
        <article className="panel kpi-card">
          <span className="kpi-label">Open invoices</span>
          <div className="kpi-value">{summary.openCount}</div>
          <span className="kpi-delta">{formatGhsAmount(summary.openTotalGhs)}</span>
        </article>
        <article className="panel kpi-card">
          <span className="kpi-label">Overdue</span>
          <div className="kpi-value">{summary.overdueCount}</div>
          <span className="kpi-delta is-warning">Needs follow-up</span>
        </article>
        <article className="panel kpi-card">
          <span className="kpi-label">Paid invoices</span>
          <div className="kpi-value">{summary.paidCount}</div>
          <span className="kpi-delta is-positive">{formatGhsAmount(summary.paidTotalGhs)}</span>
        </article>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Invoice ledger</h3>
            <p className="muted">Manage statuses and export client-ready PDFs.</p>
          </div>
        </div>

        {loading ? (
          <AnimatedLoadingState compact title="Loading invoices" />
        ) : (
          <div className="data-table">
            {isAdmin ? (
              <div className="table-bulk-toolbar" role="region" aria-label="Selected invoice actions">
                <span className="muted">
                  {selectedInvoiceCount
                    ? `${selectedInvoiceCount} selected`
                    : "Select invoices for bulk actions"}
                </span>
                <div className="table-bulk-toolbar__actions">
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={handleBulkArchiveInvoices}
                    disabled={!selectedInvoiceCount || isBulkActionRunning}
                  >
                    <FiArchive aria-hidden="true" />
                    <span>{isBulkActionRunning ? "Working..." : "Archive"}</span>
                  </button>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={handleBulkDeleteInvoices}
                    disabled={!selectedInvoiceCount || isBulkActionRunning}
                  >
                    <FiTrash2 aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ) : null}
            <div className={`table-row table-head ${invoiceRowColumnClass}`}>
              {isAdmin ? (
                <span className="table-select-cell">
                  <input
                    type="checkbox"
                    aria-label="Select all visible invoices"
                    checked={allVisibleInvoicesSelected}
                    onChange={toggleAllVisibleInvoices}
                  />
                </span>
              ) : null}
              <span>Invoice #</span>
              <span>Client</span>
              <span>Issue</span>
              <span>Due</span>
              <span>Balance</span>
              <span>Total</span>
              <span>Payment Status</span>
              <span>Invoice Status</span>
              <span>Actions</span>
            </div>

            {invoices.length ? (
              invoices.map((invoice) => {
                const payment = getInvoicePaymentSummary(invoice);
                const isSelected = selectedInvoiceIds.has(String(invoice.id));
                return (
                  <div
                    className={`table-row ${invoiceRowColumnClass} invoice-row-clickable${
                      openActionId === invoice.id ? " is-menu-open" : ""
                    }${isSelected ? " is-selected" : ""}`}
                    key={invoice.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openInvoiceModal(invoice)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openInvoiceModal(invoice);
                      }
                    }}
                  >
                    {isAdmin ? (
                      <span className="table-select-cell">
                        <input
                          type="checkbox"
                          aria-label={`Select invoice ${invoice.invoiceNumber}`}
                          checked={isSelected}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          onChange={() => toggleInvoiceSelection(invoice.id)}
                        />
                      </span>
                    ) : null}
                    <span className="table-strong">{invoice.invoiceNumber}</span>
                    <span className="table-strong">{invoice.clientName}</span>
                    <span>{formatDate(invoice.issueDate)}</span>
                    <span>{formatDate(invoice.dueDate)}</span>
                    <span className="muted">{formatAmount(payment.balanceDue, invoice.currency)}</span>
                    <span className="table-strong">{formatAmount(invoice.total, invoice.currency)}</span>
                    <span className={`status-pill is-${PAYMENT_STATUS_TONE[payment.paymentStatus] || "info"}`}>
                      {FINANCE_STATUS_LABELS[payment.paymentStatus] || payment.paymentStatus}
                    </span>
                    <span className={`status-pill is-${STATUS_TONE[invoice.status] || "info"}`}>
                      {invoice.status}
                    </span>
                    <div className="row-actions invoice-ledger-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Actions for invoice ${invoice.invoiceNumber}`}
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenActionId((current) => (current === invoice.id ? null : invoice.id));
                        }}
                      >
                        <FiMoreVertical size={16} aria-hidden="true" />
                      </button>
                      {openActionId === invoice.id ? (
                        <div
                          className="row-actions__menu"
                          role="menu"
                          tabIndex={-1}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {isAdmin ? (
                            <button type="button" onClick={() => openEditModal(invoice)}>
                              <FiEdit3 aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                          ) : null}
                          {isAdmin && canRecordInvoicePayment(invoice) ? (
                            <button type="button" onClick={() => openPaymentModal(invoice)}>
                              <FiCreditCard aria-hidden="true" />
                              <span>Record payment</span>
                            </button>
                          ) : null}
                          {isAdmin && invoice.status !== "VOID" ? (
                            <button type="button" onClick={() => handleStatusChange(invoice, "VOID")}>
                              <FiSlash aria-hidden="true" />
                              <span>Void</span>
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <button type="button" onClick={() => handleArchiveInvoice(invoice)}>
                              <FiArchive aria-hidden="true" />
                              <span>Archive</span>
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <button type="button" onClick={() => handleDeleteInvoice(invoice)}>
                              <FiTrash2 aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(invoice)}
                            disabled={isPdfDownloading}
                          >
                            <FiDownload aria-hidden="true" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted">No invoices found.</p>
            )}
          </div>
        )}
      </section>

      {selectedInvoice ? (
        <div className="modal-backdrop invoice-preview-backdrop" role="presentation">
          <button
            className="modal-dismiss"
            type="button"
            aria-label="Close invoice details"
            onClick={closeInvoiceModal}
          />
          <div
            className="modal-card invoice-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-details-title"
          >
            <div className="invoice-preview-topbar">
              <div>
                <p className="eyebrow">Invoice Preview</p>
                <div className="invoice-preview-topbar__title">
                  <h3 id="invoice-details-title">{selectedInvoice.invoiceNumber || "Draft"}</h3>
                  <span className={`status-pill is-${STATUS_TONE[selectedInvoice.status] || "info"}`}>
                    {selectedInvoice.status}
                  </span>
                </div>
                <p className="muted">Review the invoice, verify the totals, and send it when ready.</p>
              </div>
              <button className="button button-plain" type="button" onClick={closeInvoiceModal}>
                Close
              </button>
            </div>

            {error ? <div className="notice is-error">{error}</div> : null}

            <div className="invoice-preview-hero">
              <div className="invoice-preview-hero__main">
                <span className="invoice-preview-hero__eyebrow">Client</span>
                <strong className="invoice-preview-hero__client">
                  {selectedInvoice.clientName || "No client assigned"}
                </strong>
                <p className="invoice-preview-hero__meta">
                  {selectedInvoice.clientEmail || "No email"} · Due {formatDate(selectedInvoice.dueDate)}
                </p>
              </div>
              <div className="invoice-preview-hero__stats">
                <div className="invoice-preview-stat">
                  <span>Balance due</span>
                  <strong>{formatAmount(selectedInvoicePayment.balanceDue, selectedInvoice.currency)}</strong>
                </div>
                <div className="invoice-preview-stat">
                  <span>Payment received</span>
                  <strong>{formatAmount(selectedInvoicePayment.paidAmount, selectedInvoice.currency)}</strong>
                </div>
                <div className="invoice-preview-stat">
                  <span>Issue date</span>
                  <strong>{formatDate(selectedInvoice.issueDate)}</strong>
                </div>
              </div>
            </div>

            <div className="invoice-preview-layout">
              <div className="invoice-preview-main">
                <section className="invoice-preview-card">
                  <div className="invoice-preview-card__header">
                    <div>
                      <h4>Line items</h4>
                      <p className="muted">Monthly charges stay nested beneath the main service.</p>
                    </div>
                  </div>
                  {selectedInvoiceLineItems.length ? (
                    <div className="invoice-preview-items">
                      {selectedInvoiceLineItems.map((lineItem) => (
                        <div
                          key={lineItem.id}
                          className={`invoice-preview-item${lineItem.isMonthlyCharge ? " is-monthly" : ""}`}
                        >
                          <div className="invoice-preview-item__main">
                            <span className="invoice-preview-item__tag">
                              {lineItem.isMonthlyCharge ? "Monthly charge" : "Primary line"}
                            </span>
                            <strong>{lineItem.description}</strong>
                            <span className="invoice-preview-item__subtle">
                              {lineItem.quantity} {formatQuantityUnit(lineItem.quantity, lineItem.unit)} at{" "}
                              {formatAmount(lineItem.rate, selectedInvoice.currency)}
                            </span>
                          </div>
                          <div className="invoice-preview-item__amount">
                            {formatAmount(lineItem.amount, selectedInvoice.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No line items on this invoice.</p>
                  )}
                </section>

                {selectedInvoice.notes ? (
                  <section className="invoice-preview-card">
                    <div className="invoice-preview-card__header">
                      <div>
                        <h4>Notes</h4>
                      </div>
                    </div>
                    <p className="invoice-preview-note">{selectedInvoice.notes}</p>
                  </section>
                ) : null}
              </div>

              <aside className="invoice-preview-side">
                <section className="invoice-preview-card">
                  <div className="invoice-preview-card__header">
                    <div>
                      <h4>Details</h4>
                    </div>
                  </div>
                  <div className="invoice-preview-details">
                    <div className="invoice-preview-detail">
                      <span>Invoice #</span>
                      <strong>{selectedInvoice.invoiceNumber || "-"}</strong>
                    </div>
                    <div className="invoice-preview-detail">
                      <span>Issue date</span>
                      <strong>{formatDate(selectedInvoice.issueDate)}</strong>
                    </div>
                    <div className="invoice-preview-detail">
                      <span>Due date</span>
                      <strong>{formatDate(selectedInvoice.dueDate)}</strong>
                    </div>
                    <div className="invoice-preview-detail">
                      <span>Client email</span>
                      <strong>{selectedInvoice.clientEmail || "-"}</strong>
                    </div>
                    <div className="invoice-preview-detail">
                      <span>Display currency</span>
                      <strong>{DISPLAY_CURRENCY_CODE}</strong>
                    </div>
                    <div className="invoice-preview-detail">
                      <span>Organization</span>
                      <strong>{selectedInvoice.organization?.name || "-"}</strong>
                    </div>
                    <div className="invoice-preview-detail">
                      <span>Payment status</span>
                      <strong>
                        {FINANCE_STATUS_LABELS[selectedInvoicePayment.paymentStatus] ||
                          selectedInvoicePayment.paymentStatus}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="invoice-preview-card invoice-preview-card--totals">
                  <div className="invoice-preview-card__header">
                    <div>
                      <h4>Totals</h4>
                    </div>
                  </div>
                  <div className="invoice-preview-totals">
                    <div className="invoice-preview-totals__row">
                      <span>Monthly charges</span>
                      <strong>{formatAmount(selectedMonthlyChargeTotal, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="invoice-preview-totals__row">
                      <span>Subtotal (excluding monthly charges)</span>
                      <strong>{formatAmount(selectedRegularSubtotal, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="invoice-preview-totals__row">
                      <span>Tax ({Number(selectedInvoiceTotals.taxRate ?? 0).toFixed(2)}%)</span>
                      <strong>
                        {formatAmount(selectedInvoiceTotals.taxAmount ?? 0, selectedInvoice.currency)}
                      </strong>
                    </div>
                    <div className="invoice-preview-totals__row">
                      <span>Discount</span>
                      <strong>
                        -{formatAmount(selectedInvoiceTotals.discount ?? 0, selectedInvoice.currency)}
                      </strong>
                    </div>
                    <div className="invoice-preview-totals__row is-total">
                      <span>Total</span>
                      <strong>{formatAmount(selectedInvoiceTotals.total ?? 0, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="invoice-preview-totals__row">
                      <span>Payment received</span>
                      <strong>{formatAmount(selectedInvoicePayment.paidAmount, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="invoice-preview-totals__row is-total">
                      <span>Balance due</span>
                      <strong>{formatAmount(selectedInvoicePayment.balanceDue, selectedInvoice.currency)}</strong>
                    </div>
                  </div>
                </section>

                <section className="invoice-preview-card invoice-preview-card--actions">
                  <div className="invoice-preview-actions">
	                    {isAdmin ? (
	                      <button
	                        className="button button-plain"
	                        type="button"
	                        onClick={openEditFromInvoiceModal}
	                      >
	                        <FiEdit3 aria-hidden="true" />
	                        <span>Edit invoice</span>
	                      </button>
	                    ) : null}
	                    {isAdmin && canRecordInvoicePayment(selectedInvoice) ? (
	                      <button
	                        className="button button-plain"
	                        type="button"
	                        onClick={() => openPaymentModal(selectedInvoice)}
	                      >
	                        <FiCreditCard aria-hidden="true" />
	                        <span>Record payment</span>
	                      </button>
	                    ) : null}
	                    {isAdmin && selectedInvoice.status !== "VOID" ? (
	                      <button
	                        className="button button-ghost"
	                        type="button"
	                        onClick={() => handleStatusChange(selectedInvoice, "VOID")}
	                      >
	                        <FiSlash aria-hidden="true" />
	                        <span>Void invoice</span>
	                      </button>
	                    ) : null}
	                    {isAdmin && selectedInvoice.status === "DRAFT" ? (
	                      <button
	                        className="button button-plain"
	                        type="button"
                        onClick={handleSendInvoice}
                        disabled={isSendingInvoice || !selectedInvoice.clientEmail}
                      >
                        <FiMail aria-hidden="true" />
                        <span>{isSendingInvoice ? "Sending..." : "Send invoice"}</span>
                      </button>
                    ) : null}
                    {isAdmin && ["DRAFT", "SENT"].includes(selectedInvoice.status) ? (
                      <button
                        className="button button-plain"
                        type="button"
                        onClick={handleSendQuotation}
                        disabled={isSendingQuotation || !selectedInvoice.clientEmail}
                      >
                        <FiMail aria-hidden="true" />
                        <span>{isSendingQuotation ? "Sending..." : "Send as quotation"}</span>
                      </button>
                    ) : null}
                    {isAdmin && ["QUOTATION", "SENT"].includes(selectedInvoice.status) ? (
                      <>
                        <button
                          className="button button-plain"
                          type="button"
                          onClick={handleAcceptQuotation}
                          disabled={isRespondingToQuote}
                        >
                          <span>Accept quotation</span>
                        </button>
                        <button
                          className="button button-ghost"
                          type="button"
                          onClick={handleDeclineQuotation}
                          disabled={isRespondingToQuote}
                        >
                          <span>Decline quotation</span>
                        </button>
                      </>
                    ) : null}
                    <button
                      className="button button-plain"
                      type="button"
                      onClick={() => handleDownloadPdf(selectedInvoice)}
                    >
                      <FiDownload size={16} aria-hidden="true" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                  {isAdmin && ["DRAFT", "SENT"].includes(selectedInvoice.status) && !selectedInvoice.clientEmail ? (
                    <p className="muted">Add a client email before sending this invoice.</p>
                  ) : null}
                </section>
              </aside>
            </div>
          </div>
        </div>
	      ) : null}

	      {paymentInvoice ? (
	        <div className="modal-backdrop" role="presentation">
	          <button
	            className="modal-dismiss"
	            type="button"
	            aria-label="Close payment form"
	            onClick={closePaymentModal}
	          />
	          <div
	            className="modal-card invoice-payment-modal"
	            role="dialog"
	            aria-modal="true"
	            aria-labelledby="invoice-payment-title"
	          >
	            <div className="modal-header">
	              <div>
	                <p className="eyebrow">Invoice payment</p>
	                <h3 id="invoice-payment-title">Record payment</h3>
	                <p className="muted">
	                  {paymentInvoice.invoiceNumber} for {paymentInvoice.clientName}
	                </p>
	              </div>
	              <button
	                className="button button-ghost"
	                type="button"
	                onClick={closePaymentModal}
	                disabled={isRecordingPayment}
	              >
	                Close
	              </button>
	            </div>

	            {paymentError ? <div className="notice is-error">{paymentError}</div> : null}

	            <form className="stack" onSubmit={handleRecordPayment}>
	              <div className="invoice-payment-summary">
	                <div>
	                  <span>Total</span>
	                  <strong>{formatAmount(paymentInvoice.total, paymentInvoice.currency)}</strong>
	                </div>
	                <div>
	                  <span>Received</span>
	                  <strong>
	                    {formatAmount(paymentInvoiceSummary.paidAmount, paymentInvoice.currency)}
	                  </strong>
	                </div>
	                <div>
	                  <span>Balance due</span>
	                  <strong>
	                    {formatAmount(paymentInvoiceSummary.balanceDue, paymentInvoice.currency)}
	                  </strong>
	                </div>
	              </div>

	              <div className="invoice-grid">
	                <label className="form-field">
	                  <span>Payment amount</span>
	                  <input
	                    className="input"
	                    type="number"
	                    min="0.01"
	                    step="0.01"
	                    max={paymentInvoiceSummary.balanceDue || undefined}
	                    value={paymentForm.amount}
	                    onChange={(event) => updatePaymentField("amount", event.target.value)}
	                    required
	                  />
	                </label>
	                <DateField
	                  fieldClassName="form-field"
	                  label="Payment date"
	                  value={paymentForm.paidAt}
	                  onChange={(event) => updatePaymentField("paidAt", event.target.value)}
	                  required
	                />
	              </div>

	              <label className="form-field">
	                <span>Payment note</span>
	                <textarea
	                  className="input"
	                  value={paymentForm.note}
	                  onChange={(event) => updatePaymentField("note", event.target.value)}
	                  placeholder="Optional reference, channel, or note"
	                />
	              </label>

	              <div className="header-actions">
	                <button
	                  className="button button-ghost"
	                  type="button"
	                  onClick={closePaymentModal}
	                  disabled={isRecordingPayment}
	                >
	                  Cancel
	                </button>
	                <button className="button button-primary" type="submit" disabled={isRecordingPayment}>
	                  <FiCreditCard aria-hidden="true" />
	                  <span>{isRecordingPayment ? "Recording..." : "Record payment"}</span>
	                </button>
	              </div>
	            </form>
	          </div>
	        </div>
	      ) : null}

	      {showForm ? (
	        <div className="modal-backdrop" role="presentation">
	          <button
            className="modal-dismiss"
            type="button"
            aria-label="Close invoice form"
            onClick={closeFormModal}
          />
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="invoice-form-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Invoicing</p>
                <h3 id="invoice-form-title">{editingInvoiceId ? "Edit invoice" : "Create invoice"}</h3>
                <p className="muted">Complete details and line items before saving.</p>
              </div>
              <button className="button button-ghost" type="button" onClick={closeFormModal}>
                Close
              </button>
            </div>

            {formError ? <div className="notice is-error">{formError}</div> : null}

            <form className="stack" onSubmit={handleSaveInvoice}>
              <div className="invoice-meta">
                <div className="invoice-grid">
                  {isAdmin ? (
                    <SelectField
                        fieldClassName="form-field"
                        label="Organization"
                        value={formState.organizationId}
                        onChange={(event) => updateFormField("organizationId", event.target.value)}
                        required
                      >
                        <option value="">Select organization</option>
                        {organizations.map((organization) => (
                          <option key={organization.id} value={String(organization.id)}>
                            {organization.name}
                          </option>
                        ))}
                    </SelectField>
                  ) : null}

                  <label className="form-field">
                    <span>Invoice number (optional)</span>
                    <input
                      className="input"
                      type="text"
                      value={formState.invoiceNumber}
                      onChange={(event) => updateFormField("invoiceNumber", event.target.value)}
                      placeholder="Auto-generated if empty"
                    />
                  </label>

                  <SelectField
                      fieldClassName="form-field"
                      label="Status"
                      value={formState.status}
                      onChange={(event) => updateFormField("status", event.target.value)}
                    >
                      {["PAID", "VOID"].includes(formState.status) ? (
                        <option value={formState.status} disabled>
                          {formState.status === "PAID" ? "Paid (from payments)" : "Void (from action)"}
                        </option>
                      ) : null}
                      {FORM_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </SelectField>

                  <SelectField
                      fieldClassName="form-field"
                      label="Currency"
                      value={formState.currency}
                      onChange={(event) => updateFormField("currency", event.target.value)}
                    >
                      {CURRENCY_OPTIONS.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                  </SelectField>

                  <DateField
                      fieldClassName="form-field"
                      label="Issue date"
                      value={formState.issueDate}
                      onChange={(event) => updateFormField("issueDate", event.target.value)}
                      required
                  />

                  <DateField
                      fieldClassName="form-field"
                      label="Due date"
                      value={formState.dueDate}
                      onChange={(event) => updateFormField("dueDate", event.target.value)}
                  />

                  <label className="form-field">
                    <span>Client name</span>
                    <input
                      className="input"
                      type="text"
                      value={formState.clientName}
                      onChange={(event) => updateFormField("clientName", event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Client email</span>
                    <input
                      className="input"
                      type="email"
                      value={formState.clientEmail}
                      onChange={(event) => updateFormField("clientEmail", event.target.value)}
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>Client address</span>
                  <textarea
                    className="input"
                    value={formState.clientAddress}
                    onChange={(event) => updateFormField("clientAddress", event.target.value)}
                  />
                </label>
              </div>

              <div className="invoice-line-items">
                <div className="panel-header">
                  <div>
                    <h3>Line items</h3>
                    <p className="muted">Add billable items for this invoice.</p>
                  </div>
                  <button className="button button-ghost" type="button" onClick={addLineItem}>
                    <FiPlus aria-hidden="true" />
                    <span>Add line</span>
                  </button>
                </div>

              {formState.lineItems.map((lineItem) => (
                <div
                  key={lineItem.id}
                  className={`invoice-line-row${lineItem.parentLineId ? " is-indented" : ""}`}
                >
                  <label className={`form-field${lineItem.parentLineId ? " is-indented" : ""}`}>
                    <span>{lineItem.parentLineId ? "Monthly charge" : "Description"}</span>
                    <input
                      className="input"
                      type="text"
                      value={lineItem.description}
                      onChange={(event) => updateLineItem(lineItem.id, "description", event.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    <span>Qty</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={lineItem.quantity}
                      onChange={(event) => updateLineItem(lineItem.id, "quantity", event.target.value)}
                    />
                  </label>
                  <SelectField
                      fieldClassName="form-field"
                      label="Unit"
                      value={normalizeQuantityUnit(lineItem.unit)}
                      onChange={(event) => updateLineItem(lineItem.id, "unit", event.target.value)}
                    >
                      {QUANTITY_UNITS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      {!QUANTITY_UNITS.includes(normalizeQuantityUnit(lineItem.unit)) ? (
                        <option value={normalizeQuantityUnit(lineItem.unit)}>
                          {normalizeQuantityUnit(lineItem.unit)}
                        </option>
                      ) : null}
                  </SelectField>
                  <label className="form-field">
                    <span>Rate</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={lineItem.rate}
                      onChange={(event) => updateLineItem(lineItem.id, "rate", event.target.value)}
                    />
                  </label>
                  <div className="invoice-line-actions">
                    <button
                      className="button button-ghost"
                      type="button"
                      aria-label="Remove line item"
                      onClick={() => removeLineItem(lineItem.id)}
                      disabled={formState.lineItems.length <= 1}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                    {lineItem.parentLineId ? null : (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => addMonthlyChargeLine(lineItem.id)}
                      >
                        <FiPlus aria-hidden="true" />
                        <span>Add monthly charge</span>
                      </button>
                    )}
                  </div>
                  </div>
                ))}
              </div>

              <div className="invoice-grid">
                <label className="form-field">
                  <span>Tax rate (%)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formState.taxRate}
                    onChange={(event) => updateFormField("taxRate", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Discount</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.discount}
                    onChange={(event) => updateFormField("discount", event.target.value)}
                  />
                </label>
              </div>

              <label className="form-field">
                <span>Notes</span>
                <textarea
                  className="input"
                  value={formState.notes}
                  onChange={(event) => updateFormField("notes", event.target.value)}
                />
              </label>

              <div className="invoice-summary">
                <div className="invoice-summary__row">
                  <span>Monthly charges</span>
                  <span>{formatAmount(formItemTotals.monthlyChargeSubtotal, formState.currency)}</span>
                </div>
              </div>

              <div className="invoice-summary">
                <div className="invoice-summary__row">
                  <span>Subtotal (excluding monthly charges)</span>
                  <span>{formatAmount(formItemTotals.regularSubtotal, formState.currency)}</span>
                </div>
                <div className="invoice-summary__row">
                  <span>Tax ({invoiceTotals.taxRate.toFixed(2)}%)</span>
                  <span>{formatAmount(invoiceTotals.taxAmount, formState.currency)}</span>
                </div>
                <div className="invoice-summary__row">
                  <span>Discount</span>
                  <span>-{formatAmount(invoiceTotals.discount, formState.currency)}</span>
                </div>
                <div className="invoice-summary__row is-total">
                  <span>Total</span>
                  <span>{formatAmount(invoiceTotals.total, formState.currency)}</span>
                </div>
              </div>

              <div className="header-actions">
                <button className="button button-ghost" type="button" onClick={closeFormModal}>
                  Cancel
                </button>
                <button className="button button-primary" type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingInvoiceId ? "Save invoice" : "Create invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Invoicing;
