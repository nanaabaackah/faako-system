import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { OfflineStatusBadge, useOnlineStatus } from "@faako/offline-sync";
import {
  HambergerMenu,
} from "iconsax-react";
import ThemeToggle from "./components/ThemeToggle";
import ErrorBoundary from "./components/ErrorBoundary";
import SideNav from "./components/SideNav";
import useScrollAnimations from "./hooks/useScrollAnimations";
import { apiGet, apiPost } from "./api/client";
import {
  AppBottomBar,
  AppUpdateNotice,
  AnimatedLoadingState,
  ErpMobileBottomNavFrame,
  ErpPageContent,
  ErpShellTopbar,
  ErpStatusBadge,
  GoogleAnalyticsRouteTracker,
  useSidebarCollapsedState,
} from "@faako/ui";
import {
  observeElementHeightVar,
} from "@faako/utils";
import {
  clearAuthStore,
  refreshAuthSession,
  useAuthSnapshot,
} from "./auth/authStore";
import { canAccessPath, getDefaultPathForUser, isRentOnlyUser } from "./utils/moduleAccess";
import {
  addSessionInvalidListener,
} from "./utils/authSession";
import { hydrateDisplayCurrencyRate } from "./utils/displayCurrency";
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

const Login = lazy(() => import("./pages/Login/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Bookings = lazy(() => import("./pages/Bookings/Bookings"));
const PublicBooking = lazy(() => import("./pages/PublicBooking/PublicBooking"));
const Organizations = lazy(() => import("./pages/Organizations/Organizations"));
const Profile = lazy(() => import("./pages/Profile/Profile"));
const SystemHealth = lazy(() => import("./pages/SystemHealth/SystemHealth"));
const Reports = lazy(() => import("./pages/Reports/Reports"));
const Proposals = lazy(() => import("./pages/Proposals/Proposals"));
const ProposalClientView = lazy(() => import("./pages/Proposals/ProposalClientView"));
const FaakoOnboarding = lazy(() => import("./pages/FaakoOnboarding/FaakoOnboarding"));
const Settings = lazy(() => import("./pages/Settings/Settings"));
const AuditLogs = lazy(() => import("./pages/AuditLogs/AuditLogs"));
const Rent = lazy(() => import("./pages/Rent/Rent"));
const UserControl = lazy(() => import("./pages/UserControl/UserControl"));
const SetupAccount = lazy(() => import("./pages/SetupAccount/SetupAccount"));
const Accounting = lazy(() => import("./pages/Accounting/Accounting"));
const Invoicing = lazy(() => import("./pages/Invoicing/Invoicing"));
const InvoiceView = lazy(() => import("./pages/InvoiceView/InvoiceView"));
const ErrorPage = lazy(() => import("./pages/ErrorPage/ErrorPage"));

const NAV_SWIPE_CLOSE_THRESHOLD = 72;
const NAV_SWIPE_VERTICAL_TOLERANCE = 72;
const NAV_SWIPE_MIN_HORIZONTAL_DELTA = 12;
const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const GOOGLE_ANALYTICS_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === "true";

const RouteFallback = () => (
  <AnimatedLoadingState
    page
    title="Loading Dev ERP"
    message="Preparing the next workspace view."
  />
);

const PrivateRoute = ({ authReady, currentUser, children }) => {
  if (!authReady) {
    return <RouteFallback />;
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useSidebarCollapsedState({
    storageKey: "dev-erp.sidebar-collapsed",
  });
  const [navSwipeOffset, setNavSwipeOffset] = useState(0);
  const [isNavDragging, setIsNavDragging] = useState(false);
  const [navNotifications, setNavNotifications] = useState({});
  const isOnline = useOnlineStatus();
  const isOffline = !isOnline;
  const shellRef = useRef(null);
  const topbarRef = useRef(null);
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
    if (isNavOpen) return;
    resetNavSwipe();
  }, [isNavOpen]);

  useEffect(() => {
    const fallbackHeight =
      typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches
        ? 68
        : 72;

    return observeElementHeightVar({
      source: topbarRef.current,
      target: shellRef.current,
      cssVar: "--topbar-height",
      fallback: fallbackHeight,
    });
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
  const topbarLabel = getTopbarLabel(location.pathname);

  return (
    <div
      ref={shellRef}
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
        <ErpShellTopbar
          ref={topbarRef}
          className="erp-topbar"
          title={topbarLabel}
          offlineIndicator={<OfflineStatusBadge online={isOnline} />}
          leading={(
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
          )}
          actions={(
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          )}
        />
        {isOffline ? (
          <div className="offline-banner" role="status" aria-live="polite">
            Offline mode. Showing cached content where available.
          </div>
        ) : null}
        <ErpPageContent className="erp-content">
          <div className="erp-page-body">{children}</div>
          <div className="ui-bottom-bar-shell erp-content-bottom-bar">
            <AppBottomBar />
          </div>
        </ErpPageContent>
      </div>
      <ErpMobileBottomNavFrame className="mobile-tabbar">
        {visibleMobileTabItems.map((item) => {
          const count = Number(navNotifications[item.to] || 0);
          const hasNotification = count > 0;
          const moduleBadges = Array.isArray(item.badges) ? item.badges : [];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                [isActive ? "active" : "", item.enabled === false ? "is-disabled" : ""]
                  .filter(Boolean)
                  .join(" ")
              }
              data-module-key={item.key}
              data-module-group={item.group}
              data-module-status={item.status}
              data-module-state={item.state}
              data-module-visibility={item.visibility}
              data-module-status-label={item.statusLabel}
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
              <span className="mobile-tabbar__label">
                <span>{item.label}</span>
                {moduleBadges.length > 0 ? (
                  <span className="mobile-tabbar__module-badges" aria-label="Module state">
                    {moduleBadges.map((badge) => (
                      <ErpStatusBadge key={badge.key} badge={badge} className="mobile-tabbar__module-badge" />
                    ))}
                  </span>
                ) : null}
              </span>
            </NavLink>
          );
        })}
      </ErpMobileBottomNavFrame>
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
    return <Navigate to={getDefaultPathForUser(currentUser)} replace />;
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
  const [, setCurrencyRateVersion] = useState(0);
  const auth = useAuthSnapshot();
  const currentUser = auth.user;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    hydrateDisplayCurrencyRate({ signal: controller.signal }).then((didUpdate) => {
      if (didUpdate && !controller.signal.aborted) {
        setCurrencyRateVersion((version) => version + 1);
      }
    });

    return () => controller.abort();
  }, []);

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
      <GoogleAnalyticsRouteTracker
        measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
        enabled={GOOGLE_ANALYTICS_ENABLED}
      />
      <AppUpdateNotice
        appName="Dev ERP"
        enabled={import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true"}
      />
      <TitleManager />
      <ScrollAnimationManager />
      <Suspense fallback={<RouteFallback />}>
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
          path="/proposal/view/:token"
          element={
            <RouteBoundary>
              <ProposalClientView />
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
          path="/proposals"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Proposals />
            </ShellPage>
          }
        />
        <Route
          path="/proposals/:proposalId/preview"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <Proposals />
            </ShellPage>
          }
        />
        <Route
          path="/faako-onboarding"
          element={
            <ShellPage authReady={authReady} currentUser={currentUser} theme={theme} onToggleTheme={handleToggleTheme}>
              <FaakoOnboarding />
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
      </Suspense>
    </Router>
  );
}

export default App;
