import React, { Suspense, lazy, useEffect, useMemo, useRef } from "react";
import { Helmet } from "react-helmet";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ErpShellFrame } from "@faako/ui";
import { getErpPageTitle } from "@faako/utils";
import AuthProvider, { useAuth } from "./components/AuthContext/AuthContext";
import { CartProvider } from "./components/CartContext/CartContext";
import { TemplateConfigProvider } from "./context/TemplateConfigContext";
import useScrollReveal from "./hooks/useScrollReveal";
import BackToTop from "./components/BackToTop/BackToTop";
import SiteLoader from "./components/SiteLoader/SiteLoader";
import Navbar from "./components/Navbar/Navbar";
import CartOverlay from "./components/CartOverlay/CartOverlay";
import PartyConfetti from "./components/PartyConfetti/PartyConfetti";
import shellConfig from "./config/erpShell.js";
import {
  ADMIN_PREFERENCES_CHANGE_EVENT,
  applyAdminPreferences,
  clearAppliedAdminPreferences,
  readAdminPreferences,
} from "./utils/adminPreferences";

const PortalSidebar = lazy(() => import("./components/PortalSidebar/PortalSidebar"));
const AdminBottomNav = lazy(() => import("./components/AdminBottomNav/AdminBottomNav"));
const Footer = lazy(() => import("./components/Footer/Footer"));

