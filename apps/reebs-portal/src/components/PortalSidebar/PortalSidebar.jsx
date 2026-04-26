/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useState, useEffect, useRef } from "react";
import { SidebarEdgeToggle, useSidebarCollapsedState } from "@faako/ui";
import "./PortalSidebar.css";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  ADMIN_PREFERENCES_CHANGE_EVENT,
  applyAdminPreferences,
  readAdminPreferences,
  resolveAdminTheme,
  writeAdminPreferences,
} from "../../utils/adminPreferences";
import {
  faBars,
  faBullhorn,
  faCalendarDays,
  faChartLine,
  faClock,
  faClipboardList,
  faFileInvoiceDollar,
  faFileLines,
  faGlobe,
  faHome,
  faMoneyCheckDollar,
  faReceipt,
  faShieldAlt,
  faSliders,
  faStore,
  faTools,
  faTruck,
  faUser,
  faUserGroup,
  faUserTie,
  faUsers,
  faSun,
  faMoon,
  faChevronDown,
  faBell,
  faBoxesStacked,
  faCalendarCheck,
  faXmark,
  faArrowRightFromBracket,
  faArrowRightToBracket,
  faExternalLinkAlt,
  faMagnifyingGlass,
} from "/src/icons/iconSet";
import { useAuth } from "../AuthContext/AuthContext";
import { WEBSITE_URL } from "../../utils/website";
import { DASHBOARD_PATHS } from "../../utils/adminDashboardLinks";
import {
  canAccessPortalBookings,
  canAccessPortalCustomerDirectory,
  canAccessPortalInventory,
  canAccessPortalNavigationItem,
  canAccessPortalOrders,
  canAccessPrivilegedPortalArea,
  isWaterPortalRole,
} from "../../utils/adminAccess";

const MOBILE_QUERY = "(max-width: 720px)";
const REEBS_PORTAL_LOGO_LIGHT = "/imgs/brand/reebs_logo2.svg";
const REEBS_PORTAL_LOGO_DARK = "/imgs/icons/logo2-white.svg";
const ADMIN_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const getSearchShortcutLabel = () => {
  if (typeof navigator === "undefined") return "Ctrl K";
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "Cmd K" : "Ctrl K";
};

const DEFAULT_APPS = [
  {
    label: "Dashboard",
    path: "/admin",
    matchPaths: ["/admin"],
    icon: faHome,
  },
  {
    label: "Website",
    path: WEBSITE_URL,
    icon: faGlobe,
    external: true,
    description: "Open the public website",
    roles: ["admin", "manager"],
  },
  {
    label: "Inventory",
    path: "/admin/inventory",
    icon: faBoxesStacked,
  },
  {
    label: "Rentals",
    path: "/admin/rentals",
    icon: faBoxesStacked,
  },
  {
    label: "POS",
    path: "/admin/store-mode",
    icon: faReceipt,
  },
  {
    label: "CRM",
    path: "/admin/crm",
    matchPaths: ["/admin/crm", "/admin/customers"],
    icon: faUserGroup,
  },
  {
    label: "Orders",
    path: "/admin/orders",
    matchPaths: ["/admin/orders", "/admin/orders/new"],
    icon: faClipboardList,
  },
  {
    label: "Bookings",
    path: "/admin/bookings",
    icon: faCalendarDays,
    roles: ["admin", "manager"],
  },
  {
    label: "Scheduling",
    path: "/admin/schedule",
    icon: faCalendarCheck,
    roles: ["admin", "manager"],
  },
  {
    label: "Accounting",
    path: "/admin/accounting",
    icon: faChartLine,
    roles: ["admin", "manager"],
  },
  {
    label: "Invoicing",
    path: "/admin/invoicing",
    icon: faFileInvoiceDollar,
    roles: ["admin", "manager"],
  },
  {
    label: "Directory",
    path: "/admin/directory",
    matchPaths: ["/admin/directory", "/admin/users", "/admin/employees"],
    icon: faUsers,
  },
  {
    label: "Expenses",
    path: "/admin/expenses",
    icon: faMoneyCheckDollar,
    roles: ["admin", "manager"],
  },
  {
    label: "Water",
    path: "/admin/water",
    icon: faStore,
    roles: ["admin", "manager"],
  },
  {
    label: "Human Resources",
    path: "/admin/hr",
    icon: faUserTie,
    roles: ["admin", "manager"],
  },
  {
    label: "Vendors",
    path: "/admin/vendors",
    icon: faStore,
    roles: ["admin", "manager"],
  },
  {
    label: "Maintenance",
    path: "/admin/maintenance",
    icon: faTools,
  },
  {
    label: "Delivery",
    path: "/admin/delivery",
    icon: faTruck,
    roles: ["admin", "manager"],
  },
  {
    label: "Documents",
    path: "/admin/documents",
    icon: faFileLines,
    roles: ["admin", "manager"],
  },
  {
    label: "Timesheets",
    path: "/admin/timesheets",
    icon: faClock,
  },
  {
    label: "Users",
    path: "/admin/roles",
    icon: faShieldAlt,
    roles: ["admin", "manager"],
  },
  {
    label: "Marketing",
    path: "/admin/marketing",
    icon: faBullhorn,
    roles: ["admin", "manager"],
  },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: faSliders,
    matchPaths: ["/admin/settings", "/admin/advanced", "/admin/website-template"],
    roles: ["admin", "manager"],
  },
];

const normalizePath = (pathname) => {
  if (!pathname) return "/admin";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/admin";
};

