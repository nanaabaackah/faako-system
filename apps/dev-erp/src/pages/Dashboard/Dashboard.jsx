/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiChevronDown } from "react-icons/fi";
import { AnimatedLoadingState, DateField, ERPStatusBadge, SelectField } from "@faako/ui";
import KPICard from "../../components/KPICard/KPICard";
import TerminalLogStream from "../../components/TerminalLogStream/TerminalLogStream";
import MonitoringSparkline from "../../components/MonitoringSparkline/MonitoringSparkline";
import {
  buildMonitoringSparklineValues,
  getMonitoringHealthScore,
  getMonitoringStatusSummary,
  getMonitoringTone,
} from "../../components/MonitoringSparkline/monitoringSparklineUtils";
import useDashboardData from "../../hooks/useDashboardData";
import VerseWidget from "../../components/VerseWidget/VerseWidget";
import WeatherWidget from "../../components/WeatherWidget/WeatherWidget";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { readStoredSessionUser } from "../../utils/authSession";
import { formatDateTime, formatPercent, formatRatio } from "../../utils/formatters";
import { getAggregateSiteStatus } from "../../utils/siteStatus";
import { formatStatusLabel, getStatusTone, isHealthyStatus } from "../../utils/status";
import { buildUserScopedCacheKey, readOfflineCache, writeOfflineCache } from "../../utils/offlineCache";
import { hasModuleAccess } from "../../utils/moduleAccess";
import { convertAmountToDisplayGhs, formatGhsAmount } from "../../utils/displayCurrency";
import "./Dashboard.css";

const ACCOUNTING_RANGE = { value: "all", label: "All time" };
const DASHBOARD_ACTIVITY_REFRESH_INTERVAL_MS = 15000;
const RANGE_OPTIONS = [
  { value: "24h", label: "24H", description: "Last 24 hours", hours: 24 },
  { value: "7d", label: "7D", description: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "30D", description: "Last 30 days", hours: 24 * 30 },
];

const SLOT_DURATION_MIN = 60;
const TIME_SLOTS = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "11:00 AM", hour: 11, minute: 0 },
  { label: "1:00 PM", hour: 13, minute: 0 },
  { label: "3:00 PM", hour: 15, minute: 0 },
  { label: "5:00 PM", hour: 17, minute: 0 },
];

const STATUS_LABELS = {
  available: "Open",
  booked: "Booked",
  blocked: "Blocked",
};

const BOOKING_STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "TENTATIVE", label: "Tentative" },
  { value: "CANCELED", label: "Canceled" },
];
const MONITORING_PREVIEW_LIMIT = 3;

const getMonitoringIssuePriority = (status) => {
  if (status === "offline" || status === "error" || status === "suspended") return 0;
  if (status === "degraded" || status === "warning" || status === "pending") return 1;
  if (status === "not_configured" || status === "unknown" || !status) return 2;
  return 3;
};

const buildMonitoringStatusExplanation = (status) => {
  switch (status) {
    case "ok":
    case "online":
      return "Responding normally. Dependent modules should be able to refresh from this surface.";
    case "degraded":
    case "warning":
      return "Part of the check is unstable. Data may refresh slowly or only partially.";
    case "offline":
    case "error":
      return "This check is failing. Features that rely on it may show stale or missing data.";
    case "not_configured":
      return "Monitoring is missing a URL or connection value, so health cannot be confirmed.";
    default:
      return "The latest health signal is unclear. Re-run monitoring or inspect the service logs.";
  }
};

const buildMonitoringNextStep = (status, note = "") => {
  switch (status) {
    case "ok":
    case "online":
      return "Keep monitoring";
    case "degraded":
    case "warning":
      return "Check latency, recent deploys, and partial route failures";
    case "offline":
    case "error":
      return note?.toLowerCase().includes("db")
        ? "Verify database credentials, network access, and migrations"
        : "Open the service health URL and review deployment logs";
    case "not_configured":
      return "Add the missing URL or environment value";
    default:
      return "Refresh monitoring and inspect logs";
  }
};

const DEFAULT_SLOT_FORM = {
  title: "",
  attendeeName: "",
  attendeeEmail: "",
  location: "",
  status: "TENTATIVE",
  description: "",
};

const buildAccountingSummary = (entries = []) => {
  const base = {
    paidRevenueGhs: 0,
    paidExpensesGhs: 0,
    pendingPayablesGhs: 0,
    counts: {
      paidRevenue: 0,
      paidExpenses: 0,
      pendingPayables: 0,
    },
  };

  entries.forEach((entry) => {
    const amount = Number(entry.amount || 0);
    if (!Number.isFinite(amount)) return;
    const displayAmount = convertAmountToDisplayGhs(amount, entry.currency);
    if (entry.type === "REVENUE" && entry.status === "PAID") {
      base.paidRevenueGhs += displayAmount;
      base.counts.paidRevenue += 1;
    }
    if (entry.type === "EXPENSE" && entry.status === "PAID") {
      base.paidExpensesGhs += displayAmount;
      base.counts.paidExpenses += 1;
    }
    if (entry.type === "EXPENSE" && entry.status === "PENDING") {
      base.pendingPayablesGhs += displayAmount;
      base.counts.pendingPayables += 1;
    }
  });

  return base;
};

const buildTodayDate = () => toDateKey(new Date());

const DEFAULT_DAILY_VERSE = {
  status: "idle",
  text: "",
  reference: "",
  source: "youversion",
  warning: "",
  updatedAt: null,
};

const DEFAULT_DAILY_WEATHER = {
  status: "idle",
  temperature: null,
  feelsLike: null,
  temperatureUnit: "FAHRENHEIT",
  conditionLabel: "",
  locationLabel: "Current location",
  warning: "",
  updatedAt: null,
};

const getTemperatureUnitSymbol = (unit) => {
  if (String(unit || "").toUpperCase() === "CELSIUS") return "C";
  return "F";
};

