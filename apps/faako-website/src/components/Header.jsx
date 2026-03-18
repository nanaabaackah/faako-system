import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faMoon, faSun, faXmark, faArrowRight, faGlobe, faBoxesStacked, faChartLine, faHandshake, faShield, faBookOpen, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { moduleShowcaseItems } from "../data/modules.js";

const moduleNavItems = moduleShowcaseItems.map((module) => ({
  id: module.id,
  title: module.title,
  description: module.description,
  to: `/modules/${module.id}`,
  icon: module.icon,
}));

const productColumns = [
  {
    title: "Core Modules",
    items: moduleNavItems.slice(0, 3),
  },
  {
    title: "Operations Modules",
    items: moduleNavItems.slice(3),
  },
  {
    title: "Platform",
    items: [
      {
        id: "solutions-overview",
        title: "Solutions Overview",
        description: "See how modules connect into one operating system.",
        to: "/solutions",
        icon: faGlobe,
      },
      {
        id: "configure-stack",
        title: "Project Blueprint",
        description: "Configure your stack and rollout plan in one place.",
        to: "/configure",
        icon: faBoxesStacked,
      },
      {
        id: "pricing",
        title: "Pricing",
        description: "Clear package pricing and implementation options.",
        to: "/pricing",
        icon: faChartLine,
      },
    ],
  },
];

const solutionsColumns = [
  {
    title: "By Use Case",
    items: [
      {
        id: "use-web",
        title: "Get Found & Get Paid",
        description: "Website, enquiries, and payment-ready workflows.",
        to: "/solutions#core-pillars",
        icon: faGlobe,
      },
      {
        id: "use-ops",
        title: "Track Everything",
        description: "Inventory, orders, delivery, and daily operations.",
        to: "/solutions#core-pillars",
        icon: faBoxesStacked,
      },
      {
        id: "use-data",
        title: "See The Numbers",
        description: "Dashboards and performance reporting in real time.",
        to: "/solutions#core-pillars",
        icon: faChartLine,
      },
      {
        id: "use-modules",
        title: "Module Library",
        description: "Explore detailed module pages and capabilities.",
        to: "/solutions#modules",
        icon: faBookOpen,
      },
    ],
  },
  {
    title: "Popular Modules",
    items: moduleNavItems.slice(0, 4),
    footer: {
      label: "See all modules",
      to: "/solutions#modules",
    },
  },
  {
    title: "Built For",
    items: [
      {
        id: "built-retail",
        title: "Retail & Trading",
        description: "Shops, boutiques, and product-led businesses.",
        to: "/solutions#industries",
        icon: faHandshake,
      },
      {
        id: "built-distribution",
        title: "Distribution",
        description: "Wholesalers and multi-branch fulfillment teams.",
        to: "/solutions#industries",
        icon: faBoxesStacked,
      },
      {
        id: "built-services",
        title: "Professional Services",
        description: "Service teams managing clients and delivery.",
        to: "/solutions#industries",
        icon: faShield,
      },
      {
        id: "built-growing",
        title: "Growing Teams",
        description: "Move from scattered tools to one clear system.",
        to: "/solutions",
        icon: faChartLine,
      },
    ],
    footer: {
      label: "See all solutions",
      to: "/solutions",
    },
  },
];

const resourcesColumns = [
  {
    title: "Learn",
    items: [
      {
        id: "resource-about",
        title: "About Faako",
        description: "How we build local-first systems for Ghanaian teams.",
        to: "/about",
        icon: faBookOpen,
      },
      {
        id: "resource-cases",
        title: "Use-Case Scenarios",
        description: "Review sample rollout blueprints and likely outcomes.",
        to: "/case-studies",
        icon: faChartLine,
      },
      {
        id: "resource-blueprint",
        title: "Project Blueprint",
        description: "Map required modules and launch scope quickly.",
        to: "/configure",
        icon: faBoxesStacked,
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        id: "resource-contact",
        title: "Contact",
        description: "Talk to us about your workflows and current pain points.",
        to: "/contact",
        icon: faEnvelope,
      },
      {
        id: "resource-terms",
        title: "Terms",
        description: "Review product terms and commercial policies.",
        to: "/terms",
        icon: faShield,
      },
      {
        id: "resource-privacy",
        title: "Privacy",
        description: "Understand how data and access are protected.",
        to: "/privacy",
        icon: faHandshake,
      },
    ],
  },
];

function MegaColumn({ column, onNavigate }) {
  return (
    <div className="mega-column">
      <span className="mega-title">{column.title}</span>
      <div className="mega-links">
        {column.items.map((item) => (
          <Link key={item.id} to={item.to} className="mega-link" onClick={onNavigate}>
            <span className="mega-link-icon" aria-hidden="true">
              <FontAwesomeIcon icon={item.icon} />
            </span>
            <span className="mega-link-copy-wrap">
              <span className="mega-link-title">{item.title}</span>
              <span className="mega-link-copy">{item.description}</span>
            </span>
          </Link>
        ))}
      </div>
      {column.footer ? (
        <Link to={column.footer.to} className="mega-footer-link" onClick={onNavigate}>
          {column.footer.label}
          <FontAwesomeIcon icon={faArrowRight} />
        </Link>
      ) : null}
    </div>
  );
}

