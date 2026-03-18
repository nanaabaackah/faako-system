import React, { Suspense, lazy, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthProvider, { useAuth } from "./components/AuthContext/AuthContext";
import { CartProvider } from "./components/CartContext/CartContext";
import { TemplateConfigProvider } from "./context/TemplateConfigContext";
import BackToTop from "./components/BackToTop/BackToTop";
import { AppIcon } from "./components/Icon/Icon";
import SiteLoader from "./components/SiteLoader/SiteLoader";
import Navbar from "./components/Navbar/Navbar";
import CartOverlay from "./components/CartOverlay/CartOverlay";
import PartyConfetti from "./components/PartyConfetti/PartyConfetti";

const PortalSidebar = lazy(() => import("./components/PortalSidebar/PortalSidebar"));
const AdminBottomNav = lazy(() => import("./components/AdminBottomNav/AdminBottomNav"));

const Login = lazy(() => import("./pages/Login/Login"));
const Admin = lazy(() => import("./pages/Admin/Admin"));
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
  return <div className="route-loading">Loading...</div>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <RouteFallback />;

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <RouteFallback />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireRole({ children, allowedRoles = [] }) {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function DefaultRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <RouteFallback />;

  return <Navigate to={user ? '/admin' : '/login'} replace />;
}

function toTitleCase(value = '') {
  return value
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getAdminPageTitle(pathname) {
  const adminTitles = {
    '/admin': 'Dashboard',
    '/admin/inventory': 'Inventory',
    '/admin/purchases': 'Purchases',
    '/admin/offline': 'Offline',
    '/admin/advanced': 'Advanced',
    '/admin/orders': 'Orders',
    '/admin/orders/new': 'New Order',
    '/admin/crm': 'CRM',
    '/admin/customers': 'Customers',
    '/admin/users': 'Users',
    '/admin/employees': 'Employees',
    '/admin/website-template': 'Website Template',
    '/admin/directory': 'Directory',
    '/admin/accounting': 'Accounting',
    '/admin/expenses': 'Expenses',
    '/admin/water': 'Water',
    '/admin/vendors': 'Vendors',
    '/admin/delivery': 'Delivery',
    '/admin/documents': 'Documents',
    '/admin/timesheets': 'Timesheets',
    '/admin/settings': 'Settings',
    '/admin/hr': 'HR',
    '/admin/roles': 'Roles',
    '/admin/maintenance': 'Maintenance',
    '/admin/invoicing': 'Invoicing',
    '/admin/marketing': 'Marketing',
    '/admin/schedule': 'Schedule',
    '/admin/bookings': 'Bookings',
  };

  return adminTitles[pathname] ?? toTitleCase(pathname.replace('/admin/', ''));
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

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminWorkspace section="home" />
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
            <AdminExpenses />
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
            <AdminVendors />
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
  const location = useLocation();
  const pathname = location.pathname;
  const isAdminRoute = pathname.startsWith('/admin');

  const pageTitle = useMemo(() => {
    if (pathname === '/login') return 'REEBS ERP Login';
    if (isAdminRoute) return `REEBS ERP — ${getAdminPageTitle(pathname)}`;
    return 'REEBS ERP';
  }, [isAdminRoute, pathname]);

  useEffect(() => {
    document.documentElement.setAttribute('data-admin-theme', isAdminRoute ? 'true' : 'false');

    return () => {
      document.documentElement.removeAttribute('data-admin-theme');
    };
  }, [isAdminRoute]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const routes = (
    <Suspense fallback={<RouteFallback />}>
      <AppRoutes />
    </Suspense>
  );

  if (!isAdminRoute) {
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
        </Helmet>
        {routes}
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>

      <div className="portal-app-shell">
        <Suspense fallback={null}>
          <PortalSidebar />
        </Suspense>

        <div className="portal-app-content">{routes}</div>

        <Suspense fallback={null}>
          <AdminBottomNav />
        </Suspense>
      </div>
    </>
  );
}

export default function App() {
  return <AppLayout />;
}