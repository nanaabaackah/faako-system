import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ExternalRedirect from "../components/ExternalRedirect";
import Layout from "../components/Layout";
import AdminPortalLayout from "./components/AdminPortalLayout";
import RequireAdminAuth from "./components/RequireAdminAuth";
import RequirePortalAccess from "./components/RequirePortalAccess";
import { AdminPortalProvider } from "./context/AdminPortalContext";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { STOREFRONT_BASE_URL, storefrontUrl } from "../config/appSurface";
import type { AdminRoleAction, AdminRoleModule } from "./api/adminSession";
import { AnimatedLoadingState, AppBottomBar } from "@faako/ui";

const AdminPortalHome = lazy(() => import("./pages/AdminPortalHome"));
const InventoryManagement = lazy(() => import("./pages/InventoryManagement"));
const OrderManagement = lazy(() => import("./pages/OrderManagement"));
const ReceiptManagement = lazy(() => import("./pages/ReceiptManagement"));
const AccountingManagement = lazy(() => import("./pages/AccountingManagement"));
const ExpenseManagement = lazy(() => import("./pages/ExpenseManagement"));
const CustomerDirectory = lazy(() => import("./pages/CustomerDirectory"));
const AdminPortalPlaceholder = lazy(() => import("./pages/AdminPortalPlaceholder"));
const AdminPortalProfile = lazy(() => import("./pages/AdminPortalProfile"));
const AdminPortalSignIn = lazy(() => import("./pages/AdminPortalSignIn"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const AuditLogManagement = lazy(() => import("./pages/AuditLogManagement"));

const StorefrontExternalRedirect: React.FC = () => {
  const location = useLocation();
  return <ExternalRedirect to={storefrontUrl(`${location.pathname}${location.search}${location.hash}`)} />;
};

const PortalLoginRoute: React.FC = () => (
  <AuthProvider>
    <CartProvider>
      <Layout externalNavigationBaseUrl={STOREFRONT_BASE_URL}>
        <AdminPortalSignIn />
      </Layout>
    </CartProvider>
  </AuthProvider>
);

const PortalModule: React.FC<{
  moduleId: AdminRoleModule;
  action?: AdminRoleAction;
  fallbackPath?: string;
  children: React.ReactNode;
}> = ({ moduleId, action = "view", fallbackPath, children }) => (
  <RequirePortalAccess moduleId={moduleId} action={action} fallbackPath={fallbackPath}>
    {children}
  </RequirePortalAccess>
);

const PortalApp: React.FC = () => (
  <AdminPortalProvider>
    <Suspense
      fallback={
        <AnimatedLoadingState
          page
          variant="portal"
          title="Loading Stroane Admin"
          message="Preparing this workspace."
        />
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<PortalLoginRoute />} />
      <Route path="/admin/signin" element={<Navigate to="/login" replace />} />
      <Route element={<RequireAdminAuth />}>
        <Route element={<RequirePortalAccess />}>
          <Route path="/admin" element={<AdminPortalLayout />}>
            <Route index element={<PortalModule moduleId="dashboard"><AdminPortalHome /></PortalModule>} />
            <Route path="profile" element={<PortalModule moduleId="profile"><AdminPortalProfile /></PortalModule>} />
            <Route path="inventory" element={<PortalModule moduleId="inventory"><InventoryManagement /></PortalModule>} />
            <Route path="orders" element={<PortalModule moduleId="orders"><OrderManagement /></PortalModule>} />
            <Route path="receipts" element={<PortalModule moduleId="receipts"><ReceiptManagement /></PortalModule>} />
            <Route path="accounting" element={<PortalModule moduleId="accounting"><AccountingManagement /></PortalModule>} />
            <Route path="expenses" element={<PortalModule moduleId="accounting"><ExpenseManagement /></PortalModule>} />
            <Route path="crm" element={<PortalModule moduleId="crm"><CustomerDirectory /></PortalModule>} />
            <Route path="directory" element={<PortalModule moduleId="crm"><CustomerDirectory /></PortalModule>} />
            <Route path="team" element={<RequirePortalAccess allowedRoles={["ADMIN", "OWNER"]} fallbackPath="/admin"><TeamManagement /></RequirePortalAccess>} />
            <Route path="audit-logs" element={<RequirePortalAccess allowedRoles={["ADMIN"]} fallbackPath="/admin"><AuditLogManagement /></RequirePortalAccess>} />
            <Route path="suppliers" element={<PortalModule moduleId="inventory"><AdminPortalPlaceholder area="suppliers" /></PortalModule>} />
            <Route path="products" element={<PortalModule moduleId="inventory"><AdminPortalPlaceholder area="products" /></PortalModule>} />
            <Route path="operations" element={<PortalModule moduleId="orders"><AdminPortalPlaceholder area="operations" /></PortalModule>} />
            <Route path="reports" element={<PortalModule moduleId="accounting"><AdminPortalPlaceholder area="reports" /></PortalModule>} />
            <Route path="settings" element={<RequirePortalAccess allowedRoles={["ADMIN", "OWNER"]} fallbackPath="/admin"><AdminPortalPlaceholder area="settings" /></RequirePortalAccess>} />
          </Route>
        </Route>
      </Route>
        <Route path="*" element={<StorefrontExternalRedirect />} />
      </Routes>
    </Suspense>
    <div className="ui-bottom-bar-shell portal-app-bottom-bar-shell">
      <AppBottomBar />
    </div>
  </AdminPortalProvider>
);

export default PortalApp;
