import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { AnimatedLoadingState, AppUpdateNotice, GoogleAnalyticsRouteTracker } from "@faako/ui";
import { useFrontFacingScrollReveal } from "@faako/ui/useFrontFacingScrollReveal";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import CookieConsentBanner from "./components/CookieConsentBanner.jsx";
import {
  FAAKO_COOKIE_PREFS_EVENT,
  hasFaakoAnalyticsConsent,
} from "./utils/cookieConsent.js";
import Particles from "./components/Particles.jsx";
import { getModuleById } from "./data/modules.js";
import "./styles/components/button.css";

const Home = lazy(() => import("./pages/Home.jsx"));
const Pricing = lazy(() => import("./pages/Pricing.jsx"));
const ModuleConfig = lazy(() => import("./pages/ModuleConfig.jsx"));
const ModuleDetail = lazy(() => import("./pages/ModuleDetail.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const ClientSetup = lazy(() => import("./pages/ClientSetup.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Solutions = lazy(() => import("./pages/Solutions.jsx"));
const CaseStudies = lazy(() => import("./pages/CaseStudies.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));

const themeStorageKey = "faako-theme";
const appTitle = "Faako";
const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const GOOGLE_ANALYTICS_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === "true";

const getDocumentTitle = (pathname) => {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath.startsWith("/modules/")) {
    const moduleId = normalizedPath.split("/")[2];
    const module = getModuleById(moduleId);
    return module ? `${module.title} Module | ${appTitle}` : `Module Details | ${appTitle}`;
  }

  const titleMap = {
    "/": `Home | ${appTitle}`,
    "/about": `About | ${appTitle}`,
    "/solutions": `Solutions | ${appTitle}`,
    "/configure": `Configure | ${appTitle}`,
    "/pricing": `Pricing | ${appTitle}`,
    "/case-studies": `Use-Case Scenarios | ${appTitle}`,
    "/dashboard": `Dashboard | ${appTitle}`,
    "/contact": `Contact | ${appTitle}`,
    "/signup": `Client Intake | ${appTitle}`,
    "/client-setup": `Client Setup | ${appTitle}`,
    "/login": `Log In | ${appTitle}`,
    "/forgot-password": `Reset Password | ${appTitle}`,
    "/privacy": `Privacy Policy | ${appTitle}`,
    "/terms": `Terms of Service | ${appTitle}`,
  };

  return titleMap[normalizedPath] || `Page Not Found | ${appTitle}`;
};

const getStoredTheme = () => {
  return "light";
};

export default function App() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(hasFaakoAnalyticsConsent);
  const [systemTheme, setSystemTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePreferences = (event) => {
      setAnalyticsAllowed(Boolean(event.detail?.analytics));
    };

    window.addEventListener(FAAKO_COOKIE_PREFS_EVENT, handlePreferences);
    return () => window.removeEventListener(FAAKO_COOKIE_PREFS_EVENT, handlePreferences);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!theme) {
      document.documentElement.removeAttribute("data-theme");
      return;
    }

    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const currentTheme = theme || systemTheme;
  const nextThemeLabel = currentTheme === "dark" ? "Light mode" : "Dark mode";
  const headerLogo =
    currentTheme === "dark"
      ? "/assets/logos/logo-white.png"
      : "/assets/logos/logo-colour.png";
  const footerLogo =
    currentTheme === "dark"
      ? "/assets/logos/logo-white-long.png"
      : "/assets/logos/logo-white-long.png";
  const particlePalette =
    currentTheme === "dark"
      ? ["#47475e", "#55556d", "#64647c", "#77778f"]
      : ["#151419", "#262626", "#878787", "#f56e0f", "#fbfbfb"];
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.title = getDocumentTitle(location.pathname);
  }, [location.pathname]);

  useFrontFacingScrollReveal({
    query: "[data-scroll], .reveal",
    getMutationRoot: () => document.body,
  });

  const handleThemeToggle = () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(themeStorageKey, nextTheme);
    }
  };

  const handleScrollTop = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <GoogleAnalyticsRouteTracker
        measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
        enabled={GOOGLE_ANALYTICS_ENABLED && analyticsAllowed}
      />
      <AppUpdateNotice
        appName="Faako"
        mode="auto"
        enabled={import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true"}
      />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header
        headerLogo={headerLogo}
        currentTheme={currentTheme}
        nextThemeLabel={nextThemeLabel}
        onToggleTheme={handleThemeToggle}
      />
      <main className="site-main" id="main-content">
        <Particles
          className="app-particles-layer"
          particleCount={260}
          particleSpread={10}
          speed={0.1}
          particleColors={particlePalette}
          moveParticlesOnHover={false}
          particleHoverFactor={0.45}
          alphaParticles={false}
          particleBaseSize={110}
          sizeRandomness={0.85}
          cameraDistance={22}
          disableRotation={false}
          pixelRatio={1}
        />
        <Suspense
          fallback={
            <AnimatedLoadingState
              page
              variant="portfolio"
              title="Loading Faako"
              message="Preparing the next view."
            />
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/case-studies" element={<CaseStudies />} />
            <Route path="/case-studies/:slug" element={<Navigate to="/case-studies" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/configure" element={<ModuleConfig />} />
            <Route path="/modules/:moduleId" element={<ModuleDetail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/client-setup" element={<ClientSetup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {showScrollTop ? (
        <button
          className="scroll-top"
          type="button"
          onClick={handleScrollTop}
          aria-label="Scroll to top"
        >
          <FontAwesomeIcon icon={faArrowUp} />
        </button>
      ) : null}
      <Footer footerLogo={footerLogo} />
      <CookieConsentBanner />
    </div>
  );
}