const formatTemperatureValue = (value, unit) => {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}°${getTemperatureUnitSymbol(unit)}`;
};

const buildWeekDays = (startDate = new Date()) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    date.setHours(0, 0, 0, 0);

    return {
      key: toDateKey(date),
      label: dayFormatter.format(date),
      dateLabel: dateFormatter.format(date),
      date,
    };
  });
};

const buildSlotRange = (dayDate, slot) => {
  const start = new Date(dayDate);
  start.setHours(slot.hour, slot.minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + SLOT_DURATION_MIN);
  return { start, end };
};

const hasOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

const formatHolidayLabel = (holiday) => `${holiday.region}: ${holiday.label}`;

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value) => {
  const [year, month, day] = String(value || "")
    .split("-")
    .map((part) => Number(part));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date();
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getEasterDate = (year) => {
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

const getNthWeekday = (year, monthIndex, weekday, occurrence) => {
  const date = new Date(year, monthIndex, 1);
  const offset = (weekday - date.getDay() + 7) % 7;
  date.setDate(1 + offset + 7 * (occurrence - 1));
  return date;
};

const getLastWeekdayBefore = (year, monthIndex, dayOfMonth, weekday) => {
  const date = new Date(year, monthIndex, dayOfMonth);
  const offset = (date.getDay() - weekday + 7) % 7;
  date.setDate(dayOfMonth - offset);
  return date;
};

const buildHolidayList = (year) => {
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const holidays = [
    { date: new Date(year, 0, 1), label: "New Year's Day", region: "CA" },
    { date: goodFriday, label: "Good Friday", region: "CA" },
    {
      date: getLastWeekdayBefore(year, 4, 25, 1),
      label: "Victoria Day",
      region: "CA",
    },
    { date: new Date(year, 6, 1), label: "Canada Day", region: "CA" },
    { date: getNthWeekday(year, 8, 1, 1), label: "Labour Day", region: "CA" },
    { date: getNthWeekday(year, 9, 1, 2), label: "Thanksgiving", region: "CA" },
    { date: new Date(year, 11, 25), label: "Christmas Day", region: "CA" },
    { date: new Date(year, 11, 26), label: "Boxing Day", region: "CA" },
    { date: new Date(year, 0, 1), label: "New Year's Day", region: "GH" },
    { date: new Date(year, 2, 6), label: "Independence Day", region: "GH" },
    { date: goodFriday, label: "Good Friday", region: "GH" },
    { date: easterMonday, label: "Easter Monday", region: "GH" },
    { date: new Date(year, 4, 1), label: "May Day", region: "GH" },
    { date: new Date(year, 8, 21), label: "Founders' Day", region: "GH" },
    {
      date: getNthWeekday(year, 11, 5, 1),
      label: "Farmers' Day",
      region: "GH",
    },
    { date: new Date(year, 11, 25), label: "Christmas Day", region: "GH" },
    { date: new Date(year, 11, 26), label: "Boxing Day", region: "GH" },
  ];

  return holidays;
};

const buildHolidayMap = (days) => {
  const years = Array.from(new Set(days.map((day) => day.date.getFullYear())));
  const holidayMap = new Map();

  years.forEach((year) => {
    buildHolidayList(year).forEach((holiday) => {
      const key = toDateKey(holiday.date);
      const list = holidayMap.get(key) || [];
      list.push(formatHolidayLabel(holiday));
      holidayMap.set(key, list);
    });
  });

  return holidayMap;
};

const buildAvailabilityMatrix = (days, bookings, holidayMap) => {
  const now = new Date();
  const activeBookings = bookings.filter((booking) => booking.status !== "CANCELED");
  const bookingRanges = activeBookings.map((booking) => ({
    start: new Date(booking.startAt),
    end: new Date(booking.endAt),
  }));

  return days.map((day) => {
    const isHoliday = holidayMap.has(day.key);
    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

    return TIME_SLOTS.map((slot) => {
      const { start, end } = buildSlotRange(day.date, slot);
      if (isHoliday || end <= now) {
        return "blocked";
      }
      if (isWeekend || end <= now) {
        return "blocked";
      }
      const booked = bookingRanges.some((range) => hasOverlap(start, end, range.start, range.end));
      return booked ? "booked" : "available";
    });
    
  });
};

const formatAuditAction = (action) => {
  const labels = {
    LOGIN: "User signed in",
    LOGOUT: "User signed out",
    CREATE_BOOKING: "Booking created",
    UPDATE_BOOKING: "Booking updated",
    DELETE_BOOKING: "Booking deleted",
    CREATE_PRODUCT: "Product created",
    UPDATE_PRODUCT: "Product updated",
    DELETE_PRODUCT: "Product deleted",
    CREATE_ORDER: "Order created",
    UPDATE_ORDER: "Order updated",
    DELETE_ORDER: "Order deleted",
    CREATE_USER: "User created",
    UPDATE_USER: "User updated",
    DELETE_USER: "User removed",
    STOCK_ADJUSTMENT: "Stock adjusted",
    EXPORT: "Data exported",
    IMPORT: "Data imported",
    PASSWORD_RESET: "Password reset",
  };
  if (labels[action]) return labels[action];
  return String(action)
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};

const getAuditActionMeta = (action) => {
  const key = String(action).toUpperCase();
  if (/^DELETE/.test(key)) return { badge: "Delete", priority: "urgent" };
  if (/^CREATE/.test(key)) return { badge: "New", priority: "normal" };
  if (/^UPDATE|ADJUST/.test(key)) return { badge: "Update", priority: "normal" };
  if (/^(LOGIN|LOGOUT|AUTH|PASSWORD)/.test(key)) return { badge: "Auth", priority: "normal" };
  if (/^(EXPORT|IMPORT)/.test(key)) return { badge: "Data", priority: "normal" };
  return { badge: "Action", priority: "normal" };
};

const ModulePanelLink = ({ to, label }) => (
  <>
    <Link className="dashboard-module-panel__link" to={to} aria-label={label} />
    <span className="dashboard-module-panel__arrow" aria-hidden="true">
      <FiArrowRight />
    </span>
  </>
);

const Dashboard = () => {
  const storedUser = useMemo(() => readStoredSessionUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const canUseBookings = hasModuleAccess(storedUser, "bookings");
  const canUseAccounting = hasModuleAccess(storedUser, "accounting");
  const [timeRange] = useState("7d");
  const [briefDateKey] = useState(() => buildTodayDate());
  const { data: kpiData, loading, error } = useDashboardData({ range: timeRange });
  const [availabilityBookings, setAvailabilityBookings] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(canUseBookings);
  const [availabilityError, setAvailabilityError] = useState("");
  const [accountingSummary, setAccountingSummary] = useState(null);
  const [accountingLoading, setAccountingLoading] = useState(canUseAccounting);
  const [accountingError, setAccountingError] = useState("");
  const [slotModal, setSlotModal] = useState(null);
  const [slotForm, setSlotForm] = useState(DEFAULT_SLOT_FORM);
  const [slotStatus, setSlotStatus] = useState({ tone: "", message: "" });
  const [isSlotSaving, setIsSlotSaving] = useState(false);
  const [expandedSites, setExpandedSites] = useState({});
  const [selectedAvailabilityDayKey, setSelectedAvailabilityDayKey] = useState("");
  const [verseOfDay, setVerseOfDay] = useState(DEFAULT_DAILY_VERSE);
  const [dailyWeather, setDailyWeather] = useState(DEFAULT_DAILY_WEATHER);
  const [briefRefreshTick] = useState(0);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityActiveUsers, setActivityActiveUsers] = useState(0);
  const [activityLastUpdatedAt, setActivityLastUpdatedAt] = useState("");
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(parseDateKey(briefDateKey)),
    [briefDateKey]
  );
  const availabilityCacheKey = useMemo(
    () => buildUserScopedCacheKey(`dashboard:availability:${briefDateKey}`),
    [briefDateKey]
  );
  const accountingCacheKey = useMemo(
    () => buildUserScopedCacheKey("dashboard:accounting-summary"),
    []
  );
  const verseCacheKey = useMemo(() => buildUserScopedCacheKey("dashboard:verse"), []);
  const weatherCacheKey = useMemo(() => buildUserScopedCacheKey("dashboard:weather"), []);

  const days = useMemo(() => buildWeekDays(parseDateKey(briefDateKey)), [briefDateKey]);
  const holidayMap = useMemo(() => buildHolidayMap(days), [days]);

  const availabilityMatrix = useMemo(
    () => buildAvailabilityMatrix(days, availabilityBookings, holidayMap),
    [days, availabilityBookings, holidayMap]
  );

  const selectedAvailabilityDayIndex = useMemo(() => {
    const index = days.findIndex((day) => day.key === selectedAvailabilityDayKey);
    return index >= 0 ? index : 0;
  }, [days, selectedAvailabilityDayKey]);
  const selectedAvailabilityDay = days[selectedAvailabilityDayIndex] || null;

  const availabilityTotals = useMemo(() => {
    const totals = { available: 0, booked: 0, blocked: 0 };
    availabilityMatrix.forEach((daySlots) => {
      daySlots.forEach((status) => {
        totals[status] += 1;
      });
    });
    return totals;
  }, [availabilityMatrix]);

  const nextAvailable = useMemo(() => {
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      for (let slotIndex = 0; slotIndex < TIME_SLOTS.length; slotIndex += 1) {
        const daySlots = availabilityMatrix[dayIndex] || [];
        if (daySlots[slotIndex] === "available") {
          return {
            day: days[dayIndex],
            time: TIME_SLOTS[slotIndex].label,
          };
        }
      }
    }
    return null;
  }, [availabilityMatrix, days]);

  const totalSlots = TIME_SLOTS.length * days.length;
  const availableSlots = availabilityTotals.available;
  const todayDateKey = briefDateKey || buildTodayDate();
  const isBriefDateToday = todayDateKey === buildTodayDate();

  const todayBookingsCount = useMemo(
    () =>
      availabilityBookings.filter(
        (booking) => booking.status !== "CANCELED" && toDateKey(new Date(booking.startAt)) === todayDateKey
      ).length,
    [availabilityBookings, todayDateKey]
  );

  const todayOpenSlots = useMemo(() => {
    const dayIndex = days.findIndex((day) => day.key === todayDateKey);
    if (dayIndex < 0) return 0;
    return (availabilityMatrix[dayIndex] || []).filter((status) => status === "available").length;
  }, [availabilityMatrix, days, todayDateKey]);

  const findSlotBooking = useCallback(
    (day, slot) => {
      const { start, end } = buildSlotRange(day.date, slot);
      return availabilityBookings.find((booking) => {
        const bookingStart = new Date(booking.startAt);
        const bookingEnd = new Date(booking.endAt);
        return hasOverlap(start, end, bookingStart, bookingEnd);
      });
    },
    [availabilityBookings]
  );

  const openSlotModal = (day, slot, status) => {
    const existing = findSlotBooking(day, slot) || null;
    const { start, end } = buildSlotRange(day.date, slot);
    const startAt = existing ? new Date(existing.startAt) : start;
    const endAt = existing ? new Date(existing.endAt) : end;
    setSlotModal({ day, slot, status, booking: existing, startAt, endAt });
    setSlotForm({
      title: existing?.title ?? "",
      attendeeName: existing?.attendeeName ?? "",
      attendeeEmail: existing?.attendeeEmail ?? "",
      location: existing?.location ?? "",
      status: existing?.status ?? "CONFIRMED",
      description: existing?.description ?? "",
    });
    setSlotStatus({ tone: "", message: "" });
  };

  const closeSlotModal = () => {
    setSlotModal(null);
    setSlotForm(DEFAULT_SLOT_FORM);
    setSlotStatus({ tone: "", message: "" });
    setIsSlotSaving(false);
  };

  const handleSlotSave = async () => {
    if (!slotModal) return;
    if (!canUseBookings) {
      setSlotStatus({ tone: "error", message: "Bookings access is required to save appointments." });
      return;
    }

    const title = slotForm.title.trim();
    if (!title) {
      setSlotStatus({ tone: "error", message: "Title is required." });
      return;
    }

    const payload = {
      title,
      attendeeName: slotForm.attendeeName.trim() || null,
      attendeeEmail: slotForm.attendeeEmail.trim() || null,
      location: slotForm.location.trim() || null,
      status: slotForm.status,
      description: slotForm.description.trim() || null,
      startAt: slotModal.startAt.toISOString(),
      endAt: slotModal.endAt.toISOString(),
    };

    setIsSlotSaving(true);
    setSlotStatus({ tone: "", message: "" });

    try {
      const isEditing = Boolean(slotModal.booking?.id);
      const endpoint = isEditing ? `/api/bookings/${slotModal.booking.id}` : "/api/bookings";
      if (isEditing) {
        await apiPatch(endpoint, payload, { fallbackMessage: "Unable to save appointment." });
      } else {
        await apiPost(endpoint, payload, { fallbackMessage: "Unable to save appointment." });
      }
      setSlotStatus({ tone: "success", message: "Appointment saved." });
      await loadAvailability();
      closeSlotModal();
    } catch (saveError) {
      setSlotStatus({ tone: "error", message: saveError.message });
    } finally {
      setIsSlotSaving(false);
    }
  };

  const loadAvailability = useCallback(async () => {
    if (!canUseBookings) {
      setAvailabilityBookings([]);
      setAvailabilityError("");
      setAvailabilityLoading(false);
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const from = parseDateKey(briefDateKey);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 6);
      to.setHours(23, 59, 59, 999);

      const query = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const payload = await apiGet(`/api/bookings?${query.toString()}`, {
        fallbackMessage: "Unable to load availability",
      });
      const bookings = Array.isArray(payload) ? payload : [];
      setAvailabilityBookings(bookings);
      writeOfflineCache(availabilityCacheKey, bookings);
    } catch (err) {
      const cached = readOfflineCache(availabilityCacheKey);
      if (Array.isArray(cached?.payload)) {
        setAvailabilityBookings(cached.payload);
        setAvailabilityError("Offline mode: showing cached availability.");
      } else {
        setAvailabilityError(err.message);
      }
    } finally {
      setAvailabilityLoading(false);
    }
  }, [availabilityCacheKey, briefDateKey, canUseBookings]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!days.length) return;
    const validSelected = days.some((day) => day.key === selectedAvailabilityDayKey);
    if (validSelected) return;

    const firstOpenDay = days.find((day, dayIndex) =>
      (availabilityMatrix[dayIndex] || []).some((slotStatus) => slotStatus === "available")
    );
    setSelectedAvailabilityDayKey((firstOpenDay || days[0]).key);
  }, [days, availabilityMatrix, selectedAvailabilityDayKey]);

  const loadAccountingSummary = useCallback(
    async ({ silent = false } = {}) => {
      if (!canUseAccounting) {
        setAccountingSummary(null);
        setAccountingError("");
        setAccountingLoading(false);
        return;
      }

      if (!silent) {
        setAccountingLoading(true);
      }
      setAccountingError("");

      try {
        const query = new URLSearchParams({ range: ACCOUNTING_RANGE.value });
        if (isAdmin) {
          query.set("organizationId", "all");
        }
        const payload = await apiGet(`/api/accounting/entries?${query.toString()}`, {
          fallbackMessage: "Unable to load accounting summary",
        });
        const entries = payload.entries || [];
        setAccountingSummary(buildAccountingSummary(entries));
        writeOfflineCache(accountingCacheKey, entries);
      } catch (err) {
        const cached = readOfflineCache(accountingCacheKey);
        if (Array.isArray(cached?.payload)) {
          setAccountingSummary(buildAccountingSummary(cached.payload));
          setAccountingError("Offline mode: showing cached accounting summary.");
        } else {
          setAccountingError(err.message);
          setAccountingSummary(null);
        }
      } finally {
        setAccountingLoading(false);
      }
    },
    [accountingCacheKey, canUseAccounting, isAdmin]
  );

  useEffect(() => {
    loadAccountingSummary();
  }, [loadAccountingSummary]);

  useEffect(() => {
    let isActive = true;

    setVerseOfDay((prev) => ({ ...prev, status: "loading", warning: "" }));

    apiGet("/api/dashboard/verse-of-day", { fallbackMessage: "Unable to load verse of the day" })
      .then((payload) => {
        const verse = payload?.verse || {};
        const nextVerse = {
          status: "ready",
          text: String(verse?.text || "").trim(),
          reference: String(verse?.reference || "").trim(),
          source: String(verse?.source || payload?.meta?.source || "youversion"),
          warning: String(payload?.meta?.warning || ""),
          updatedAt: payload?.meta?.fetchedAt || new Date().toISOString(),
        };
        if (!nextVerse.text || !nextVerse.reference) {
          throw new Error("Verse endpoint returned incomplete data.");
        }
        if (!isActive) return;
        setVerseOfDay(nextVerse);
        writeOfflineCache(verseCacheKey, nextVerse);
      })
      .catch((requestError) => {
        if (!isActive) return;
        const cached = readOfflineCache(verseCacheKey);
        if (cached?.payload?.text && cached?.payload?.reference) {
          setVerseOfDay({
            ...cached.payload,
            status: "ready",
            warning: cached.payload.warning || "Offline mode: showing cached verse.",
          });
          return;
        }
        setVerseOfDay((prev) => ({
          ...prev,
          status: "error",
          warning: requestError.message || "Unable to load verse of the day.",
        }));
      });

    return () => {
      isActive = false;
    };
  }, [verseCacheKey, briefRefreshTick]);

  useEffect(() => {
    let isActive = true;
    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
      const cached = readOfflineCache(weatherCacheKey);
      if (cached?.payload) {
        setDailyWeather({
          ...DEFAULT_DAILY_WEATHER,
          ...cached.payload,
          status: "ready",
          warning: cached.payload.warning || "Offline mode: showing cached weather.",
        });
      } else {
        setDailyWeather((prev) => ({ ...prev, status: "unavailable" }));
      }
      return undefined;
    }

    setDailyWeather((prev) => ({ ...prev, status: "loading" }));

    const handleSuccess = async (position) => {
      const latitude = Number(position?.coords?.latitude);
      const longitude = Number(position?.coords?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        if (!isActive) return;
        setDailyWeather((prev) => ({ ...prev, status: "error" }));
        return;
      }

      try {
        const weatherQuery = new URLSearchParams({
          lat: String(latitude),
          lng: String(longitude),
        });
        const weatherPayload = await apiGet(`/api/dashboard/weather?${weatherQuery.toString()}`, {
          fallbackMessage: "Unable to load weather",
        });

        const weather = weatherPayload?.weather || {};
        const parsedTemperature = Number(weather?.temperature);
        const parsedFeelsLike = Number(weather?.feelsLike);
        const nextWeather = {
          status: "ready",
          temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : null,
          feelsLike: Number.isFinite(parsedFeelsLike) ? parsedFeelsLike : null,
          temperatureUnit: String(weather?.temperatureUnit || "FAHRENHEIT"),
          conditionLabel: String(weather?.conditionLabel || "Current conditions"),
          locationLabel: String(weather?.locationLabel || "Current location"),
          warning: String(weatherPayload?.meta?.warning || ""),
          updatedAt: weatherPayload?.meta?.fetchedAt || new Date().toISOString(),
        };
        if (!isActive) return;
        setDailyWeather(nextWeather);
        writeOfflineCache(weatherCacheKey, nextWeather);
      } catch (requestError) {
        if (!isActive) return;
        const cached = readOfflineCache(weatherCacheKey);
        if (cached?.payload) {
          setDailyWeather({
            ...DEFAULT_DAILY_WEATHER,
            ...cached.payload,
            status: "ready",
            warning: cached.payload.warning || "Offline mode: showing cached weather.",
          });
          return;
        }
        setDailyWeather((prev) => ({
          ...prev,
          status: "error",
          warning: requestError.message || "Unable to fetch weather forecast.",
        }));
      }
    };

    const handleError = () => {
      if (!isActive) return;
      const cached = readOfflineCache(weatherCacheKey);
      if (cached?.payload) {
        setDailyWeather({
          ...DEFAULT_DAILY_WEATHER,
          ...cached.payload,
          status: "ready",
          warning: cached.payload.warning || "Location unavailable. Showing cached weather.",
        });
        return;
      }
      setDailyWeather((prev) => ({ ...prev, status: "unavailable" }));
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 20 * 60 * 1000,
    });

    return () => {
      isActive = false;
    };
  }, [weatherCacheKey, briefRefreshTick]);

  const loadActivityLogs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setActivityLoading(true);
    }
    try {
      const payload = await apiGet(`/api/dashboard/activity?range=${timeRange}`, {
        fallbackMessage: "Unable to load activity",
      });
      setActivityLogs(Array.isArray(payload.entries) ? payload.entries : []);
      setActivityActiveUsers(Number(payload.activeUserCount) || 0);
      setActivityLastUpdatedAt(new Date().toISOString());
    } catch {
      // silently fall through — timeline still shows synthetic events
    } finally {
      if (!silent) {
        setActivityLoading(false);
      }
    }
  }, [setActivityActiveUsers, timeRange]);

  useEffect(() => {
    loadActivityLogs();
  }, [loadActivityLogs]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      loadActivityLogs({ silent: true });
    }, DASHBOARD_ACTIVITY_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadActivityLogs]);

  const toggleSiteExpansion = (siteId) => {
    setExpandedSites((prev) => ({ ...prev, [siteId]: !prev[siteId] }));
  };

  const handleSiteCardKeyDown = (event, siteId) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleSiteExpansion(siteId);
  };

  const activeRange = RANGE_OPTIONS.find((option) => option.value === timeRange) || RANGE_OPTIONS[1];
  const rangeDescription = activeRange.description;
  const rangeWindowMs = activeRange.hours * 60 * 60 * 1000;

  const renderStatusPill = (status) => {
    const tone = getStatusTone(status);
    return (
      <ERPStatusBadge tone={tone} className={`status-pill is-${tone}`}>
        {formatStatusLabel(status)}
      </ERPStatusBadge>
    );
  };

  const organizations = Array.isArray(kpiData?.organizations) ? kpiData.organizations : [];
  const topLevelOrganizations =
    kpiData?.topLevelOrganizations ?? organizations.filter((organization) => organization.isTopLevel).length;
  const childOrganizations =
    kpiData?.childOrganizations ?? organizations.filter((organization) => organization.parentOrganizationId).length;
  const organizationManagedSummary = organizations.length
    ? organizations.map((organization) => `${organization.name} ${organization.managedOrganizationsCount ?? 0}`).join(" | ")
    : "No organizations tracked";

  const siteStatuses = kpiData?.siteStatus?.sites ?? [];
  const systemStatus = kpiData?.status ?? {};
  const apiSurfaces = Array.isArray(kpiData?.apiSurfaces)
    ? kpiData.apiSurfaces
    : [
        {
          id: "dev-erp-api",
          label: "Dev ERP API",
          status: systemStatus.api,
          note: "API surface",
        },
        {
          id: "faako-api",
          label: "Faako API",
          status: systemStatus.faakoApi,
          note: "API surface",
        },
        {
          id: "stroane-api",
          label: "Stroane API",
          status: systemStatus.stroaneApi,
          note: "API surface",
        },
      ].filter((surface) => surface.status);
  const lastSyncedLabel = kpiData?.lastSyncedAt ? formatDateTime(kpiData.lastSyncedAt) : "N/A";
  const systemEntries = [
    ...apiSurfaces.map((surface) => ({
      id: surface.id,
      label: surface.label,
      status: surface.status,
      note: surface.note || "API surface",
    })),
    {
      id: "portfolio",
      label: "Primary DB",
      status: systemStatus.portfolioDb,
      note: "Core organization data",
    },
    {
      id: "reebs",
      label: "Reebs DB",
      status: systemStatus.reebsDb,
      note: "Operational data",
    },
    {
      id: "faako",
      label: "Faako DB",
      status: systemStatus.faakoDb,
      note: "ERP members",
    },
    {
      id: "stroane",
      label: "Stroane DB",
      status: systemStatus.stroaneDb,
      note: "Client commerce data",
    },
  ];

  const siteOverview = siteStatuses.map((site) => {
    const pages = site.pages ?? [];
    const aggregateStatus = getAggregateSiteStatus(pages);
    const summary = getMonitoringStatusSummary(pages);
    const score = aggregateStatus === "not_configured"
      ? 0
      : summary.configured
        ? summary.score
        : getMonitoringHealthScore(aggregateStatus);
    return {
      id: site.id,
      title: site.title,
      category: site.category,
      pages,
      aggregateStatus,
      summary,
      score,
      tone: getMonitoringTone(aggregateStatus),
      sparkline: buildMonitoringSparklineValues({
        status: aggregateStatus,
        score,
        seed: site.title?.length || site.id?.length || 1,
      }),
    };
  });
  const orderedSites = [...siteOverview].sort((left, right) => {
    if (left.id === "stroane-portal" || left.id === "reebs-portal") return 1;
    if (right.id === "stroane-portal" || right.id === "reebs-portal") return -1;
    return 0;
  });

  const sitePages = siteOverview.flatMap((site) => site.pages);
  const totalServices = systemEntries.filter((entry) => entry.status).length;
  const healthyServices = systemEntries.filter(
    (entry) => entry.status && isHealthyStatus(entry.status)
  ).length;
  const configuredSites = siteOverview.filter((site) => site.aggregateStatus !== "not_configured");
  const totalSites = configuredSites.length;
  const notConfiguredSites = siteOverview.length - configuredSites.length;
  const onlineSites = siteOverview.filter((site) => site.aggregateStatus === "online").length;
  const configuredPages = sitePages.filter((page) => page.status !== "not_configured");
  const totalPages = configuredPages.length;
  const onlinePages = sitePages.filter((page) => page.status === "online").length;
  const serviceHealthPercent = formatPercent(healthyServices, totalServices);
  const siteHealthPercent = formatPercent(onlineSites, totalSites);
  const pageHealthPercent = formatPercent(onlinePages, totalPages);
  const affectedSystemEntries = systemEntries
    .filter((entry) => entry.status && !isHealthyStatus(entry.status))
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      status: entry.status,
      detail: entry.note,
    }))
    .sort((left, right) => getMonitoringIssuePriority(left.status) - getMonitoringIssuePriority(right.status));
  const affectedSiteEntries = siteOverview
    .filter((site) => site.aggregateStatus === "offline" || site.aggregateStatus === "degraded")
    .map((site) => ({
      id: site.id,
      label: site.title,
      status: site.aggregateStatus,
      detail: `${site.summary.online}/${site.summary.configured || site.summary.total} checks online`,
    }))
    .sort((left, right) => getMonitoringIssuePriority(left.status) - getMonitoringIssuePriority(right.status));
  const siteConfigurationGaps = siteOverview
    .filter((site) => site.aggregateStatus === "not_configured")
    .map((site) => ({
      id: site.id,
      label: site.title,
      status: "not_configured",
      detail: "No monitored URL configured",
    }));
  const pageIssueEntries = siteOverview
    .flatMap((site) =>
      (site.pages || [])
        .filter((page) => page.status && !isHealthyStatus(page.status) && page.status !== "not_configured")
        .map((page, index) => ({
          id: `${site.id}-page-${page.path || page.label || index}`,
          label: page.label || page.path || page.url || "Endpoint",
          status: page.status,
          detail: `${site.title}${page.path ? ` - ${page.path}` : ""}`,
        }))
    )
    .sort((left, right) => getMonitoringIssuePriority(left.status) - getMonitoringIssuePriority(right.status));
  const pageConfigurationGaps = siteOverview.flatMap((site) =>
    (site.pages || [])
      .filter((page) => page.status === "not_configured")
      .map((page, index) => ({
        id: `${site.id}-missing-${page.path || page.label || index}`,
        label: page.label || page.path || "Endpoint",
        status: "not_configured",
        detail: `${site.title}${page.path ? ` - ${page.path}` : ""}`,
      }))
  );
  const surfaceIssueEntries = [...affectedSiteEntries, ...siteConfigurationGaps];
  const pageOperationalIssues = [...pageIssueEntries, ...pageConfigurationGaps];
  const systemDiagnosisRows = systemEntries
    .map((entry) => {
      const status = entry.status || "unknown";
      return {
        ...entry,
        status,
        tone: getMonitoringTone(status),
        explanation: buildMonitoringStatusExplanation(status),
        nextStep: buildMonitoringNextStep(status, entry.note),
      };
    })
    .sort((left, right) => getMonitoringIssuePriority(left.status) - getMonitoringIssuePriority(right.status));
  const operationalSnapshotCards = [
    {
      id: "services",
      label: "Service layer",
      status: healthyServices === totalServices ? "online" : healthyServices ? "degraded" : "offline",
      headline: affectedSystemEntries.length
        ? `${affectedSystemEntries.length} service${affectedSystemEntries.length === 1 ? "" : "s"} need attention`
        : "All API and database checks are healthy",
      summary: affectedSystemEntries.length
        ? "A failing API or database can block dashboards, accounting, invoicing, and monitored app refreshes."
        : "Core APIs and databases are responding normally.",
      primaryMetric: `${serviceHealthPercent}% healthy`,
      secondaryMetric: `${formatRatio(healthyServices, totalServices)} services`,
      issues: affectedSystemEntries,
      nextStep: affectedSystemEntries.length
        ? buildMonitoringNextStep(affectedSystemEntries[0].status, affectedSystemEntries[0].detail)
        : "No service action needed",
    },
    {
      id: "surfaces",
      label: "App surfaces",
      status: affectedSiteEntries.length
        ? affectedSiteEntries.some((site) => site.status === "offline")
          ? "offline"
          : "degraded"
        : siteConfigurationGaps.length
          ? "not_configured"
          : "online",
      headline: affectedSiteEntries.length
        ? `${affectedSiteEntries.length} app surface${affectedSiteEntries.length === 1 ? "" : "s"} affected`
        : siteConfigurationGaps.length
          ? `${siteConfigurationGaps.length} app surface${siteConfigurationGaps.length === 1 ? "" : "s"} not monitored`
          : "All configured app surfaces are online",
      summary: affectedSiteEntries.length
        ? "The named app is not consistently reachable, so user-facing workflows may be affected."
        : siteConfigurationGaps.length
          ? "Monitoring cannot confirm every optional app surface yet because a URL is missing."
          : "Configured apps are reachable from the monitor.",
      primaryMetric: `${siteHealthPercent}% online`,
      secondaryMetric: `${formatRatio(onlineSites, totalSites)} surfaces`,
      issues: surfaceIssueEntries,
      nextStep: affectedSiteEntries.length
        ? buildMonitoringNextStep(affectedSiteEntries[0].status)
        : siteConfigurationGaps.length
          ? "Add missing surface URLs"
          : "No app action needed",
    },
    {
      id: "pages",
      label: "Page checks",
      status: pageIssueEntries.length
        ? pageIssueEntries.some((page) => page.status === "offline" || page.status === "error")
          ? "offline"
          : "degraded"
        : pageConfigurationGaps.length
          ? "not_configured"
          : "online",
      headline: pageIssueEntries.length
        ? `${pageIssueEntries.length} route${pageIssueEntries.length === 1 ? "" : "s"} failing checks`
        : pageConfigurationGaps.length
          ? `${pageConfigurationGaps.length} route${pageConfigurationGaps.length === 1 ? "" : "s"} missing URLs`
          : "All configured routes are online",
      summary: pageIssueEntries.length
        ? "These are the specific routes to open first when an app looks unhealthy."
        : pageConfigurationGaps.length
          ? "The monitor is missing some optional route URLs, so those checks are invisible."
          : "Every configured route returned a healthy signal.",
      primaryMetric: `${pageHealthPercent}% online`,
      secondaryMetric: `${formatRatio(onlinePages, totalPages)} pages`,
      issues: pageOperationalIssues,
      nextStep: pageIssueEntries.length
        ? buildMonitoringNextStep(pageIssueEntries[0].status)
        : pageConfigurationGaps.length
          ? "Fill in missing route URLs"
          : "No route action needed",
    },
  ].map((card) => ({
    ...card,
    tone: getMonitoringTone(card.status),
    hiddenIssueCount: Math.max(card.issues.length - MONITORING_PREVIEW_LIMIT, 0),
  }));
  const accountingNetTotals = useMemo(() => {
    if (!accountingSummary) return null;
    return accountingSummary.paidRevenueGhs - accountingSummary.paidExpensesGhs;
  }, [accountingSummary]);
  const verseTextLabel =
    verseOfDay.status === "ready" && verseOfDay.text
      ? `"${verseOfDay.text}"`
      : verseOfDay.status === "loading"
        ? "Loading verse..."
        : '"Keep moving with purpose today."';
  const verseReferenceLabel =
    verseOfDay.status === "ready" && verseOfDay.reference
      ? verseOfDay.reference
      : verseOfDay.warning || "Verse unavailable.";
  const weatherPrimaryLabel =
    dailyWeather.status === "ready"
      ? formatTemperatureValue(dailyWeather.temperature, dailyWeather.temperatureUnit)
      : dailyWeather.status === "loading"
        ? "Loading..."
        : "--";
  const weatherSecondaryLabel =
    dailyWeather.status === "ready"
      ? `${dailyWeather.conditionLabel || "Current conditions"} • ${dailyWeather.locationLabel}`
      : dailyWeather.status === "unavailable"
        ? "Enable location for local weather."
        : dailyWeather.status === "error"
          ? dailyWeather.warning || "Unable to fetch forecast."
          : "Fetching local forecast.";
  const weatherFeelsLikeLabel =
    dailyWeather.status === "ready" && Number.isFinite(dailyWeather.feelsLike)
      ? `Feels like ${formatTemperatureValue(dailyWeather.feelsLike, dailyWeather.temperatureUnit)}`
      : dailyWeather.warning || "Current forecast";

  const attentionItems = [
    ...systemEntries
      .filter((entry) => entry.status && !isHealthyStatus(entry.status))
      .map((entry) => ({
        id: `system-${entry.id}`,
        label: entry.label,
        status: entry.status,
        note: entry.note,
      })),
    ...siteOverview
      .filter((site) => site.aggregateStatus === "offline" || site.aggregateStatus === "degraded")
      .map((site) => ({
        id: `site-${site.id}`,
        label: site.title,
        status: site.aggregateStatus,
        note: `${site.pages.length} pages tracked`,
      })),
  ];

  const baseTimelineEvents = [
    kpiData?.lastSyncedAt
      ? {
          id: "sync",
          timestamp: kpiData.lastSyncedAt,
          title: "KPI ingestion completed",
          detail: `Orgs ${kpiData.totalOrganizations ?? 0} | Surfaces ${onlineSites}/${totalSites} online`,
          badge: "Sync",
          source: "dashboard",
          level: "success",
          priority: "normal",
        }
      : null,
    kpiData?.siteStatus?.checkedAt
      ? {
          id: "site-check",
          timestamp: kpiData.siteStatus.checkedAt,
          title: "App surface health check",
          detail: `${onlineSites}/${totalSites} surfaces online | ${onlinePages}/${totalPages} pages online`,
          badge: attentionItems.length ? "Alert" : "Check",
          source: "monitor",
          level: attentionItems.length ? "warning" : "info",
          priority: attentionItems.length ? "urgent" : "normal",
        }
      : null,
  ].filter(Boolean);

  const auditTimelineEvents = activityLogs.map((log) => {
    const { badge, priority } = getAuditActionMeta(log.action);
    const userName = log.user?.fullName || "System";
    const targetInfo = log.targetType
      ? `${log.targetType}${log.targetId ? ` #${log.targetId}` : ""}`
      : "";
    return {
      id: `audit-${log.id}`,
      timestamp: log.createdAt,
      title: formatAuditAction(log.action),
      detail: [userName, targetInfo].filter(Boolean).join(" · "),
      badge,
      source: log.source || "audit",
      level: log.severity || (priority === "urgent" ? "warning" : "info"),
      priority,
    };
  });

  const timelineEvents = [...baseTimelineEvents, ...auditTimelineEvents]
    .filter((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      if (Number.isNaN(eventTime)) return false;
      return Date.now() - eventTime <= rangeWindowMs;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const terminalTimelineEvents = timelineEvents.map((event) => ({
    id: event.id,
    timestamp: event.timestamp,
    level: event.level || (event.priority === "urgent" ? "warning" : "info"),
    source: event.source || event.badge || "dashboard",
    message: event.title,
    detail: event.detail,
  }));

  const isExternalBooking = slotModal?.booking?.source
    ? slotModal.booking.source !== "MANUAL"
    : false;
  const isSlotBlocked = Boolean(slotModal && slotModal.status === "blocked" && !slotModal.booking);
  const slotTitle = slotModal?.booking ? "Edit appointment" : "Add appointment";
  const slotDateLabel = slotModal
    ? `${slotModal.day.dateLabel} • ${slotModal.slot.label}`
    : "";

  return (
    <section className="page dashboard">
      <div className="dashboard-hero availability-hero">
        <div className="dashboard-hero__intro">
          <h1 className="heading">Welcome Baaba</h1>
          <p className="muted">
            {todayLabel} | Last synced {lastSyncedLabel}
          </p>
          <VerseWidget textLabel={verseTextLabel} referenceLabel={verseReferenceLabel} />
        </div>
        <div className="dashboard-hero__side">
          <div className="dashboard-brief-grid">
            <WeatherWidget
              primaryLabel={weatherPrimaryLabel}
              secondaryLabel={weatherSecondaryLabel}
              feelsLikeLabel={weatherFeelsLikeLabel}
            />
            {canUseBookings ? (
              <>
                <KPICard
                  variant="brief"
                  label={isBriefDateToday ? "Appointments today" : "Appointments selected day"}
                  value={todayBookingsCount}
                  meta="Scheduled appointments"
                  delta={`Availability ${availableSlots}/${totalSlots}`}
                />
                <KPICard
                  variant="brief"
                  label={isBriefDateToday ? "Open slots today" : "Open slots selected day"}
                  value={`${todayOpenSlots}/${TIME_SLOTS.length}`}
                  meta="Available windows"
                  delta={
                    nextAvailable
                      ? `Next open ${nextAvailable.day.dateLabel} ${nextAvailable.time}`
                      : "No open slots"
                  }
                />
              </>
            ) : null}
            <KPICard
              variant="brief"
              label="Service health"
              value={serviceHealthPercent}
              meta={`${healthyServices}/${totalServices} healthy services`}
              delta={`${onlineSites}/${totalSites} surfaces online`}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <AnimatedLoadingState compact className="panel" title="Loading dashboard data" />
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {canUseBookings ? (
        <section
          className="glass-card panel availability-panel dashboard-module-panel dashboard-module-panel--interactive"
          id="availability"
        >
        <div className="panel-header">
          <div>
            <h3>Weekly availability</h3>
          </div>
          <div className="availability-legend">
            <span className="legend-item">
              <span className="legend-dot is-available" />
              Available
            </span>
            <span className="legend-item">
              <span className="legend-dot is-booked" />
              Booked
            </span>
            <span className="legend-item">
              <span className="legend-dot is-blocked" />
              Blocked
            </span>
          </div>
        </div>

        {availabilityError ? (
          <div className="notice is-error" role="alert">
            {availabilityError}
          </div>
        ) : null}

        {availabilityLoading ? (
          <AnimatedLoadingState compact title="Loading availability" />
        ) : null}

        {nextAvailable ? (
          <div className="availability-callout">
            <span className="table-strong">Next available:</span>
            <span>
              {nextAvailable.day.dateLabel} • {nextAvailable.time}
            </span>
          </div>
        ) : (
          <div className="availability-callout muted">No available slots in this window.</div>
        )}

        <div className="availability-scroll availability-desktop">
          <div className="glass-card availability-grid" role="grid">
            <div className="availability-cell availability-corner" aria-hidden="true" />
            {days.map((day) => {
              const holidayLabels = holidayMap.get(day.key) || [];
              return (
                <div className="availability-cell availability-day" role="columnheader" key={day.key}>
                  <span className="availability-day__label">{day.label}</span>
                  <span className="availability-day__date">{day.dateLabel}</span>
                  {holidayLabels.length ? (
                    <div className="availability-day__holidays">
                      {holidayLabels.map((label) => (
                        <span className="availability-holiday" key={label}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {TIME_SLOTS.map((slot, slotIndex) => (
              <React.Fragment key={slot.label}>
                <div className="availability-cell availability-time" role="rowheader">
                  {slot.label}
                </div>
                {days.map((day, dayIndex) => {
                  const daySlots = availabilityMatrix[dayIndex] || [];
                  const status = daySlots[slotIndex] || "blocked";
                  const slotBooking = findSlotBooking(day, slot);
                  const isBlocked = status === "blocked" && !slotBooking;
                  const label = `${day.label} ${day.dateLabel} at ${slot.label} - ${STATUS_LABELS[status]}`;
                  return (
                    <button
                      className={`availability-cell availability-slot availability-slot-button is-${status}`}
                      type="button"
                      role="gridcell"
                      key={`${day.key}-${slot.label}`}
                      onClick={() => openSlotModal(day, slot, status)}
                      aria-label={label}
                      disabled={isBlocked}
                    >
                      <span>{STATUS_LABELS[status]}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="availability-mobile" aria-label="Mobile weekly availability">
          <div className="availability-mobile__days" role="tablist" aria-label="Choose day">
            {days.map((day, dayIndex) => {
              const isActive = selectedAvailabilityDay?.key === day.key;
              const hasOpenSlot = (availabilityMatrix[dayIndex] || []).some(
                (slotStatus) => slotStatus === "available"
              );
              return (
                <button
                  key={day.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`availability-day-chip ${isActive ? "is-active" : ""}`}
                  onClick={() => setSelectedAvailabilityDayKey(day.key)}
                >
                  <span className="availability-day-chip__label">{day.label}</span>
                  <span className="availability-day-chip__number">{day.date.getDate()}</span>
                  {hasOpenSlot ? <span className="availability-day-chip__dot" /> : null}
                </button>
              );
            })}
          </div>

          <div className="availability-mobile__agenda" role="list">
            {selectedAvailabilityDay
              ? TIME_SLOTS.map((slot, slotIndex) => {
                  const status = availabilityMatrix[selectedAvailabilityDayIndex]?.[slotIndex] || "blocked";
                  const slotBooking = findSlotBooking(selectedAvailabilityDay, slot);
                  const isBlocked = status === "blocked" && !slotBooking;
                  return (
                    <button
                      key={`${selectedAvailabilityDay.key}-${slot.label}`}
                      type="button"
                      className={`availability-agenda-slot is-${status}`}
                      onClick={() => openSlotModal(selectedAvailabilityDay, slot, status)}
                      disabled={isBlocked}
                    >
                      <span>{slot.label}</span>
                      <span>{STATUS_LABELS[status]}</span>
                    </button>
                  );
                })
              : null}
          </div>
        </div>

        <ModulePanelLink to="/bookings" label="Open bookings module" />
        </section>
      ) : null}

      {canUseBookings && slotModal ? (
        <div className="slot-modal" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
          <div className="slot-modal__card">
            <div className="slot-modal__header">
              <div>
                <p className="eyebrow">Appointment</p>
                <h3 id="slot-modal-title">{slotTitle}</h3>
                <p className="muted">{slotDateLabel}</p>
              </div>
              <button className="button button-ghost" type="button" onClick={closeSlotModal}>
                Close
              </button>
            </div>

            <div className="slot-meta">
              <div>
                <span className="kpi-label">Starts</span>
                <div>{formatDateTime(slotModal.startAt)}</div>
              </div>
              <div>
                <span className="kpi-label">Ends</span>
                <div>{formatDateTime(slotModal.endAt)}</div>
              </div>
            </div>

            {slotStatus.message ? (
              <div className={`notice ${slotStatus.tone ? `is-${slotStatus.tone}` : ""}`.trim()}>
                {slotStatus.message}
              </div>
            ) : null}

            {isExternalBooking ? (
              <div className="notice">
                This appointment is synced from Google Calendar and can only be edited there.
              </div>
            ) : null}

            {isSlotBlocked ? (
              <div className="notice">
                This slot is blocked due to a holiday or being in the past.
              </div>
            ) : null}

            <form
              className="slot-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSlotSave();
              }}
            >
              <label className="form-field">
                <span>Title</span>
                <input
                  className="input"
                  type="text"
                  value={slotForm.title}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Customer appointment"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <label className="form-field">
                <span>Attendee name</span>
                <input
                  className="input"
                  type="text"
                  value={slotForm.attendeeName}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, attendeeName: event.target.value }))
                  }
                  placeholder="Full name"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <label className="form-field">
                <span>Attendee email</span>
                <input
                  className="input"
                  type="email"
                  value={slotForm.attendeeEmail}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, attendeeEmail: event.target.value }))
                  }
                  placeholder="name@email.com"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <label className="form-field">
                <span>Location</span>
                <input
                  className="input"
                  type="text"
                  value={slotForm.location}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="Zoom, phone, or office"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <SelectField
                  fieldClassName="form-field"
                  label="Status"
                  value={slotForm.status}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                >
                  {BOOKING_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </SelectField>
              <label className="form-field">
                <span>Notes</span>
                <textarea
                  className="input"
                  value={slotForm.description}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Add any notes for this appointment"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <div className="slot-form__actions">
                <button className="button button-ghost" type="button" onClick={closeSlotModal}>
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                >
                  {isSlotSaving ? "Saving..." : "Save appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}


      {canUseAccounting ? (
        <section className="glass-card panel stack dashboard-module-panel dashboard-accounting-snapshot">
          <div className="panel-header">
            <div>
              <h3>Accounting snapshot</h3>
            </div>
          </div>

        {accountingError ? (
          <div className="notice is-error" role="alert">
            {accountingError}
          </div>
        ) : null}

        {accountingLoading ? (
          <AnimatedLoadingState compact title="Loading accounting summary" />
        ) : null}

        {!accountingLoading && accountingSummary ? (
          <div className="kpi-grid">
            <KPICard
              label="Paid revenue"
              value={formatGhsAmount(accountingSummary.paidRevenueGhs)}
              delta={`${accountingSummary.counts.paidRevenue} paid`}
            />
            <KPICard
              label="Paid expenses"
              value={formatGhsAmount(accountingSummary.paidExpensesGhs)}
              delta={`${accountingSummary.counts.paidExpenses} paid`}
            />
            <KPICard
              label="Net profit"
              value={formatGhsAmount(accountingNetTotals ?? 0)}
              delta="After paid expenses"
            />
            <KPICard
              label="Pending payables"
              value={formatGhsAmount(accountingSummary.pendingPayablesGhs)}
              delta={`${accountingSummary.counts.pendingPayables} pending`}
            />
          </div>
        ) : null}

          <ModulePanelLink to="/accounting" label="Open accounting module" />
        </section>
      ) : null}

      {kpiData ? (
        <>
          <div className="kpi-grid">
            {[
              {
                id: "orgs",
                label: "Organizations",
                value: kpiData.totalOrganizations,
                delta: organizationManagedSummary,
              },
              {
                id: "services",
                label: "Services healthy",
                value: formatRatio(healthyServices, totalServices),
                delta: `${serviceHealthPercent}% healthy`,
              },
              {
                id: "sites",
                label: "Surfaces online",
                value: formatRatio(onlineSites, totalSites),
                delta: `${siteHealthPercent}% uptime`,
              },
              {
                id: "pages",
                label: "Pages online",
                value: formatRatio(onlinePages, totalPages),
                delta: `${pageHealthPercent}% uptime`,
              },
            ].map((card) => (
              <KPICard
                key={card.id}
                label={card.label}
                value={card.value ?? "N/A"}
                delta={card.delta}
                tone={card.tone}
              />
            ))}
          </div>

          <div className="panel-grid">
            {[
              {
                id: "service-health",
                label: "Service health",
                value: serviceHealthPercent,
                hint: `${healthyServices}/${totalServices} services healthy`,
              },
              {
                id: "site-health",
                label: "Surface health",
                value: siteHealthPercent,
                hint: `${onlineSites}/${totalSites} surfaces online`,
              },
              {
                id: "tracked-organizations",
                label: "Tracked organizations",
                value: kpiData.totalOrganizations ?? 0,
                hint: `${topLevelOrganizations} top-level • ${childOrganizations} child orgs`,
              },
            ].map((insight) => (
              <article className="panel bubble-card metric-card" key={insight.id}>
                <span className="kpi-label">{insight.label}</span>
                <div className="kpi-value">{insight.value}</div>
                <span className="muted">{insight.hint}</span>
              </article>
            ))}
          </div>

          <div className="dashboard-grid">
            <article className="glass-card panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Organization hierarchy</h3>
                </div>
              </div>
              <div className="glass-card data-table">
                <div className="table-row table-head is-5">
                  <span>Organization</span>
                  <span>Parent</span>
                  <span>Child orgs</span>
                  <span>Manages</span>
                  <span>Status</span>
                </div>
                {organizations.map((organization) => (
                  <div className="table-row is-5" key={organization.id}>
                    <div className="table-cell-stack">
                      <span className="table-strong">{organization.name}</span>
                      <span className="muted">{organization.slug}</span>
                    </div>
                    <span>{organization.parentOrganizationName || "—"}</span>
                    <span>{organization.childOrganizationsCount ?? 0}</span>
                    <span>{organization.managedOrganizationsCount ?? 0}</span>
                    {renderStatusPill(organization.status)}
                  </div>
                ))}
              </div>
            </article>

            <article className="panel panel-span-3">
              <div className="panel-header">
                <div>
                  <h3>Operational snapshot</h3>
                  <p className="muted">What is affected, where to look, and what to check first.</p>
                </div>
              </div>
              <div className="dashboard-health-grid">
                {operationalSnapshotCards.map((card) => (
                  <article className={`dashboard-health-card is-${card.tone}`} key={card.id}>
                    <div className="dashboard-health-card__header">
                      <div>
                        <span className="kpi-label">{card.label}</span>
                        <strong>{card.headline}</strong>
                      </div>
                      {renderStatusPill(card.status)}
                    </div>
                    <p className="dashboard-health-card__summary">{card.summary}</p>
                    <div className="dashboard-health-card__metrics">
                      <span>{card.primaryMetric}</span>
                      <span>{card.secondaryMetric}</span>
                    </div>
                    {card.issues.length ? (
                      <ul className="dashboard-health-card__issues">
                        {card.issues.slice(0, MONITORING_PREVIEW_LIMIT).map((issue) => (
                          <li key={issue.id}>
                            <div>
                              <strong>{issue.label}</strong>
                              <span>{issue.detail}</span>
                            </div>
                            {renderStatusPill(issue.status)}
                          </li>
                        ))}
                        {card.hiddenIssueCount ? (
                          <li className="dashboard-health-card__more">
                            +{card.hiddenIssueCount} more check{card.hiddenIssueCount === 1 ? "" : "s"}
                          </li>
                        ) : null}
                      </ul>
                    ) : (
                      <p className="dashboard-health-card__empty">No issues in this group.</p>
                    )}
                    <div className="dashboard-health-card__next">
                      <span>Next check</span>
                      <strong>{card.nextStep}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="bubble-card panel">
              <div className="panel-header">
                <div>
                  <h3>Attention required</h3>
                </div>
              </div>
              <div className="list">
                {attentionItems.length ? (
                  attentionItems.map((item) => (
                    <div className="list-row is-split" key={item.id}>
                      <div className="table-cell-stack">
                        <span className="table-strong">{item.label}</span>
                        <span className="muted">{item.note}</span>
                      </div>
                      {renderStatusPill(item.status)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No alerts right now.</p>
                )}
              </div>
            </article>

            <article className="glass-card panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>System status</h3>
                  <p className="muted">APIs and databases with the reason each state matters.</p>
                </div>
              </div>
              <div className="dashboard-diagnosis-list">
                {systemDiagnosisRows.map((row) => (
                  <article className={`dashboard-diagnosis-row is-${row.tone}`} key={row.id}>
                    <span className="dashboard-diagnosis-row__marker" aria-hidden="true" />
                    <div className="dashboard-diagnosis-row__main">
                      <div className="dashboard-diagnosis-row__title">
                        <strong>{row.label}</strong>
                        {renderStatusPill(row.status)}
                      </div>
                      <span className="muted">{row.note}</span>
                      <p>{row.explanation}</p>
                    </div>
                    <div className="dashboard-diagnosis-row__next">
                      <span>Next check</span>
                      <strong>{row.nextStep}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="glass-card panel panel-span-3">
              <div className="panel-header">
                <div>
                  <h3>Activity timeline</h3>
                  <p className="muted">
                    {activityLoading
                      ? "Loading..."
                      : `${timelineEvents.length} event${timelineEvents.length !== 1 ? "s" : ""} · ${activityActiveUsers} active user${activityActiveUsers !== 1 ? "s" : ""} · ${rangeDescription}`}
                  </p>
                </div>
              </div>
              <TerminalLogStream
                entries={terminalTimelineEvents}
                emptyMessage={
                  activityLoading ? "Loading activity..." : "No activity logged in this window."
                }
                isLive
                isRefreshing={activityLoading}
                lastUpdatedAt={activityLastUpdatedAt}
                ariaLabel="Dashboard activity terminal log"
              />
            </article>
          </div>

          <section className="glass-card panel site-status" id="site-status">
            <div className="panel-header">
              <div>
                <h3>Website and portal health</h3>
              </div>
            </div>
            <div className="site-grid">
              {orderedSites.length ? (
                orderedSites.map((site) => {
                  const isExpanded = Boolean(expandedSites[site.id]);
                  const listId = `site-pages-${site.id}`;
                  return (
                    <article
                      key={site.id}
                      className={`bubble-card site-card is-${site.tone} ${site.category}`.trim()}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      aria-controls={listId}
                      onClick={() => toggleSiteExpansion(site.id)}
                      onKeyDown={(event) => handleSiteCardKeyDown(event, site.id)}
                    >
                      <div className="site-card__header">
                        <div className="site-card__meta">
                          <span className="table-strong">{site.title}</span>
                          <span className="muted">
                            {site.aggregateStatus === "not_configured"
                              ? "URL not configured"
                              : `${site.summary.configured}/${site.summary.total} endpoints configured`}
                          </span>
                        </div>
                      </div>
                      <div className="site-card__telemetry">
                        <div className="site-card__score">
                          <strong>
                            {site.aggregateStatus === "not_configured" ? "--" : `${site.score}%`}
                          </strong>
                          <span>surface score</span>
                        </div>
                        <div className="site-card__spark">
                          <MonitoringSparkline
                            values={site.sparkline}
                            status={site.aggregateStatus}
                            label={`${site.title} health sparkline`}
                          />
                        </div>
                      </div>
                      <div className="site-card__chips" aria-label={`${site.title} endpoint mix`}>
                        <span className="site-card__chip is-success">
                          {site.summary.online} online
                        </span>
                        {site.summary.degraded ? (
                          <span className="site-card__chip is-warning">
                            {site.summary.degraded} degraded
                          </span>
                        ) : null}
                        {site.summary.offline ? (
                          <span className="site-card__chip is-danger">
                            {site.summary.offline} offline
                          </span>
                        ) : null}
                        {site.summary.notConfigured ? (
                          <span className="site-card__chip">
                            {site.summary.notConfigured} missing URL
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="muted">No site checks yet.</p>
              )}
            </div>
            {notConfiguredSites ? (
              <p className="muted">
                {notConfiguredSites} optional app URL{notConfiguredSites === 1 ? "" : "s"} not
                configured.
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
};

export default Dashboard;
