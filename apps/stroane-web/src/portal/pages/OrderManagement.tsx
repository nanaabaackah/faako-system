import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  HiOutlineCash,
  HiOutlineCheckCircle,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineClipboardList,
  HiOutlineCreditCard,
  HiOutlineExternalLink,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineShoppingBag,
  HiOutlineTrash,
  HiOutlineTruck,
  HiOutlineXCircle,
} from "react-icons/hi";
import {
  DateField,
  ERPIconAction,
  ERPFormNotice,
  ERPModal,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPStatusBadge,
  ERPTablePagination,
  ERPTableSearch,
  ERPTextareaField,
  ERPTextField,
  SelectField,
} from "@faako/ui";
import { portalUrl } from "../../config/appSurface";
import useSEOMeta from "../../hooks/useSEOMeta";
import { isLikelyEmail, isLikelyPhone, PHONE_INPUT_PATTERN } from "../../utils/contactValidation";
import { hasPortalPermission } from "../api/adminSession";
import { adminProductsApi, type AdminProduct } from "../api/adminProducts";
import {
  adminOrdersApi,
  type AdminOrder,
  type AdminOrderCreatePayload,
  type AdminOrderFilters,
  type AdminOrderSummary,
} from "../api/adminOrders";
import { useAdminPortal } from "../context/AdminPortalContext";
import "../styles/order-management.css";

const ORDER_PAGE_SIZE = 12;

const EMPTY_SUMMARY: AdminOrderSummary = {
  totalOrders: 0,
  totalValue: 0,
  paidValue: 0,
  outstandingValue: 0,
  paidOrders: 0,
  pendingPaymentOrders: 0,
  failedPaymentOrders: 0,
  completedOrders: 0,
};

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "All order statuses" },
  { value: "PAYMENT_PENDING", label: "Payment pending" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const ORDER_EDIT_STATUS_OPTIONS = ORDER_STATUS_OPTIONS.filter((option) => option.value);

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All payment statuses" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "abandoned", label: "Abandoned" },
  { value: "not_started", label: "Not started" },
];

const FULFILLMENT_OPTIONS = [
  { value: "", label: "All fulfillment states" },
  { value: "new", label: "New" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const FULFILLMENT_EDIT_OPTIONS = FULFILLMENT_OPTIONS.filter((option) => option.value);

const DELIVERY_METHOD_OPTIONS = [
  { value: "", label: "Method not set" },
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
];

const CONTACT_METHOD_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
];

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const toMoneyNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMoney = (value: number, currency = "GHS") =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: currency || "GHS",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatLabel = (value = "") =>
  String(value || "not set")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDeliveryMethod = (value?: string | null) =>
  value ? formatLabel(value) : "Method not set";

const getFulfillmentMethodLabel = (order: AdminOrder | null) =>
  order?.deliveryMethod === "pickup" ? "Pickup" : "Delivery";

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

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getOrderTone = (status = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "completed") return "success";
  if (normalized === "cancelled") return "danger";
  if (normalized === "processing") return "info";
  return "warning";
};

const getPaymentTone = (status = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  const normalized = status.toLowerCase();
  if (normalized === "paid") return "success";
  if (normalized === "failed" || normalized === "abandoned") return "danger";
  if (normalized === "not_started") return "neutral";
  return "warning";
};

const getFulfillmentTone = (
  status = ""
): "neutral" | "success" | "warning" | "danger" | "info" => {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "success";
  if (normalized === "cancelled") return "danger";
  if (normalized === "packed" || normalized === "dispatched") return "info";
  if (normalized === "confirmed") return "warning";
  return "neutral";
};

type ManualOrderDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preferredContactMethod: string;
  businessName: string;
  deliveryAddress: string;
  deliveryNotes: string;
  items: Array<{
    productSlug: string;
    quantity: string;
  }>;
};

const EMPTY_MANUAL_DRAFT: ManualOrderDraft = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  preferredContactMethod: "email",
  businessName: "",
  deliveryAddress: "",
  deliveryNotes: "",
  items: [{ productSlug: "", quantity: "1" }],
};

const buildOrderEditDraft = (order: AdminOrder | null) => ({
  status: order?.status?.toUpperCase() || "PAYMENT_PENDING",
  fulfillmentStatus: order?.fulfillmentStatus || "new",
  deliveryMethod: order?.deliveryMethod || "",
  expectedDeliveryDate: toDateInputValue(order?.expectedDeliveryDate),
  adminDeliveryNotes: order?.adminDeliveryNotes || "",
  internalNotes: order?.internalNotes || "",
});

type OrderEditDraft = ReturnType<typeof buildOrderEditDraft>;
type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const areOrderDraftsEqual = (left: OrderEditDraft, right: OrderEditDraft) =>
  left.status === right.status &&
  left.fulfillmentStatus === right.fulfillmentStatus &&
  left.deliveryMethod === right.deliveryMethod &&
  left.expectedDeliveryDate === right.expectedDeliveryDate &&
  left.adminDeliveryNotes === right.adminDeliveryNotes &&
  left.internalNotes === right.internalNotes;

const getOrderMapQuery = (order: AdminOrder | null) => {
  if (!order) return "";
  const location = order.deliveryLocation;
  if (location?.latitude != null && location?.longitude != null) {
    return `${location.latitude},${location.longitude}`;
  }
  return location?.address || location?.label || order.customer.deliveryAddress || "";
};