const sortPortalApps = (list = []) =>
  [...list].sort((left, right) => {
    const leftIsDashboard = normalizePath(left?.path) === "/admin";
    const rightIsDashboard = normalizePath(right?.path) === "/admin";
    if (leftIsDashboard && !rightIsDashboard) return -1;
    if (!leftIsDashboard && rightIsDashboard) return 1;
    return String(left?.label || "").localeCompare(String(right?.label || ""), undefined, {
      sensitivity: "base",
    });
  });

const buildPathWithParams = (basePath, params = {}) => {
  const [pathname, baseSearch = ""] = String(basePath || "").split("?");
  const searchParams = new URLSearchParams(baseSearch);
  Object.entries(params).forEach(([key, value]) => {
    const normalized = value == null ? "" : String(value).trim();
    if (!normalized) {
      searchParams.delete(key);
      return;
    }
    searchParams.set(key, normalized);
  });
  const nextSearch = searchParams.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
};

const getResolvedAdminTheme = (userId) => {
  const storedPreferences = readAdminPreferences(userId);
  const rootTheme =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-admin-theme")
      : "";

  if (rootTheme === "light" || rootTheme === "dark") {
    return rootTheme;
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return resolveAdminTheme(storedPreferences.theme, window.matchMedia(ADMIN_THEME_MEDIA_QUERY));
  }

  return storedPreferences.theme === "dark" ? "dark" : "light";
};

const NOTIFICATION_WINDOW_DAYS = 21;

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isRecent = (date, days = NOTIFICATION_WINDOW_DAYS) => {
  if (!date) return false;
  const diff = Date.now() - date.getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
};

