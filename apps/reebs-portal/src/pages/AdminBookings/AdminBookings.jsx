import React, { useEffect, useMemo, useState } from "react";
import "./AdminBookings.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faPlus,
  faRotateRight,
  faXmark,
  faPen,
  faFileInvoice,
  faChevronLeft,
  faChevronRight,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../components/AuthContext/AuthContext";
import SearchField from "../../components/SearchField/SearchField";

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

const normalizeCurrency = (currency) => {
  if (typeof currency !== "string") return "GHS";
  const trimmed = currency.trim();
  return trimmed ? trimmed.toUpperCase() : "GHS";
};

const formatMoney = (value, currency = "GHS") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const normalized = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: normalized,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${normalized} ${amount}`;
  }
};

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

const MOBILE_VIEW_QUERY = "(max-width: 720px)";

const getIsMobileView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;

const formatUser = (name) => name || "Admin";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatAttendantsNeeded = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Attendants: -";
  return `Attendants: ${parsed}`;
};

const normalizeStatus = (status) => {
  if (typeof status !== "string") return "";
  const normalized = status.trim().toLowerCase();
  return normalized === "canceled" ? "cancelled" : normalized;
};

const getBookingStage = (booking) => {
  const status = normalizeStatus(booking?.status);
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "confirmed") return "confirmed";
  return "received";
};

const buildMapUrl = (address) => {
  if (!address) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
};

function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const pageSize = 10;
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [detailBooking, setDetailBooking] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);

  const [productQuery, setProductQuery] = useState("");
  const [form, setForm] = useState({
    customerId: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    venueAddress: "",
    status: "pending",
    assignedUserId: "",
    items: [],
    discount: "",
    discountType: "amount",
  });
  const [bouncyCastles, setBouncyCastles] = useState([]);
  const { user } = useAuth();
  const roleKey = String(user?.role || "").trim().toLowerCase();
  const canAccessInvoicing = roleKey === "admin" || roleKey === "manager";
  const viewStorageKey = useMemo(
    () => `reebs_bookings_views_${user?.id || "guest"}`,
    [user?.id]
  );
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(MOBILE_VIEW_QUERY);
    const handleChange = () => {
      const matches = mediaQuery.matches;
      setIsMobileView(matches);
      if (matches) {
        setModalOpen(false);
        setEditing(null);
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
    const handleClickAway = (event) => {
      if (!event.target.closest(".bookings-menu")) {
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
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(viewStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
      }
    } catch (err) {
      console.warn("Failed to load booking views", err);
    }
  }, [viewStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(viewStorageKey, JSON.stringify(savedViews));
    } catch (err) {
      console.warn("Failed to save booking views", err);
    }
  }, [savedViews, viewStorageKey]);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingsRes, inventoryRes, customersRes, usersRes, bouncyRes] = await Promise.all([
        fetch("/.netlify/functions/bookings"),
        fetch("/.netlify/functions/inventory"),
        fetch("/.netlify/functions/customers"),
        fetch("/.netlify/functions/users"),
        fetch("/.netlify/functions/bouncy_castles"),
      ]);

      const [bookingsText, inventoryText, customersText, usersText, bouncyText] = await Promise.all([
        bookingsRes.text(),
        inventoryRes.text(),
        customersRes.text(),
        usersRes.text(),
        bouncyRes.text(),
      ]);

      const tryJson = (text) => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      };

      const bookingsPayload = tryJson(bookingsText);
      const inventoryPayload = tryJson(inventoryText);
      const customersPayload = tryJson(customersText);
      const usersPayload = tryJson(usersText);
      const bouncyPayload = tryJson(bouncyText);

      if (!bookingsRes.ok) {
        throw new Error(bookingsPayload?.error || `Failed to fetch bookings (${bookingsRes.status}).`);
      }
      if (!inventoryRes.ok) {
        throw new Error(inventoryPayload?.error || `Failed to fetch products (${inventoryRes.status}).`);
      }
      if (!customersRes.ok) {
        throw new Error(customersPayload?.error || `Failed to fetch customers (${customersRes.status}).`);
      }
      if (!usersRes.ok) {
        throw new Error(usersPayload?.error || `Failed to fetch team members (${usersRes.status}).`);
      }

      setBookings(Array.isArray(bookingsPayload) ? bookingsPayload : []);
      setCustomers(Array.isArray(customersPayload) ? customersPayload : []);
      setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      if (bouncyRes.ok) {
        setBouncyCastles(Array.isArray(bouncyPayload) ? bouncyPayload : []);
      } else {
        setBouncyCastles([]);
      }

      const rentalProducts = (Array.isArray(inventoryPayload) ? inventoryPayload : []).filter((item) => {
        const sku = (item.sku || "").toString().toUpperCase();
        const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toString().toUpperCase();
        const name = (item.name || "").toString().toLowerCase();
        const isPump = sku.startsWith("PUM") || name.includes("motor pump");
        return (source === "RENTAL" || sku.startsWith("RENT")) && !isPump;
      });

      setProducts(rentalProducts);
    } catch (err) {
      console.error("Failed to load bookings", err);
      setError(err.message || "We couldn't load bookings right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, query, bookings.length]);

  const productMap = useMemo(() => {
    const map = new Map();
    for (const item of products) {
      map.set(Number(item.id), item);
    }
    return map;
  }, [products]);

  const bouncyMap = useMemo(() => {
    const map = new Map();
    for (const castle of bouncyCastles) {
      const productId = Number(castle?.productId);
      if (!Number.isFinite(productId)) continue;
      const motors = toNumber(castle?.motorsToPump, 0);
      map.set(productId, motors);
    }
    return map;
  }, [bouncyCastles]);

  const detailItems = useMemo(() => {
    if (!detailBooking || !Array.isArray(detailBooking.items)) return [];
    const baseItems = detailBooking.items.map((item, index) => ({
      ...item,
      _key: `item-${item.id || item.productId || index}`,
    }));

    const hasPump = baseItems.some((item) => {
      const product = productMap.get(Number(item.productId));
      const name = String(item.productName || product?.name || "").toLowerCase();
      const sku = String(product?.sku || "").toUpperCase();
      return name.includes("pump") || sku.startsWith("PUM");
    });

    const pumpQuantity = baseItems.reduce((sum, item) => {
      const motors = bouncyMap.get(Number(item.productId)) || 0;
      if (!motors) return sum;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      return sum + motors * qty;
    }, 0);

    if (pumpQuantity > 0 && !hasPump) {
      baseItems.push({
        productId: "motor-pump",
        quantity: pumpQuantity,
        productName: "Motor Pump",
        productImage: "",
        _key: `pump-${detailBooking.id || "detail"}`,
      });
    }

    return baseItems;
  }, [detailBooking, productMap, bouncyMap]);

  const filteredBookings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = bookings.filter((booking) => {
      if (statusFilter !== "all" && String(booking.status || "").toLowerCase() !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      const idText = String(booking.id || "").toLowerCase();
      const customer = String(booking.customerName || "").toLowerCase();
      const status = String(booking.status || "").toLowerCase();
      return idText.includes(needle) || customer.includes(needle) || status.includes(needle);
    });
    return list;
  }, [bookings, query, statusFilter]);

  const sortValue = (booking, key) => {
    switch (key) {
      case "id":
        return Number(booking.id) || 0;
      case "customerName":
        return (booking.customerName || "").toLowerCase();
      case "assignedUserName":
        return (booking.assignedUserName || "").toLowerCase();
      case "eventDate":
        return new Date(booking.eventDate || 0).getTime();
      case "timeWindow":
        return (booking.startTime || booking.endTime || "").toLowerCase();
      case "venueAddress":
        return (booking.venueAddress || "").toLowerCase();
      case "items":
        return Array.isArray(booking.items) ? booking.items.length : 0;
      case "totalAmount":
        return toNumber(booking.totalAmount);
      case "status":
        return (booking.status || "").toLowerCase();
      default:
        return booking[key] ?? "";
    }
  };

  const sortedBookings = useMemo(() => {
    const list = [...filteredBookings];
    const { key, direction } = sortConfig;
    list.sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va < vb) return direction === "asc" ? -1 : 1;
      if (va > vb) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredBookings, sortConfig]);

  const kanbanColumns = useMemo(() => {
    const columns = [
      { id: "received", label: "Booking received", items: [] },
      { id: "confirmed", label: "Confirmed", items: [] },
      { id: "event", label: "Event date", items: [] },
      { id: "completed", label: "Completed", items: [] },
      { id: "cancelled", label: "Cancelled", items: [] },
    ];
    const columnMap = new Map(columns.map((col) => [col.id, col]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    sortedBookings.forEach((booking) => {
      const stage = getBookingStage(booking);
      if (stage === "confirmed" && booking?.eventDate) {
        const eventDate = new Date(booking.eventDate);
        if (!Number.isNaN(eventDate.getTime()) && eventDate >= today) {
          columnMap.get("event")?.items.push(booking);
          return;
        }
      }
      columnMap.get(stage)?.items.push(booking);
    });

    columns.forEach((col) => {
      col.items.sort(
        (a, b) => new Date(b.eventDate || 0).getTime() - new Date(a.eventDate || 0).getTime()
      );
    });

    return columns;
  }, [sortedBookings]);

  const detailIndex = useMemo(() => {
    if (!detailBooking) return -1;
    return sortedBookings.findIndex((booking) => booking.id === detailBooking.id);
  }, [detailBooking, sortedBookings]);

  const canGoPrevDetail = detailIndex > 0;
  const canGoNextDetail = detailIndex >= 0 && detailIndex < sortedBookings.length - 1;

  const goPrevDetail = () => {
    if (!canGoPrevDetail) return;
    setDetailBooking(sortedBookings[detailIndex - 1]);
  };

  const goNextDetail = () => {
    if (!canGoNextDetail) return;
    setDetailBooking(sortedBookings[detailIndex + 1]);
  };

  const pageCount = Math.max(1, Math.ceil(sortedBookings.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedBookings = useMemo(() => {
    const start = clampedPage * pageSize;
    return sortedBookings.slice(start, start + pageSize);
  }, [sortedBookings, clampedPage, pageSize]);

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

  const filteredProducts = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();
    const list = [...products].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    if (!needle) return list;
    return list.filter((product) => {
      return product.name?.toLowerCase().includes(needle) || product.sku?.toLowerCase().includes(needle);
    });
  }, [productQuery, products]);

  const bookingCurrency = useMemo(() => {
    const firstItem = form.items[0];
    if (!firstItem) return "GHS";
    const product = productMap.get(Number(firstItem.productId));
    return normalizeCurrency(product?.currency || "GHS");
  }, [form.items, productMap]);

  const bookingDiscountAmount = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      const product = productMap.get(Number(item.productId));
      const overridePrice = Number(item.price);
      const priceCents = Number.isFinite(overridePrice) && overridePrice >= 0
        ? Math.round(overridePrice * 100)
        : Number(product?.price ?? 0);
      const quantity = Number(item.quantity) || 1;
      return sum + priceCents * quantity;
    }, 0);
    const rawDiscount = Math.max(0, Number(form.discount) || 0);
    if (form.discountType === "percent") {
      return (subtotal / 100) * (rawDiscount / 100);
    }
    return rawDiscount;
  }, [form.items, form.discount, form.discountType, productMap]);

  const bookingTotalCents = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      const product = productMap.get(Number(item.productId));
      const overridePrice = Number(item.price);
      const priceCents = Number.isFinite(overridePrice) && overridePrice >= 0
        ? Math.round(overridePrice * 100)
        : Number(product?.price ?? 0);
      const quantity = Number(item.quantity) || 1;
      return sum + priceCents * quantity;
    }, 0);
    const rawDiscount = Math.max(0, Number(form.discount) || 0);
    const discountCents = form.discountType === "percent"
      ? Math.round(subtotal * (rawDiscount / 100))
      : Math.round(rawDiscount * 100);
    return Math.max(0, subtotal - discountCents);
  }, [form.items, form.discount, form.discountType, productMap]);

  const viewInvoice = (booking) => {
    if (!booking?.id || !canAccessInvoicing) return;
    navigate(`/admin/invoicing?type=bookings&id=${booking.id}`);
  };

  const addItem = (product) => {
    setForm((prev) => {
      const existing = prev.items.find((item) => Number(item.productId) === Number(product.id));
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            Number(item.productId) === Number(product.id)
              ? { ...item, quantity: (Number(item.quantity) || 1) + 1 }
              : item
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            productId: product.id,
            quantity: 1,
            price: Number.isFinite(product?.price) ? (product.price / 100).toFixed(2) : "",
          },
        ],
      };
    });
  };

  const updateItemQuantity = (productId, nextValue) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (Number(item.productId) !== Number(productId)) return item;
        const next = Math.max(1, parseInt(nextValue, 10) || 1);
        return { ...item, quantity: next };
      }),
    }));
  };

  const updateItemPrice = (productId, nextValue) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (Number(item.productId) !== Number(productId)) return item;
        return { ...item, price: nextValue };
      }),
    }));
  };

  const removeItem = (productId) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => Number(item.productId) !== Number(productId)),
    }));
  };

  const buildMenuPosition = (rect) => {
    const width = 320;
    const gutter = 12;
    const initialTop = rect.bottom + 8;
    const maxBelow = window.innerHeight - initialTop - gutter;
    const maxAbove = rect.top - gutter - 8;
    let maxHeight = Math.min(420, Math.max(160, maxBelow));
    let top = initialTop;
    if (maxBelow < 160 && maxAbove > maxBelow) {
      maxHeight = Math.min(420, Math.max(160, maxAbove));
      top = Math.max(gutter, rect.top - maxHeight - 8);
    }
    let left = rect.left;
    if (left + width > window.innerWidth - gutter) {
      left = rect.right - width;
    }
    left = Math.min(Math.max(gutter, left), window.innerWidth - width - gutter);
    return { top, left, maxHeight };
  };

  const toggleBookingMenu = (bookingId, event) => {
    const rect = event?.currentTarget?.getBoundingClientRect();
    if (openMenuId === bookingId) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }
    setOpenMenuId(bookingId);
    setMenuPosition(rect ? buildMenuPosition(rect) : null);
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const openCreate = () => {
    if (isMobileView) return;
    setEditing(null);
    setSaveError("");
    setProductQuery("");
    setForm({
      customerId: customers[0]?.id ? String(customers[0].id) : "",
      eventDate: "",
      startTime: "",
      endTime: "",
      venueAddress: "",
      status: "pending",
      assignedUserId: user?.id ? String(user.id) : "",
      items: [],
      discount: "",
      discountType: "amount",
    });
    setModalOpen(true);
  };

  const openEdit = (booking) => {
    if (isMobileView) return;
    setEditing(booking);
    setSaveError("");
    setProductQuery("");

    setForm({
      customerId: booking.customerId ? String(booking.customerId) : "",
      eventDate: booking.eventDate ? String(booking.eventDate).slice(0, 10) : "",
      startTime: booking.startTime || "",
      endTime: booking.endTime || "",
      venueAddress: booking.venueAddress || "",
      status: booking.status || "pending",
      assignedUserId: booking.assignedUserId ? String(booking.assignedUserId) : "",
      items: Array.isArray(booking.items)
        ? booking.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: Number.isFinite(item.price) ? (item.price / 100).toFixed(2) : "",
          }))
        : [],
      discount: "",
      discountType: "amount",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setSaveError("");
  };

  const save = async (event) => {
    event.preventDefault();
    setSaveError("");

    if (!form.customerId) return setSaveError("Select a customer.");
    if (!form.eventDate) return setSaveError("Event date is required.");
    if (!form.venueAddress.trim()) return setSaveError("Venue address is required.");
    if (!form.items.length) return setSaveError("Add at least one item to the booking.");

    setSaving(true);
    try {
      const isEdit = Boolean(editing?.id);
      const response = await fetch("/.netlify/functions/bookings", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? editing.id : undefined,
          customerId: Number(form.customerId),
          eventDate: form.eventDate,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          venueAddress: form.venueAddress,
          status: form.status,
          assignedUserId: form.assignedUserId ? Number(form.assignedUserId) : null,
          discount: bookingDiscountAmount,
          items: form.items.map((item) => ({
            ...item,
            price: Number(item.price) || undefined,
          })),
          userId: user?.id,
          userName: user?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
          userEmail: user?.email,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Save failed.");

      setBookings((prev) => {
        if (isEdit) return prev.map((row) => (row.id === payload.id ? payload : row));
        return [payload, ...prev];
      });

      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      console.error("Save booking failed", err);
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateBookingStatus = async (booking, nextStatus) => {
    if (!booking?.id) return;
    setStatusUpdatingId(booking.id);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: booking.id,
          customerId: booking.customerId,
          eventDate: booking.eventDate,
          startTime: booking.startTime || null,
          endTime: booking.endTime || null,
          venueAddress: booking.venueAddress || "",
          status: nextStatus,
          assignedUserId: booking.assignedUserId ?? null,
          discount: 0,
          items: Array.isArray(booking.items)
            ? booking.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: Number.isFinite(item.price) ? item.price / 100 : undefined,
              }))
            : [],
          userId: user?.id,
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to update booking.");
      setBookings((prev) =>
        prev.map((row) => (row.id === payload.id ? payload : row))
      );
      setDetailBooking((prev) => (prev && prev.id === payload.id ? payload : prev));
    } catch (err) {
      console.error("Booking status update failed", err);
      setError(err.message || "Failed to update booking.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const applySavedView = (view) => {
    setQuery(view?.query || "");
    setStatusFilter(view?.statusFilter || "all");
  };

  const handleViewChange = (event) => {
    const nextId = event.target.value;
    setActiveViewId(nextId);
    if (nextId === "all") {
      applySavedView({ query: "", statusFilter: "all" });
      return;
    }
    const view = savedViews.find((item) => item.id === nextId);
    if (view) applySavedView(view);
  };

  const handleSaveView = () => {
    if (typeof window === "undefined") return;
    const name = window.prompt("Name this view");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedViews((prev) => {
      const existing = prev.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        const next = prev.map((item) =>
          item.id === existing.id ? { ...item, query, statusFilter } : item
        );
        setActiveViewId(existing.id);
        return next;
      }
      const nextId = `view-${Date.now()}`;
      setActiveViewId(nextId);
      return [...prev, { id: nextId, name: trimmed, query, statusFilter }];
    });
  };

  const handleDeleteView = () => {
    if (activeViewId === "all") return;
    setSavedViews((prev) => prev.filter((item) => item.id !== activeViewId));
    setActiveViewId("all");
    applySavedView({ query: "", statusFilter: "all" });
  };


  return (
    <div className="bookings-page">
      <div className="bookings-shell">
        <AdminBreadcrumb items={[{ label: "Bookings" }]} />

        <header className="bookings-header">
          <div>
            <p className="bookings-eyebrow">Bookings</p>
            <h1>Rental bookings</h1>
            <p className="bookings-subtitle">Review upcoming events, track statuses, and create bookings.</p>
          </div>
          {!isMobileView && (
            <div className="bookings-actions">
              <button type="button" className="bookings-secondary" onClick={fetchAll}>
                <AppIcon icon={faRotateRight} />
                Refresh
              </button>
              <button type="button" className="bookings-primary" onClick={openCreate}>
                <AppIcon icon={faPlus} />
                Add booking
              </button>
            </div>
          )}
        </header>

        <section className="bookings-panel">
          <div className="bookings-panel-header">
            <div>
              <h3>All bookings</h3>
              <span>{bookings.length} total</span>
            </div>
            <div className="bookings-view">
              <label className="bookings-filter">
                Status
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="bookings-filter">
                Saved view
                <select value={activeViewId} onChange={handleViewChange}>
                  <option value="all">All bookings</option>
                  {savedViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="bookings-search">
                Search
                <SearchField
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClear={() => setQuery("")}
                  placeholder="Id, customer, status"
                  aria-label="Search bookings"
                />
              </label>
              <div className="bookings-view-actions">
                <button type="button" className="bookings-action" onClick={handleSaveView}>
                  Save view
                </button>
                {activeViewId !== "all" && (
                  <button
                    type="button"
                    className="bookings-action bookings-action-ghost"
                    onClick={handleDeleteView}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading && <p className="bookings-status">Loading bookings...</p>}
          {!loading && error && (
            <div className="bookings-inline">
              <p className="bookings-error">{error}</p>
              <button type="button" className="bookings-secondary" onClick={fetchAll}>
                <AppIcon icon={faRotateRight} /> Retry
              </button>
            </div>
          )}

          {!loading && !error && false && (
            <div className="bookings-table-wrapper">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("id")}>
                        Booking <span className="sort-indicator">{sortIndicator("id")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("customerName")}>
                        Customer <span className="sort-indicator">{sortIndicator("customerName")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("assignedUserName")}>
                        Assigned to <span className="sort-indicator">{sortIndicator("assignedUserName")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("eventDate")}>
                        Event <span className="sort-indicator">{sortIndicator("eventDate")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("timeWindow")}>
                        Time <span className="sort-indicator">{sortIndicator("timeWindow")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("venueAddress")}>
                        Venue <span className="sort-indicator">{sortIndicator("venueAddress")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("totalAmount")}>
                        Total <span className="sort-indicator">{sortIndicator("totalAmount")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("status")}>
                        Status <span className="sort-indicator">{sortIndicator("status")}</span>
                      </button>
                    </th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedBookings.map((booking) => {
                    const timeWindow = booking.startTime || booking.endTime
                      ? `${booking.startTime || ""}${booking.endTime ? ` – ${booking.endTime}` : ""}`
                      : "-";
                    const totalValue = toNumber(booking.totalAmount, 0) / 100;

                    return (
                      <tr key={booking.id} className="bookings-row" onClick={() => setDetailBooking(booking)}>
                        <td>#{booking.id}</td>
                        <td>{booking.customerName || "-"}</td>
                        <td>{formatUser(booking.assignedUserName)}</td>
                        <td>{formatDate(booking.eventDate)}</td>
                        <td>{timeWindow}</td>
                        <td className="bookings-venue">{booking.venueAddress || "-"}</td>
                        <td>{formatMoney(totalValue, "GHS")}</td>
                        <td>
                          <span className={`bookings-pill ${booking.status || "pending"}`}>
                            {booking.status || "pending"}
                          </span>
                        </td>
                        <td>
                          {!isMobileView && (
                            <div className="bookings-actions-col" onClick={(e) => e.stopPropagation()}>
                              <div className="bookings-menu">
                                <button
                                  type="button"
                                  className="bookings-edit"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBookingMenu(booking.id, e);
                                  }}
                                >
                                  ⋮
                                </button>
                                <div
                                  className={`bookings-menu-list ${openMenuId === booking.id ? "open" : ""}`}
                                  style={openMenuId === booking.id ? menuPosition : undefined}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="bookings-menu-actions">
                                    {canAccessInvoicing && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          closeMenu();
                                          viewInvoice(booking);
                                        }}
                                      >
                                        Generate invoice
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        closeMenu();
                                        openEdit(booking);
                                      }}
                                    >
                                      Edit details
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!sortedBookings.length && (
                    <tr>
                      <td colSpan={10} className="bookings-empty">
                        No bookings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="table-pagination">
                <span>
                  Showing {sortedBookings.length === 0 ? 0 : clampedPage * pageSize + 1}-
                  {Math.min(sortedBookings.length, (clampedPage + 1) * pageSize)} of {sortedBookings.length}
                </span>
                <div className="table-pagination-controls">
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}>
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={clampedPage >= pageCount - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="bookings-card-grid">
                {paginatedBookings.map((booking) => {
                  const timeWindow = booking.startTime || booking.endTime
                    ? `${booking.startTime || ""}${booking.endTime ? ` – ${booking.endTime}` : ""}`
                    : "-";
                  const itemsCount = Array.isArray(booking.items) ? booking.items.length : 0;
                  const totalValue = toNumber(booking.totalAmount, 0) / 100;
                return (
                  <button
                    type="button"
                    key={booking.id}
                    className="bookings-card"
                    onClick={() => setDetailBooking(booking)}
                  >
                    <div className="bookings-card-head">
                      <span className="bookings-pill small">{booking.status || "pending"}</span>
                      <span className="bookings-amount">{formatMoney(totalValue, "GHS")}</span>
                    </div>
                    <h4>#{booking.id} · {booking.customerName || "-"}</h4>
                    <p className="bookings-card-meta">
                      {formatDate(booking.eventDate)} · {timeWindow}
                    </p>
                    <p className="bookings-card-meta">{booking.venueAddress || "-"}</p>
                    <p className="bookings-card-meta">{itemsCount} item{itemsCount === 1 ? "" : "s"}</p>
                    <p className="bookings-card-meta">
                      Assigned to: {formatUser(booking.assignedUserName)}
                    </p>
                    {!isMobileView && (
                      <div className="bookings-card-actions">
                        <div className="bookings-menu">
                          <button
                            type="button"
                            className="bookings-edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookingMenu(booking.id, e);
                            }}
                          >
                            ⋮
                          </button>
                          <div
                            className={`bookings-menu-list ${openMenuId === booking.id ? "open" : ""}`}
                            style={openMenuId === booking.id ? menuPosition : undefined}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bookings-menu-actions">
                              {canAccessInvoicing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMenu();
                                    viewInvoice(booking);
                                  }}
                                >
                                  <AppIcon icon={faFileInvoice} />
                                  Generate invoice
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  closeMenu();
                                  openEdit(booking);
                                }}
                              >
                                <AppIcon icon={faPen} />
                                Edit details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
              {!sortedBookings.length && <p className="bookings-muted">No bookings found.</p>}
              </div>
              <div className="table-pagination">
                <span>
                  Showing {sortedBookings.length === 0 ? 0 : clampedPage * pageSize + 1}-
                  {Math.min(sortedBookings.length, (clampedPage + 1) * pageSize)} of {sortedBookings.length}
                </span>
                <div className="table-pagination-controls">
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}>
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={clampedPage >= pageCount - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          {!loading && !error && false && (
            <div className="bookings-kanban">
              {kanbanColumns.map((column) => (
                <div key={column.id} className="bookings-kanban-column">
                  <div className="bookings-kanban-header">
                    <h4>{column.label}</h4>
                    <span>{column.items.length}</span>
                  </div>
                  {column.items.length ? (
                    column.items.map((booking) => {
                      const totalValue = toNumber(booking.totalAmount, 0) / 100;
                      return (
                        <button
                          type="button"
                          key={booking.id}
                          className="bookings-kanban-card"
                          onClick={() => setDetailBooking(booking)}
                        >
                          <div className="bookings-kanban-card-head">
                            <span className={`bookings-pill ${booking.status || "pending"}`}>
                              {booking.status || "pending"}
                            </span>
                            <span className="bookings-kanban-amount">{formatMoney(totalValue, "GHS")}</span>
                          </div>
                          <h5>#{booking.id} · {booking.customerName || "-"}</h5>
                          <p className="bookings-kanban-meta">{formatDate(booking.eventDate)}</p>
                          <p className="bookings-kanban-meta">{booking.venueAddress || "-"}</p>
                        </button>
                      );
                    })
                  ) : (
                    <p className="bookings-muted">No bookings here.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel">
            <header>
              <div>
                <p className="customers-eyebrow">{editing ? "Edit" : "New"} booking</p>
                <h2>{editing ? "Update" : "Add"} booking</h2>
              </div>
              <button type="button" className="customers-modal-close" onClick={closeModal} aria-label="Close">
                <AppIcon icon={faXmark} />
              </button>
            </header>

            <form className="customers-form" onSubmit={save}>
              <label>
                Customer
                <select
                  value={form.customerId}
                  onChange={(event) => setForm((prev) => ({ ...prev, customerId: event.target.value }))}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.email ? `- ${customer.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Venue address
                <input
                  type="text"
                  value={form.venueAddress}
                  onChange={(event) => setForm((prev) => ({ ...prev, venueAddress: event.target.value }))}
                  placeholder="Venue / delivery address"
                  required
                />
              </label>

              <label>
                Event date
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, eventDate: event.target.value }))}
                  required
                />
              </label>

              <label>
                Start time (optional)
                <input
                  type="text"
                  value={form.startTime}
                  onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                  placeholder="10:00 AM"
                />
              </label>

              <label>
                End time (optional)
                <input
                  type="text"
                  value={form.endTime}
                  onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                  placeholder="04:00 PM"
                />
              </label>

              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label>
                Assigned to
                <select
                  value={form.assignedUserId}
                  onChange={(event) => setForm((prev) => ({ ...prev, assignedUserId: event.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {users.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName || [member.firstName, member.lastName].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Add items
                <SearchField
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  onClear={() => setProductQuery("")}
                  placeholder="Search rentals"
                  aria-label="Search rentals"
                />
              </label>

              <div className="booking-items-picker">
                <div className="booking-items-list">
                  {filteredProducts.slice(0, 10).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="booking-item-add"
                      onClick={() => addItem(product)}
                    >
                      {product.name}
                    </button>
                  ))}
                </div>

                {form.items.length > 0 && (
                  <div className="booking-items-selected">
                    {form.items.map((item) => {
                      const product = productMap.get(Number(item.productId));
                      return (
                        <div key={item.productId} className="booking-item-row">
                          <span>{product?.name || `Product ${item.productId}`}</span>
                          <div className="booking-item-controls">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price ?? ""}
                              onChange={(event) => updateItemPrice(item.productId, event.target.value)}
                              placeholder={product?.price ? (product.price / 100).toFixed(2) : "0.00"}
                              aria-label="Override price"
                            />
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) => updateItemQuantity(item.productId, event.target.value)}
                            />
                            <button type="button" onClick={() => removeItem(item.productId)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="booking-item-total">
                      <div className="booking-item-total-left">
                        <span>Discount</span>
                        <div className="booking-discount-input">
                          <select
                            value={form.discountType}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, discountType: event.target.value }))
                            }
                            aria-label="Discount type"
                          >
                            <option value="amount">Amount</option>
                            <option value="percent">Percent</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            step={form.discountType === "percent" ? "1" : "0.01"}
                            value={form.discount}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, discount: event.target.value }))
                            }
                            placeholder={form.discountType === "percent" ? "0" : "0.00"}
                          />
                        </div>
                      </div>
                      <div className="booking-item-total-right">
                        <span>Total</span>
                        <strong>{formatMoney(bookingTotalCents / 100, bookingCurrency)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {saveError && <p className="customers-error">{saveError}</p>}

              <div className="customers-form-actions">
                <button type="button" className="customers-secondary" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="customers-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailBooking && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel bookings-detail-panel">
            <header>
              <div>
                <p className="customers-eyebrow">Booking #{detailBooking.id}</p>
                <h2>{detailBooking.customerName || "Customer"}</h2>
                <p className="bookings-card-meta">
                  {formatDate(detailBooking.eventDate)} · {detailBooking.startTime || ""}{detailBooking.endTime ? ` – ${detailBooking.endTime}` : ""}
                </p>
              </div>
              <div className="booking-detail-actions">
                <div className="detail-nav">
                  <button
                    type="button"
                    className="detail-nav-button"
                    onClick={goPrevDetail}
                    disabled={!canGoPrevDetail}
                    aria-label="Previous booking"
                  >
                    <AppIcon icon={faChevronLeft} />
                  </button>
                  <button
                    type="button"
                    className="detail-nav-button"
                    onClick={goNextDetail}
                    disabled={!canGoNextDetail}
                    aria-label="Next booking"
                  >
                    <AppIcon icon={faChevronRight} />
                  </button>
                </div>
                {!isMobileView && (
                  <>
                    <button
                      type="button"
                      className="bookings-action"
                      onClick={() => updateBookingStatus(detailBooking, "confirmed")}
                      disabled={
                        statusUpdatingId === detailBooking.id ||
                        normalizeStatus(detailBooking.status) !== "pending"
                      }
                    >
                      {statusUpdatingId === detailBooking.id ? "Updating..." : "Accept"}
                    </button>
                    <button
                      type="button"
                      className="bookings-action bookings-action-primary"
                      onClick={() => updateBookingStatus(detailBooking, "completed")}
                      disabled={
                        statusUpdatingId === detailBooking.id ||
                        normalizeStatus(detailBooking.status) !== "confirmed"
                      }
                    >
                      {statusUpdatingId === detailBooking.id ? "Updating..." : "Confirm"}
                    </button>
                  </>
                )}
                {!isMobileView && (
                  <button
                    type="button"
                    className="bookings-edit"
                    onClick={() => {
                      openEdit(detailBooking);
                      setDetailBooking(null);
                    }}
                  >
                    <AppIcon icon={faPen} />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="customers-modal-close"
                  onClick={() => setDetailBooking(null)}
                  aria-label="Close"
                >
                  <AppIcon icon={faXmark} />
                </button>
              </div>
            </header>

            <div className="booking-detail-body">
              <div className="booking-detail-row">
                <span>Status</span>
                <span className={`bookings-pill ${detailBooking.status || "pending"}`}>
                  {detailBooking.status || "pending"}
                </span>
              </div>
              {isMobileView && (
                <div className="bookings-detail-mobile-actions">
                  <button
                    type="button"
                    className="bookings-action"
                    onClick={() => updateBookingStatus(detailBooking, "confirmed")}
                    disabled={
                      statusUpdatingId === detailBooking.id ||
                      normalizeStatus(detailBooking.status) !== "pending"
                    }
                  >
                    {statusUpdatingId === detailBooking.id ? "Updating..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    className="bookings-action bookings-action-primary"
                    onClick={() => updateBookingStatus(detailBooking, "completed")}
                    disabled={
                      statusUpdatingId === detailBooking.id ||
                      normalizeStatus(detailBooking.status) !== "confirmed"
                    }
                  >
                    {statusUpdatingId === detailBooking.id ? "Updating..." : "Confirm"}
                  </button>
                </div>
              )}
              <div className="booking-detail-row">
                <span>Assigned To</span>
                <span>{formatUser(detailBooking.assignedUserName)}</span>
              </div>
              <div className="booking-detail-row">
                <span>Last updated</span>
                <span>
                  {formatDateTime(detailBooking.lastModifiedAt || detailBooking.updatedAt)} · {formatUser(detailBooking.updatedByName)}
                </span>
              </div>
              <div className="booking-detail-row">
                <span>Venue</span>
                <span>{detailBooking.venueAddress || "-"}</span>
              </div>
              <div className="booking-detail-row">
                <span>Location</span>
                <span>
                  {detailBooking.venueAddress ? (
                    <div className="booking-map">
                      <iframe
                        title="Booking location"
                        src={buildMapUrl(detailBooking.venueAddress)}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  ) : (
                    "No address provided"
                  )}
                </span>
              </div>
              <div className="booking-detail-row">
                <span>Total</span>
                <span>{formatMoney((detailBooking.totalAmount || 0) / 100, "GHS")}</span>
              </div>
              <div className="booking-detail-items">
                <h4>Items</h4>
                {detailItems.length > 0 ? (
                  <ul>
                    {detailItems.map((item) => {
                      const product = productMap.get(Number(item.productId));
                      const productName = item.productName || product?.name || `Product ${item.productId}`;
                      const imageSrc = item.productImage || product?.imageUrl || product?.image || "";
                      const fallbackLabel = productName.slice(0, 1).toUpperCase();
                      const attendantsLabel = formatAttendantsNeeded(product?.attendantsNeeded);
                      return (
                        <li key={item._key || `${detailBooking.id}-${item.productId}`}>
                          <div className="booking-detail-item">
                            {imageSrc ? (
                              <img
                                className="booking-detail-item-image"
                                src={imageSrc}
                                alt={productName}
                                loading="lazy"
                              />
                            ) : (
                              <div className="booking-detail-item-fallback" aria-hidden="true">
                                {fallbackLabel}
                              </div>
                            )}
                            <div>
                              <strong>{productName}</strong>
                            </div>
                          </div>
                          <div className="booking-detail-metrics">
                            <span>x{item.quantity}</span>
                            <span className="booking-detail-attendants">{attendantsLabel}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="bookings-muted">No items listed.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBookings;
