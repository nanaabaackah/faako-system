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
import AdminPortalPlaceholder from "./pages/AdminPortalPlaceholder";
import AdminPortalProfile from "./pages/AdminPortalProfile";
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
            <Route path="profile" element={<AdminPortalProfile />} />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="suppliers" element={<AdminPortalPlaceholder area="suppliers" />} />
            <Route path="products" element={<AdminPortalPlaceholder area="products" />} />
            <Route path="operations" element={<AdminPortalPlaceholder area="operations" />} />
            <Route path="orders" element={<AdminPortalPlaceholder area="operations" />} />
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