const getOrderMapUrls = (order: AdminOrder | null) => {
  const query = getOrderMapQuery(order);
  if (!query) return { embedUrl: "", externalUrl: "" };
  const encodedQuery = encodeURIComponent(query);
  return {
    embedUrl: `https://maps.google.com/maps?q=${encodedQuery}&z=15&output=embed`,
    externalUrl:
      order?.deliveryLocation?.mapUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`,
  };
};

const splitCustomerFulfillmentNotes = (notes?: string) => {
  const lines = String(notes || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let pickupWindow = "";
  const customerNotes = lines.filter((line) => {
    const match = line.match(/^Pickup window:\s*(.+?\.?)$/i);
    if (match) {
      pickupWindow = match[1].replace(/\.$/, "");
      return false;
    }
    return true;
  });

  return {
    customerNotes: customerNotes.join("\n"),
    pickupWindow,
  };
};

const getCustomerFulfillmentLocation = (order: AdminOrder) => {
  const savedAddress = order.customer.deliveryAddress || "";
  const selectedAddress = order.deliveryLocation?.address || "";
  const selectedLabel = order.deliveryLocation?.label || "";
  const primary = selectedLabel || selectedAddress || savedAddress || "Not recorded";
  const secondary =
    selectedAddress && selectedAddress !== primary
      ? selectedAddress
      : savedAddress && savedAddress !== primary
        ? savedAddress
        : "";

  return { primary, secondary };
};

const OrderManagement: React.FC = () => {
  const { session } = useAdminPortal();
  const canManageOrders =
    hasPortalPermission(session, "orders", "create") ||
    hasPortalPermission(session, "orders", "edit") ||
    hasPortalPermission(session, "orders", "delete") ||
    hasPortalPermission(session, "orders", "archive") ||
    hasPortalPermission(session, "orders", "manage");
  const canViewInventory = hasPortalPermission(session, "inventory", "view");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [summary, setSummary] = useState<AdminOrderSummary>(EMPTY_SUMMARY);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [filters, setFilters] = useState<AdminOrderFilters>({
    search: "",
    status: "",
    paymentStatus: "",
    fulfillmentStatus: "",
    limit: 150,
  });
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productLoadError, setProductLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentAction, setPaymentAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualOrderDraft>(EMPTY_MANUAL_DRAFT);
  const [orderDraft, setOrderDraft] = useState(buildOrderEditDraft(null));
  const [orderDraftOrderId, setOrderDraftOrderId] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [autosaveError, setAutosaveError] = useState("");
  const [paymentLinks, setPaymentLinks] = useState<Record<string, string>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set());
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSEOMeta({
    title: "Orders | Stroane operations",
    description: "Manage Stroane storefront and manually created commerce orders.",
    canonical: portalUrl("/admin/orders"),
    noIndex: true,
  });

  const pricedProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.publishingStatus === "active" &&
          toMoneyNumber(product.price) !== null &&
          Boolean(product.slug || product.id)
      ),
    [products]
  );

  const productBySlug = useMemo(
    () => new Map(pricedProducts.map((product) => [product.slug || product.id, product])),
    [pricedProducts]
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );
  const selectedOrderIndex = useMemo(
    () => orders.findIndex((order) => order.id === selectedOrderId),
    [orders, selectedOrderId]
  );
  const selectedOrderPosition =
    selectedOrderIndex >= 0 ? `${selectedOrderIndex + 1} of ${orders.length}` : "";
  const canGoPreviousOrder = selectedOrderIndex > 0;
  const canGoNextOrder = selectedOrderIndex >= 0 && selectedOrderIndex < orders.length - 1;
  const selectedOrderMap = useMemo(() => getOrderMapUrls(selectedOrder), [selectedOrder]);
  const selectedOrderFulfillment = useMemo(() => {
    if (!selectedOrder) return null;
    return {
      ...getCustomerFulfillmentLocation(selectedOrder),
      ...splitCustomerFulfillmentNotes(selectedOrder.customer.deliveryNotes),
      methodLabel: getFulfillmentMethodLabel(selectedOrder),
    };
  }, [selectedOrder]);

  const pageCount = Math.max(1, Math.ceil(orders.length / ORDER_PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedOrders = useMemo(
    () =>
      orders.slice(
        clampedPageIndex * ORDER_PAGE_SIZE,
        clampedPageIndex * ORDER_PAGE_SIZE + ORDER_PAGE_SIZE
      ),
    [clampedPageIndex, orders]
  );
  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);
  const toggleOrderPageSelection = useCallback(() => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      const allPageSelected =
        paginatedOrders.length > 0 && paginatedOrders.every((order) => next.has(order.id));
      paginatedOrders.forEach((order) => {
        if (allPageSelected) {
          next.delete(order.id);
        } else {
          next.add(order.id);
        }
      });
      return next;
    });
  }, [paginatedOrders]);

  const manualDraftTotal = useMemo(
    () =>
      manualDraft.items.reduce((total, item) => {
        const product = productBySlug.get(item.productSlug);
        const price = toMoneyNumber(product?.price);
        const quantity = Number(item.quantity);
        return total + (price && Number.isFinite(quantity) ? price * Math.max(1, quantity) : 0);
      }, 0),
    [manualDraft.items, productBySlug]
  );

  const updateFilter = <Key extends keyof AdminOrderFilters>(
    key: Key,
    value: AdminOrderFilters[Key]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const replaceOrder = useCallback((nextOrder: AdminOrder) => {
    setOrders((current) =>
      current.map((order) => (order.id === nextOrder.id ? nextOrder : order))
    );
    setSelectedOrderId(nextOrder.id);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminOrdersApi.listOrders(session, filters);
      setOrders(data.orders);
      setSummary(data.summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, [filters, session]);

  useEffect(() => {
    if (!session) return;
    void loadOrders();
  }, [loadOrders, session]);

  useEffect(() => {
    if (!session || !canViewInventory) {
      setProducts([]);
      setProductsLoading(false);
      setProductLoadError("");
      return;
    }
    let cancelled = false;
    const loadProducts = async () => {
      setProductsLoading(true);
      setProductLoadError("");
      try {
        const data = await adminProductsApi.listProducts(session, {
          limit: 250,
          publishingStatus: "active",
        });
        if (!cancelled) setProducts(data.products);
      } catch (loadError) {
        if (!cancelled) {
          setProducts([]);
          setProductLoadError(
            loadError instanceof Error ? loadError.message : "Unable to load products."
          );
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [canViewInventory, session]);

  useEffect(() => {
    setPageIndex(0);
  }, [filters.search, filters.status, filters.paymentStatus, filters.fulfillmentStatus]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

  useEffect(() => {
    const orderIds = new Set(orders.map((order) => order.id));
    setSelectedOrderIds((current) => {
      const next = new Set(Array.from(current).filter((orderId) => orderIds.has(orderId)));
      return next.size === current.size ? current : next;
    });
  }, [orders]);

  useEffect(() => {
    setOrderDraft(buildOrderEditDraft(selectedOrder));
    setOrderDraftOrderId(selectedOrder?.id || "");
    setAutosaveStatus("idle");
    setAutosaveError("");
  }, [selectedOrder]);

  const openOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setNotice("");
    setError("");
  };

  const closeOrder = () => {
    setSelectedOrderId("");
    setPaymentAction("");
  };

  const saveOrderDraft = useCallback(
    async (mode: "manual" | "autosave" = "manual") => {
      if (!session || !selectedOrder || !canManageOrders) return null;
      if (orderDraftOrderId !== selectedOrder.id) return null;
      const baseline = buildOrderEditDraft(selectedOrder);
      if (areOrderDraftsEqual(orderDraft, baseline)) return selectedOrder;

      if (mode === "manual") {
        setSaving(true);
        setNotice("");
      } else {
        setAutosaveStatus("saving");
        setAutosaveError("");
      }
      setError("");

      try {
        const data = await adminOrdersApi.updateOrder(session, selectedOrder.id, {
          status: orderDraft.status,
          fulfillmentStatus: orderDraft.fulfillmentStatus,
          deliveryMethod: orderDraft.deliveryMethod,
          expectedDeliveryDate: orderDraft.expectedDeliveryDate,
          adminDeliveryNotes: orderDraft.adminDeliveryNotes,
          internalNotes: orderDraft.internalNotes,
        });
        replaceOrder(data.order);
        if (mode === "manual") {
          setNotice(`${data.order.orderNumber} updated.`);
        } else {
          setAutosaveStatus("saved");
        }
        return data.order;
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : "Unable to update order.";
        if (mode === "manual") {
          setError(message);
        } else {
          setAutosaveStatus("error");
          setAutosaveError(message);
        }
        return null;
      } finally {
        if (mode === "manual") setSaving(false);
      }
    },
    [canManageOrders, orderDraft, orderDraftOrderId, replaceOrder, selectedOrder, session]
  );

  const openAdjacentOrder = async (direction: -1 | 1) => {
    if (selectedOrderIndex < 0) return;
    const nextOrder = orders[selectedOrderIndex + direction];
    if (!nextOrder) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await saveOrderDraft("autosave");
    setSelectedOrderId(nextOrder.id);
  };

  const handleManualLineChange = (
    index: number,
    patch: Partial<ManualOrderDraft["items"][number]>
  ) => {
    setManualDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const addManualLine = () => {
    setManualDraft((current) => ({
      ...current,
      items: [...current.items, { productSlug: "", quantity: "1" }],
    }));
  };

  const removeManualLine = (index: number) => {
    setManualDraft((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleCreateOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !canManageOrders) return;
    setError("");
    setNotice("");

    if (!manualDraft.customerName.trim()) {
      setError("Add the customer's name.");
      return;
    }
    if (!isLikelyEmail(manualDraft.customerEmail)) {
      setError("Add a valid customer email address.");
      return;
    }
    if (!isLikelyPhone(manualDraft.customerPhone)) {
      setError("Add a valid customer phone number.");
      return;
    }
    if (!manualDraft.deliveryAddress.trim()) {
      setError("Add a delivery or pickup address.");
      return;
    }
    if (
      manualDraft.items.some(
        (item) =>
          !item.productSlug ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1 ||
          Number(item.quantity) > 99
      )
    ) {
      setError("Select a product and quantity between 1 and 99 for every order line.");
      return;
    }

    setSaving(true);
    try {
      const payload: AdminOrderCreatePayload = {
        customer: {
          name: manualDraft.customerName.trim(),
          email: manualDraft.customerEmail.trim(),
          phone: manualDraft.customerPhone.trim(),
          preferredContactMethod: manualDraft.preferredContactMethod,
          businessName: manualDraft.businessName.trim() || undefined,
          deliveryAddress: manualDraft.deliveryAddress.trim(),
          deliveryNotes: manualDraft.deliveryNotes.trim() || undefined,
        },
        items: manualDraft.items
          .map((item) => ({
            productSlug: item.productSlug,
            quantity: Number(item.quantity),
          }))
          .filter((item) => item.productSlug),
        source: "portal_manual",
      };
      const data = await adminOrdersApi.createOrder(session, payload);
      setManualDraft(EMPTY_MANUAL_DRAFT);
      setManualOrderOpen(false);
      setNotice(`Manual order ${data.order.orderNumber} created.`);
      setOrders((current) => [data.order, ...current]);
      setSelectedOrderId(data.order.id);
      await loadOrders();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create order.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveOrderDraft("manual");
  };

  const handleInitializePaystack = async () => {
    if (!session || !selectedOrder || !canManageOrders) return;
    setPaymentAction("initialize");
    setError("");
    setNotice("");
    try {
      const data = await adminOrdersApi.initializePaystack(session, selectedOrder.id);
      replaceOrder(data.order);
      setPaymentLinks((current) => ({
        ...current,
        [data.order.id]: data.payment.authorizationUrl,
      }));
      setNotice(`Paystack payment link created for ${data.order.orderNumber}.`);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error ? paymentError.message : "Unable to initialize Paystack."
      );
    } finally {
      setPaymentAction("");
    }
  };

  const handleRefreshPaystack = async (orderId = selectedOrder?.id || "") => {
    if (!session || !orderId || !canManageOrders) return;
    setPaymentAction(orderId);
    setError("");
    setNotice("");
    try {
      const data = await adminOrdersApi.refreshPaystackStatus(session, orderId);
      replaceOrder(data.order);
      setNotice(
        data.payment.amountMatches && data.payment.currencyMatches
          ? `Payment status refreshed for ${data.order.orderNumber}.`
          : `Payment status refreshed, but amount or currency needs review for ${data.order.orderNumber}.`
      );
    } catch (paymentError) {
      setError(
        paymentError instanceof Error ? paymentError.message : "Unable to refresh payment status."
      );
    } finally {
      setPaymentAction("");
    }
  };

  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!selectedOrder || !canManageOrders || orderDraftOrderId !== selectedOrder.id) return undefined;
    const baseline = buildOrderEditDraft(selectedOrder);
    if (areOrderDraftsEqual(orderDraft, baseline)) {
      if (autosaveStatus !== "saved") setAutosaveStatus("idle");
      return undefined;
    }

    setAutosaveStatus("idle");
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void saveOrderDraft("autosave");
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [autosaveStatus, canManageOrders, orderDraft, orderDraftOrderId, saveOrderDraft, selectedOrder]);

  if (!session) return null;

  return (
    <section className="stroane-orders" aria-labelledby="stroane-orders-title">
      <header className="stroane-orders__head">
        <div>
          <span>Commerce hub</span>
          <h1 id="stroane-orders-title">Orders</h1>
          <p>Storefront orders, manual orders, fulfillment notes, and Paystack payment status.</p>
        </div>
        <div className="stroane-orders__head-actions">
          <ERPSecondaryAction
            icon={<HiOutlineRefresh />}
            onClick={loadOrders}
            disabled={loading}
            loading={loading}
            loadingLabel="Refreshing"
          >
            Refresh
          </ERPSecondaryAction>
          <ERPPrimaryAction
            icon={<HiOutlinePlus />}
            onClick={() => setManualOrderOpen(true)}
            disabled={!canManageOrders}
          >
            Manual order
          </ERPPrimaryAction>
        </div>
      </header>

      {!canManageOrders ? (
        <ERPFormNotice tone="warning" title="View-only access">
          This account can review orders but cannot create orders or change payment and fulfillment state.
        </ERPFormNotice>
      ) : null}

      {notice ? (
        <ERPFormNotice tone="success" title="Orders update" onDismiss={() => setNotice("")}>
          {notice}
        </ERPFormNotice>
      ) : null}

      {error ? (
        <ERPFormNotice tone="danger" title="Orders action" onDismiss={() => setError("")}>
          {error}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-orders__kpis" aria-label="Order analytics">
        <article className="bubble-card" data-tone="info">
          <HiOutlineClipboardList aria-hidden="true" />
          <span>Total orders</span>
          <strong>{summary.totalOrders}</strong>
          <small>{formatMoney(summary.totalValue)} requested</small>
        </article>
        <article className="bubble-card" data-tone="success">
          <HiOutlineCash aria-hidden="true" />
          <span>Revenue</span>
          <strong>{formatMoney(summary.paidValue)}</strong>
          <small>{summary.paidOrders} paid order{summary.paidOrders === 1 ? "" : "s"}</small>
        </article>
        <article className="bubble-card" data-tone={summary.outstandingValue ? "warning" : "success"}>
          <HiOutlineCreditCard aria-hidden="true" />
          <span>Outstanding</span>
          <strong>{formatMoney(summary.outstandingValue)}</strong>
          <small>{summary.pendingPaymentOrders} payment pending</small>
        </article>
        <article className="bubble-card" data-tone={summary.failedPaymentOrders ? "danger" : "success"}>
          <HiOutlineXCircle aria-hidden="true" />
          <span>Payment issues</span>
          <strong>{summary.failedPaymentOrders}</strong>
          <small>Failed or abandoned payments</small>
        </article>
        <article className="bubble-card" data-tone="success">
          <HiOutlineCheckCircle aria-hidden="true" />
          <span>Completed</span>
          <strong>{summary.completedOrders}</strong>
          <small>Fulfilled orders</small>
        </article>
      </section>

      <section className="stroane-orders__table-panel">
        <div className="stroane-orders__toolbar">
          <ERPTableSearch
            label="Search orders"
            value={filters.search || ""}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search order, customer, email, phone"
          />
          <SelectField
            label="Order status"
            value={filters.status || ""}
            onChangeValue={(value) => updateFilter("status", getSelectValue(value))}
            options={ORDER_STATUS_OPTIONS}
          />
          <SelectField
            label="Payment"
            value={filters.paymentStatus || ""}
            onChangeValue={(value) => updateFilter("paymentStatus", getSelectValue(value))}
            options={PAYMENT_STATUS_OPTIONS}
          />
          <SelectField
            label="Fulfillment"
            value={filters.fulfillmentStatus || ""}
            onChangeValue={(value) => updateFilter("fulfillmentStatus", getSelectValue(value))}
            options={FULFILLMENT_OPTIONS}
          />
          {(filters.search || filters.status || filters.paymentStatus || filters.fulfillmentStatus) ? (
            <ERPSecondaryAction
              size="sm"
              onClick={() =>
                setFilters({
                  search: "",
                  status: "",
                  paymentStatus: "",
                  fulfillmentStatus: "",
                  limit: 150,
                })
              }
            >
              Clear
            </ERPSecondaryAction>
          ) : null}
        </div>

        {selectedOrderIds.size ? (
          <div className="stroane-orders__bulk-bar" role="region" aria-label="Selected orders">
            <span>
              <strong>{selectedOrderIds.size}</strong> selected
            </span>
            <ERPSecondaryAction size="sm" onClick={() => setSelectedOrderIds(new Set())}>
              Clear selection
            </ERPSecondaryAction>
          </div>
        ) : null}

        <div className="stroane-orders__admin-table admin-table admin-table-scroll">
          <ERPTablePagination
            className="stroane-orders__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={ORDER_PAGE_SIZE}
            totalItems={orders.length}
            itemLabel="orders"
            onPageChange={setPageIndex}
          />
          <table className="stroane-orders__table">
            <colgroup>
              <col className="stroane-orders__col-select" />
              <col className="stroane-orders__col-number" />
              <col className="stroane-orders__col-order" />
              <col className="stroane-orders__col-customer" />
              <col className="stroane-orders__col-source" />
              <col className="stroane-orders__col-payment" />
              <col className="stroane-orders__col-fulfillment" />
              <col className="stroane-orders__col-created" />
              <col className="stroane-orders__col-total" />
              <col className="stroane-orders__col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="portal-table-select-cell" aria-label="Select orders">
                  <input
                    type="checkbox"
                    className="portal-table-checkbox"
                    checked={
                      paginatedOrders.length > 0 &&
                      paginatedOrders.every((order) => selectedOrderIds.has(order.id))
                    }
                    onChange={toggleOrderPageSelection}
                    disabled={!paginatedOrders.length}
                    aria-label="Select all orders on this page"
                  />
                </th>
                <th className="portal-table-number-cell">#</th>
                <th className="col-desktop">Order</th>
                <th>Customer</th>
                <th className="col-desktop">Source</th>
                <th className="col-desktop">Payment</th>
                <th className="col-desktop">Fulfillment</th>
                <th className="col-desktop">Created</th>
                <th>Total</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="stroane-orders__table-empty">
                    Loading orders...
                  </td>
                </tr>
              ) : null}
              {!loading && !orders.length ? (
                <tr>
                  <td colSpan={10} className="stroane-orders__table-empty">
                    No orders match the current view.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? paginatedOrders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={selectedOrderIds.has(order.id) ? "is-bulk-selected" : ""}
                      onClick={() => openOrder(order.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openOrder(order.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td
                        className="portal-table-select-cell"
                        data-label="Select"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="portal-table-checkbox"
                          checked={selectedOrderIds.has(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          aria-label={`Select ${order.orderNumber}`}
                        />
                      </td>
                      <td className="portal-table-number-cell" data-label="#">
                        {clampedPageIndex * ORDER_PAGE_SIZE + index + 1}
                      </td>
                      <td className="col-desktop" data-label="Order">
                        <span className="stroane-orders__order-cell">
                          <strong>{order.orderNumber}</strong>
                        </span>
                      </td>
                      <td data-label="Customer">
                        <span className="stroane-orders__customer-cell">
                          <strong>{order.customer.name}</strong>
                        </span>
                      </td>
                      <td className="col-desktop" data-label="Source">
                        {formatLabel(order.source || "checkout")}
                      </td>
                      <td className="col-desktop" data-label="Payment">
                        <ERPStatusBadge tone={getPaymentTone(order.paymentStatus || "")}>
                          {formatLabel(order.paymentStatus || "not_started")}
                        </ERPStatusBadge>
                      </td>
                      <td className="col-desktop" data-label="Fulfillment">
                        <span
                          className="stroane-orders__fulfillment-cell"
                          title={`${formatDeliveryMethod(order.deliveryMethod)} · ${formatLabel(
                            order.fulfillmentStatus || "new"
                          )}`}
                        >
                          <strong>{formatDeliveryMethod(order.deliveryMethod)}</strong>
                        </span>
                      </td>
                      <td className="col-desktop" data-label="Created">{formatDateTime(order.createdAt)}</td>
                      <td data-label="Total">{formatMoney(order.total, order.currency)}</td>
                      <td
                        data-label="Actions"
                        className="col-desktop stroane-orders__actions-cell"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="stroane-orders__row-actions">
                          {order.paymentReference ? (
                            <ERPIconAction
                              size="sm"
                              className="stroane-orders__paystack-sync"
                              label={`Refresh Paystack status for ${order.orderNumber}`}
                              title={`Refresh Paystack status for ${order.orderNumber}`}
                              onClick={() => void handleRefreshPaystack(order.id)}
                              disabled={!canManageOrders || paymentAction === order.id}
                              loading={paymentAction === order.id}
                            >
                              <HiOutlineRefresh aria-hidden="true" />
                            </ERPIconAction>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
            {orders.length ? (
              <tfoot className="admin-table-footer">
                <tr>
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">
                      {formatMoney(summary.totalValue)}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                </tr>
              </tfoot>
            ) : null}
          </table>
          <ERPTablePagination
            className="stroane-orders__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={ORDER_PAGE_SIZE}
            totalItems={orders.length}
            itemLabel="orders"
            onPageChange={setPageIndex}
          />
        </div>
      </section>

      <ERPModal
        open={Boolean(selectedOrder)}
        title={selectedOrder ? selectedOrder.orderNumber : "Order"}
        description={
          selectedOrder
            ? `${selectedOrder.customer.name} · ${formatMoney(
                selectedOrder.total,
                selectedOrder.currency
              )}`
            : undefined
        }
        onClose={closeOrder}
        closeOnBackdrop
        size="xl"
        className="stroane-orders__modal"
      >
        {selectedOrder ? (
          <div className="stroane-orders__detail-grid">
            <div className="stroane-orders__modal-nav">
              <ERPIconAction
                size="sm"
                label="Previous order"
                onClick={() => void openAdjacentOrder(-1)}
                disabled={!canGoPreviousOrder || autosaveStatus === "saving"}
              >
                <HiOutlineChevronLeft aria-hidden="true" />
              </ERPIconAction>
              <span>{selectedOrderPosition}</span>
              <ERPIconAction
                size="sm"
                label="Next order"
                onClick={() => void openAdjacentOrder(1)}
                disabled={!canGoNextOrder || autosaveStatus === "saving"}
              >
                <HiOutlineChevronRight aria-hidden="true" />
              </ERPIconAction>
            </div>
            <section className="stroane-orders__detail-panel">
              <div className="stroane-orders__status-row">
                <ERPStatusBadge tone={getOrderTone(selectedOrder.status)}>
                  {formatLabel(selectedOrder.status)}
                </ERPStatusBadge>
                <ERPStatusBadge tone={selectedOrder.deliveryMethod ? "info" : "neutral"}>
                  {formatDeliveryMethod(selectedOrder.deliveryMethod)}
                </ERPStatusBadge>
                <ERPStatusBadge tone={getFulfillmentTone(selectedOrder.fulfillmentStatus || "")}>
                  {formatLabel(selectedOrder.fulfillmentStatus || "new")}
                </ERPStatusBadge>
              </div>

              <div className="stroane-orders__mini-stats">
                <span>
                  <strong>{formatMoney(selectedOrder.total, selectedOrder.currency)}</strong>
                  <small>Total</small>
                </span>
                <span>
                  <strong>{selectedOrder.items.length}</strong>
                  <small>Line items</small>
                </span>
                <span>
                  <strong>{formatDateTime(selectedOrder.createdAt)}</strong>
                  <small>Created</small>
                </span>
              </div>

              <div className="stroane-orders__customer-summary">
                <span>
                  <strong>{selectedOrder.customer.name}</strong>
                  <small>{selectedOrder.customer.businessName || "Individual customer"}</small>
                </span>
                <span>{selectedOrder.customer.email}</span>
                <span>{selectedOrder.customer.phone}</span>
              </div>

              {selectedOrderFulfillment ? (
                <section
                  className="stroane-orders__fulfillment-summary"
                  aria-label={`${selectedOrderFulfillment.methodLabel} details from customer checkout`}
                >
                  <header>
                    <span>{selectedOrderFulfillment.methodLabel} details</span>
                    <ERPStatusBadge tone="info">From checkout</ERPStatusBadge>
                  </header>
                  <div className="stroane-orders__fulfillment-facts">
                    <span>
                      <small>
                        {selectedOrder.deliveryMethod === "pickup"
                          ? "Pickup location"
                          : "Delivery address"}
                      </small>
                      <strong>{selectedOrderFulfillment.primary}</strong>
                      {selectedOrderFulfillment.secondary ? (
                        <em>{selectedOrderFulfillment.secondary}</em>
                      ) : null}
                    </span>
                    <span>
                      <small>
                        {selectedOrder.deliveryMethod === "pickup"
                          ? "Pickup date / window"
                          : "Requested date"}
                      </small>
                      <strong>{formatDateTime(selectedOrder.expectedDeliveryDate)}</strong>
                      {selectedOrderFulfillment.pickupWindow ? (
                        <em>{selectedOrderFulfillment.pickupWindow}</em>
                      ) : null}
                    </span>
                  </div>
                  <div className="stroane-orders__fulfillment-notes">
                    <small>
                      {selectedOrder.deliveryMethod === "pickup"
                        ? "Pickup notes from customer"
                        : "Delivery notes from customer"}
                    </small>
                    <p>{selectedOrderFulfillment.customerNotes || "No customer notes provided."}</p>
                  </div>
                </section>
              ) : null}

              {selectedOrderMap.embedUrl ? (
                <div className="stroane-orders__delivery-map">
                  <div>
                    <span>
                      {selectedOrder.deliveryMethod === "pickup"
                        ? "Pickup location"
                        : "Delivery location"}
                    </span>
                    <strong>
                      {selectedOrder.deliveryLocation?.label ||
                        selectedOrder.customer.deliveryAddress}
                    </strong>
                    {selectedOrder.deliveryLocation?.provider ? (
                      <small>{formatLabel(selectedOrder.deliveryLocation.provider)}</small>
                    ) : null}
                  </div>
                  <iframe
                    title={`Map for ${selectedOrder.orderNumber}`}
                    src={selectedOrderMap.embedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <a
                    href={selectedOrderMap.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="stroane-orders__map-link"
                  >
                    <HiOutlineExternalLink aria-hidden="true" />
                    <span>Open in maps</span>
                  </a>
                </div>
              ) : null}

              <div className="stroane-orders__line-list">
                {selectedOrder.items.map((item) => (
                  <div key={`${item.productSlug}-${item.sku || item.productName}`}>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>{item.sku || item.productSlug}</small>
                    </span>
                    <span>
                      <small>{item.quantity} × {formatMoney(item.unitPrice, selectedOrder.currency)}</small>
                      <strong>{formatMoney(item.lineTotal, selectedOrder.currency)}</strong>
                    </span>
                  </div>
                ))}
              </div>

              <div className="stroane-orders__payment-summary">
                <span>
                  <small>Payment status</small>
                  <ERPStatusBadge tone={getPaymentTone(selectedOrder.paymentStatus || "")}>
                    {formatLabel(selectedOrder.paymentStatus || "not_started")}
                  </ERPStatusBadge>
                </span>
                <span>
                  <small>Provider</small>
                  <strong>{formatLabel(selectedOrder.paymentProvider || "paystack")}</strong>
                </span>
              </div>

              <div className="stroane-orders__payment-actions">
                <ERPPrimaryAction
                  icon={<HiOutlineCreditCard />}
                  onClick={handleInitializePaystack}
                  disabled={
                    !canManageOrders ||
                    selectedOrder.paymentStatus === "paid" ||
                    Boolean(paymentAction)
                  }
                  loading={paymentAction === "initialize"}
                  loadingLabel="Creating"
                >
                  Create Paystack link
                </ERPPrimaryAction>
                <ERPSecondaryAction
                  icon={<HiOutlineRefresh />}
                  onClick={() => void handleRefreshPaystack(selectedOrder.id)}
                  disabled={!canManageOrders || !selectedOrder.paymentReference || Boolean(paymentAction)}
                  loading={paymentAction === selectedOrder.id}
                  loadingLabel="Checking"
                >
                  Refresh payment
                </ERPSecondaryAction>
                {paymentLinks[selectedOrder.id] ? (
                  <a
                    href={paymentLinks[selectedOrder.id]}
                    className="stroane-orders__payment-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <HiOutlineExternalLink aria-hidden="true" />
                    <span>Open payment link</span>
                  </a>
                ) : null}
              </div>

              {selectedOrder.paymentReference ? (
                <p className="stroane-orders__reference">
                  Paystack reference: <strong>{selectedOrder.paymentReference}</strong>
                </p>
              ) : null}
            </section>

            <form className="stroane-orders__detail-form" onSubmit={handleSaveOrder}>
              <div className="stroane-orders__form-grid">
                <SelectField
                  label="Order status"
                  value={orderDraft.status}
                  onChangeValue={(value) =>
                    setOrderDraft((current) => ({ ...current, status: getSelectValue(value) }))
                  }
                  disabled={!canManageOrders}
                  options={ORDER_EDIT_STATUS_OPTIONS}
                />
                <SelectField
                  label="Fulfillment status"
                  value={orderDraft.fulfillmentStatus}
                  onChangeValue={(value) =>
                    setOrderDraft((current) => ({
                      ...current,
                      fulfillmentStatus: getSelectValue(value),
                    }))
                  }
                  disabled={!canManageOrders}
                  options={FULFILLMENT_EDIT_OPTIONS}
                />
                <SelectField
                  label="Order type"
                  value={orderDraft.deliveryMethod}
                  onChangeValue={(value) =>
                    setOrderDraft((current) => ({
                      ...current,
                      deliveryMethod: getSelectValue(value),
                    }))
                  }
                  disabled={!canManageOrders}
                  options={DELIVERY_METHOD_OPTIONS}
                />
                <DateField
                  label="Expected delivery / pickup"
                  value={orderDraft.expectedDeliveryDate}
                  onChangeValue={(value) =>
                    setOrderDraft((current) => ({
                      ...current,
                      expectedDeliveryDate: value,
                    }))
                  }
                  disabled={!canManageOrders}
                />
              </div>
              <ERPTextareaField
                label="Staff fulfillment notes"
                value={orderDraft.adminDeliveryNotes}
                onChange={(event) =>
                  setOrderDraft((current) => ({
                    ...current,
                    adminDeliveryNotes: event.target.value,
                  }))
                }
                disabled={!canManageOrders}
              />
              <ERPTextareaField
                label="Internal notes"
                value={orderDraft.internalNotes}
                onChange={(event) =>
                  setOrderDraft((current) => ({
                    ...current,
                    internalNotes: event.target.value,
                  }))
                }
                disabled={!canManageOrders}
              />
              <div className="stroane-orders__modal-actions">
                <span
                  className={`stroane-orders__autosave is-${autosaveStatus}`}
                  role={autosaveStatus === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {autosaveStatus === "saving"
                    ? "Autosaving..."
                    : autosaveStatus === "saved"
                      ? "Autosaved"
                      : autosaveStatus === "error"
                        ? autosaveError || "Autosave failed"
                        : canManageOrders
                          ? "Autosave ready"
                          : "View only"}
                </span>
                <ERPPrimaryAction
                  type="submit"
                  icon={<HiOutlineSave />}
                  loading={saving}
                  disabled={!canManageOrders || autosaveStatus === "saving"}
                >
                  Save now
                </ERPPrimaryAction>
              </div>
            </form>
          </div>
        ) : null}
      </ERPModal>

      <ERPModal
        open={manualOrderOpen}
        title="Manual order"
        description="Create an admin-entered order from priced storefront products."
        onClose={() => setManualOrderOpen(false)}
        closeOnBackdrop
        size="xl"
        className="stroane-orders__modal"
      >
        <form className="stroane-orders__manual-form" onSubmit={handleCreateOrder}>
          <div className="stroane-orders__form-grid">
            <ERPTextField
              label="Customer name"
              value={manualDraft.customerName}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, customerName: event.target.value }))
              }
              required
            />
            <ERPTextField
              label="Email"
              type="email"
              value={manualDraft.customerEmail}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, customerEmail: event.target.value }))
              }
              required
            />
            <ERPTextField
              label="Phone"
              type="tel"
              value={manualDraft.customerPhone}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, customerPhone: event.target.value }))
              }
              autoComplete="tel"
              inputMode="tel"
              pattern={PHONE_INPUT_PATTERN}
              title="Use a valid phone number, for example +233 24 331 6192."
              required
            />
            <SelectField
              label="Preferred contact"
              value={manualDraft.preferredContactMethod}
              onChangeValue={(value) =>
                setManualDraft((current) => ({
                  ...current,
                  preferredContactMethod: getSelectValue(value),
                }))
              }
              options={CONTACT_METHOD_OPTIONS}
            />
            <ERPTextField
              label="Business name"
              value={manualDraft.businessName}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, businessName: event.target.value }))
              }
            />
            <ERPTextField
              label="Delivery address"
              value={manualDraft.deliveryAddress}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, deliveryAddress: event.target.value }))
              }
              required
            />
          </div>
          <ERPTextareaField
            label="Delivery notes"
            value={manualDraft.deliveryNotes}
            onChange={(event) =>
              setManualDraft((current) => ({ ...current, deliveryNotes: event.target.value }))
            }
          />

          <section className="stroane-orders__manual-lines" aria-label="Manual order products">
            <header>
              <span>
                <HiOutlineShoppingBag aria-hidden="true" />
                Products
              </span>
              <ERPSecondaryAction
                type="button"
                size="sm"
                icon={<HiOutlinePlus />}
                onClick={addManualLine}
                disabled={productsLoading || !pricedProducts.length}
              >
                Add line
              </ERPSecondaryAction>
            </header>
            {productLoadError ? (
              <ERPFormNotice tone="warning" title="Catalogue products">
                {productLoadError}
              </ERPFormNotice>
            ) : null}
            {!productLoadError && !pricedProducts.length ? (
              <ERPFormNotice tone="warning" title="No priced products">
                Add prices to active catalogue products before creating manual orders.
              </ERPFormNotice>
            ) : null}
            {manualDraft.items.map((item, index) => {
              const product = productBySlug.get(item.productSlug);
              const quantity = Number(item.quantity) || 1;
              const price = toMoneyNumber(product?.price);
              return (
                <div className="stroane-orders__manual-line" key={`${index}-${item.productSlug}`}>
                  <SelectField
                    label="Product"
                    value={item.productSlug}
                    onChangeValue={(value) =>
                      handleManualLineChange(index, { productSlug: getSelectValue(value) })
                    }
                    options={[
                      { value: "", label: "Select product" },
                      ...pricedProducts.map((productOption) => ({
                        value: productOption.slug || productOption.id,
                        label: `${productOption.name} · ${formatMoney(
                          Number(productOption.price),
                          productOption.currency
                        )}`,
                      })),
                    ]}
                    required
                  />
                  <ERPTextField
                    label="Quantity"
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      handleManualLineChange(index, { quantity: event.target.value })
                    }
                    required
                  />
                  <span className="stroane-orders__manual-line-total">
                    <strong>
                      {price === null ? "Select product" : formatMoney(price * quantity, product?.currency)}
                    </strong>
                    <small>Line total</small>
                  </span>
                  <button
                    type="button"
                    className="stroane-orders__line-remove"
                    onClick={() => removeManualLine(index)}
                    disabled={manualDraft.items.length === 1}
                    aria-label="Remove order line"
                  >
                    <HiOutlineTrash aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </section>

          <div className="stroane-orders__manual-total">
            <span>
              <strong>{formatMoney(manualDraftTotal)}</strong>
              <small>Estimated order total</small>
            </span>
            <div className="stroane-orders__modal-actions">
              <ERPSecondaryAction type="button" onClick={() => setManualOrderOpen(false)}>
                Cancel
              </ERPSecondaryAction>
              <ERPPrimaryAction
                type="submit"
                icon={<HiOutlineTruck />}
                loading={saving}
                disabled={!canManageOrders || !pricedProducts.length}
              >
                Create order
              </ERPPrimaryAction>
            </div>
          </div>
        </form>
      </ERPModal>
    </section>
  );
};

export default OrderManagement;
