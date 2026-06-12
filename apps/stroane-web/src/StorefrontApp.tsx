import React from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import ExternalRedirect from "./components/ExternalRedirect";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { portalUrl } from "./config/appSurface";
import Home from "./pages/frontend/Home";
import About from "./pages/frontend/About";
import Services from "./pages/frontend/Services";
import Shop from "./pages/frontend/Shop";
import Resources from "./pages/frontend/Resources";
import Contact from "./pages/frontend/Contact";
import Terms from "./pages/frontend/Terms";
import Privacy from "./pages/frontend/Privacy";
import Cookies from "./pages/frontend/Cookies";
import Sitemap from "./pages/frontend/Sitemap";
import ProductList from "./pages/frontend/ProductList";
import ProductDetail from "./pages/frontend/ProductDetail";
import Checkout from "./pages/frontend/Checkout";
import CheckoutReturn from "./pages/frontend/CheckoutReturn";
import CustomerAccountPlaceholder from "./pages/frontend/CustomerAccountPlaceholder";
import SignUp from "./pages/frontend/SignUp";
import Search from "./pages/frontend/Search";
import ErrorPage from "./pages/frontend/ErrorPage";

const PortalExternalRedirect: React.FC = () => {
  const location = useLocation();
  const portalPath = location.pathname === "/admin/signin" ? "/login" : location.pathname;
  return <ExternalRedirect to={portalUrl(`${portalPath}${location.search}${location.hash}`)} />;
};

const StorefrontApp: React.FC = () => (
  <AuthProvider>
    <CartProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/catalogue" element={<Shop />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/return" element={<CheckoutReturn />} />
        <Route path="/account" element={<CustomerAccountPlaceholder area="account" />} />
        <Route path="/orders" element={<CustomerAccountPlaceholder area="orders" />} />
        <Route path="/quotes" element={<CustomerAccountPlaceholder area="quotes" />} />
        <Route path="/signin" element={<ExternalRedirect to={portalUrl("/login")} />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/search" element={<Search />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route
          path="/login"
          element={<PortalExternalRedirect />}
        />
        <Route
          path="/admin/*"
          element={<PortalExternalRedirect />}
        />
        <Route path="*" element={<ErrorPage statusCode="404" />} />
      </Routes>
    </CartProvider>
  </AuthProvider>
);

export default StorefrontApp;