export default function Header({
  headerLogo,
  currentTheme,
  nextThemeLabel,
  onToggleTheme,
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const headerRef = useRef(null);
  const location = useLocation();

  const isDesktopViewport = () =>
    typeof window !== "undefined" && window.innerWidth > 1000;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setOpenMenu(null);
        setIsMobileNavOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setIsMobileNavOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 1000) {
        setIsMobileNavOpen(false);
        setOpenMenu(null);
      }
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 6);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const handleMenuToggle = (menuKey) => {
    setOpenMenu((prev) => (prev === menuKey ? null : menuKey));
  };

  const handleMenuEnter = (menuKey) => {
    if (!isDesktopViewport()) {
      return;
    }
    setOpenMenu(menuKey);
  };

  const handleMenuLeave = () => {
    if (!isDesktopViewport()) {
      return;
    }
    setOpenMenu(null);
  };

  const handleNavLinkClick = () => {
    setOpenMenu(null);
    setIsMobileNavOpen(false);
  };

  const handleMobileNavToggle = () => {
    setIsMobileNavOpen((prev) => {
      const next = !prev;
      if (!next) {
        setOpenMenu(null);
      }
      return next;
    });
  };

  const isProductOpen = openMenu === "product";
  const isSolutionsOpen = openMenu === "solutions";
  const isResourcesOpen = openMenu === "resources";

  return (
    <header
      ref={headerRef}
      className={`site-header ${isMobileNavOpen ? "nav-open" : ""} ${
        isScrolled ? "is-scrolled" : ""
      }`}
    >
      <div className="brand-block">
        <Link className="logo" to="/" onClick={handleNavLinkClick}>
          <img src={headerLogo} alt="Faako logo" loading="lazy" />
        </Link>
      </div>

      <nav className="site-nav" aria-label="Primary" id="primary-navigation">
        <div
          className={`nav-group ${isProductOpen ? "is-open" : ""}`}
          onMouseEnter={() => handleMenuEnter("product")}
          onMouseLeave={handleMenuLeave}
        >
          <button
            type="button"
            className="nav-trigger"
            aria-haspopup="menu"
            aria-expanded={isProductOpen}
            aria-controls="product-menu"
            onClick={() => handleMenuToggle("product")}
          >
            Product <span className="nav-caret" aria-hidden="true">▾</span>
          </button>
          <div id="product-menu" className="nav-dropdown nav-dropdown--product" role="menu">
            <div className="mega-grid mega-grid--product">
              {productColumns.map((column) => (
                <MegaColumn key={column.title} column={column} onNavigate={handleNavLinkClick} />
              ))}
              <aside className="mega-side">
                <span className="mega-title">Recent</span>
                <div className="mega-side-card">
                  <h4>New module detail pages</h4>
                  <p>Open each module to review workflows, scope, and integrations.</p>
                  <div className="mega-side-visual" aria-hidden="true" />
                  <Link to="/solutions#modules" className="mega-footer-link" onClick={handleNavLinkClick}>
                    Browse modules
                    <FontAwesomeIcon icon={faArrowRight} />
                  </Link>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <div
          className={`nav-group ${isSolutionsOpen ? "is-open" : ""}`}
          onMouseEnter={() => handleMenuEnter("solutions")}
          onMouseLeave={handleMenuLeave}
        >
          <button
            type="button"
            className="nav-trigger"
            aria-haspopup="menu"
            aria-expanded={isSolutionsOpen}
            aria-controls="solutions-menu"
            onClick={() => handleMenuToggle("solutions")}
          >
            Solutions <span className="nav-caret" aria-hidden="true">▾</span>
          </button>
          <div id="solutions-menu" className="nav-dropdown nav-dropdown--solutions" role="menu">
            <div className="mega-grid mega-grid--solutions">
              {solutionsColumns.map((column) => (
                <MegaColumn key={column.title} column={column} onNavigate={handleNavLinkClick} />
              ))}
            </div>
          </div>
        </div>

        <div
          className={`nav-group ${isResourcesOpen ? "is-open" : ""}`}
          onMouseEnter={() => handleMenuEnter("resources")}
          onMouseLeave={handleMenuLeave}
        >
          <button
            type="button"
            className="nav-trigger"
            aria-haspopup="menu"
            aria-expanded={isResourcesOpen}
            aria-controls="resources-menu"
            onClick={() => handleMenuToggle("resources")}
          >
            Resources <span className="nav-caret" aria-hidden="true">▾</span>
          </button>
          <div id="resources-menu" className="nav-dropdown nav-dropdown--resources" role="menu">
            <div className="mega-grid mega-grid--resources">
              {resourcesColumns.map((column) => (
                <MegaColumn key={column.title} column={column} onNavigate={handleNavLinkClick} />
              ))}
            </div>
          </div>
        </div>

        <Link className="nav-link-static" to="/pricing" onClick={handleNavLinkClick}>
          Pricing
        </Link>

        <div className="nav-mobile-links">
          <Link className="nav-mobile-link" to="/login" onClick={handleNavLinkClick}>
            Sign in
          </Link>
          <Link className="nav-mobile-link nav-mobile-link--cta" to="/signup" onClick={handleNavLinkClick}>
            Get started free
          </Link>
        </div>
      </nav>

      <div className="nav-actions">
        <button
          type="button"
          className="button button-ghost nav-toggle"
          aria-label="Toggle navigation"
          aria-controls="primary-navigation"
          aria-expanded={isMobileNavOpen}
          onClick={handleMobileNavToggle}
        >
          <FontAwesomeIcon icon={isMobileNavOpen ? faXmark : faBars} />
        </button>

        <Link to="/login" className="nav-signin" onClick={handleNavLinkClick}>
          Sign in
        </Link>
        <Link to="/signup" className="button button-primary nav-cta" onClick={handleNavLinkClick}>
          Get started free
        </Link>

        <button
          className="theme-toggle icon-only"
          type="button"
          onClick={onToggleTheme}
          aria-label={nextThemeLabel}
        >
          <FontAwesomeIcon icon={currentTheme === "dark" ? faSun : faMoon} />
        </button>
      </div>
    </header>
  );
}
