import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppUpdateNotice, GoogleAnalyticsRouteTracker } from "@faako/ui";
import AuthProvider, { useAuth } from "./components/AuthContext/AuthContext";
import { CartProvider } from "./components/CartContext/CartContext";
import { TemplateConfigProvider } from "./context/TemplateConfigContext";
import BackToTop from "./components/BackToTop/BackToTop";
import { AppIcon } from "./components/Icon/Icon";
import SiteLoader from "./components/SiteLoader/SiteLoader";
import Navbar from "./components/Navbar/Navbar";
import CartOverlay from "./components/CartOverlay/CartOverlay";
import CookieBanner from "./components/CookieBanner/CookieBanner";
import PartyConfetti from "./components/PartyConfetti/PartyConfetti";
import { faArrowRight } from "./icons/iconSet";
import useScrollReveal from "./hooks/useScrollReveal";
import { applySeo } from "./utils/seo";
import { buildPortalUrl } from "./utils/portal";
import {
  GOOGLE_ANALYTICS_ENABLED,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  hasReebsAnalyticsConsent,
} from "./utils/analytics";

const Home = lazy(() => import("./pages/Home/Home"));
const Footer = lazy(() => import("./components/Footer/Footer"));

const Login = lazy(() => import("./pages/Login/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword/ResetPassword"));
const About = lazy(() => import("./pages/About/About"));
const Book = lazy(() => import("./pages/Book/Book"));
const Cart = lazy(() => import("./pages/Cart/Cart"));
const Checkout = lazy(() => import("./pages/Checkout/Checkout"));
const Contact = lazy(() => import("./pages/Contact/Contact"));
const DeliveryPolicy = lazy(() => import("./pages/DeliveryPolicy/DeliveryPolicy"));
const FAQ = lazy(() => import("./pages/FAQ/FAQ"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy/RefundPolicy"));
const Rentals = lazy(() => import("./pages/Rentals/Rentals"));
const RentalItem = lazy(() => import("./pages/RentalItem/RentalItem"));
const TermsOfService = lazy(() => import("./pages/TermsOfService/TermsOfService"));
const Shop = lazy(() => import("./pages/Shop/Shop"));

function RouteFallback() {
  return (
    <SiteLoader
      label="Loading page"
      sublabel="Setting up your next view."
      variant="storefront"
    />
  );
}

function PublicOnly({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  if (user) return <Navigate to="/admin" replace />;
  return children;
}

function PortalRedirect({ targetPath = "" }) {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nextPath =
      targetPath
      || `${location.pathname}${location.search || ""}${location.hash || ""}`;
    const targetUrl = buildPortalUrl(nextPath);

    if (window.location.href === targetUrl) return;
    window.location.replace(targetUrl);
  }, [location.hash, location.pathname, location.search, targetPath]);

  return <RouteFallback />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin/*" element={<PortalRedirect />} />
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/book" element={<Book />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/contact" element={<Contact />} />
      <Route
        path="/customer-login"
        element={
          <PublicOnly>
            <Login mode="customer" />
          </PublicOnly>
        }
      />
      <Route
        path="/login"
        element={
          <PortalRedirect targetPath="/login" />
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/delivery-policy" element={<DeliveryPolicy />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/gallery" element={<Navigate to="/about" replace />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />
      <Route path="/rentals" element={<Rentals />} />
      <Route path="/rentals/:slug" element={<RentalItem />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  function AppLayout() {
    const location = useLocation();
    const publicScrollRef = useRef(null);
    const [showShellCta, setShowShellCta] = useState(false);
    const pathname = location.pathname.toLowerCase();
    const isPortalRoute = pathname.startsWith("/admin");
    const isAuthRoute =
      pathname === "/login"
      || pathname === "/customer-login"
      || pathname === "/reset-password";
    const isHomeRoute = pathname === "/" || pathname === "/home";
    const routes = (
      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
    );
    const analyticsTracker = (
      <GoogleAnalyticsRouteTracker
        measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
        enabled={GOOGLE_ANALYTICS_ENABLED}
        shouldTrack={hasReebsAnalyticsConsent}
      />
    );
    const updateNotice = (
      <AppUpdateNotice
        appName="REEBS"
        mode={isPortalRoute ? "prompt" : "auto"}
        enabled={import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true"}
      />
    );

    useScrollReveal(pathname, publicScrollRef);

    useEffect(() => {

      if (isPortalRoute) {
        applySeo({
          pathname: location.pathname,
          title: "REEBS Portal | REEBS Party Themes",
          description: "Protected REEBS portal. Redirecting to the team workspace.",
          noIndex: true,
          schema: null,
        });
        return;
      }

      if (isAuthRoute) {
        const isCustomerLogin = pathname === "/customer-login";
        const isResetPassword = pathname === "/reset-password";
        applySeo({
          pathname: location.pathname,
          title: isResetPassword
            ? "Reset Password | REEBS Party Themes"
            : isCustomerLogin
              ? "Customer Login | REEBS Party Themes"
              : "Staff Login | REEBS Party Themes",
          description: isResetPassword
            ? "Secure REEBS staff password reset page."
            : isCustomerLogin
              ? "Customer access page for returning booking and checkout visitors."
              : "Secure sign-in for REEBS administrators and staff.",
          noIndex: true,
          schema: null,
        });
        return;
      }

      const noIndexPaths = new Set(["/cart", "/checkout", "/customer-login", "/home"]);
      applySeo({
        pathname: location.pathname,
        noIndex: noIndexPaths.has(pathname),
      });
    }, [isAuthRoute, isPortalRoute, location.pathname, pathname]);

    useEffect(() => {
      if (typeof window === "undefined" || !window.history) return undefined;
      if (!("scrollRestoration" in window.history)) return undefined;

      const previous = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => {
        window.history.scrollRestoration = previous;
      };
    }, []);

    useEffect(() => {
      if (typeof window === "undefined" || typeof document === "undefined") return;

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });

      if (isPortalRoute) {
        return;
      }

      const scrollHost = publicScrollRef.current;
      if (scrollHost) {
        scrollHost.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    }, [isPortalRoute, location.pathname, location.search]);

    useEffect(() => {
      if (typeof document === "undefined") return undefined;
      if (isPortalRoute) {
        document.documentElement.style.setProperty("--scroll-progress", "0");
        setShowShellCta(false);
        return undefined;
      }

      const scrollHost = publicScrollRef.current;
      if (!scrollHost) return undefined;
      let rafId = 0;

      const updateScrollProgress = () => {
        const maxScroll = scrollHost.scrollHeight - scrollHost.clientHeight;
        const progress = maxScroll > 0 ? scrollHost.scrollTop / maxScroll : 0;
        const bounded = Math.max(0, Math.min(1, progress));
        document.documentElement.style.setProperty("--scroll-progress", bounded.toFixed(4));

        const heroSection = isHomeRoute ? scrollHost.querySelector("#hero-section") : null;
        const footerSection = isHomeRoute ? scrollHost.querySelector(".site-footer") : null;

        if (!heroSection) {
          setShowShellCta(false);
          return;
        }

        const revealAfter = Math.max(220, heroSection.offsetHeight - 120);
        const viewportBottom = scrollHost.scrollTop + scrollHost.clientHeight;
        const footerTop = footerSection?.offsetTop ?? Number.POSITIVE_INFINITY;
        const footerVisible = viewportBottom >= footerTop;
        const shouldShow = scrollHost.scrollTop > revealAfter && !footerVisible;
        setShowShellCta((prev) => (prev === shouldShow ? prev : shouldShow));
      };

      updateScrollProgress();
      scrollHost.addEventListener("scroll", updateScrollProgress, { passive: true });
      window.addEventListener("resize", updateScrollProgress);

      const mutationObserver =
        typeof MutationObserver === "function"
          ? new MutationObserver(() => {
              if (rafId) window.cancelAnimationFrame(rafId);
              rafId = window.requestAnimationFrame(updateScrollProgress);
            })
          : null;

      mutationObserver?.observe(scrollHost, { childList: true, subtree: true });

      return () => {
        scrollHost.removeEventListener("scroll", updateScrollProgress);
        window.removeEventListener("resize", updateScrollProgress);
        mutationObserver?.disconnect();
        if (rafId) window.cancelAnimationFrame(rafId);
      };
    }, [isHomeRoute, isPortalRoute, location.pathname]);

    if (isPortalRoute) {
      return (
        <>
          {analyticsTracker}
          {updateNotice}
          {routes}
        </>
      );
    }

    return (
      <>
        {analyticsTracker}
        {updateNotice}
        <div className="site-shell">
          <div className={`main ${showShellCta ? "has-shell-cta" : ""}`} ref={publicScrollRef}>
            <PartyConfetti className="site-shell-confetti party-confetti-rentals" />
            <Navbar scrollContainerRef={publicScrollRef} />
            {routes}
            <Suspense fallback={null}>
              <Footer />
            </Suspense>
            <BackToTop scrollContainerRef={publicScrollRef} />
            <CartOverlay />
            <CookieBanner />
          </div>
          {isHomeRoute && (
            <div className={`shell-bottom-cta ${showShellCta ? "is-visible" : ""}`} aria-hidden={!showShellCta}>
              <div className="shell-bottom-cta-corner shell-bottom-cta-corner-left" aria-hidden="true">
                <svg viewBox="0 0 44 44" focusable="false" role="presentation">
                  <path d="M0 0H44V44C44 19.7 40 0 0 0Z" />
                </svg>
              </div>
              <div className="shell-bottom-cta-corner shell-bottom-cta-corner-right" aria-hidden="true">
                <svg viewBox="0 0 44 44" focusable="false" role="presentation">
                  <path d="M0 0H44V44C44 19.7 40 0 0 0Z" />
                </svg>
              </div>
              <Link to="/rentals" className="shell-bottom-cta-btn shell-bottom-cta-btn-book">
                <span>Book your party</span>
                <AppIcon icon={faArrowRight} />
              </Link>
              <Link to="/shop"
                className="shell-bottom-cta-btn shell-bottom-cta-btn-dark"
              >
                <span>Explore our shop</span>
                <AppIcon icon={faArrowRight} />
              </Link>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <Router>
      <CartProvider>
        <TemplateConfigProvider>
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
        </TemplateConfigProvider>
      </CartProvider>
    </Router>
  );
}

export default App;
