import React, { useMemo, useState, useEffect } from "react";
import "./PortalSidebar.css";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
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
  faPenToSquare,
  faShieldAlt,
  faSliders,
  faStore,
  faTools,
  faTruck,
  faUser,
  faUserGroup,
  faUserTie,
  faUsers,
  faChevronLeft,
  faChevronDown,
  faBell,
  faBoxesStacked,
  faCalendarCheck,
  faXmark,
  faArrowRightFromBracket,
  faArrowRightToBracket,
} from "/src/icons/iconSet";
import { useAuth } from "../AuthContext/AuthContext";
import { WEBSITE_URL } from "../../utils/website";

const MOBILE_QUERY = "(max-width: 720px)";

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
  },
  {
    label: "Inventory",
    path: "/admin/inventory",
    icon: faBoxesStacked,
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
  },
  {
    label: "Scheduling",
    path: "/admin/schedule",
    icon: faCalendarCheck,
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
  },
  {
    label: "Water",
    path: "/admin/water",
    icon: faStore,
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
    roles: ["admin", "manager"],
  },
  {
    label: "Advanced",
    path: "/admin/advanced",
    icon: faPenToSquare,
    matchPaths: ["/admin/advanced", "/admin/website-template"],
    roles: ["admin", "manager"],
  },
];

const normalizePath = (pathname) => {
  if (!pathname) return "/admin";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/admin";
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
  const [expanded, setExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationPayload, setNotificationPayload] = useState({ orders: [], bookings: [] });
  const [readNotifications, setReadNotifications] = useState(() => new Set());
  const { user, logout, authReady } = useAuth();
  const isAuthenticated = Boolean(user);
  const userRole = String(user?.role || "staff").toLowerCase();
  const isWaterUser = userRole === "water";
  const authLabel = isAuthenticated ? "Sign out" : "Sign in";
  const authIcon = isAuthenticated ? faArrowRightFromBracket : faArrowRightToBracket;
  const displayName =
    user?.name ||
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Guest";
  const displayEmail = user?.email || (authReady ? "Not signed in" : "Loading...");
  const userInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "GU";
  const readStorageKey = useMemo(
    () => `reebs_notifications_read_${user?.id || "guest"}`,
    [user?.id]
  );

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
    setUserMenuOpen(false);
    setNotificationsOpen(true);
    setOverlayOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobile) return;
    setOverlayOpen(false);
  }, [isMobile]);

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
    if (!authReady || !isAuthenticated || isWaterUser) {
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
        const [ordersRes, bookingsRes] = await Promise.all([
          fetch("/.netlify/functions/orders"),
          fetch("/.netlify/functions/bookings"),
        ]);
        const [ordersData, bookingsData] = await Promise.all([
          ordersRes.json().catch(() => null),
          bookingsRes.json().catch(() => null),
        ]);

        if (!ordersRes.ok) throw new Error(ordersData?.error || "Failed to load orders.");
        if (!bookingsRes.ok) throw new Error(bookingsData?.error || "Failed to load bookings.");

        if (active) {
          setNotificationPayload({
            orders: Array.isArray(ordersData) ? ordersData : [],
            bookings: Array.isArray(bookingsData) ? bookingsData : [],
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
  }, [authReady, isAuthenticated, isWaterUser]);

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
    if (isWaterUser) {
      return app.path === "/admin/water";
    }
    if (!app.roles || app.roles.length === 0) return true;
    return app.roles.some((role) => String(role).toLowerCase() === userRole);
  };

  const renderLinks = (context = "sidebar") => (
    <ul className={`portal-sidebar__list portal-sidebar__list--${context}`}>
      {apps.filter(canSeeApp).map((app) => {
        const active = isActive(app);
        const linkClasses = [
          "portal-sidebar__link",
          context === "overlay" ? "portal-sidebar__link--overlay" : "",
          active ? "is-active" : "",
          app.external ? "portal-sidebar__link--external" : "",
        ]
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
                <AppIcon icon={app.icon} />
                <span>{app.label}</span>
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
              <AppIcon icon={app.icon} />
              <span>{app.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

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

  const notifications = useMemo(() => {
    if (!isAuthenticated || !user?.id || isWaterUser) return [];
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
  }, [isAuthenticated, isWaterUser, notificationPayload, user?.id]);

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
    if (isWaterUser) return null;
    return (
      <div className={`portal-sidebar__notifications portal-sidebar__notifications--${context}`}>
        <button
          type="button"
          className="portal-sidebar__notifications-toggle"
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-expanded={notificationsOpen}
          aria-label="Toggle notifications"
        >
          <span className="portal-sidebar__notifications-title">
            <AppIcon icon={faBell} />
            <span>Notifications</span>
          </span>
          <span className="portal-sidebar__notifications-count">{unreadCount}</span>
          <AppIcon
            icon={faChevronDown}
            className={`portal-sidebar__notifications-caret ${notificationsOpen ? "is-open" : ""}`}
          />
        </button>
        {notificationsOpen && (
          <div className="portal-sidebar__notifications-body">
            {isAuthenticated && unreadCount > 0 && (
              <div className="portal-sidebar__notifications-actions">
                <button
                  type="button"
                  className="portal-sidebar__notifications-action"
                  onClick={markAllNotificationsRead}
                >
                  Mark all read
                </button>
              </div>
            )}
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
                      <div>
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
        )}
      </div>
    );
  };

  const renderUserSection = (context = "sidebar") => (
    <div className={`portal-sidebar__user portal-sidebar__user--${context}`}>
      <button
        type="button"
        className="portal-sidebar__user-button"
        onClick={() => setUserMenuOpen((prev) => !prev)}
        aria-expanded={userMenuOpen}
        aria-label="Open user menu"
      >
        <span className="portal-sidebar__user-avatar">{userInitials}</span>
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
          {isAuthenticated && !isWaterUser && (
            <Link
              to="/admin/settings?tab=profile"
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
              <button
                type="button"
                className="portal-sidebar__overlay-close"
                onClick={() => setOverlayOpen(false)}
                aria-label="Close menu"
              >
                <AppIcon icon={faXmark} />
              </button>
              {renderUserSection("overlay")}
              {renderNotifications("overlay")}
              <nav aria-label="Portal apps">{renderLinks("overlay")}</nav>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <aside className={`portal-sidebar ${expanded ? "is-expanded" : ""}`} aria-label="Portal navigation">
        <div className="portal-sidebar__brand">
          <span className="portal-sidebar__brand-short">R</span>
          <span className="portal-sidebar__brand-full">Reebs ERP</span>
        </div>
        {!isMobile && renderUserSection()}
        <div className="portal-sidebar__toggle">
          <button
            type="button"
            onClick={() => {
              if (isMobile) {
                setOverlayOpen(true);
                return;
              }
              setExpanded((prev) => !prev);
            }}
            className="portal-sidebar__toggle-btn"
            aria-label={isMobile ? "Open menu" : "Toggle navigation"}
          >
            <AppIcon icon={isMobile ? faBars : expanded ? faChevronLeft : faBars} />
            {!isMobile && <span>{expanded ? "Collapse" : "Explore"}</span>}
          </button>
        </div>
        {!isMobile && renderNotifications()}
        {!isMobile && <nav className="portal-sidebar__nav" aria-label="Portal apps">{renderLinks()}</nav>}
      </aside>
      {mobileOverlay}
    </>
  );
}

export default PortalSidebar;
