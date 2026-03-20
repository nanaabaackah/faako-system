/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import "./AdminInvoicing.css";
import { useLocation } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import { faFilePdf, faPrint, faPaperPlane, faSearch, faFolderOpen } from "/src/icons/iconSet";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";

const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch (err) {
    return `GHS ${Number(amount || 0).toFixed(2)}`;
  }
};

const formatPdfCurrency = (amount) => {
  const value = Number(amount || 0);
  try {
    const formatted = new Intl.NumberFormat("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `GHS ${formatted}`;
  } catch (err) {
    return `GHS ${value.toFixed(2)}`;
  }
};

const COMPANY = {
  name: "REEBS Party Themes",
  location: "Sakumono Broadway, Tema, Ghana",
  phone: "+233 24 423 8419",
  email: "info@reebs.com",
  logo: "/imgs/brand/reebs_logo.png",
};

const defaultConfig = {
  currency: "GHS",
  taxRate: "0",
  storeName: COMPANY.name,
  storeEmail: COMPANY.email,
  storePhone: COMPANY.phone,
  storeAddress: COMPANY.location,
  transportRate: "0",
};

const loadConfig = () => {
  try {
    const stored = localStorage.getItem("reebs_erp_config");
    if (!stored) return defaultConfig;
    const parsed = JSON.parse(stored);
    return { ...defaultConfig, ...parsed };
  } catch {
    return defaultConfig;
  }
};

const parseTaxRate = (value) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const parseTransportRate = (value) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
};

const geocodeCacheKey = "reebs_invoice_geocode_v1";

