/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./AdminScheduler.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";

import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { AppIcon } from "/src/components/Icon/Icon";
import { faArrowLeft, faArrowRight } from "/src/icons/iconSet";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTimeRange = (start, end) => {
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return start || end;
};

const dayKey = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const GHANA_FIXED_HOLIDAYS = [
  { month: 0, day: 1, name: "New Year's Day" },
  { month: 0, day: 7, name: "Constitution Day" },
  { month: 2, day: 6, name: "Independence Day" },
  { month: 4, day: 1, name: "May Day" },
  { month: 7, day: 4, name: "Founders' Day" },
  { month: 7, day: 15, name: "Assumption Day" },
  { month: 8, day: 21, name: "Kwame Nkrumah Memorial Day" },
  { month: 11, day: 25, name: "Christmas Day" },
  { month: 11, day: 26, name: "Boxing Day" },
];

const GHANA_EID_BY_YEAR = {
  2024: { fitr: "2024-04-10", adha: "2024-06-17" },
  2025: { fitr: "2025-03-31", adha: "2025-06-07" },
  2026: { fitr: "2026-03-20", adha: "2026-05-27" },
  2027: { fitr: "2027-03-10", adha: "2027-05-16" },
  2028: { fitr: "2028-02-27", adha: "2028-05-05" },
};

const parseIsoDate = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getEasterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getFarmersDay = (year) => {
  const firstDecember = new Date(year, 11, 1);
  const weekday = firstDecember.getDay();
  const offset = (5 - weekday + 7) % 7;
  firstDecember.setDate(firstDecember.getDate() + offset);
  return firstDecember;
};

const buildGhanaHolidays = (year) => {
  const holidays = GHANA_FIXED_HOLIDAYS.map((holiday) => ({
    name: holiday.name,
    date: new Date(year, holiday.month, holiday.day),
  }));

  const easterSunday = getEasterSunday(year);
  holidays.push({ name: "Good Friday", date: addDays(easterSunday, -2) });
  holidays.push({ name: "Easter Monday", date: addDays(easterSunday, 1) });
  holidays.push({ name: "Farmers' Day", date: getFarmersDay(year) });

  const eidDates = GHANA_EID_BY_YEAR[year];
  if (eidDates?.fitr) {
    holidays.push({ name: "Eid al-Fitr", date: parseIsoDate(eidDates.fitr) });
  }
  if (eidDates?.adha) {
    holidays.push({ name: "Eid al-Adha", date: parseIsoDate(eidDates.adha) });
  }

  const normalized = holidays.filter(
    (holiday) => holiday.date && !Number.isNaN(holiday.date.getTime())
  );

  const observed = [];
  const seen = new Set();
  normalized.forEach((holiday) => {
    const key = dayKey(holiday.date);
    if (key) seen.add(`${holiday.name}:${key}`);
  });

  normalized.forEach((holiday) => {
    const weekday = holiday.date.getDay();
    if (weekday === 6 || weekday === 0) {
      const offset = weekday === 6 ? 2 : 1;
      const observedDate = addDays(holiday.date, offset);
      const observedKey = dayKey(observedDate);
      const observedName = `${holiday.name} (Observed)`;
      if (observedKey && !seen.has(`${observedName}:${observedKey}`)) {
        observed.push({ name: observedName, date: observedDate });
        seen.add(`${observedName}:${observedKey}`);
      }
    }
  });

  return [...normalized, ...observed];
};

const buildCalendarDays = (monthDate) => {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);

  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // Monday-start

  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
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

const normalizeVenueAddress = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const getVenueAddressKey = (value) => normalizeVenueAddress(value).toLowerCase();

const geocodeCacheKey = "reebs_booking_geocode_v1";
const googleMapContainerStyle = { width: "100%", height: "440px" };

const findNextBookingDate = (list) => {
  const now = Date.now();
  const dates = list
    .map((b) => {
      const d = new Date(b.eventDate);
      return Number.isNaN(d.getTime()) ? null : d;
    })
    .filter(Boolean)
    .sort((a, b) => a - b);
  return dates.find((d) => d.getTime() >= now) || dates[0] || null;
};

