import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatedLoadingState } from "@faako/ui";
import ExternalRedirect from "../components/ExternalRedirect";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { portalUrl } from "../config/appSurface";
import CookieConsentBanner from "./components/CookieConsentBanner";

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const Shop = lazy(() => import("./pages/Shop"));
const Resources = lazy(() => import("./pages/Resources"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Sitemap = lazy(() => import("./pages/Sitemap"));
const ProductList = lazy(() => import("./pages/ProductList"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const CustomerAccountPlaceholder = lazy(
  () => import("./pages/CustomerAccountPlaceholder"),
);
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Search = lazy(() => import("./pages/Search"));
const ErrorPage = lazy(() => import("./pages/ErrorPage"));

const PortalExternalRedirect: React.FC = () => {
  const location = useLocation();
  const portalPath = location.pathname === "/admin/signin" ? "/login" : location.pathname;
  return <ExternalRedirect to={portalUrl(`${portalPath}${location.search}${location.hash}`)} />;
};

const StorefrontApp: React.FC = () => (
  <AuthProvider>
    <CartProvider>
      <Suspense
        fallback={
          <AnimatedLoadingState
            page
            variant="storefront"
            title="Loading Stroane"
            message="Preparing this page."
          />
        }
      >
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
        <Route path="/sign" element={<SignIn />} />
        <Route path="/signin" element={<Navigate to="/sign" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
      </Suspense>
      <CookieConsentBanner />
    </CartProvider>
  </AuthProvider>
);

export default StorefrontApp;