const loadGeocodeCache = () => {
  try {
    const raw = localStorage.getItem(geocodeCacheKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveGeocodeCache = (cache) => {
  try {
    localStorage.setItem(geocodeCacheKey, JSON.stringify(cache));
  } catch {
    // ignore cache write issues
  }
};

const geocodeAddress = async (address) => {
  const cleaned = String(address || "").trim();
  if (!cleaned) return null;
  const cache = loadGeocodeCache();
  if (cache[cleaned]) return cache[cleaned];

  const response = await fetch("/.netlify/functions/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: cleaned }),
  });
  const raw = await response.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!response.ok) return null;
  const lat = Number(data?.lat);
  const lng = Number(data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const coords = { lat, lng };
  cache[cleaned] = coords;
  saveGeocodeCache(cache);
  return coords;
};

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (origin, destination) => {
  if (!origin || !destination) return 0;
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(destination.lng - origin.lng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const loadImageData = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load logo");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseTimeToMinutes = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3] ? match[3].toUpperCase() : "";
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (meridiem) {
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  }
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const calculateDurationHours = (startTime, endTime) => {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return null;
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  if (diff <= 0) return null;
  return diff / 60;
};

const loadInvoiceMeta = () => {
  try {
    const stored = localStorage.getItem("invoiceMeta");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const formatShortDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateStamp = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10).replace(/-/g, "");
};

function AdminInvoicing() {
  const location = useLocation();
  const [viewType, setViewType] = useState("orders"); // orders | bookings
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceMeta, setInvoiceMeta] = useState(loadInvoiceMeta);
  const [config, setConfig] = useState(loadConfig);
  const [bouncyCastles, setBouncyCastles] = useState([]);
  const [transportInfo, setTransportInfo] = useState(null);
  const [transportLoading, setTransportLoading] = useState(false);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    setConfig(loadConfig());
    const handleStorage = (event) => {
      if (event.key === "reebs_erp_config") {
        setConfig(loadConfig());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextType = params.get("type");
    const nextId = Number(params.get("id"));
    if (nextType === "orders" || nextType === "bookings") {
      setViewType(nextType);
    }
    if (Number.isFinite(nextId) && nextId > 0) {
      setSelectedId(nextId);
    }
    setSaveError("");
    setSaveStatus("");
  }, [location.search]);

  useEffect(() => {
    localStorage.setItem("invoiceMeta", JSON.stringify(invoiceMeta));
  }, [invoiceMeta]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const res = await fetch("/.netlify/functions/orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load orders.");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Orders fetch failed", err);
      setOrdersError(err.message || "Unable to load orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchBookings = async () => {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const res = await fetch("/.netlify/functions/bookings");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load bookings.");
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Bookings fetch failed", err);
      setBookingsError(err.message || "Unable to load bookings.");
    } finally {
      setBookingsLoading(false);
    }
  };

  const fetchBouncyCastles = async () => {
    try {
      const res = await fetch("/.netlify/functions/bouncy_castles");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load bouncy castles.");
      setBouncyCastles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Bouncy castles fetch failed", err);
      setBouncyCastles([]);
    }
  };

  const normalizeOrderInvoice = (payload, fallbackItems = []) => {
    let items = Array.isArray(payload?.items) ? payload.items : payload?.items;
    let usingFallback = false;
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }
    if (!Array.isArray(items)) items = [];
    if (!items.length && Array.isArray(fallbackItems) && fallbackItems.length) {
      items = fallbackItems;
      usingFallback = true;
    }
    const expenseInfo = normalizeExpenseList(payload);
    return {
      type: "order",
      docLabel: "Receipt",
      invoiceNumber: payload?.invoiceNumber || (payload?.orderNumber ? `REC-${payload.orderNumber}` : ""),
      date: payload?.date || formatShortDate(new Date()),
      customer: payload?.customer || {},
      items: items.map((item, index) => {
        const quantity = toNumber(item.quantity, 1);
        const unitPriceRaw = toNumber(item.unitPriceCents ?? item.unit_price ?? item.unitPrice, 0);
        const totalRaw = toNumber(item.totalCents ?? item.total_amount ?? item.total, unitPriceRaw * quantity);
        const isCents = usingFallback || item.unitPriceCents != null || item.unit_price != null || item.totalCents != null || item.total_amount != null;
        const unitPrice = isCents ? unitPriceRaw / 100 : unitPriceRaw;
        const total = isCents ? totalRaw / 100 : totalRaw;
        return {
          id: item.id || `${item.productId || "item"}-${index}`,
          name: item.name || item.Product?.name || "Item",
          quantity,
          unitPrice,
          total,
        };
      }),
      summary: payload?.summary || { subtotal: 0, taxRate: 0.15, taxTotal: 0, grandTotal: 0 },
      expenses: expenseInfo.expenses,
      expensesTotal: expenseInfo.total,
    };
  };

  const normalizeBookingInvoice = (payload, fallbackItems = []) => {
    let items = Array.isArray(payload?.items) ? payload.items : payload?.items;
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }
    if (!Array.isArray(items)) items = [];
    if (!items.length && Array.isArray(fallbackItems) && fallbackItems.length) {
      items = fallbackItems;
    }
    const subtotal = toNumber(payload?.totalAmount, 0) / 100;
    const expenseInfo = normalizeExpenseList(payload);
    return {
      type: "booking",
      docLabel: "Invoice",
      invoiceNumber: `INV-${formatDateStamp(payload?.eventDate)}-${payload?.id}`,
      date: formatShortDate(payload?.eventDate),
      customer: {
        name: payload?.customerName || "Customer",
        email: payload?.customerEmail || "",
        phone: payload?.customerPhone || "",
      },
      event: {
        eventDate: payload?.eventDate,
        startTime: payload?.startTime || "",
        endTime: payload?.endTime || "",
        venueAddress: payload?.venueAddress || "",
      },
      items: items.map((item, index) => {
        const quantity = toNumber(item.quantity, 1);
        const unitPrice = toNumber(item.price ?? item.unitPrice, 0) / 100;
        const total = unitPrice * quantity;
        return {
          id: item.id || `${item.productId || "item"}-${index}`,
          productId: item.productId,
          name: item.productName || item.name || "Item",
          quantity,
          unitPrice,
          total,
          attendantsNeeded: item.attendantsNeeded,
          rate: item.rate,
        };
      }),
      summary: {
        subtotal,
        taxRate: 0,
        taxTotal: 0,
        grandTotal: subtotal,
      },
      expenses: expenseInfo.expenses,
      expensesTotal: expenseInfo.total,
    };
  };

  const bouncyMotorMap = useMemo(() => {
    const map = new Map();
    for (const castle of bouncyCastles) {
      const productId = Number(castle?.productId);
      if (!Number.isFinite(productId)) continue;
      const motors = toNumber(castle?.motorsToPump, 0);
      map.set(productId, motors);
    }
    return map;
  }, [bouncyCastles]);

  const addMotorPumpLine = (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const hasPump = items.some((item) => {
      const name = String(item?.name || "").toLowerCase();
      return name.includes("motor pump") || name.includes("pump");
    });
    const pumpQty = items.reduce((sum, item) => {
      const motors = bouncyMotorMap.get(Number(item?.productId)) || 0;
      if (!motors) return sum;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      return sum + motors * qty;
    }, 0);
    if (pumpQty > 0 && !hasPump) {
      return [
        ...items,
        {
          id: `pump-${pumpQty}`,
          productId: null,
          name: "Motor Pump",
          quantity: pumpQty,
          unitPrice: 0,
          total: 0,
        },
      ];
    }
    return items;
  };

  const buildTransportLine = (transport) => {
    if (!transport || transport.cost <= 0 || transport.distanceKm <= 0) return null;
    const distance = Number(transport.distanceKm.toFixed(1));
    const rate = Number(transport.rate.toFixed(2));
    const total = Number(transport.cost.toFixed(2));
    return {
      id: "transport-line",
      productId: null,
      name: `Transportation (${distance} km @ GHS ${rate}/km)`,
      quantity: distance,
      unitPrice: rate,
      total,
    };
  };

  const fetchInvoice = async (type, id) => {
    if (!id) return;
    setInvoiceLoading(true);
    setInvoiceError("");
    try {
      const endpoint =
        type === "bookings"
          ? `/.netlify/functions/getInvoiceDetails?id=${id}`
          : `/.netlify/functions/generateInvoice?orderId=${id}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load invoice.");
      if (type === "bookings") {
        const fallback = bookings.find((booking) => booking.id === id)?.items || [];
        setInvoice(normalizeBookingInvoice(data, fallback));
      } else {
        const fallback = orders.find((order) => order.id === id)?.items || [];
        const normalized = normalizeOrderInvoice(data, fallback);
        if (!normalized.customer?.name) {
          const matched = orders.find((order) => order.id === id);
          if (matched?.customerName) normalized.customer.name = matched.customerName;
        }
        setInvoice(normalized);
      }
    } catch (err) {
      console.error("Invoice fetch failed", err);
      setInvoiceError(err.message || "Unable to load invoice.");
      setInvoice(null);
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchBookings();
    fetchBouncyCastles();
  }, []);

  useEffect(() => {
    if (viewType === "orders" && orders.length && !selectedId) {
      setSelectedId(orders[0].id);
    }
    if (viewType === "bookings" && bookings.length && !selectedId) {
      setSelectedId(bookings[0].id);
    }
  }, [viewType, orders, bookings, selectedId]);

  useEffect(() => {
    if (selectedId) {
      fetchInvoice(viewType, selectedId);
    }
    setSaveError("");
    setSaveStatus("");
  }, [selectedId, viewType]);

  const displayInvoice = useMemo(() => {
    if (!invoice) return null;
    const taxRate = parseTaxRate(config?.taxRate);
    let items = Array.isArray(invoice.items) ? [...invoice.items] : [];
    if (invoice.type === "booking") {
      items = addMotorPumpLine(items);
      const transportLine = buildTransportLine(transportInfo);
      const hasTransport = items.some((item) => {
        const name = String(item?.name || "").toLowerCase();
        return name.includes("transport") || name.includes("delivery");
      });
      if (transportLine && !hasTransport) {
        items = [...items, transportLine];
      }

      const isPerHeadRate = (rate) => {
        const normalized = String(rate || "").toLowerCase();
        return (
          normalized.includes("per head") ||
          normalized.includes("per person") ||
          normalized.includes("per guest")
        );
      };
      const attendantsTotal = items.reduce((sum, item) => {
        const attendants = toNumber(item.attendantsNeeded, 0);
        if (!attendants) return sum;
        const quantity = Math.max(1, toNumber(item.quantity, 1));
        const multiplier = isPerHeadRate(item.rate) ? 1 : quantity;
        return sum + attendants * multiplier;
      }, 0);
      const durationHours = calculateDurationHours(
        invoice.event?.startTime,
        invoice.event?.endTime
      );
      const billedHours =
        Number.isFinite(durationHours) && durationHours > 0
          ? Math.round(durationHours * 10) / 10
          : 1;
      const hasAttendants = items.some((item) =>
        String(item?.name || "").toLowerCase().includes("attendant")
      );
      if (attendantsTotal > 0 && !hasAttendants) {
        const label = `Attendant support (${attendantsTotal} attendant${
          attendantsTotal === 1 ? "" : "s"
        } × ${billedHours} hr${billedHours === 1 ? "" : "s"} @ GHS 10/hr)`;
        const unitPrice = 10 * billedHours;
        const total = attendantsTotal * unitPrice;
        items = [
          ...items,
          {
            id: `attendants-${invoice.id || "booking"}`,
            name: label,
            quantity: attendantsTotal,
            unitPrice,
            total,
          },
        ];
      }
    }
    const itemsSubtotal = items.reduce((sum, item) => sum + toNumber(item.total), 0);
    const fallbackSubtotal = toNumber(invoice.summary?.subtotal ?? invoice.summary?.grandTotal ?? 0);
    const subtotal = itemsSubtotal > 0 ? itemsSubtotal : fallbackSubtotal;
    const taxTotal = taxRate > 0 ? subtotal * taxRate : 0;
    const grandTotal = subtotal + taxTotal;
    return {
      ...invoice,
      items,
      summary: {
        ...(invoice.summary || {}),
        subtotal,
        taxRate,
        taxTotal,
        grandTotal,
        transportCost: transportInfo?.cost || 0,
        transportKm: transportInfo?.distanceKm || 0,
        transportRate: transportInfo?.rate || 0,
      },
    };
  }, [invoice, config, transportInfo, bouncyMotorMap]);

  useEffect(() => {
    if (!invoice || invoice.type !== "booking") {
      setTransportInfo(null);
      return;
    }
    const rate = parseTransportRate(config?.transportRate);
    const destination = String(invoice.event?.venueAddress || "").trim();
    const origin = String(config?.storeAddress || COMPANY.location || "").trim();
    if (!rate || !destination || !origin) {
      setTransportInfo(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setTransportLoading(true);
      try {
        const [originCoords, destCoords] = await Promise.all([
          geocodeAddress(origin),
          geocodeAddress(destination),
        ]);
        if (cancelled) return;
        if (!originCoords || !destCoords) {
          setTransportInfo(null);
          return;
        }
        const distanceKm = calculateDistanceKm(originCoords, destCoords);
        const cost = distanceKm * rate;
        setTransportInfo({ distanceKm, rate, cost, origin, destination });
      } catch (err) {
        console.warn("Transport calculation failed", err);
        if (!cancelled) setTransportInfo(null);
      } finally {
        if (!cancelled) setTransportLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [invoice, config]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      return (
        String(order.orderNumber || "").toLowerCase().includes(term) ||
        String(order.customerName || "").toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm]);

  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((booking) => {
      const idText = `bk-${booking.id}`.toLowerCase();
      const customer = String(booking.customerName || "").toLowerCase();
      return idText.includes(term) || customer.includes(term);
    });
  }, [bookings, searchTerm]);

  const orderQueueTotal = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + toNumber(order.total, 0), 0);
  }, [filteredOrders]);

  const bookingQueueTotal = useMemo(() => {
    return filteredBookings.reduce((sum, booking) => sum + toNumber(booking.totalAmount, 0) / 100, 0);
  }, [filteredBookings]);

  const metaKey = selectedId ? `${viewType}-${selectedId}` : "";

  const currentMeta = useMemo(() => {
    if (!metaKey) return { status: "unpaid", deposit: null };
    return invoiceMeta[metaKey] || { status: "unpaid", deposit: null };
  }, [invoiceMeta, metaKey]);

  const updateMeta = (changes) => {
    if (!metaKey) return;
    setInvoiceMeta((prev) => {
      const existing = prev[metaKey] || { status: "unpaid", deposit: null };
      return {
        ...prev,
        [metaKey]: { ...existing, ...changes },
      };
    });
  };

  const isBooking = viewType === "bookings";
  const summary = displayInvoice?.summary || null;
  const defaultDeposit = isBooking ? Number((toNumber(summary?.grandTotal, 0) * 0.7).toFixed(2)) : 0;
  const depositInput = currentMeta.deposit;
  const depositRaw = isBooking
    ? depositInput === null || depositInput === undefined || depositInput === ""
      ? defaultDeposit
      : toNumber(depositInput, 0)
    : 0;
  const totalDue = toNumber(summary?.grandTotal, 0);
  const deposit = Math.min(Math.max(depositRaw, 0), totalDue);
  const statusValue = (currentMeta.status || "unpaid").toLowerCase();
  const isPaid = statusValue === "paid";
  const effectiveDeposit = isPaid ? totalDue : deposit;
  const balanceDue = isPaid ? 0 : Math.max(totalDue - deposit, 0);
  const depositPct = totalDue > 0 ? Math.min((effectiveDeposit / totalDue) * 100, 100) : 0;
  const activeQueueCount = viewType === "orders" ? filteredOrders.length : filteredBookings.length;
  const activeQueueTotal = viewType === "orders" ? orderQueueTotal : bookingQueueTotal;
  const activePaidCount = (viewType === "orders" ? filteredOrders : filteredBookings).reduce((count, item) => {
    const rowKey = `${viewType}-${item.id}`;
    return count + (((invoiceMeta[rowKey]?.status || "unpaid").toLowerCase() === "paid") ? 1 : 0);
  }, 0);
  const activeUnpaidCount = Math.max(activeQueueCount - activePaidCount, 0);
  const activeModeLabel = viewType === "orders" ? "Shop receipt queue" : "Rental invoice queue";
  const selectedFocusValue = displayInvoice ? balanceDue : activeQueueTotal;
  const collectionPct = activeQueueCount > 0 ? Math.round((activePaidCount / activeQueueCount) * 100) : 0;
  const activeOutstandingTotal = (viewType === "orders" ? filteredOrders : filteredBookings).reduce(
    (sum, item) => {
      const rowKey = `${viewType}-${item.id}`;
      const itemStatus = (invoiceMeta[rowKey]?.status || "unpaid").toLowerCase();
      if (itemStatus === "paid") return sum;
      const amount =
        viewType === "orders" ? toNumber(item.total, 0) : toNumber(item.totalAmount, 0) / 100;
      return sum + amount;
    },
    0
  );
  const selectionSummary = displayInvoice
    ? displayInvoice.type === "booking"
      ? `${formatShortDate(displayInvoice.event?.eventDate)}${
          displayInvoice.event?.venueAddress ? ` • ${displayInvoice.event.venueAddress}` : ""
        }`
      : `${(displayInvoice.items || []).length} line item${
          (displayInvoice.items || []).length === 1 ? "" : "s"
        } ready to issue`
    : `Choose a ${viewType === "orders" ? "receipt" : "rental invoice"} from the queue to preview, export, and track payment.`;
  const selectionContact = displayInvoice
    ? [displayInvoice.customer?.phone, displayInvoice.customer?.email].filter(Boolean).join(" • ") ||
      "No customer contact saved"
    : activeQueueCount > 0
      ? `${activeQueueCount} document${activeQueueCount === 1 ? "" : "s"} waiting in this queue`
      : "The queue is empty right now.";

  const createPdfDoc = async () => {
    if (!displayInvoice) return null;
    const invoiceData = displayInvoice;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const headerTop = 16;
    let cursorY = headerTop;
    let logoLoaded = false;

    try {
      const logoData = await loadImageData(COMPANY.logo);
      doc.addImage(logoData, "PNG", margin, headerTop - 4, 24, 24);
      logoLoaded = true;
    } catch (err) {
      console.warn("Logo load failed", err);
    }

    const textX = logoLoaded ? margin + 30 : margin;
    doc.setFontSize(16);
    doc.text(COMPANY.name, textX, headerTop + 4);
    doc.setFontSize(10);
    doc.text(COMPANY.location, textX, headerTop + 10);
    doc.text(COMPANY.phone, textX, headerTop + 15);
    doc.text(COMPANY.email, textX, headerTop + 20);

    doc.setFontSize(18);
    doc.text(invoiceData.docLabel.toUpperCase(), pageWidth - margin, headerTop + 2, { align: "right" });
    doc.setFontSize(11);
    doc.text(`#${invoiceData.invoiceNumber}`, pageWidth - margin, headerTop + 9, { align: "right" });
    doc.text(`Date: ${invoiceData.date}`, pageWidth - margin, headerTop + 15, { align: "right" });

    cursorY = headerTop + 26;
    doc.setDrawColor(220);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;

    doc.setFontSize(12);
    doc.text("Bill To", margin, cursorY);
    doc.setFontSize(10);
    const billLines = [invoiceData.customer?.name || "-", invoiceData.customer?.phone, invoiceData.customer?.email].filter(Boolean);
    billLines.forEach((line, index) => {
      doc.text(String(line), margin, cursorY + 6 + index * 5);
    });
    let detailY = cursorY + 6 + billLines.length * 5 + 2;

    if (invoiceData.type === "booking" && invoiceData.event) {
      doc.setFontSize(11);
      doc.text("Event", margin, detailY);
      doc.setFontSize(10);
      const eventLine = `${formatShortDate(invoiceData.event.eventDate)} ${invoiceData.event.startTime || ""}${
        invoiceData.event.endTime ? ` - ${invoiceData.event.endTime}` : ""
      }`;
      doc.text(eventLine.trim() || "-", margin, detailY + 6);
      if (invoiceData.event.venueAddress) {
        doc.text(invoiceData.event.venueAddress, margin, detailY + 12);
      }
      detailY += invoiceData.event.venueAddress ? 18 : 12;
    }

    const tableBody = (invoiceData.items || []).map((item) => [
      item.name || "Item",
      item.quantity || 0,
      formatPdfCurrency(item.unitPrice || 0),
      formatPdfCurrency(item.total || 0),
    ]);

    const tableConfig = {
      startY: Math.max(detailY + 6, cursorY + 18),
      head: [["Description", "Qty", "Unit Price", "Total"]],
      body: tableBody,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [118, 50, 7], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    };

    const drawTable = (config) => {
      if (typeof doc.autoTable === "function") {
        doc.autoTable(config);
      } else if (typeof autoTable === "function") {
        autoTable(doc, config);
      }
    };

    drawTable(tableConfig);

    const finalY = doc.lastAutoTable?.finalY || tableConfig.startY + 20;
    let totalsY = finalY + 8;
    let termsText = "";
    let refundText = "";
    if (invoiceData.type === "booking") {
      termsText =
        "Terms: 70% deposit secures the booking. Balance is due before delivery/setup. Delivery fees are non-refundable. Late cancellations may forfeit deposits; refunds are not guaranteed within 48 hours of the event. Date changes are subject to availability and may incur a reschedule fee.";
    } else {
      refundText =
        "Refund policy: Returns/exchanges are accepted within 7 days with the original receipt. Items must be unused and in original packaging; custom orders are non-refundable.";
    }
    const waiverText =
      "Digital waivers & contracts: Rentals (e.g., bouncy castles) require a signed liability release. Our attendants supervise rentals on-site. We can provide a digital waiver for signature.";
    const combinedText = [termsText, refundText, waiverText].filter(Boolean).join(" ");
    doc.setFontSize(9);
    const termsLines = doc.splitTextToSize(combinedText, pageWidth - margin * 2);
    doc.text(termsLines, margin, totalsY);
    totalsY += termsLines.length * 4 + 6;
    const totalsX = pageWidth - margin - 70;

    doc.setFillColor(245, 245, 245);
    doc.rect(totalsX, totalsY - 4, 70, isBooking ? 34 : 24, "F");
    doc.setFontSize(10);
    doc.text("Subtotal:", totalsX + 4, totalsY + 4);
    doc.text(formatPdfCurrency(summary?.subtotal || 0), pageWidth - margin, totalsY + 4, { align: "right" });
    if ((summary?.taxRate || 0) > 0) {
      doc.text(`VAT (${Math.round((summary?.taxRate || 0) * 100)}%):`, totalsX + 4, totalsY + 10);
      doc.text(formatPdfCurrency(summary?.taxTotal || 0), pageWidth - margin, totalsY + 10, { align: "right" });
    }
    doc.setFontSize(11);
    doc.text("Total:", totalsX + 4, totalsY + 18);
    doc.text(formatPdfCurrency(summary?.grandTotal || 0), pageWidth - margin, totalsY + 18, { align: "right" });
    if (isBooking) {
      doc.setFontSize(10);
      doc.text("Deposit:", totalsX + 4, totalsY + 24);
      doc.text(formatPdfCurrency(effectiveDeposit), pageWidth - margin, totalsY + 24, { align: "right" });
      doc.text("Balance Due:", totalsX + 4, totalsY + 30);
      doc.text(formatPdfCurrency(balanceDue), pageWidth - margin, totalsY + 30, { align: "right" });
    }

    if (invoiceData.expenses && invoiceData.expenses.length > 0) {
      const expenseRows = invoiceData.expenses.map((expense) => [
        expense.category,
        formatShortDate(expense.date),
        formatPdfCurrency(expense.amount),
        expense.description || "-",
      ]);

      const expensesY = totalsY + (isBooking ? 40 : 30);
      drawTable({
        startY: expensesY,
        head: [["Related expenses", "Date", "Amount", "Notes"]],
        body: expenseRows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [31, 37, 48], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }

    if (invoiceData.type === "booking") {
      doc.addPage();
      const pageHeight = doc.internal.pageSize.getHeight();
      const waiverMargin = 16;
      let waiverY = 24;

      doc.setFontSize(16);
      doc.text("Liability Waiver & Release", waiverMargin, waiverY);
      waiverY += 8;
      doc.setFontSize(10);
      doc.text(`Invoice: ${invoiceData.invoiceNumber}`, waiverMargin, waiverY);
      waiverY += 5;
      doc.text(`Customer: ${invoiceData.customer?.name || "-"}`, waiverMargin, waiverY);
      waiverY += 5;
      if (invoiceData.event?.eventDate) {
        const eventLine = `${formatShortDate(invoiceData.event.eventDate)} ${invoiceData.event.startTime || ""}${
          invoiceData.event.endTime ? ` - ${invoiceData.event.endTime}` : ""
        }`.trim();
        doc.text(`Event: ${eventLine || "-"}`, waiverMargin, waiverY);
        waiverY += 5;
      }
      if (invoiceData.event?.venueAddress) {
        doc.text(`Venue: ${invoiceData.event.venueAddress}`, waiverMargin, waiverY);
        waiverY += 6;
      }

      const waiverText =
        "I acknowledge that rental equipment, including inflatables and powered items, involves inherent risk. REEBS attendants supervise rentals on-site; I agree to follow their safety guidance, ensure guests comply, and accept responsibility for all guests. I release REEBS Party Themes, its team, and affiliates from liability for injuries or damages arising from misuse, negligence, or failure to follow safety guidance. I understand deposits secure the date and that cancellations are subject to the stated policy.";
      const waiverLines = doc.splitTextToSize(waiverText, pageWidth - waiverMargin * 2);
      doc.setFontSize(10);
      doc.text(waiverLines, waiverMargin, waiverY + 4);
      waiverY += waiverLines.length * 5 + 16;

      if (waiverY > pageHeight - 60) {
        doc.addPage();
        waiverY = 28;
      }

      doc.setDrawColor(60);
      doc.line(waiverMargin, waiverY, waiverMargin + 80, waiverY);
      doc.text("Client name (print)", waiverMargin, waiverY + 5);
      doc.line(waiverMargin + 100, waiverY, pageWidth - waiverMargin, waiverY);
      doc.text("Signature", waiverMargin + 100, waiverY + 5);

      waiverY += 20;
      doc.line(waiverMargin, waiverY, waiverMargin + 80, waiverY);
      doc.text("Phone", waiverMargin, waiverY + 5);
      doc.line(waiverMargin + 100, waiverY, pageWidth - waiverMargin, waiverY);
      doc.text("Date", waiverMargin + 100, waiverY + 5);
    }

    return doc;
  };

  const buildPdf = async () => {
    if (!displayInvoice) return;
    setPdfLoading(true);
    setInvoiceError("");
    try {
      const doc = await createPdfDoc();
      if (!doc) return;
      const filePrefix = displayInvoice.type === "booking" ? "invoice" : "receipt";
      doc.save(`${filePrefix}-${displayInvoice.invoiceNumber}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
      setInvoiceError("Failed to generate PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  const saveToDocuments = async () => {
    if (!displayInvoice) return;
    setSavingDoc(true);
    setSaveError("");
    setSaveStatus("");
    try {
      const doc = await createPdfDoc();
      if (!doc) return;
      const dataUri = doc.output("datauristring");
      const base64 = String(dataUri || "").split(",")[1] || "";
      if (!base64) throw new Error("Unable to prepare document data.");

      const filePrefix = displayInvoice.type === "booking" ? "invoice" : "receipt";
      const title = `${displayInvoice.docLabel} ${displayInvoice.invoiceNumber}`.trim();
      const fileName = `${filePrefix}-${displayInvoice.invoiceNumber}.pdf`;
      const category = displayInvoice.type === "booking" ? "Invoice" : "Receipt";

      const res = await fetch("/.netlify/functions/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          fileName,
          mimeType: "application/pdf",
          data: base64,
          source: "generated",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save document.");
      setSaveStatus("Saved to Documents.");
    } catch (err) {
      console.error("Save document failed", err);
      setSaveError(err.message || "Failed to save document.");
    } finally {
      setSavingDoc(false);
    }
  };

  return (
    <div className="invoicing-page">
      <div className="invoicing-shell">
        <AdminBreadcrumb items={[{ label: "Invoicing" }]} />

        <header className="invoicing-header">
          <div>
            <p className="invoicing-eyebrow">Document Center</p>
            <h1>Invoicing</h1>
            <p className="invoicing-subtitle">
              Generate branded invoices, track deposits, and keep a clear paid/unpaid workflow.
            </p>
          </div>
          <div className="invoicing-controls no-print">
            <div className="invoicing-tabs" role="tablist" aria-label="Invoice types">
              <button
                type="button"
                role="tab"
                aria-selected={viewType === "orders"}
                className={viewType === "orders" ? "is-active" : ""}
                onClick={() => {
                  setViewType("orders");
                  setSelectedId(null);
                  setInvoice(null);
                  setInvoiceError("");
                }}
              >
                Shop receipts
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewType === "bookings"}
                className={viewType === "bookings" ? "is-active" : ""}
                onClick={() => {
                  setViewType("bookings");
                  setSelectedId(null);
                  setInvoice(null);
                  setInvoiceError("");
                }}
              >
                Rental invoices
              </button>
            </div>
            <div className="invoicing-actions no-print">
              <button
                type="button"
                className="invoicing-primary"
                onClick={buildPdf}
                disabled={!displayInvoice || pdfLoading}
              >
                <AppIcon icon={faFilePdf} /> {pdfLoading ? "Preparing..." : "Download PDF"}
              </button>
              <button
                type="button"
                className="invoicing-secondary"
                onClick={saveToDocuments}
                disabled={!displayInvoice || savingDoc}
              >
                <AppIcon icon={faFolderOpen} /> {savingDoc ? "Saving..." : "Save to Documents"}
              </button>
              <button
                type="button"
                className="invoicing-secondary"
                onClick={() => window.print()}
                disabled={!displayInvoice}
              >
                <AppIcon icon={faPrint} /> Print
              </button>
              <button type="button" className="invoicing-secondary" disabled>
                <AppIcon icon={faPaperPlane} /> Email
              </button>
            </div>
            {saveError && <p className="invoicing-error">{saveError}</p>}
            {saveStatus && <p className="invoicing-success">{saveStatus}</p>}
          </div>
        </header>

        <section className="invoicing-overview no-print" aria-label="Invoicing summary">
          <article className="invoicing-feature-card">
            <div className="invoicing-feature-copy">
              <p className="invoicing-label">{viewType === "orders" ? "Retail workflow" : "Rental workflow"}</p>
              <h2>
                {displayInvoice
                  ? `${displayInvoice.docLabel} #${displayInvoice.invoiceNumber}`
                  : viewType === "orders"
                    ? "Receipts desk"
                    : "Invoices desk"}
              </h2>
              <p>{selectionSummary}</p>
            </div>
            <div className="invoicing-feature-meta">
              <div className="invoicing-feature-stat">
                <span className="invoicing-label">Customer</span>
                <strong>{displayInvoice?.customer?.name || "No document selected"}</strong>
                <p>{selectionContact}</p>
              </div>
              <div className="invoicing-feature-stat">
                <span className="invoicing-label">Collection pace</span>
                <strong>{collectionPct}% cleared</strong>
                <div className="invoicing-feature-progress" aria-hidden="true">
                  <span style={{ width: `${collectionPct}%` }} />
                </div>
                <p>{activePaidCount} of {activeQueueCount} marked paid</p>
              </div>
            </div>
          </article>
          <article className="invoicing-metric">
            <p className="invoicing-label">Queue</p>
            <strong>{activeQueueCount}</strong>
            <span>{activeModeLabel}</span>
          </article>
          <article className="invoicing-metric">
            <p className="invoicing-label">Collected</p>
            <strong>{activePaidCount}</strong>
            <span>{collectionPct}% of visible queue</span>
          </article>
          <article className="invoicing-metric">
            <p className="invoicing-label">Outstanding</p>
            <strong>{formatCurrency(activeOutstandingTotal)}</strong>
            <span>{activeUnpaidCount} awaiting payment</span>
          </article>
          <article className="invoicing-metric">
            <p className="invoicing-label">{displayInvoice ? "Selected due" : "Next action"}</p>
            <strong>{formatCurrency(selectedFocusValue)}</strong>
            <span>{displayInvoice ? `#${displayInvoice.invoiceNumber}` : "Pick a document to continue"}</span>
          </article>
        </section>

        <div className="invoicing-layout">
          <aside className="invoicing-sidebar no-print">
            <div className="invoicing-sidebar-head">
              <div>
                <p className="invoicing-label">{activeModeLabel}</p>
                <h2>{activeQueueCount} document{activeQueueCount === 1 ? "" : "s"}</h2>
              </div>
              <strong className="invoicing-sidebar-total">{formatCurrency(activeQueueTotal)}</strong>
            </div>
            <div className="invoicing-search">
              <SearchField
                placeholder={viewType === "bookings" ? "Search booking or customer" : "Search order or customer"}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onClear={() => setSearchTerm("")}
                aria-label={viewType === "bookings" ? "Search bookings" : "Search orders"}
              />
            </div>
            {viewType === "orders" ? (
              ordersLoading ? (
                <p className="invoicing-muted">Loading orders...</p>
              ) : ordersError ? (
                <p className="invoicing-error">{ordersError}</p>
              ) : filteredOrders.length === 0 ? (
                <p className="invoicing-muted">No orders match this search.</p>
              ) : (
                <div className="invoicing-list">
                  {filteredOrders.map((order) => {
                    const key = `orders-${order.id}`;
                    const orderStatus = (invoiceMeta[key]?.status || "unpaid").toLowerCase();
                    return (
                      <button
                        key={order.id}
                        type="button"
                        className={`invoicing-list-item ${selectedId === order.id ? "is-active" : ""}`}
                        onClick={() => setSelectedId(order.id)}
                      >
                        <div className="invoicing-list-item-main">
                          <div className="invoicing-list-item-row">
                            <strong>{order.orderNumber}</strong>
                            <span className={`invoice-pill ${orderStatus === "paid" ? "paid" : "unpaid"}`}>
                              {orderStatus}
                            </span>
                          </div>
                          <p className="invoicing-list-item-sub">{order.customerName || "Unknown customer"}</p>
                          <div className="invoicing-list-item-meta">
                            <span>{formatShortDate(order.date || order.createdAt)}</span>
                            <span>{orderStatus === "paid" ? "Ready to archive" : "Needs payment"}</span>
                          </div>
                          <p className="invoicing-list-item-note">{formatCurrency(order.total || 0)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : bookingsLoading ? (
              <p className="invoicing-muted">Loading bookings...</p>
            ) : bookingsError ? (
              <p className="invoicing-error">{bookingsError}</p>
            ) : filteredBookings.length === 0 ? (
              <p className="invoicing-muted">No bookings match this search.</p>
            ) : (
              <div className="invoicing-list">
                {filteredBookings.map((booking) => {
                  const key = `bookings-${booking.id}`;
                  const bookingStatus = (invoiceMeta[key]?.status || "unpaid").toLowerCase();
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      className={`invoicing-list-item ${selectedId === booking.id ? "is-active" : ""}`}
                      onClick={() => setSelectedId(booking.id)}
                    >
                      <div className="invoicing-list-item-main">
                        <div className="invoicing-list-item-row">
                          <strong>Booking #{booking.id}</strong>
                          <span className={`invoice-pill ${bookingStatus === "paid" ? "paid" : "unpaid"}`}>
                            {bookingStatus}
                          </span>
                        </div>
                        <p className="invoicing-list-item-sub">{booking.customerName || "Unknown customer"}</p>
                        <div className="invoicing-list-item-meta">
                          <span>{formatShortDate(booking.eventDate)}</span>
                          <span>{bookingStatus === "paid" ? "Ready to archive" : "Deposit / balance open"}</span>
                        </div>
                        <p className="invoicing-list-item-note">
                          {formatCurrency(toNumber(booking.totalAmount, 0) / 100)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="invoicing-main">
            {invoiceLoading ? (
              <p className="invoicing-muted">Preparing invoice...</p>
            ) : invoiceError ? (
              <p className="invoicing-error">{invoiceError}</p>
            ) : !displayInvoice ? (
              <div className="invoicing-empty">
                <p className="invoicing-label">No document selected</p>
                <h3>{viewType === "orders" ? "Select a receipt to preview" : "Select an invoice to preview"}</h3>
                <p>
                  Choose a row from the queue to review totals, update payment status, and export a
                  branded PDF.
                </p>
              </div>
            ) : (
              <>
                <div className="invoicing-balance no-print">
                  <div className="invoicing-balance-head">
                    <div>
                      <p className="invoicing-label">Payment tracker</p>
                      <h3>
                        {displayInvoice.docLabel} #{displayInvoice.invoiceNumber}
                      </h3>
                    </div>
                    <span className={`invoice-pill ${statusValue === "paid" ? "paid" : "unpaid"}`}>
                      {statusValue}
                    </span>
                  </div>
                  <div>
                    <p className="invoicing-label">{displayInvoice.docLabel} status</p>
                    <select
                      value={statusValue}
                      onChange={(event) => updateMeta({ status: event.target.value })}
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  {isBooking && (
                    <div>
                      <p className="invoicing-label">Deposit received</p>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={depositRaw}
                        onChange={(event) => updateMeta({ deposit: event.target.value })}
                      />
                    </div>
                  )}
                  <div className="invoicing-balance-total">
                    <p className="invoicing-label">{isBooking ? "Balance due" : "Amount due"}</p>
                    <strong>{formatCurrency(balanceDue)}</strong>
                    <p className="invoicing-muted">Total: {formatCurrency(totalDue)}</p>
                  </div>
                  {isBooking && (
                    <div className="invoicing-progress">
                      <span style={{ width: `${depositPct}%` }} />
                    </div>
                  )}
                </div>

                <div className="invoice-preview-actions no-print">
                  <button
                    type="button"
                    className="invoicing-primary"
                    onClick={buildPdf}
                    disabled={!displayInvoice || pdfLoading}
                  >
                    <AppIcon icon={faFilePdf} /> {pdfLoading ? "Preparing..." : "Download PDF"}
                  </button>
                  <button
                    type="button"
                    className="invoicing-secondary"
                    onClick={saveToDocuments}
                    disabled={!displayInvoice || savingDoc}
                  >
                    <AppIcon icon={faFolderOpen} /> {savingDoc ? "Saving..." : "Save to Documents"}
                  </button>
                </div>

                <div className="invoice-paper">
                  <div className="invoice-header">
                    <div className="invoice-brand">
                      <img className="invoice-logo" src={COMPANY.logo} alt="Reebs logo" />
                      <div>
                        <h2>{COMPANY.name}</h2>
                        <p>{COMPANY.location}</p>
                        <p>{COMPANY.phone}</p>
                        <p>{COMPANY.email}</p>
                      </div>
                    </div>
                    <div className="invoice-meta">
                      <p className="invoicing-label">{displayInvoice.docLabel}</p>
                      <h3>#{displayInvoice.invoiceNumber}</h3>
                      <p>Date: {displayInvoice.date}</p>
                    </div>
                  </div>

                  <div className="invoice-chip-row">
                    <span className={`invoice-pill ${statusValue === "paid" ? "paid" : "unpaid"}`}>
                      {statusValue}
                    </span>
                    {isBooking && (
                      <span className="invoice-chip-detail">Deposit {formatCurrency(effectiveDeposit)}</span>
                    )}
                    {transportLoading && (
                      <span className="invoice-chip-detail">Updating transport…</span>
                    )}
                    {toNumber(summary?.transportCost, 0) > 0 && (
                      <span className="invoice-chip-detail">
                        Transport {formatCurrency(summary?.transportCost || 0)}
                      </span>
                    )}
                  </div>

                  <div className="invoice-bill-grid">
                    {displayInvoice.type === "booking" && displayInvoice.event && (
                      <div className="invoice-bill-card invoice-event-card">
                        <h4>Event</h4>
                        <p>
                          {formatShortDate(displayInvoice.event.eventDate)}{" "}
                          {displayInvoice.event.startTime ? `· ${displayInvoice.event.startTime}` : ""}
                          {displayInvoice.event.endTime ? ` - ${displayInvoice.event.endTime}` : ""}
                        </p>
                        <p>{displayInvoice.event.venueAddress || "-"}</p>
                      </div>
                    )}

                    <div className="invoice-bill-card">
                      <h4>Bill To</h4>
                      <p>{displayInvoice.customer?.name || "-"}</p>
                      <p>{displayInvoice.customer?.phone || "-"}</p>
                      <p>{displayInvoice.customer?.email || "-"}</p>
                    </div>
                  </div>

                  <div className="invoice-table-wrapper">
                    <table className="invoice-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(displayInvoice.items || []).map((item) => (
                          <tr key={item.id}>
                            <td data-label="Description">{item.name || "Item"}</td>
                            <td data-label="Qty">{item.quantity}</td>
                            <td data-label="Unit Price">{formatCurrency(item.unitPrice)}</td>
                            <td data-label="Total">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="invoice-notes-grid">
                    <div className="invoice-note-block">
                      <h4>Terms & policy</h4>
                      <div className="invoice-terms">
                        {displayInvoice.type === "booking" ? (
                          <p>
                            Terms: 70% deposit secures the booking. Balance is due before delivery/setup. Delivery fees are
                            non-refundable. Late cancellations may forfeit deposits; refunds are not guaranteed within 48
                            hours of the event. Date changes are subject to availability and may incur a reschedule fee.
                            Digital waivers & contracts are available for rentals (e.g., bouncy castles); our attendants
                            supervise rentals on-site and a signed liability release is required.
                          </p>
                        ) : (
                          <p>
                            Refund policy: Returns/exchanges are accepted within 7 days with the original receipt. Items
                            must be unused and in original packaging; custom orders are non-refundable. Digital waivers &
                            contracts are available for rentals (e.g., bouncy castles); our attendants supervise rentals
                            on-site and a signed liability release is required.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="invoice-summary-panel">
                      <p className="invoicing-label">Amount summary</p>
                      <div className="invoice-totals">
                        <div className="invoice-total-row">
                          <span>Subtotal</span>
                          <span>{formatCurrency(summary?.subtotal || 0)}</span>
                        </div>
                        {(summary?.taxRate || 0) > 0 && (
                          <div className="invoice-total-row">
                            <span>VAT ({Math.round((summary?.taxRate || 0) * 100)}%)</span>
                            <span>{formatCurrency(summary?.taxTotal || 0)}</span>
                          </div>
                        )}
                        <div className="invoice-total-row grand">
                          <strong>Total</strong>
                          <strong>{formatCurrency(summary?.grandTotal || 0)}</strong>
                        </div>
                        {isBooking && (
                          <>
                            <div className="invoice-total-row">
                              <span>Deposit</span>
                              <span>{formatCurrency(effectiveDeposit)}</span>
                            </div>
                            <div className="invoice-total-row">
                              <span>Balance Due</span>
                              <span>{formatCurrency(balanceDue)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {displayInvoice.expenses && displayInvoice.expenses.length > 0 && (
                    <div className="invoice-expenses">
                      <h4>Related expenses</h4>
                      <ul>
                        {displayInvoice.expenses.map((expense) => (
                          <li key={expense.id}>
                            <div>
                              <strong>{expense.category}</strong>
                              <span>{formatShortDate(expense.date)}</span>
                            </div>
                            <div>
                              <span>{expense.description || "-"}</span>
                              <strong>{formatCurrency(expense.amount)}</strong>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="invoice-expenses-total">
                        <span>Total expenses</span>
                        <strong>{formatCurrency(displayInvoice.expensesTotal || 0)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {displayInvoice.type === "booking" && (
                  <div className="invoice-paper invoice-waiver-paper">
                    <div className="invoice-waiver-header">
                      <h3>Liability Waiver & Release</h3>
                      <p>Invoice #{displayInvoice.invoiceNumber}</p>
                    </div>
                    <div className="invoice-waiver-details">
                      <p><strong>Customer:</strong> {displayInvoice.customer?.name || "-"}</p>
                      <p><strong>Event:</strong> {formatShortDate(displayInvoice.event?.eventDate) || "-"}</p>
                      <p><strong>Venue:</strong> {displayInvoice.event?.venueAddress || "-"}</p>
                    </div>
                    <p className="invoice-waiver-text">
                      I acknowledge that rental equipment, including inflatables and powered items, involves inherent
                      risk. REEBS attendants supervise rentals on-site; I agree to follow their safety guidance, ensure
                      guests comply, and accept responsibility for all guests. I release REEBS Party Themes, its team,
                      and affiliates from liability for injuries or damages arising from misuse, negligence, or failure
                      to follow safety guidance. I understand deposits secure the date and that cancellations are
                      subject to the stated policy.
                    </p>
                    <div className="invoice-waiver-lines">
                      <div className="invoice-waiver-line">
                        <div>
                          <span />
                          <label>Client name (print)</label>
                        </div>
                        <div>
                          <span />
                          <label>Signature</label>
                        </div>
                      </div>
                      <div className="invoice-waiver-line">
                        <div>
                          <span />
                          <label>Phone</label>
                        </div>
                        <div>
                          <span />
                          <label>Date</label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminInvoicing;
const normalizeExpenseList = (payload) => {
  let expenses = payload?.expenses || [];
  if (typeof expenses === "string") {
    try {
      expenses = JSON.parse(expenses);
    } catch {
      expenses = [];
    }
  }
  if (!Array.isArray(expenses)) expenses = [];
  const normalized = expenses.map((expense, index) => ({
    id: expense.id || `${expense.category || "expense"}-${index}`,
    category: expense.category || "Expense",
    description: expense.description || "",
    date: expense.date,
    amount: toNumber(expense.amount, 0),
  }));
  const total = normalized.reduce((sum, row) => sum + row.amount, 0);
  return { expenses: normalized, total: toNumber(payload?.expensesTotal, total) };
};
