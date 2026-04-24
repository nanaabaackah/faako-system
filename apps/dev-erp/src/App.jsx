import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  HambergerMenu,
} from "iconsax-react";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Bookings from "./pages/Bookings/Bookings";
import PublicBooking from "./pages/PublicBooking/PublicBooking";
import Organizations from "./pages/Organizations/Organizations";
import Profile from "./pages/Profile/Profile";
import SystemHealth from "./pages/SystemHealth/SystemHealth";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";
import AuditLogs from "./pages/AuditLogs/AuditLogs";
import Rent from "./pages/Rent/Rent";
import UserControl from "./pages/UserControl/UserControl";
import SetupAccount from "./pages/SetupAccount/SetupAccount";
import ThemeToggle from "./components/ThemeToggle";
import Accounting from "./pages/Accounting/Accounting";
import Invoicing from "./pages/Invoicing/Invoicing";
import InvoiceView from "./pages/InvoiceView/InvoiceView";
import ErrorBoundary from "./components/ErrorBoundary";
import SideNav from "./components/SideNav";
import ErrorPage from "./pages/ErrorPage/ErrorPage";
import useScrollAnimations from "./hooks/useScrollAnimations";
import { apiGet, apiPost } from "./api/client";
import {
  clearAuthStore,
  refreshAuthSession,
  useAuthSnapshot,
} from "./auth/authStore";
import { canAccessPath, isRentOnlyUser } from "./utils/moduleAccess";
import {
  addSessionInvalidListener,
} from "./utils/authSession";
import {
  formatNotificationCount,
  getAlertNotificationCount,
  getAppointmentsNotificationCount,
  getOverdueAccountingCount,
  getOverdueInvoicesCount,
  getRentOutstandingCount,
  getTitleForPath,
  getTopbarLabel,
  getVisibleMobileTabItems,
  getVisibleNavItems,
} from "./app/navigation";

const NAV_SWIPE_CLOSE_THRESHOLD = 72;
const NAV_SWIPE_VERTICAL_TOLERANCE = 72;
const NAV_SWIPE_MIN_HORIZONTAL_DELTA = 12;
const SIDEBAR_COLLAPSE_STORAGE_KEY = "dev-erp.sidebar-collapsed";

