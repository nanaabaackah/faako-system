import React from "react";
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
import AdminPortalHome from "./pages/AdminPortalHome";
import InventoryManagement from "./pages/InventoryManagement";
import OrderManagement from "./pages/OrderManagement";
import ReceiptManagement from "./pages/ReceiptManagement";
import AccountingManagement from "./pages/AccountingManagement";
import ExpenseManagement from "./pages/ExpenseManagement";
import CustomerDirectory from "./pages/CustomerDirectory";
import AdminPortalPlaceholder from "./pages/AdminPortalPlaceholder";
import AdminPortalProfile from "./pages/AdminPortalProfile";
import AdminPortalSignIn from "./pages/AdminPortalSignIn";
import TeamManagement from "./pages/TeamManagement";
import AuditLogManagement from "./pages/AuditLogManagement";
import type { AdminRoleAction, AdminRoleModule } from "./api/adminSession";
import { AppBottomBar } from "@faako/ui"

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
    <div className="ui-bottom-bar-shell portal-app-bottom-bar-shell">
      <AppBottomBar />
    </div>
  </AdminPortalProvider>
);

export default PortalApp;