function AdminScheduler() {
  const [view, setView] = useState("month"); // month | agenda | map
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(() => new Date());
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [userSelectedDay, setUserSelectedDay] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [mapStats, setMapStats] = useState({ total: 0, geocoded: 0 });
  const [mapFailures, setMapFailures] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [bookingForm, setBookingForm] = useState({
    customerId: "",
    venueAddress: "",
    startTime: "",
    endTime: "",
    status: "pending",
    items: [],
  });
  const mapInstanceRef = useRef(null);
  const monthPickerRef = useRef(null);

  const geocodeQueueRef = useRef(Promise.resolve());
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const { isLoaded: isGoogleLoaded, loadError: googleLoadError } = useJsApiLoader({
    id: "reebs-google-maps",
    googleMapsApiKey: googleMapsApiKey || "",
  });

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/bookings");
      const text = await response.text();
      const payload = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to fetch bookings (${response.status}).`);
      }

      const sanitized = (Array.isArray(payload) ? payload : [])
        .filter((booking) => booking && booking.eventDate)
        .map((booking) => ({
          ...booking,
          eventDate: booking.eventDate,
          status: booking.status || "pending",
        }))
        .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate) || (Number(a.id) || 0) - (Number(b.id) || 0));

      setBookings(sanitized);
    } catch (err) {
      console.error("Failed to fetch bookings", err);
      setError(err.message || "We couldn't load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (userSelectedDay) return;
    if (!bookings.length) return;
    const nextDate = findNextBookingDate(bookings);
    if (!nextDate) return;
    const nextKey = dayKey(nextDate);
    if (dayKey(activeDay) === nextKey) return;
    setActiveDay(nextDate);
    setMonthCursor(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }, [activeDay, bookings, userSelectedDay]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const handleClickAway = (event) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target)) {
        setMonthPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [monthPickerOpen]);

  const monthOptions = useMemo(() => {
    const options = [];
    const baseYear = monthCursor.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let year = baseYear - 1; year <= baseYear + 1; year += 1) {
      for (let m = 0; m < 12; m += 1) {
        options.push({ year, month: m, label: `${monthNames[m]} ${year}` });
      }
    }
    return options;
  }, [monthCursor]);

  const handleSelectMonth = (year, month) => {
    const next = new Date(year, month, 1);
    setMonthCursor(next);
    setActiveDay(next);
    setUserSelectedDay(true);
    setMonthPickerOpen(false);
  };

  const fetchSupportData = async () => {
    const [customersRes, inventoryRes] = await Promise.all([
      fetch("/.netlify/functions/customers"),
      fetch("/.netlify/functions/inventory"),
    ]);

    const customersText = await customersRes.text();
    const inventoryText = await inventoryRes.text();

    const parseJson = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const customersPayload = parseJson(customersText);
    const inventoryPayload = parseJson(inventoryText);

    if (!customersRes.ok) {
      throw new Error(customersPayload?.error || `Failed to fetch customers (${customersRes.status}).`);
    }
    if (!inventoryRes.ok) {
      throw new Error(inventoryPayload?.error || `Failed to fetch inventory (${inventoryRes.status}).`);
    }

    setCustomers(Array.isArray(customersPayload) ? customersPayload : []);

    const rentals = (Array.isArray(inventoryPayload) ? inventoryPayload : []).filter((item) => {
      const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toString().toLowerCase();
      const sku = (item.sku || "").toString().toUpperCase();
      const name = (item.name || "").toString().toLowerCase();
      const isPump = sku.startsWith("PUM") || name.includes("motor pump");
      if (source) return source === "rental" && !isPump;
      return sku.startsWith("REN") && !isPump;
    });

    setProducts(rentals);
  };

  const productMap = useMemo(() => {
    const map = new Map();
    for (const product of products) {
      map.set(Number(product.id), product);
    }
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();
    const list = [...products].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
    if (!needle) return list;
    return list.filter((product) => {
      return (
        product.name?.toLowerCase().includes(needle) ||
        product.sku?.toLowerCase().includes(needle)
      );
    });
  }, [productQuery, products]);

  const bookingTotalCents = useMemo(() => {
    return bookingForm.items.reduce((sum, item) => {
      const product = productMap.get(Number(item.productId));
      const priceValue = Number(product?.price ?? product?.priceCents ?? 0);
      const priceCents = Number.isFinite(priceValue) ? priceValue : 0;
      const quantity = Number(item.quantity) || 1;
      return sum + priceCents * quantity;
    }, 0);
  }, [bookingForm.items, productMap]);

  const focusBookingDate = (booking) => {
    if (!booking?.eventDate) return;
    const target = new Date(booking.eventDate);
    if (Number.isNaN(target.getTime())) return;
    setActiveDay(target);
    setMonthCursor(new Date(target.getFullYear(), target.getMonth(), 1));
    setUserSelectedDay(true);
    setView("month");
    const agenda = document.querySelector(".calendar-detail");
    if (agenda?.scrollIntoView) {
      agenda.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openBookingModal = async () => {
    setBookingError("");
    setProductQuery("");
    try {
      if (customers.length === 0 || products.length === 0) {
        await fetchSupportData();
      }
      setBookingForm({
        customerId: customers[0]?.id ? String(customers[0].id) : "",
        venueAddress: "",
        startTime: "",
        endTime: "",
        status: "pending",
        items: [],
      });
      setBookingModalOpen(true);
    } catch (err) {
      console.error("Failed to open booking modal", err);
      setBookingError(err.message || "Failed to load customers/products.");
    }
  };

  const closeBookingModal = () => {
    setBookingModalOpen(false);
    setBookingSaving(false);
    setBookingError("");
  };

  const addItem = (product) => {
    setBookingForm((prev) => {
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
      return { ...prev, items: [...prev.items, { productId: product.id, quantity: 1 }] };
    });
  };

  const updateItemQuantity = (productId, nextValue) => {
    setBookingForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (Number(item.productId) !== Number(productId)) return item;
        const next = Math.max(1, parseInt(nextValue, 10) || 1);
        return { ...item, quantity: next };
      }),
    }));
  };

  const removeItem = (productId) => {
    setBookingForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => Number(item.productId) !== Number(productId)),
    }));
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    setBookingError("");

    const trimmedAddress = bookingForm.venueAddress.trim();
    const trimmedStart = bookingForm.startTime.trim();
    const trimmedEnd = bookingForm.endTime.trim();
    const normalizedItems = bookingForm.items
      .map((item) => ({
        productId: Number(item.productId),
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      }))
      .filter((item) => Number.isFinite(item.productId));

    if (!bookingForm.customerId) return setBookingError("Select a customer.");
    if (!trimmedAddress) return setBookingError("Venue address is required.");
    if (normalizedItems.length === 0) return setBookingError("Add at least one rental item.");

    setBookingSaving(true);
    try {
      const response = await fetch("/.netlify/functions/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(bookingForm.customerId),
          eventDate: dayKey(activeDay),
          startTime: trimmedStart || null,
          endTime: trimmedEnd || null,
          venueAddress: trimmedAddress,
          status: bookingForm.status,
          items: normalizedItems,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to create booking.");

      setBookings((prev) => {
        const next = [payload, ...prev];
        return next.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate) || (Number(a.id) || 0) - (Number(b.id) || 0));
      });
      if (payload?.eventDate) {
        const target = new Date(payload.eventDate);
        if (!Number.isNaN(target.getTime())) {
          setActiveDay(target);
          setMonthCursor(new Date(target.getFullYear(), target.getMonth(), 1));
          setUserSelectedDay(false);
        }
      }
      setBookingModalOpen(false);
    } catch (err) {
      console.error("Booking creation failed", err);
      setBookingError(err.message || "Failed to create booking.");
    } finally {
      setBookingSaving(false);
    }
  };

  const bookingsByDay = useMemo(() => {
    const map = new Map();
    for (const booking of bookings) {
      const key = dayKey(booking.eventDate);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(booking);
    }
    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")))
      );
    }
    return map;
  }, [bookings]);

  const addressGroups = useMemo(() => {
    const map = new Map();
    for (const booking of bookings) {
      const address = normalizeVenueAddress(booking.venueAddress);
      if (!address) continue;
      const key = getVenueAddressKey(address);
      if (!map.has(key)) {
        map.set(key, { key, address, bookings: [] });
      }
      map.get(key).bookings.push(booking);
    }
    return Array.from(map.values()).map((group) => ({
      ...group,
      bookings: [...group.bookings].sort(
        (a, b) =>
          new Date(a.eventDate) - new Date(b.eventDate) ||
          String(a.startTime || "").localeCompare(String(b.startTime || ""))
      ),
    }));
  }, [bookings]);

  const activeDayBookings = useMemo(() => {
    return bookingsByDay.get(dayKey(activeDay)) || [];
  }, [activeDay, bookingsByDay]);

  const monthDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const monthLabel = useMemo(() => {
    return monthCursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, [monthCursor]);
  const holidayMap = useMemo(() => {
    const years = new Set(monthDays.map((date) => date.getFullYear()));
    const map = new Map();
    years.forEach((year) => {
      const holidays = buildGhanaHolidays(year);
      holidays.forEach((holiday) => {
        const key = dayKey(holiday.date);
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(holiday.name);
      });
    });
    return map;
  }, [monthDays]);
  const activeHolidays = useMemo(() => holidayMap.get(dayKey(activeDay)) || [], [holidayMap, activeDay]);

  const mapCenter = useMemo(() => {
    if (locations.length) return { lat: locations[0].lat, lng: locations[0].lng };
    return { lat: 5.6037, lng: -0.187 }; // Accra fallback
  }, [locations]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!isGoogleLoaded) return;
    if (!locations.length) return;
    if (typeof window === "undefined" || !window.google?.maps?.LatLngBounds) return;

    const bounds = new window.google.maps.LatLngBounds();
    for (const loc of locations) {
      bounds.extend({ lat: loc.lat, lng: loc.lng });
    }
    mapInstanceRef.current.fitBounds(bounds, 48);
  }, [isGoogleLoaded, locations]);

  useEffect(() => {
    if (!selectedLocation) return;
    const updatedLocation = locations.find((location) => location.key === selectedLocation.key);
    if (!updatedLocation) {
      setSelectedLocation(null);
      return;
    }
    if (updatedLocation !== selectedLocation) {
      setSelectedLocation(updatedLocation);
    }
  }, [locations, selectedLocation]);

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
      // ignore
    }
  };

  const geocodeAddress = async (address) => {
    const cleaned = normalizeVenueAddress(address);
    if (!cleaned) return null;

    const cache = loadGeocodeCache();
    const cacheKey = getVenueAddressKey(cleaned);
    const cachedValue = cache[cacheKey] || cache[cleaned];
    if (cachedValue) {
      if (!cache[cacheKey]) {
        cache[cacheKey] = cachedValue;
        saveGeocodeCache(cache);
      }
      return { ok: true, address: cleaned, coords: cachedValue, cached: true };
    }

    const response = await fetch("/.netlify/functions/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: cleaned }),
    });
    const raw = await response.text();
    const data = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();
    if (!response.ok) {
      return {
        ok: false,
        address: cleaned,
        reason: data?.error || `HTTP ${response.status}`,
      };
    }
    const lat = Number(data?.lat);
    const lng = Number(data?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const provider = typeof data?.provider === "string" ? data.provider.trim() : "";
      const status = typeof data?.status === "string" ? data.status.trim() : "";
      const label = provider ? provider[0].toUpperCase() + provider.slice(1) : "";
      return {
        ok: false,
        address: cleaned,
        reason: status ? `${label || "Geocode"} ${status}` : data?.lastStatus ? `Nominatim ${data.lastStatus}` : "No match",
        tried: data?.tried,
      };
    }

    const value = { lat, lng, updatedAt: Date.now() };
    cache[cacheKey] = value;
    saveGeocodeCache(cache);
    return { ok: true, address: cleaned, coords: value };
  };

  useEffect(() => {
    if (view !== "map") return;
    setSelectedLocation(null);

    if (!addressGroups.length) {
      setLocations([]);
      setMapStats({ total: 0, geocoded: 0 });
      setMapFailures([]);
      return;
    }

    let cancelled = false;
    geocodeQueueRef.current = Promise.resolve();

    const schedule = (task) => {
      let shouldDelay = false;
      geocodeQueueRef.current = geocodeQueueRef.current
        .then(async () => {
          const result = await task();
          shouldDelay = !result?.cached;
          return result;
        })
        .catch(() => null)
        .then(
          (result) =>
            shouldDelay
              ? new Promise((resolve) => setTimeout(() => resolve(result), 350))
              : result
        );
      return geocodeQueueRef.current;
    };

    const run = async () => {
      const results = [];
      const failures = [];
      for (const group of addressGroups) {
        const result = await schedule(() => geocodeAddress(group.address));
        if (cancelled) return;
        if (result?.ok) {
          results.push({
            key: group.key,
            address: group.address,
            bookings: group.bookings,
            count: group.bookings.length,
            ...result.coords,
          });
        } else {
          failures.push({
            address: result?.address || group.address,
            reason: result?.reason || "No match",
            tried: result?.tried,
          });
        }
      }

      if (!cancelled) {
        setLocations(results);
        setMapStats({ total: addressGroups.length, geocoded: results.length });
        setMapFailures(failures);
      }
    };

    run();

    return () => {
      cancelled = true;
      geocodeQueueRef.current = Promise.resolve();
    };
  }, [addressGroups, view]);

  return (
    <div className="scheduler-page">
      <div className="scheduler-shell">
        <AdminBreadcrumb items={[{ label: "Scheduler" }]} />

        <header className="scheduler-header">
          <div>
            <p className="scheduler-eyebrow">Planning</p>
            <h1>Scheduler</h1>
            <p className="scheduler-subtitle">View bookings by date, agenda, or on a map.</p>
          </div>

          <div className="scheduler-actions">
            <button type="button" className="scheduler-secondary" onClick={fetchBookings}>
              Refresh
            </button>
            <div className="scheduler-seg" role="tablist" aria-label="Scheduler views">
              <button
                type="button"
                role="tab"
                aria-selected={view === "month"}
                className={view === "month" ? "is-active" : ""}
                onClick={() => setView("month")}
              >
                Month
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "agenda"}
                className={view === "agenda" ? "is-active" : ""}
                onClick={() => setView("agenda")}
              >
                Agenda
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "map"}
                className={view === "map" ? "is-active" : ""}
                onClick={() => setView("map")}
              >
                Map
              </button>
            </div>
          </div>
        </header>

        {loading && <p className="scheduler-status">Loading bookings...</p>}
        {!loading && error && <p className="scheduler-error">{error}</p>}

        {!loading && !error && view === "month" && (
          <div className="scheduler-grid">
            <section className="calendar-panel">
              <div className="calendar-header">
                <div className="calendar-nav-group" ref={monthPickerRef}>
                  <button
                    type="button"
                    className="calendar-nav"
                    onClick={() =>
                      setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                  >
                    <AppIcon icon={faArrowLeft} />
                  </button>
                  <button
                    type="button"
                    className="calendar-month-toggle"
                    onClick={() => setMonthPickerOpen((open) => !open)}
                    aria-expanded={monthPickerOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{monthLabel}</span>
                    <span className="calendar-caret" aria-hidden="true">▾</span>
                  </button>
                  {monthPickerOpen && (
                    <div className="calendar-month-menu" role="listbox">
                      {monthOptions.map((opt) => {
                        const isActive =
                          monthCursor.getFullYear() === opt.year && monthCursor.getMonth() === opt.month;
                        return (
                          <button
                            key={`${opt.year}-${opt.month}`}
                            type="button"
                            role="option"
                            className={isActive ? "is-active" : ""}
                            onClick={() => handleSelectMonth(opt.year, opt.month)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    className="calendar-nav"
                    onClick={() =>
                      setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    }
                  >
                    <AppIcon icon={faArrowRight} />
                  </button>
                </div>
                <button
                  type="button"
                  className="calendar-nav calendar-nav-ghost"
                  onClick={() => {
                    const today = new Date();
                    setActiveDay(today);
                    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                    setUserSelectedDay(true);
                  }}
                >
                  Today
                </button>
              </div>
              <div className="calendar-weekdays">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {monthDays.map((date) => {
                  const key = dayKey(date);
                  const isCurrentMonth = date.getMonth() === monthCursor.getMonth();
                  const isSelected = dayKey(activeDay) === key;
                  const count = bookingsByDay.get(key)?.length || 0;
                  const holidayNames = holidayMap.get(key) || [];
                  const holidayLabel =
                    holidayNames.length > 1 ? `${holidayNames.length} holidays` : holidayNames[0];
                  const holidayTitle = holidayNames.join(", ");

                  return (
                    <button
                      key={key}
                      type="button"
                      className={
                        "calendar-day" +
                        (isCurrentMonth ? "" : " is-out") +
                        (isSelected ? " is-selected" : "") +
                        (holidayNames.length ? " is-holiday" : "")
                      }
                      title={holidayTitle || undefined}
                      onClick={() => {
                        setActiveDay(date);
                        setUserSelectedDay(true);
                      }}
                    >
                      <span className="calendar-number">{date.getDate()}</span>
                      {holidayNames.length > 0 && (
                        <span className="calendar-holiday">{holidayLabel}</span>
                      )}
                      {count > 0 && <span className="calendar-badge">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
            
            <aside className="calendar-detail">
                
              <div className="calendar-detail-head">
                <div>
                  <h3>{formatDate(activeDay)}</h3>
                  <p className="scheduler-muted">Select a date to review bookings.</p>
                </div>
                <button type="button" className="scheduler-primary" onClick={openBookingModal}>
                  Book rental
                </button>
              </div>
              {activeHolidays.length > 0 && (
                <div className="calendar-holidays">
                  <h4>Ghana holidays</h4>
                  <ul>
                    {activeHolidays.map((holiday) => (
                      <li key={`${dayKey(activeDay)}-${holiday}`}>{holiday}</li>
                    ))}
                  </ul>
                </div>
              )}
              {activeDayBookings.length === 0 ? (
                <p className="scheduler-muted">No bookings scheduled.</p>
              ) : (
                <div className="agenda-list">
                  {activeDayBookings.map((booking) => (
                    <div key={booking.id} className="agenda-card">
                      <div>
                        <h4>#{booking.id} · {booking.customerName}</h4>
                        <p>
                          {formatTimeRange(booking.startTime, booking.endTime)}
                          {booking.venueAddress ? ` · ${booking.venueAddress}` : ""}
                        </p>
                      </div>
                      <div className="agenda-meta">
                        <span className={`agenda-pill ${booking.status || "pending"}`}>{booking.status}</span>
                        <span className="agenda-amount">
                          {formatMoney((booking.totalAmount || 0) / 100, "GHS")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}

        {!loading && !error && view === "agenda" && (
          <section className="agenda-panel">
            <h2>Upcoming bookings</h2>
            {bookings.length === 0 ? (
              <p className="scheduler-muted">No bookings found.</p>
            ) : (
              <div className="agenda-list">
                {[...bookings]
                  .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
                  .slice(0, 50)
                  .map((booking) => (
                    <div key={booking.id} className="agenda-card">
                      <div>
                        <h4>#{booking.id} · {booking.customerName}</h4>
                        <p>
                          {formatDate(booking.eventDate)}
                          {formatTimeRange(booking.startTime, booking.endTime)
                            ? ` · ${formatTimeRange(booking.startTime, booking.endTime)}`
                            : ""}
                          {booking.venueAddress ? ` · ${booking.venueAddress}` : ""}
                        </p>
                      </div>
                      <div className="agenda-meta">
                        <span className={`agenda-pill ${booking.status || "pending"}`}>{booking.status}</span>
                        <span className="agenda-amount">
                          {formatMoney((booking.totalAmount || 0) / 100, "GHS")}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {!loading && !error && view === "map" && (
          <section className="map-panel">
            <div className="map-header">
              <h2>Delivery map</h2>
              <p className="scheduler-muted">
                Pins are geocoded from venue addresses and cached in your browser. {mapStats.total > 0
                  ? `Geocoded ${mapStats.geocoded}/${mapStats.total} addresses.`
                  : ""}
              </p>
            </div>

            <div className="map-frame">
              {!googleMapsApiKey ? (
                <p className="scheduler-muted">
                  Google Maps API key missing. Add <code>VITE_GOOGLE_MAPS_KEY</code> to <code>.env</code> and restart the dev server.
                </p>
              ) : googleLoadError ? (
                <p className="scheduler-muted">Unable to load Google Maps right now.</p>
              ) : !isGoogleLoaded ? (
                <p className="scheduler-muted">Loading map…</p>
              ) : (
                <GoogleMap
                  mapContainerStyle={googleMapContainerStyle}
                  center={mapCenter}
                  zoom={11}
                  options={{
                    fullscreenControl: false,
                    streetViewControl: false,
                    mapTypeControl: false,
                    clickableIcons: false,
                  }}
                  onLoad={(map) => {
                    mapInstanceRef.current = map;
                  }}
                  onUnmount={() => {
                    mapInstanceRef.current = null;
                  }}
                >
                  {locations.map((loc) => (
                    <MarkerF
                      key={loc.key}
                      position={{ lat: loc.lat, lng: loc.lng }}
                      title={`${loc.count} booking${loc.count === 1 ? "" : "s"} · ${loc.address}`}
                      label={
                        loc.count > 1
                          ? {
                              text: String(loc.count),
                              color: "#ffffff",
                              fontWeight: "700",
                              fontSize: "12px",
                            }
                          : undefined
                      }
                      onClick={() => {
                        setSelectedLocation(loc);
                        if (mapInstanceRef.current?.panTo) {
                          mapInstanceRef.current.panTo({ lat: loc.lat, lng: loc.lng });
                        }
                      }}
                    />
                  ))}

                  {selectedLocation && (
                    <InfoWindowF
                      position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                      onCloseClick={() => setSelectedLocation(null)}
                    >
                      <div className="map-popup">
                        <strong>{selectedLocation.address}</strong>
                        <div style={{ marginTop: 4, fontWeight: 600 }}>
                          {selectedLocation.count} booking{selectedLocation.count === 1 ? "" : "s"}
                        </div>
                        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                          {(selectedLocation.bookings || [])
                            .slice(0, 6)
                            .map((booking) => (
                              <div key={booking.id}>
                                #{booking.id} · {booking.customerName} · {formatDate(booking.eventDate)}
                              </div>
                            ))}
                          {(selectedLocation.bookings || []).length > 6 && (
                            <div>…more bookings</div>
                          )}
                        </div>
                      </div>
                    </InfoWindowF>
                  )}
                </GoogleMap>
              )}
            </div>

            {locations.length === 0 && mapStats.total === 0 && (
              <p className="scheduler-muted">
                No map pins yet — check venue addresses or try Refresh.
              </p>
            )}

            {mapFailures.length > 0 && (
              <div className="map-failures">
                <p className="scheduler-muted">
                  Addresses not geocoded ({mapFailures.length}):
                </p>
                <ul>
                  {mapFailures.slice(0, 3).map((failure) => (
                    <li key={failure.address}>
                      <strong>{failure.address}</strong> <span>— {failure.reason}</span>
                    </li>
                  ))}
                </ul>
                {mapFailures.length > 3 && (
                  <p className="scheduler-muted">…and more</p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {bookingModalOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel">
            <header>
              <div>
                <p className="customers-eyebrow">New booking</p>
                <h2>Book rentals for {formatDate(activeDay)}</h2>
              </div>
              <button
                type="button"
                className="customers-modal-close"
                onClick={closeBookingModal}
                aria-label="Close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <form className="customers-form" onSubmit={submitBooking}>
              <label>
                Customer
                <select
                  value={bookingForm.customerId}
                  onChange={(event) =>
                    setBookingForm((prev) => ({ ...prev, customerId: event.target.value }))
                  }
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
                  value={bookingForm.venueAddress}
                  onChange={(event) =>
                    setBookingForm((prev) => ({ ...prev, venueAddress: event.target.value }))
                  }
                  placeholder="Venue / delivery address"
                  required
                />
              </label>

              <label>
                Start time (optional)
                <input
                  type="text"
                  value={bookingForm.startTime}
                  onChange={(event) =>
                    setBookingForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                  placeholder="10:00 AM"
                />
              </label>

              <label>
                End time (optional)
                <input
                  type="text"
                  value={bookingForm.endTime}
                  onChange={(event) =>
                    setBookingForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                  placeholder="04:00 PM"
                />
              </label>

              <label>
                Status
                <select
                  value={bookingForm.status}
                  onChange={(event) =>
                    setBookingForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
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

                {bookingForm.items.length > 0 && (
                  <div className="booking-items-selected">
                    {bookingForm.items.map((item) => {
                      const product = productMap.get(Number(item.productId));
                      return (
                        <div key={item.productId} className="booking-item-row">
                          <span>{product?.name || `Product ${item.productId}`}</span>
                          <div className="booking-item-controls">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItemQuantity(item.productId, event.target.value)
                              }
                            />
                            <button type="button" onClick={() => removeItem(item.productId)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="booking-item-total">
                      <span>Total</span>
                      <strong>{formatMoney(bookingTotalCents / 100, "GHS")}</strong>
                    </div>
                  </div>
                )}
              </div>

              {bookingError && <p className="customers-error">{bookingError}</p>}

              <div className="customers-form-actions">
                <button
                  type="button"
                  className="customers-secondary"
                  onClick={closeBookingModal}
                  disabled={bookingSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="customers-primary" disabled={bookingSaving}>
                  {bookingSaving ? "Saving..." : "Create booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminScheduler;
