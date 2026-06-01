import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ExternalRedirect from "./components/ExternalRedirect";
import Layout from "./components/Layout";
import AdminPortalLayout from "./components/admin/AdminPortalLayout";
import RequireAdminAuth from "./components/admin/RequireAdminAuth";
import RequirePortalAccess from "./components/admin/RequirePortalAccess";
import { AdminPortalProvider } from "./context/AdminPortalContext";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { STOREFRONT_BASE_URL, storefrontUrl } from "./config/appSurface";
import AdminOrders from "./pages/AdminOrders";
import AdminInventory from "./pages/AdminInventory";
import AdminPortalHome from "./pages/AdminPortalHome";
import AdminPortalPlaceholder from "./pages/AdminPortalPlaceholder";
import AdminProducts from "./pages/AdminProducts";
import AdminPortalSignIn from "./pages/AdminPortalSignIn";

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

const PortalApp: React.FC = () => (
  <AdminPortalProvider>
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<PortalLoginRoute />} />
      <Route path="/admin/signin" element={<Navigate to="/login" replace />} />
      <Route element={<RequireAdminAuth />}>
        <Route element={<RequirePortalAccess />}>
          <Route path="/admin" element={<AdminPortalLayout />}>
            <Route index element={<AdminPortalHome />} />
            <Route path="inventory" element={<AdminInventory initialTab="inventory" />} />
            <Route path="suppliers" element={<AdminInventory initialTab="suppliers" />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="operations" element={<AdminOrders />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="reports" element={<AdminPortalPlaceholder area="reports" />} />
            <Route path="settings" element={<AdminPortalPlaceholder area="settings" />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<StorefrontExternalRedirect />} />
    </Routes>
  </AdminPortalProvider>
);

export default PortalApp;