const Login = lazy(() => import("./pages/Login/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin/Admin"));
const StoreMode = lazy(() => import("./pages/StoreMode/StoreMode"));
const AdminWorkspace = lazy(() => import("./pages/AdminWorkspace/AdminWorkspace"));
const OrdersList = lazy(() => import("./pages/OrdersList/OrdersList"));
const OrderBuilder = lazy(() => import("./pages/OrderBuilder/OrderBuilder"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers/AdminCustomers"));
const WebsiteTemplateEditor = lazy(() => import("./pages/WebsiteTemplateEditor/WebsiteTemplateEditor"));

const AdminDirectory = lazy(() => import("./pages/AdminDirectory/AdminDirectory"));
const AdminAccounting = lazy(() => import("./pages/AdminAccounting/AdminAccounting"));
const AdminExpenses = lazy(() => import("./pages/AdminExpenses/AdminExpenses"));
const AdminWater = lazy(() => import("./pages/AdminWater/AdminWater"));
const AdminVendors = lazy(() => import("./pages/AdminVendors/AdminVendors"));
const AdminDelivery = lazy(() => import("./pages/AdminDelivery/AdminDelivery"));
const AdminDocuments = lazy(() => import("./pages/AdminDocuments/AdminDocuments"));
const AdminTimesheets = lazy(() => import("./pages/AdminTimesheets/AdminTimesheets"));
const AdminSettings = lazy(() => import("./pages/AdminSettings/AdminSettings"));
const AdminHR = lazy(() => import("./pages/AdminHR/AdminHR"));
const AdminRoles = lazy(() => import("./pages/AdminRoles/AdminRoles"));
const AdminMaintenance = lazy(() => import("./pages/AdminMaintenance/AdminMaintenance"));
const AdminInvoicing = lazy(() => import("./pages/AdminInvoicing/AdminInvoicing"));
const AdminMarketing = lazy(() => import("./pages/AdminMarketing/AdminMarketing"));
const AdminScheduler = lazy(() => import("./pages/AdminScheduler/AdminScheduler"));
const AdminBookings = lazy(() => import("./pages/AdminBookings/AdminBookings"));

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

function RouteFallback() {
  return (
    <SiteLoader
      compact
      label="Loading page"
      sublabel="Setting up your portal view."
    />
  );
}

function PublicOnly({ children }) {
  const { user, authReady } = useAuth();

  if (!authReady) return <RouteFallback />;

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function RequireAuth({ children }) {
  const { user, authReady } = useAuth();

  if (!authReady) return <RouteFallback />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireRole({ children, allowedRoles = [] }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  const role = normalizeRole(user?.role);

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function DefaultRedirect() {
  const { user, authReady } = useAuth();

  if (!authReady) return <RouteFallback />;

  return <Navigate to={user ? '/admin' : '/login'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminWorkspace section="home" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/store-mode"
        element={
          <RequireAuth>
            <StoreMode />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/inventory"
        element={
          <RequireAuth>
            <Admin />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/purchases"
        element={
          <RequireAuth>
            <AdminWorkspace section="purchases" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/offline"
        element={
          <RequireAuth>
            <AdminWorkspace section="offline" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/advanced"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminWorkspace section="advanced" />
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/admin/orders"
        element={
          <RequireAuth>
            <OrdersList />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/orders/new"
        element={
          <RequireAuth>
            <OrderBuilder />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/crm"
        element={
          <RequireAuth>
            <AdminCustomers />
          </RequireAuth>
        }
      />
      <Route path="/admin/customers" element={<Navigate to="/admin/crm" replace />} />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <AdminDirectory />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <RequireAuth>
            <AdminDirectory />
          </RequireAuth>
        }
      />
      <Route path="/admin/website-template" element={<Navigate to="/admin/advanced" replace />} />

      <Route
        path="/admin/directory"
        element={
          <RequireAuth>
            <AdminDirectory />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/accounting"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminAccounting />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/expenses"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminExpenses />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/water"
        element={
          <RequireAuth>
            <AdminWater />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/vendors"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminVendors />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/delivery"
        element={
          <RequireAuth>
            <AdminDelivery />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/documents"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminDocuments />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/timesheets"
        element={
          <RequireAuth>
            <AdminTimesheets />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <RequireAuth>
            <AdminSettings profileOnly />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminSettings />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/hr"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminHR />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/roles"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminRoles />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/maintenance"
        element={
          <RequireAuth>
            <AdminMaintenance />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/invoicing"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminInvoicing />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/marketing"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminMarketing />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/schedule"
        element={
          <RequireAuth>
            <AdminScheduler />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/bookings"
        element={
          <RequireAuth>
            <AdminBookings />
          </RequireAuth>
        }
      />

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}

function AppLayout() {
  const { user, authReady } = useAuth();
  const location = useLocation();
  const shellScrollRef = useRef(null);
  const pathname = location.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isStoreModeRoute = pathname === "/admin/store-mode";

  const pageTitle = useMemo(
    () => getErpPageTitle(pathname, shellConfig.brand.name, shellConfig.pageTitles, "/admin"),
    [pathname],
  );

  useScrollReveal(pathname, shellScrollRef);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const root = document.documentElement;
    if (!isAdminRoute) {
      clearAppliedAdminPreferences(root);
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const activeUserId = authReady ? user?.id : undefined;
    const syncAdminPreferences = () => {
      applyAdminPreferences(readAdminPreferences(activeUserId), { root, mediaQuery });
    };
    const handlePreferencesChange = (event) => {
      const changedUserId = String(event?.detail?.userId || "guest");
      const currentUserId = String(activeUserId || "guest");
      if (changedUserId !== currentUserId) return;
      applyAdminPreferences(event?.detail?.preferences, { root, mediaQuery });
    };

    syncAdminPreferences();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncAdminPreferences);
    } else {
      mediaQuery.addListener(syncAdminPreferences);
    }
    window.addEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", syncAdminPreferences);
      } else {
        mediaQuery.removeListener(syncAdminPreferences);
      }
      window.removeEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);
      clearAppliedAdminPreferences(root);
    };
  }, [authReady, isAdminRoute, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.scrollTo(0, 0);

    const scrollHost = shellScrollRef.current;
    if (scrollHost) {
      scrollHost.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    if (!isAdminRoute || typeof document === "undefined") return;

    const adminContent = document.querySelector(".portal-app-content");
    if (adminContent instanceof HTMLElement) {
      adminContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [isAdminRoute, pathname, location.search]);

  const routes = (
    <Suspense fallback={<RouteFallback />}>
      <AppRoutes />
    </Suspense>
  );

  if (isAdminRoute) {
    if (!authReady) {
      return (
        <>
          <Helmet>
            <title>{pageTitle}</title>
          </Helmet>
          <RouteFallback />
        </>
      );
    }

    if (!user) {
      return (
        <>
          <Helmet>
            <title>{pageTitle}</title>
          </Helmet>
          {routes}
        </>
      );
    }

    if (isStoreModeRoute) {
      return (
        <>
          <Helmet>
            <title>{pageTitle}</title>
          </Helmet>
          <div className="portal-app-shell portal-app-shell--store-mode">
            <div className="portal-app-content portal-app-content--store-mode">{routes}</div>
          </div>
        </>
      );
    }

    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
        </Helmet>
        <ErpShellFrame
          brand={shellConfig.brand}
          className="portal-app-shell"
          contentClassName="portal-app-content"
          layout="overlay"
          sidebar={(
            <Suspense fallback={null}>
              <PortalSidebar />
            </Suspense>
          )}
          bottomNav={(
            <Suspense fallback={null}>
              <AdminBottomNav />
            </Suspense>
          )}
        >
          {routes}
        </ErpShellFrame>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>
      <div className="site-shell">
        <div className="main portal-site-main" ref={shellScrollRef}>
          <PartyConfetti className="site-shell-confetti party-confetti-rentals" />
          <Navbar scrollContainerRef={shellScrollRef} />
          <div className="portal-route-shell portal-route-shell--public">
            {routes}
          </div>

          <Suspense fallback={null}>
            <Footer />
          </Suspense>
          <BackToTop scrollContainerRef={shellScrollRef} />
          <CartOverlay />
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <TemplateConfigProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </TemplateConfigProvider>
    </CartProvider>
  );
}
