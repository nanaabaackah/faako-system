import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
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
import { faArrowRight } from "./icons/iconSet";
import useScrollReveal from "./hooks/useScrollReveal";
import { applySeo } from "./utils/seo";

const Home = lazy(() => import("./pages/Home/Home"));
const Footer = lazy(() => import("./components/Footer/Footer"));

const Login = lazy(() => import("./pages/Login/Login"));
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

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

function RouteFallback() {
  return (
    <SiteLoader
      compact
      label="Loading page"
      sublabel="Setting up your next view."
    />
  );
}

function RequireAuth({ children }) {
  const { user, authReady } = useAuth();
  const location = useLocation();
  if (!authReady) return <RouteFallback />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  const normalizedPath = location.pathname.toLowerCase();
  const role = normalizeRole(user?.role);
  if (role === "water" && normalizedPath.startsWith("/admin") && normalizedPath !== "/admin/water") {
    return <Navigate to="/admin/water" replace />;
  }
  return children;
}

function RequireRole({ allowedRoles = [], children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  if (!allowedRoles.length) return children;
  const role = normalizeRole(user?.role);
  const canAccess = allowedRoles.some((allowed) => normalizeRole(allowed) === role);
  if (!canAccess) return <Navigate to="/admin" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  if (user) return <Navigate to="/admin" replace />;
  return children;
}

function DefaultRedirect() {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  return <Navigate to={user ? "/admin" : "/"} replace />;
}

function AppRoutes() {
  return (
    <Routes>
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
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
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
    const isAdminRoute = pathname.startsWith("/admin");
    const isAuthRoute = pathname === "/login" || pathname === "/customer-login";
    const isHomeRoute = pathname === "/" || pathname === "/home";
    const routes = (
      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
    );

    useScrollReveal(pathname, publicScrollRef);

    useEffect(() => {

      if (isAuthRoute) {
        const isCustomerLogin = pathname === "/customer-login";
        applySeo({
          pathname: location.pathname,
          title: isCustomerLogin
            ? "Customer Login | REEBS Party Themes"
            : "Staff Login | REEBS Party Themes",
          description: isCustomerLogin
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
    }, [isAdminRoute, isAuthRoute, location.pathname, pathname]);

    useEffect(() => {
      if (typeof window === "undefined" || typeof document === "undefined") return undefined;

      const root = document.documentElement;
      if (!isAdminRoute) {
        root.removeAttribute("data-admin-theme");
        return undefined;
      }

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const syncAdminTheme = () => {
        root.setAttribute("data-admin-theme", mediaQuery.matches ? "dark" : "light");
      };

      syncAdminTheme();

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", syncAdminTheme);
      } else {
        mediaQuery.addListener(syncAdminTheme);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", syncAdminTheme);
        } else {
          mediaQuery.removeListener(syncAdminTheme);
        }
        root.removeAttribute("data-admin-theme");
      };
    }, [isAdminRoute]);

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

      if (isAdminRoute) {
        const adminContent = document.querySelector(".portal-app-content");
        if (adminContent instanceof HTMLElement) {
          adminContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
        return;
      }

      const scrollHost = publicScrollRef.current;
      if (scrollHost) {
        scrollHost.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    }, [location.pathname, location.search, isAdminRoute]);

    useEffect(() => {
      if (typeof document === "undefined") return undefined;
      if (isAdminRoute) {
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
    }, [isAdminRoute, isHomeRoute, location.pathname]);

    if (isAdminRoute) {
      return (
        <div className="portal-app-shell">
          <Suspense fallback={<RouteFallback />}>
            <PortalSidebar />
          </Suspense>
          <div className="portal-app-content">{routes}</div>
          <Suspense fallback={null}>
            <AdminBottomNav />
          </Suspense>
        </div>
      );
    }

    return (
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
