import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { animate } from "animejs";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Particles from "./components/Particles.jsx";
import Home from "./pages/Home.jsx";
import Pricing from "./pages/Pricing.jsx";
import ModuleConfig from "./pages/ModuleConfig.jsx";
import ModuleDetail from "./pages/ModuleDetail.jsx";
import Signup from "./pages/Signup.jsx";
import Contact from "./pages/Contact.jsx";
import NotFound from "./pages/NotFound.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Solutions from "./pages/Solutions.jsx";
import CaseStudies from "./pages/CaseStudies.jsx";
import About from "./pages/About.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import { getModuleById } from "./data/modules.js";
import "./styles/components/button.css";

const themeStorageKey = "faako-theme";
const appTitle = "Faako";

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(
      document.querySelectorAll("[data-scroll], .reveal"),
    );

    const parseDelayMs = (value) => {
      const raw = value?.trim();
      if (!raw) return 0;
      if (raw.endsWith("ms")) return Number.parseFloat(raw) || 0;
      if (raw.endsWith("s")) return (Number.parseFloat(raw) || 0) * 1000;
      return Number.parseFloat(raw) || 0;
    };
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const getNodeDelay = (node) =>
      parseDelayMs(node.style.getPropertyValue("--delay")) ||
      parseDelayMs(getComputedStyle(node).getPropertyValue("--delay"));
    const getFeatureVisualImage = (node) =>
      node.classList.contains("feature-visual") ||
      node.classList.contains("hero-visual")
        ? node.querySelector("img")
        : null;
    const featureVisualEntries = nodes
      .map((node) => ({
        node,
        image: getFeatureVisualImage(node),
      }))
      .filter((entry) => entry.image);

    const updateFeatureVisualZoom = () => {
      if (!featureVisualEntries.length) {
        return;
      }

      const viewportHeight = window.innerHeight || 1;

      featureVisualEntries.forEach(({ node, image }) => {
        const rect = node.getBoundingClientRect();
        const start = viewportHeight;
        const end = -rect.height * 0.35;
        const progress = clamp((start - rect.top) / (start - end), 0, 1);
        const scale = 1 + progress * 0.18;

        image.style.transform = `scale(${scale.toFixed(4)})`;
      });
    };

    if (prefersReducedMotion) {
      nodes.forEach((node) => {
        const featureImage = getFeatureVisualImage(node);
        node.classList.add("is-visible");
        node.style.opacity = "";
        node.style.transform = "";
        node.style.filter = "";
        node.style.willChange = "auto";
        if (featureImage) {
          featureImage.style.transform = "";
          featureImage.style.willChange = "auto";
        }
      });
      return undefined;
    }

    let lastScrollY = window.scrollY;
    let scrollDirection = "down";
    const setScrollDirection = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY + 1) {
        scrollDirection = "down";
      } else if (currentY < lastScrollY - 1) {
        scrollDirection = "up";
      }
      lastScrollY = currentY;
    };

    const visibilityMap = new WeakMap();

    const animateNode = (node, isEntering) => {
      const enterFrom = scrollDirection === "down" ? 28 : -28;
      const exitTo = scrollDirection === "down" ? -22 : 22;
      const delay = isEntering ? getNodeDelay(node) : 0;

      animate(node, {
        opacity: isEntering ? [0, 1] : [1, 0],
        translateY: isEntering ? [enterFrom, 0] : [0, exitTo],
        filter: isEntering ? ["blur(6px)", "blur(0px)"] : ["blur(0px)", "blur(4px)"],
        duration: isEntering ? 760 : 420,
        delay,
        ease: isEntering ? "outCubic" : "inQuad",
        composition: "replace",
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const node = entry.target;
          const isVisible = entry.isIntersecting;
          const wasVisible = visibilityMap.get(node);

          if (wasVisible === isVisible) {
            return;
          }

          visibilityMap.set(node, isVisible);
          node.classList.toggle("is-visible", isVisible);
          animateNode(node, isVisible);
        });
      },
      { threshold: 0.22, rootMargin: "-5% 0px -8% 0px" }
    );

    nodes.forEach((node) => {
      node.classList.add("js-observed-reveal");
      const featureImage = getFeatureVisualImage(node);
      node.classList.remove("is-visible");
      node.style.willChange = "transform, opacity, filter";
      node.style.opacity = "0";
      node.style.transform = "translateY(28px)";
      node.style.filter = "blur(6px)";
      if (featureImage) {
        featureImage.style.transformOrigin = "50% 50%";
        featureImage.style.willChange = "transform";
      }
      visibilityMap.set(node, false);
      observer.observe(node);
    });

    let zoomRafId = null;
    const scheduleFeatureZoom = () => {
      if (zoomRafId !== null) {
        return;
      }
      zoomRafId = window.requestAnimationFrame(() => {
        zoomRafId = null;
        updateFeatureVisualZoom();
      });
    };
    const handleScroll = () => {
      setScrollDirection();
      scheduleFeatureZoom();
    };

    scheduleFeatureZoom();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", scheduleFeatureZoom);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", scheduleFeatureZoom);
      if (zoomRafId !== null) {
        window.cancelAnimationFrame(zoomRafId);
      }
      nodes.forEach((node) => {
        const featureImage = getFeatureVisualImage(node);
        node.classList.remove("js-observed-reveal");
        node.style.willChange = "auto";
        if (featureImage) {
          featureImage.style.willChange = "auto";
        }
      });
    };
  }, [location.pathname]);

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
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
    </div>
  );
}