const formatNotificationTime = (date) => {
  if (!date) return "";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((date - startOfDay) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

function PortalSidebar({ apps = DEFAULT_APPS }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchFieldRef = useRef(null);
  const pendingSearchFocusRef = useRef(false);
  const notificationsRef = useRef(null);
  const notificationsPanelRef = useRef(null);
  const userMenuRef = useRef(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useSidebarCollapsedState({
    storageKey: "reebs-portal.sidebar-collapsed",
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationPayload, setNotificationPayload] = useState({ orders: [], bookings: [] });
  const [readNotifications, setReadNotifications] = useState(() => new Set());
  const [navQuery, setNavQuery] = useState("");
  const [searchPayload, setSearchPayload] = useState({
    customers: [],
    inventory: [],
    orders: [],
    bookings: [],
  });
  const [searchLoaded, setSearchLoaded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const { user, logout, authReady } = useAuth();
  const activeAdminUserId = authReady ? user?.id : undefined;
  const [resolvedAdminTheme, setResolvedAdminTheme] = useState(() =>
    getResolvedAdminTheme(activeAdminUserId)
  );
  const isAuthenticated = Boolean(user);
  const userRole = String(user?.role || "staff").toLowerCase();
  const isWaterUser = isWaterPortalRole(userRole);
  const canSearchInvoices = canAccessPrivilegedPortalArea(userRole);
  const canAccessCustomers = canAccessPortalCustomerDirectory(userRole);
  const canAccessInventoryRecords = canAccessPortalInventory(userRole);
  const canAccessOrdersModule = canAccessPortalOrders(userRole);
  const canAccessBookingsModule = canAccessPortalBookings(userRole);
  const canViewNotifications = canAccessOrdersModule || canAccessBookingsModule;
  const authLabel = isAuthenticated ? "Sign out" : "Sign in";
  const authIcon = isAuthenticated ? faArrowRightFromBracket : faArrowRightToBracket;
  const displayName =
    user?.name ||
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    (authReady ? "Not signed in" : "Loading...");
  const displayEmail = user?.personalEmail || user?.email || (authReady ? "Sign in required" : "Loading...");
  const userAvatarSrc = String(user?.imageUrl || user?.profilePhoto || "").trim();
  const userInitials = isAuthenticated
    ? displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "TM"
    : authReady
      ? "SI"
      : "..";
  const readStorageKey = useMemo(
    () => `reebs_notifications_read_${user?.id || "guest"}`,
    [user?.id]
  );
  const searchShortcutLabel = useMemo(() => getSearchShortcutLabel(), []);
  const portalLogoSrc =
    resolvedAdminTheme === "dark" ? REEBS_PORTAL_LOGO_DARK : REEBS_PORTAL_LOGO_LIGHT;
  const expanded = !isSidebarCollapsed;

  const normalizedPath = useMemo(() => normalizePath(location.pathname), [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    setResolvedAdminTheme(getResolvedAdminTheme(activeAdminUserId));
  }, [activeAdminUserId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(ADMIN_THEME_MEDIA_QUERY);
    const syncTheme = () => {
      setResolvedAdminTheme(getResolvedAdminTheme(activeAdminUserId));
    };
    const handlePreferencesChange = (event) => {
      const changedUserId = String(event?.detail?.userId || "guest");
      const currentUserId = String(activeAdminUserId || "guest");
      if (changedUserId !== currentUserId) return;
      syncTheme();
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncTheme);
    } else {
      mediaQuery.addListener(syncTheme);
    }
    window.addEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", syncTheme);
      } else {
        mediaQuery.removeListener(syncTheme);
      }
      window.removeEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);
    };
  }, [activeAdminUserId]);

  useEffect(() => {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setOverlayOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobile) return;
    setOverlayOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleMouseDown = (event) => {
      const target = event.target;
      const clickedNotificationToggle =
        notificationsRef.current && notificationsRef.current.contains(target);
      const clickedNotificationPanel =
        notificationsPanelRef.current && notificationsPanelRef.current.contains(target);
      if (!clickedNotificationToggle && !clickedNotificationPanel) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    if (!isMobile || !overlayOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOverlayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, overlayOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;

      event.preventDefault();
      pendingSearchFocusRef.current = true;

      if (isMobile) {
        setOverlayOpen(true);
        return;
      }

      if (!expanded) {
        setIsSidebarCollapsed(false);
        return;
      }

      searchFieldRef.current?.focus();
      searchFieldRef.current?.select?.();
      pendingSearchFocusRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded, isMobile, setIsSidebarCollapsed]);

  useEffect(() => {
    if (!pendingSearchFocusRef.current) return;
    if (isMobile && !overlayOpen) return;
    if (!isMobile && !expanded) return;
    if (typeof window === "undefined") return undefined;

    const frame = window.requestAnimationFrame(() => {
      searchFieldRef.current?.focus();
      searchFieldRef.current?.select?.();
      pendingSearchFocusRef.current = false;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expanded, isMobile, overlayOpen]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !canViewNotifications) {
      setNotificationPayload({ orders: [], bookings: [] });
      setNotificationsError("");
      setNotificationsLoading(false);
      setReadNotifications(new Set());
      return;
    }

    let active = true;
    const fetchNotifications = async () => {
      setNotificationsLoading(true);
      setNotificationsError("");
      try {
        const requests = [
          canAccessOrdersModule ? { key: "orders", path: "/.netlify/functions/orders" } : null,
          canAccessBookingsModule ? { key: "bookings", path: "/.netlify/functions/bookings" } : null,
        ].filter(Boolean);
        const settled = await Promise.all(
          requests.map(async (request) => {
            const response = await fetch(request.path);
            const data = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(data?.error || `Failed to load ${request.key}.`);
            }
            return { key: request.key, data: Array.isArray(data) ? data : [] };
          })
        );

        if (active) {
          const nextPayload = { orders: [], bookings: [] };
          settled.forEach((entry) => {
            nextPayload[entry.key] = entry.data;
          });
          setNotificationPayload({
            orders: nextPayload.orders,
            bookings: nextPayload.bookings,
          });
        }
      } catch (err) {
        console.error("Failed to load notifications", err);
        if (active) {
          setNotificationsError(err.message || "Unable to load notifications.");
        }
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    fetchNotifications();
    return () => {
      active = false;
    };
  }, [authReady, canAccessBookingsModule, canAccessOrdersModule, canViewNotifications, isAuthenticated]);

  useEffect(() => {
    if (authReady && isAuthenticated) return;
    setSearchPayload({ customers: [], inventory: [], orders: [], bookings: [] });
    setSearchLoaded(false);
    setSearchLoading(false);
    setSearchError("");
  }, [authReady, isAuthenticated]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return undefined;
    if (!navQuery.trim() || searchLoaded || searchLoading) return undefined;

    let active = true;

    const fetchSearchData = async () => {
      setSearchLoading(true);
      setSearchError("");
      const requests = [
        canAccessCustomers
          ? { key: "customers", label: "customers", path: "/.netlify/functions/customers" }
          : null,
        canAccessInventoryRecords
          ? { key: "inventory", label: "inventory", path: "/.netlify/functions/inventory" }
          : null,
        canAccessOrdersModule
          ? { key: "orders", label: "orders", path: "/.netlify/functions/orders" }
          : null,
        canAccessBookingsModule
          ? { key: "bookings", label: "bookings", path: "/.netlify/functions/bookings" }
          : null,
      ].filter(Boolean);

      if (!requests.length) {
        setSearchPayload({ customers: [], inventory: [], orders: [], bookings: [] });
        setSearchLoaded(true);
        setSearchLoading(false);
        return;
      }

      try {
        const settled = await Promise.allSettled(requests.map((request) => fetch(request.path)));
        const nextPayload = { customers: [], inventory: [], orders: [], bookings: [] };
        const errors = [];

        for (let index = 0; index < settled.length; index += 1) {
          const result = settled[index];
          const request = requests[index];
          if (result.status !== "fulfilled") {
            errors.push(`Unable to load ${request.label}.`);
            continue;
          }
          const response = result.value;
          const data = await response.json().catch(() => null);
          if (!response.ok) {
            errors.push(data?.error || `Unable to load ${request.label}.`);
            continue;
          }
          nextPayload[request.key] = Array.isArray(data) ? data : [];
        }

        if (!active) return;
        setSearchPayload(nextPayload);
        setSearchLoaded(true);
        setSearchError(errors[0] || "");
      } catch (err) {
        if (!active) return;
        console.error("Failed to load sidebar search data", err);
        setSearchLoaded(true);
        setSearchError(err.message || "Unable to load search data.");
      } finally {
        if (active) setSearchLoading(false);
      }
    };

    fetchSearchData();
    return () => {
      active = false;
    };
  }, [
    authReady,
    canAccessBookingsModule,
    canAccessCustomers,
    canAccessInventoryRecords,
    canAccessOrdersModule,
    isAuthenticated,
    navQuery,
    searchLoaded,
    searchLoading,
  ]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(readStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setReadNotifications(new Set(parsed));
      }
    } catch (err) {
      console.warn("Failed to load notification state", err);
    }
  }, [authReady, isAuthenticated, readStorageKey]);

  const isActive = (app) => {
    if (app.external) return false;
    const matchPaths = app.matchPaths ?? [app.path];
    return matchPaths.some((path) => {
      if (!path) return false;
      const normalized = path.replace(/\/+$/, "") || "/admin";
      return (
        normalized === normalizedPath ||
        (normalized !== "/" && normalizedPath.startsWith(normalized))
      );
    });
  };

  const canSeeApp = (app) => {
    if (!isAuthenticated) return false;
    return canAccessPortalNavigationItem(userRole, app);
  };

  const visibleApps = useMemo(
    () => sortPortalApps(apps.filter((app) => canSeeApp(app))),
    [apps, isAuthenticated, isWaterUser, userRole]
  );

  const moduleSearchResults = useMemo(() => {
    const term = navQuery.trim().toLowerCase();
    if (!term) return [];

    return visibleApps.filter((app) =>
      [app.label, app.description, app.path]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [navQuery, visibleApps]);

  const recordSearchResults = useMemo(() => {
    const needle = navQuery.trim().toLowerCase();
    if (!needle || !isAuthenticated) return [];

    const matchesText = (value) => String(value || "").toLowerCase().includes(needle);
    const pushMatches = (target, list, buildItem, limit) => {
      for (const row of list) {
        if (target.length >= limit) break;
        const nextItem = buildItem(row);
        if (!nextItem) continue;
        if (target.some((item) => item.key === nextItem.key)) continue;
        target.push(nextItem);
      }
    };

    const orders = searchLoaded ? searchPayload.orders : notificationPayload.orders;
    const bookings = searchLoaded ? searchPayload.bookings : notificationPayload.bookings;
    const results = [];

    pushMatches(
      results,
      canAccessCustomers
        ? searchPayload.customers.filter((customer) =>
            matchesText(customer?.name) || matchesText(customer?.phone) || matchesText(customer?.email)
          )
        : [],
      (customer) => ({
        key: `customer-${customer.id}`,
        kind: "Customer",
        title: customer.name || `Customer #${customer.id}`,
        meta: [customer.phone, customer.email].filter(Boolean).join(" • ") || "Open customer record",
        path: buildPathWithParams(DASHBOARD_PATHS.customerDirectory, { id: customer.id }),
        icon: faUserGroup,
      }),
      3
    );

    pushMatches(
      results,
      canAccessOrdersModule
        ? orders.filter((order) =>
            matchesText(order?.orderNumber) || matchesText(order?.customerName) || matchesText(order?.status)
          )
        : [],
      (order) => ({
        key: `order-${order.id}`,
        kind: "Order",
        title: order.orderNumber || `Order #${order.id}`,
        meta: order.customerName ? `Customer: ${order.customerName}` : "Open order",
        path: buildPathWithParams(DASHBOARD_PATHS.orders, { id: order.id }),
        icon: faClipboardList,
      }),
      6
    );

    pushMatches(
      results,
      canAccessBookingsModule
        ? bookings.filter((booking) =>
            matchesText(booking?.id) || matchesText(booking?.customerName) || matchesText(booking?.status)
          )
        : [],
      (booking) => ({
        key: `booking-${booking.id}`,
        kind: "Booking",
        title: `Booking #${booking.id}`,
        meta: booking.customerName ? `Client: ${booking.customerName}` : "Open booking",
        path: buildPathWithParams("/admin/bookings", { id: booking.id }),
        icon: faCalendarDays,
      }),
      9
    );

    pushMatches(
      results,
      canAccessInventoryRecords
        ? searchPayload.inventory.filter((item) =>
            matchesText(item?.name) || matchesText(item?.sku) || matchesText(item?.barcode)
          )
        : [],
      (item) => ({
        key: `product-${item.id}`,
        kind: "Product",
        title: item.name || `Product #${item.id}`,
        meta: item.sku ? `SKU: ${item.sku}` : "Open product inventory",
        path: buildPathWithParams(DASHBOARD_PATHS.inventory, { q: item.name || item.sku || item.id }),
        icon: faBoxesStacked,
      }),
      12
    );

    if (canSearchInvoices && canAccessOrdersModule) {
      pushMatches(
        results,
        orders.filter((order) =>
          matchesText(order?.orderNumber) || matchesText(order?.customerName)
        ),
        (order) => ({
          key: `invoice-order-${order.id}`,
          kind: "Invoice",
          title: `Receipt ${order.orderNumber || `#${order.id}`}`,
          meta: order.customerName ? `Receipt for ${order.customerName}` : "Open order receipt",
          path: `/admin/invoicing?type=orders&id=${order.id}`,
          icon: faFileInvoiceDollar,
        }),
        14
      );
    }
    if (canSearchInvoices && canAccessBookingsModule) {
      pushMatches(
        results,
        bookings.filter((booking) =>
          matchesText(booking?.id) || matchesText(booking?.customerName)
        ),
        (booking) => ({
          key: `invoice-booking-${booking.id}`,
          kind: "Invoice",
          title: `Invoice for Booking #${booking.id}`,
          meta: booking.customerName ? `Rental invoice for ${booking.customerName}` : "Open booking invoice",
          path: `/admin/invoicing?type=bookings&id=${booking.id}`,
          icon: faFileInvoiceDollar,
        }),
        16
      );
    }

    return results.slice(0, 8);
  }, [
    canSearchInvoices,
    canAccessBookingsModule,
    canAccessCustomers,
    canAccessInventoryRecords,
    canAccessOrdersModule,
    isAuthenticated,
    navQuery,
    notificationPayload.bookings,
    notificationPayload.orders,
    searchLoaded,
    searchPayload.bookings,
    searchPayload.customers,
    searchPayload.inventory,
    searchPayload.orders,
  ]);

  const handleSearchNavigate = (item) => {
    setNavQuery("");
    setUserMenuOpen(false);
    if (isMobile) {
      setOverlayOpen(false);
    }
    if (item.external) {
      if (typeof window !== "undefined") {
        window.open(item.path, "_blank", "noopener,noreferrer");
      }
      return;
    }
    navigate(item.path);
  };

  const renderSearch = (context = "sidebar") => (
    <label
      className={`portal-sidebar__search portal-sidebar__search--${context}`}
      htmlFor={`portal-sidebar-search-${context}`}
    >
      <AppIcon icon={faMagnifyingGlass} className="portal-sidebar__search-icon" />
      <input
        id={`portal-sidebar-search-${context}`}
        ref={searchFieldRef}
        type="text"
        className="portal-sidebar__search-input"
        value={navQuery}
        onChange={(event) => setNavQuery(event.target.value)}
        placeholder="Search"
        enterKeyHint="search"
        autoComplete="off"
      />
      <span className="portal-sidebar__search-hint">{searchShortcutLabel}</span>
    </label>
  );

  const renderSearchRow = (context = "sidebar") => {
    const toolbarContext = `${context}-toolbar`;
    return (
      <div className={`portal-sidebar__search-stack portal-sidebar__search-stack--${context}`}>
        <div className={`portal-sidebar__search-row portal-sidebar__search-row--${context}`}>
          {renderSearch(context)}
          {renderNotifications(toolbarContext)}
        </div>
        {renderNotificationsPanel(toolbarContext)}
      </div>
    );
  };

  const renderLinks = (context = "sidebar") => (
    visibleApps.length > 0 ? (
      <ul className={`portal-sidebar__list portal-sidebar__list--${context}`}>
        {visibleApps.map((app) => {
        const active = isActive(app);
        const linkClasses = ["portal-sidebar__link", active ? "is-active" : ""]
          .filter(Boolean)
          .join(" ");
        if (app.external) {
          return (
            <li key={app.label} className={active ? "is-active" : undefined}>
              <a
                href={app.path}
                target="_blank"
                rel="noreferrer"
                className={linkClasses}
                title={app.label}
                aria-label={`${app.label}: ${app.description || "Opens in new tab"}`}
                onClick={() => {
                  setUserMenuOpen(false);
                  if (isMobile) setOverlayOpen(false);
                }}
              >
                <span className="portal-sidebar__link-main">
                  <span className="portal-sidebar__link-icon" aria-hidden="true">
                    <AppIcon icon={app.icon} />
                  </span>
                  <span className="portal-sidebar__link-label">{app.label}</span>
                </span>
                <AppIcon
                  icon={faExternalLinkAlt}
                  className="portal-sidebar__link-trailing"
                  aria-hidden="true"
                />
              </a>
            </li>
          );
        }
        return (
          <li key={app.label} className={active ? "is-active" : undefined}>
            <Link
              to={app.path}
              className={linkClasses}
              title={app.label}
              onClick={() => {
                setUserMenuOpen(false);
                if (isMobile && overlayOpen) setOverlayOpen(false);
              }}
            >
              <span className="portal-sidebar__link-main">
                <span className="portal-sidebar__link-icon" aria-hidden="true">
                  <AppIcon icon={app.icon} />
                </span>
                <span className="portal-sidebar__link-label">{app.label}</span>
              </span>
            </Link>
          </li>
        );
        })}
      </ul>
    ) : (
      <p className="portal-sidebar__empty" role="status" aria-live="polite">
        {navQuery.trim()
          ? `No modules match "${navQuery.trim()}".`
          : isAuthenticated
            ? "No portal modules are available."
            : "Sign in to view portal modules."}
      </p>
    )
  );

  const renderSearchResults = (context = "sidebar") => {
    const trimmedQuery = navQuery.trim();
    if (!trimmedQuery || !isAuthenticated) {
      return renderLinks(context);
    }

    const moduleResults = moduleSearchResults
      .slice(0, 4)
      .map((app) => ({
        key: `module-${app.label}`,
        kind: "Module",
        title: app.label,
        meta: app.description || app.path,
        path: app.path,
        icon: app.icon,
        external: Boolean(app.external),
      }));
    const hasResults = recordSearchResults.length > 0 || moduleResults.length > 0;

    return (
      <div className={`portal-sidebar__search-results portal-sidebar__search-results--${context}`}>
        {searchLoading && (
          <p className="portal-sidebar__search-status">Searching customers, orders, bookings, inventory, and modules...</p>
        )}
        {searchError && (
          <p className="portal-sidebar__search-status is-warning">{searchError}</p>
        )}
        {recordSearchResults.length > 0 && (
          <div className="portal-sidebar__search-group">
            <p className="portal-sidebar__search-section-label">Records</p>
            <ul className="portal-sidebar__search-list">
              {recordSearchResults.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className="portal-sidebar__search-result"
                    onClick={() => handleSearchNavigate(item)}
                  >
                    <span className="portal-sidebar__search-result-icon" aria-hidden="true">
                      <AppIcon icon={item.icon} />
                    </span>
                    <span className="portal-sidebar__search-result-copy">
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </span>
                    <span className="portal-sidebar__search-result-kind">{item.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {moduleResults.length > 0 && (
          <div className="portal-sidebar__search-group">
            <p className="portal-sidebar__search-section-label">Modules</p>
            <ul className="portal-sidebar__search-list">
              {moduleResults.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className="portal-sidebar__search-result"
                    onClick={() => handleSearchNavigate(item)}
                  >
                    <span className="portal-sidebar__search-result-icon" aria-hidden="true">
                      <AppIcon icon={item.icon} />
                    </span>
                    <span className="portal-sidebar__search-result-copy">
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </span>
                    <span className="portal-sidebar__search-result-kind">{item.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!searchLoading && !hasResults && (
          <p className="portal-sidebar__empty" role="status" aria-live="polite">
            No records or modules match "{trimmedQuery}".
          </p>
        )}
      </div>
    );
  };

  const handleSignOut = () => {
    logout();
    setUserMenuOpen(false);
    if (isMobile) {
      setOverlayOpen(false);
    }
    navigate("/login", { replace: true, state: { signedOut: true } });
  };

  const handleAuthAction = () => {
    if (!isAuthenticated) {
      setUserMenuOpen(false);
      if (isMobile) {
        setOverlayOpen(false);
      }
      navigate("/login", { replace: true, state: { from: normalizedPath } });
      return;
    }
    handleSignOut();
  };

  const handleThemeChange = (nextTheme) => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const mediaQuery = window.matchMedia(ADMIN_THEME_MEDIA_QUERY);
    const nextPreferences = writeAdminPreferences(activeAdminUserId, {
      ...readAdminPreferences(activeAdminUserId),
      theme: nextTheme,
    });

    applyAdminPreferences(nextPreferences, {
      root: document.documentElement,
      mediaQuery,
    });
    setResolvedAdminTheme(resolveAdminTheme(nextPreferences.theme, mediaQuery));
  };

  const notifications = useMemo(() => {
    if (!isAuthenticated || !user?.id || !canViewNotifications) return [];
    const userId = Number(user.id);
    if (!Number.isFinite(userId)) return [];

    const map = new Map();
    const upsert = (key, entry) => {
      const existing = map.get(key);
      if (!existing || entry.priority > existing.priority) {
        map.set(key, entry);
      }
    };

    notificationPayload.orders.forEach((order) => {
      const orderId = Number(order.id);
      if (!Number.isFinite(orderId)) return;
      const orderNumber = order.orderNumber || `#${orderId}`;
      const date =
        toDate(order.lastModifiedAt) ||
        toDate(order.orderDate) ||
        toDate(order.deliveryDate);
      const deliveryDate = toDate(order.deliveryDate);
      const status = String(order.status || "").toLowerCase();
      const isClosed = ["delivered", "completed", "cancelled", "canceled"].includes(status);
      const isOverdue = deliveryDate && deliveryDate.getTime() < Date.now() && !isClosed;
      const assigned = Number(order.assignedUserId) === userId;
      const updatedBy = Number(order.updatedByUserId) === userId;
      const recent = isRecent(date);
      const base = {
        id: `order-${orderId}`,
        type: "order",
        date,
        href: "/admin/orders",
      };

      if (isOverdue) {
        upsert(base.id, {
          ...base,
          priority: 4,
          title: `Overdue order ${orderNumber}`,
          meta: deliveryDate ? `Due ${formatNotificationTime(deliveryDate)}` : "Past due",
        });
      } else if (assigned) {
        upsert(base.id, {
          ...base,
          priority: 3,
          title: `Order ${orderNumber} assigned to you`,
          meta: order.customerName ? `Customer: ${order.customerName}` : "Assigned order",
        });
      } else if (recent) {
        upsert(base.id, {
          ...base,
          priority: 2,
          title: `New order ${orderNumber}`,
          meta: order.customerName ? `Customer: ${order.customerName}` : "New order received",
        });
      } else if (updatedBy) {
        upsert(base.id, {
          ...base,
          priority: 1,
          title: `Order ${orderNumber} updated by you`,
          meta: "Recent update",
        });
      }
    });

    notificationPayload.bookings.forEach((booking) => {
      const bookingId = Number(booking.id);
      if (!Number.isFinite(bookingId)) return;
      const date =
        toDate(booking.lastModifiedAt) ||
        toDate(booking.createdAt) ||
        toDate(booking.eventDate);
      const eventDate = toDate(booking.eventDate);
      const status = String(booking.status || "").toLowerCase();
      const isClosed = ["completed", "cancelled", "canceled"].includes(status);
      const isOverdue = eventDate && eventDate.getTime() < Date.now() && !isClosed;
      const assigned = Number(booking.assignedUserId) === userId;
      const createdBy = Number(booking.createdByUserId) === userId;
      const recent = isRecent(date);
      const base = {
        id: `booking-${bookingId}`,
        type: "booking",
        date,
        href: "/admin/bookings",
      };

      if (isOverdue) {
        upsert(base.id, {
          ...base,
          priority: 4,
          title: `Overdue booking #${bookingId}`,
          meta: eventDate ? `Event ${formatNotificationTime(eventDate)}` : "Past event date",
        });
      } else if (assigned) {
        upsert(base.id, {
          ...base,
          priority: 3,
          title: `Booking #${bookingId} assigned to you`,
          meta: booking.customerName ? `Client: ${booking.customerName}` : "Assigned booking",
        });
      } else if (recent) {
        upsert(base.id, {
          ...base,
          priority: 2,
          title: `New booking #${bookingId}`,
          meta: booking.customerName ? `Client: ${booking.customerName}` : "New booking created",
        });
      } else if (createdBy) {
        upsert(base.id, {
          ...base,
          priority: 1,
          title: `Booking #${bookingId} created by you`,
          meta: booking.customerName ? `Client: ${booking.customerName}` : "Created booking",
        });
      }
    });

    return [...map.values()]
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, 8);
  }, [canViewNotifications, isAuthenticated, notificationPayload, user?.id]);

  const unreadNotifications = useMemo(
    () => notifications.filter((note) => !readNotifications.has(note.id)),
    [notifications, readNotifications]
  );

  const unreadCount = unreadNotifications.length;

  const persistReadNotifications = (nextSet) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(readStorageKey, JSON.stringify([...nextSet]));
    } catch (err) {
      console.warn("Failed to persist notification state", err);
    }
  };

  useEffect(() => {
    if (!notifications.length) return;
    setReadNotifications((prev) => {
      if (!prev.size) return prev;
      const currentIds = new Set(notifications.map((note) => note.id));
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (currentIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed) return prev;
      persistReadNotifications(next);
      return next;
    });
  }, [notifications, readStorageKey]);

  const markNotificationRead = (id) => {
    setReadNotifications((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistReadNotifications(next);
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    setReadNotifications((prev) => {
      if (unreadNotifications.length === 0) return prev;
      const next = new Set(prev);
      unreadNotifications.forEach((note) => next.add(note.id));
      persistReadNotifications(next);
      return next;
    });
  };

  const renderNotifications = (context = "sidebar") => {
    if (!canViewNotifications) return null;
    const toolbarContext = context.endsWith("-toolbar");
    const compactCollapsedSidebar = context === "sidebar" && !isMobile && !expanded;
    const iconOnly = toolbarContext || compactCollapsedSidebar;
    const unreadBadgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
    return (
      <div
        ref={notificationsRef}
        className={`portal-sidebar__notifications portal-sidebar__notifications--${context}`}
      >
        <button
          type="button"
          className={`portal-sidebar__notifications-toggle${iconOnly ? " is-icon-only" : ""}`}
          onClick={() => {
            if (compactCollapsedSidebar) return;
            setNotificationsOpen((open) => !open);
          }}
          aria-expanded={compactCollapsedSidebar ? false : notificationsOpen}
          aria-label={
            unreadCount > 0
              ? `${unreadBadgeLabel} unread notifications`
              : "Notifications"
          }
          title="Notifications"
        >
          <span className="portal-sidebar__notifications-title">
            <AppIcon icon={faBell} />
            {!iconOnly ? <span>Notifications</span> : null}
          </span>
          {unreadCount > 0 && (
            <span className="portal-sidebar__notifications-count">{unreadBadgeLabel}</span>
          )}
          {!iconOnly ? (
            <AppIcon
              icon={faChevronDown}
              className={`portal-sidebar__notifications-caret ${notificationsOpen ? "is-open" : ""}`}
            />
          ) : null}
        </button>
        {!toolbarContext && !compactCollapsedSidebar && renderNotificationsPanel(context)}
      </div>
    );
  };

  const renderNotificationsPanel = (context = "sidebar") => {
    if (!canViewNotifications || !notificationsOpen) return null;

    return (
      <div
        ref={notificationsPanelRef}
        className={`portal-sidebar__notifications-dock portal-sidebar__notifications-dock--${context}`}
      >
        <div className="portal-sidebar__notifications-body" aria-label="Notifications panel">
          <div className="portal-sidebar__notifications-panel-head">
            <div className="portal-sidebar__notifications-panel-copy">
              <p className="portal-sidebar__notifications-panel-title">Notifications</p>
            </div>
            {isAuthenticated && unreadCount > 0 && (
              <button
                type="button"
                className="portal-sidebar__notifications-action"
                onClick={markAllNotificationsRead}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="portal-sidebar__notifications-panel-content">
            {!isAuthenticated && <p className="portal-sidebar__notifications-muted">Sign in to see updates.</p>}
            {isAuthenticated && notificationsLoading && (
              <p className="portal-sidebar__notifications-muted">Loading activity...</p>
            )}
            {isAuthenticated && !notificationsLoading && notificationsError && (
              <p className="portal-sidebar__notifications-error">{notificationsError}</p>
            )}
            {isAuthenticated && !notificationsLoading && !notificationsError && notifications.length === 0 && (
              <p className="portal-sidebar__notifications-muted">No recent activity.</p>
            )}
            {isAuthenticated &&
              !notificationsLoading &&
              !notificationsError &&
              notifications.length > 0 &&
              unreadNotifications.length === 0 && (
              <p className="portal-sidebar__notifications-muted">All caught up.</p>
            )}
            {!notificationsLoading && !notificationsError && unreadNotifications.length > 0 && (
              <ul className="portal-sidebar__notifications-list">
                {unreadNotifications.map((note) => (
                  <li key={note.id} className="portal-sidebar__notification-item">
                    <Link
                      to={note.href}
                      className="portal-sidebar__notification-link"
                      onClick={() => {
                        markNotificationRead(note.id);
                        setNotificationsOpen(false);
                        if (isMobile && overlayOpen) setOverlayOpen(false);
                      }}
                    >
                      <span className="portal-sidebar__notification-dot" aria-hidden="true" />
                      <div className="portal-sidebar__notification-copy">
                        <span className="portal-sidebar__notification-title">{note.title}</span>
                        <span className="portal-sidebar__notification-meta">{note.meta}</span>
                      </div>
                      <span className="portal-sidebar__notification-time">
                        {formatNotificationTime(note.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderUserSection = (context = "sidebar") => (
    <div
      ref={userMenuRef}
      className={`portal-sidebar__user portal-sidebar__user--${context}`}
    >
      <button
        type="button"
        className="portal-sidebar__user-button"
        onClick={() => setUserMenuOpen((prev) => !prev)}
        aria-expanded={userMenuOpen}
        aria-label="Open user menu"
      >
        <span className="portal-sidebar__user-avatar">
          {userAvatarSrc ? (
            <img src={userAvatarSrc} alt={displayName} />
          ) : (
            userInitials
          )}
        </span>
        <span className="portal-sidebar__user-info">
          <span className="portal-sidebar__user-name">{displayName}</span>
          <span className="portal-sidebar__user-email">{displayEmail}</span>
        </span>
        <AppIcon
          icon={faChevronDown}
          className={`portal-sidebar__user-caret ${userMenuOpen ? "is-open" : ""}`}
        />
      </button>
      {userMenuOpen && (
        <div className="portal-sidebar__user-menu">
          {isAuthenticated && (
            <Link
              to="/admin/profile"
              className="portal-sidebar__user-link"
              title="Profile settings"
              onClick={() => {
                setUserMenuOpen(false);
                if (isMobile) setOverlayOpen(false);
              }}
            >
              <AppIcon icon={faUser} />
              <span>Profile settings</span>
            </Link>
          )}
          <div className="portal-sidebar__user-menu-group">
            <p className="portal-sidebar__user-menu-label">Appearance</p>
            <div className="portal-sidebar__theme-toggle" role="group" aria-label="Theme">
              <button
                type="button"
                className={`portal-sidebar__theme-option ${resolvedAdminTheme === "light" ? "is-active" : ""}`}
                onClick={() => handleThemeChange("light")}
                aria-pressed={resolvedAdminTheme === "light"}
                title="Light mode"
                aria-label="Light mode"
              >
                <AppIcon icon={faSun} />
                <span className="sr-only">Light mode</span>
              </button>
              <button
                type="button"
                className={`portal-sidebar__theme-option ${resolvedAdminTheme === "dark" ? "is-active" : ""}`}
                onClick={() => handleThemeChange("dark")}
                aria-pressed={resolvedAdminTheme === "dark"}
                title="Dark mode"
                aria-label="Dark mode"
              >
                <AppIcon icon={faMoon} />
                <span className="sr-only">Dark mode</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            className="portal-sidebar__signout-btn"
            onClick={handleAuthAction}
            aria-label={authLabel}
            title={authLabel}
            disabled={!authReady}
          >
            <AppIcon icon={authIcon} />
            <span>{authLabel}</span>
          </button>
        </div>
      )}
    </div>
  );

  const mobileOverlay =
    isMobile && overlayOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="portal-sidebar__overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setOverlayOpen(false)}
          >
            <div className="portal-sidebar__overlay-content" onClick={(e) => e.stopPropagation()}>
              <div className="portal-sidebar__overlay-header">
                <Link
                  to="/admin"
                  className="portal-sidebar__brand"
                  onClick={() => setOverlayOpen(false)}
                >
                  <span className="portal-sidebar__brand-mark" aria-hidden="true">
                    <img src={portalLogoSrc} alt="" />
                  </span>
                  <span className="portal-sidebar__brand-copy">
                    <span className="portal-sidebar__brand-full">REEBS Portal</span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="portal-sidebar__overlay-close"
                  onClick={() => setOverlayOpen(false)}
                  aria-label="Close menu"
                >
                  <AppIcon icon={faXmark} />
                </button>
              </div>
              {renderSearchRow("overlay")}
              <nav className="portal-sidebar__overlay-nav" aria-label="Portal apps">
                {renderSearchResults("overlay")}
              </nav>
              <div className="portal-sidebar__footer">
                {renderUserSection("overlay")}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <aside className={`portal-sidebar ${expanded ? "is-expanded" : ""}`} aria-label="Portal navigation">
        <div className="portal-sidebar__panel">
          <div className="portal-sidebar__header">
            <Link to="/admin" className="portal-sidebar__brand">
              <span className="portal-sidebar__brand-mark" aria-hidden="true">
                <img src={portalLogoSrc} alt="" />
              </span>
              <span className="portal-sidebar__brand-copy">
                <span className="portal-sidebar__brand-full">REEBS Portal</span>
              </span>
            </Link>
            {isMobile ? (
              <div className="portal-sidebar__toggle">
                <button
                  type="button"
                  onClick={() => setOverlayOpen(true)}
                  className="portal-sidebar__toggle-btn"
                  aria-label="Open menu"
                >
                  <AppIcon icon={faBars} />
                </button>
              </div>
            ) : null}
          </div>
          {!isMobile && expanded && renderSearchRow("sidebar")}
          {!isMobile && <nav className="portal-sidebar__nav" aria-label="Portal apps">{renderSearchResults()}</nav>}
          {!isMobile && (
            <div className="portal-sidebar__footer">
              {!expanded ? renderNotifications("sidebar") : null}
              {renderUserSection()}
            </div>
          )}
        </div>
        {!isMobile ? (
          <SidebarEdgeToggle
            className="portal-sidebar__edge-toggle"
            collapsed={isSidebarCollapsed}
            onClick={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
          />
        ) : null}
      </aside>
      {mobileOverlay}
    </>
  );
}

export default PortalSidebar;