const getInitialSidebarCollapsed = () => {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const PrivateRoute = ({ authReady, currentUser, children }) => {
  if (!authReady) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        Checking session...
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" />;
};

const getInitialTheme = () => {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
};

const AppShell = ({ children, theme, onToggleTheme, currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isRentScopedUser = isRentOnlyUser(currentUser);
  const visibleNavItems = getVisibleNavItems(currentUser);
  const visibleMobileTabItems = getVisibleMobileTabItems(currentUser);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [navSwipeOffset, setNavSwipeOffset] = useState(0);
  const [isNavDragging, setIsNavDragging] = useState(false);
  const [navNotifications, setNavNotifications] = useState({});
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const navSwipeRef = useRef({
    active: false,
    horizontal: false,
    startX: 0,
    startY: 0,
  });

  const isMobileViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches;

  const resetNavSwipe = () => {
    navSwipeRef.current = {
      active: false,
      horizontal: false,
      startX: 0,
      startY: 0,
    };
    setIsNavDragging(false);
    setNavSwipeOffset(0);
  };

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("nav-open", isNavOpen);
    return () => document.body.classList.remove("nav-open");
  }, [isNavOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSE_STORAGE_KEY,
        isSidebarCollapsed ? "true" : "false"
      );
    } catch {
      // ignore storage write failures and keep the in-memory preference
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (isNavOpen) return;
    resetNavSwipe();
  }, [isNavOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOffline) return undefined;

    let isCanceled = false;
    const loadNavNotifications = async () => {
      if (!currentUser) {
        if (!isCanceled) setNavNotifications({});
        return;
      }

      try {
        if (isRentScopedUser) {
          const payload = await apiGet("/api/rent/dashboard", {
            fallbackMessage: "Unable to load rent dashboard",
          });
          if (!isCanceled) {
            setNavNotifications({
              "/dashboard": getRentOutstandingCount(payload),
            });
          }
          return;
        }

        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        const query = new URLSearchParams({
          from: now.toISOString(),
          to: end.toISOString(),
        });
        const accountingQuery = new URLSearchParams({
          range: "all",
        });

        const [dashboardPayload, bookingsPayload, invoicesPayload, accountingPayload] =
          await Promise.all([
            apiGet("/api/dashboard", { fallbackMessage: "Unable to load dashboard" }),
            apiGet(`/api/bookings?${query.toString()}`, {
              fallbackMessage: "Unable to load appointments",
            }),
            apiGet("/api/invoices?status=OVERDUE", {
              fallbackMessage: "Unable to load invoices",
            }),
            apiGet(`/api/accounting/entries?${accountingQuery.toString()}`, {
              fallbackMessage: "Unable to load accounting",
            }),
          ]);

        if (!isCanceled) {
          setNavNotifications({
            "/bookings": getAppointmentsNotificationCount(bookingsPayload),
            "/system-health": getAlertNotificationCount(dashboardPayload),
            "/invoicing": getOverdueInvoicesCount(invoicesPayload),
            "/accounting": getOverdueAccountingCount(accountingPayload),
          });
        }
      } catch {
        if (!isCanceled) {
          setNavNotifications({});
        }
      }
    };

    loadNavNotifications();
    const intervalId = window.setInterval(loadNavNotifications, 60_000);

    return () => {
      isCanceled = true;
      window.clearInterval(intervalId);
    };
  }, [currentUser, isOffline, isRentScopedUser, location.pathname]);

  const handleSignOut = async () => {
    try {
      await apiPost("/api/auth/logout");
    } catch {
      // local cleanup still happens even if network logout fails
    }
    clearAuthStore();
    navigate("/login");
  };

  const handleSidebarTouchStart = (event) => {
    if (!isNavOpen || !isMobileViewport()) return;
    const touch = event.touches?.[0];
    if (!touch) return;

    navSwipeRef.current = {
      active: true,
      horizontal: false,
      startX: touch.clientX,
      startY: touch.clientY,
    };
    setIsNavDragging(false);
    setNavSwipeOffset(0);
  };

  const handleSidebarTouchMove = (event) => {
    if (!isNavOpen || !isMobileViewport()) return;
    const touch = event.touches?.[0];
    if (!touch || !navSwipeRef.current.active) return;

    const deltaX = touch.clientX - navSwipeRef.current.startX;
    const deltaY = touch.clientY - navSwipeRef.current.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!navSwipeRef.current.horizontal) {
      if (absY > NAV_SWIPE_VERTICAL_TOLERANCE && absY > absX) {
        resetNavSwipe();
        return;
      }

      if (absX < NAV_SWIPE_MIN_HORIZONTAL_DELTA || absX < absY) {
        return;
      }

      navSwipeRef.current.horizontal = true;
    }

    if (deltaX >= 0) {
      setNavSwipeOffset(0);
      return;
    }

    setIsNavDragging(true);
    setNavSwipeOffset(Math.max(deltaX, -320));
    event.preventDefault();
  };

  const handleSidebarTouchEnd = () => {
    if (!isNavOpen || !isMobileViewport()) return;
    const shouldClose = navSwipeOffset <= -NAV_SWIPE_CLOSE_THRESHOLD;
    resetNavSwipe();
    if (shouldClose) {
      setIsNavOpen(false);
    }
  };

  const sidebarClassName = [
    "erp-sidebar",
    isNavOpen ? "is-open" : "",
    isNavDragging ? "is-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const sidebarStyle =
    isNavOpen && navSwipeOffset !== 0 ? { transform: `translateX(${navSwipeOffset}px)` } : undefined;

  return (
    <div
      className={[
        "erp-shell",
        isOffline ? "is-offline" : "",
        isSidebarCollapsed ? "is-sidebar-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SideNav
        className={sidebarClassName}
        style={sidebarStyle}
        isOpen={isNavOpen}
        isCollapsed={isSidebarCollapsed}
        visibleNavItems={visibleNavItems}
        navNotifications={navNotifications}
        formatNotificationCount={formatNotificationCount}
        currentUser={currentUser}
        onOpen={() => setIsNavOpen(true)}
        onClose={() => setIsNavOpen(false)}
        onToggleCollapsed={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
        onExpand={() => setIsSidebarCollapsed(false)}
        onSignOut={handleSignOut}
        onTouchStart={handleSidebarTouchStart}
        onTouchMove={handleSidebarTouchMove}
        onTouchEnd={handleSidebarTouchEnd}
        onTouchCancel={handleSidebarTouchEnd}
      />
      <div className="erp-main">
        <header className="erp-topbar">
          <div className="topbar-title">
            <button
              className="nav-toggle"
              type="button"
              aria-label="Open navigation"
              aria-controls="erp-sidebar"
              aria-expanded={isNavOpen}
              onClick={() => setIsNavOpen(true)}
            >
              <HambergerMenu
                size={24}
                color="currentColor"
                variant="Linear"
                aria-hidden="true"
              />
            </button>
            <span>{getTopbarLabel(location.pathname)}</span>
          </div>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </header>
        {isOffline ? (
          <div className="offline-banner" role="status" aria-live="polite">
            Offline mode. Showing cached content where available.
          </div>
        ) : null}
        <main className="erp-content">{children}</main>
      </div>
      <nav className="mobile-tabbar" aria-label="Primary mobile navigation">
        {visibleMobileTabItems.map((item) => {
          const count = Number(navNotifications[item.to] || 0);
          const hasNotification = count > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span className="mobile-tabbar__icon-wrap">
                {React.createElement(item.Icon, {
                  size: 18,
                  variant: "Linear",
                  className: "mobile-tabbar__icon",
                })}
                {hasNotification ? (
                  <span className="mobile-tabbar__badge" aria-hidden="true">
                    {formatNotificationCount(count)}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

const TitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = getTitleForPath(location.pathname);
  }, [location.pathname]);

  return null;
};

const ScrollAnimationManager = () => {
  const location = useLocation();

  useScrollAnimations(location.pathname);

  return null;
};

const RouteBoundary = ({ children }) => {
  const location = useLocation();

  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
};

const ModuleScopeRoute = ({ currentUser, children }) => {
  const location = useLocation();
  if (!canAccessPath(currentUser, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const ShellPage = ({ authReady, currentUser, children, theme, onToggleTheme }) => (
  <PrivateRoute authReady={authReady} currentUser={currentUser}>
    <ModuleScopeRoute currentUser={currentUser}>
      <RouteBoundary>
        <AppShell theme={theme} onToggleTheme={onToggleTheme} currentUser={currentUser}>
          {children}
        </AppShell>
      </RouteBoundary>
    </ModuleScopeRoute>
  </PrivateRoute>
);

const DashboardLanding = ({ currentUser }) => {
  if (isRentOnlyUser(currentUser)) {
    return <Rent />;
  }
  return <Dashboard />;
};

function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [authReady, setAuthReady] = useState(false);
  const auth = useAuthSnapshot();
  const currentUser = auth.user;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  
  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    let isActive = true;

    const bootstrapSession = async () => {
      try {
        await refreshAuthSession();
      } catch (error) {
        console.warn("Failed to validate stored session", error);
      } finally {
        if (isActive) {
          setAuthReady(true);
        }
      }
    };

    bootstrapSession();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => addSessionInvalidListener(() => {
    clearAuthStore();
    setAuthReady(true);
  }), []);

  return (
    <Router>
      <TitleManager />
      <ScrollAnimationManager />
      <Routes>
        <Route
          path="/login"
          element={
            <RouteBoundary>
              <Login theme={theme} onToggleTheme={handleToggleTheme} />
            </RouteBoundary>
          }
        />
        <Route
          path="/setup-account"
          element={
            <RouteBoundary>
              <SetupAccount />
            </RouteBoundary>
          }
        />
        <Route
          path="/book/:orgSlug?"
          element={
            <RouteBoundary>
              <PublicBooking />
            </RouteBoundary>
          }
        />
        <Route
          path="/invoice/view/:token"
          element={
            <RouteBoundary>
              <InvoiceView />
            </RouteBoundary>
          }
        />
        <Route
          path="/error"
          element={
            <RouteBoundary>
              <ErrorPage />
            </RouteBoundary>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <DashboardLanding currentUser={currentUser} />
            </ShellPage>
          }
        />
        <Route
          path="/rent"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Rent />
            </ShellPage>
          }
        />
        <Route
          path="/bookings"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Bookings />
            </ShellPage>
          }
        />
        <Route
          path="/organizations"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Organizations />
            </ShellPage>
          }
        />
        <Route
          path="/profile"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Profile />
            </ShellPage>
          }
        />
        <Route
          path="/user-control"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <UserControl />
            </ShellPage>
          }
        />
        <Route path="/users" element={<Navigate to="/user-control" replace />} />
        <Route
          path="/system-health"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <SystemHealth />
            </ShellPage>
          }
        />
        <Route
          path="/reports"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Reports />
            </ShellPage>
          }
        />
        <Route
          path="/accounting"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Accounting />
            </ShellPage>
          }
        />
        <Route
          path="/invoicing"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Invoicing />
            </ShellPage>
          }
        />
        <Route path="/productivity" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/settings"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Settings />
            </ShellPage>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <AuditLogs />
            </ShellPage>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route
          path="*"
          element={
            <RouteBoundary>
              <ErrorPage
                code="404"
                title="Page not found."
                message="The page you requested does not exist or may have moved."
              />
            </RouteBoundary>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
