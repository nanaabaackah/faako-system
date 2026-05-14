import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HiMenuAlt3, HiOutlineSearch, HiX } from "react-icons/hi";
import "../styles/components/Header.css";

const NAV_LINKS = [
  { label: "About Us",  to: "/about" },
  { label: "Services",  to: "/services" },
  { label: "Store",     to: "/shop" },
  { label: "Resources", to: "/resources" },
];

// Routes with an image hero — header sits on top of dark imagery, so it stays transparent (white text) until scrolled.
// Every other route gets the dark variant from the start so the white text isn't invisible.
const HERO_ROUTES = new Set<string>([
  "/",
  "/about",
  "/services",
  "/shop",
  "/resources",
  "/contact",
]);

const Header: React.FC = () => {
  const [scrolled, setScrolled]     = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [query, setQuery]           = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const hasHero = HERO_ROUTES.has(location.pathname);
  const isDark = scrolled || !hasHero;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    if (searchOpen || menuOpen) {
      body.style.overflow = "hidden";
    } else {
      body.style.overflow = previousOverflow || "";
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [menuOpen, searchOpen]);

  const handleSearch = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    setQuery("");
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <header
        className={`page-header${
          isDark ? " page-header--scrolled" : " page-header--transparent"
        }${!hasHero ? " page-header--static" : ""}`}
      >
        <div className="page-header__inner">

          {/* Logo — far left */}
          <Link to="/">
            <img
              src="/assets/logos/logo_long.png"
              alt="Stroane Solutions"
              className="page-header__logo"
            />
          </Link>

          {/* Nav — absolutely centred */}
          <nav className="page-header__nav" aria-label="Main navigation">
            <ul className="page-header__links">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Actions — far right */}
          <div className="page-header__actions">
            <button
              className={`nav-search-btn${isDark ? " nav-search-btn--dark" : ""}`}
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
              aria-label="Open search"
            >
              <HiOutlineSearch size={18} aria-hidden="true" />
            </button>
            <button
              className={`page-header__menu-btn${isDark ? " page-header__menu-btn--dark" : ""}`}
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="stroane-mobile-nav"
            >
              {menuOpen ? <HiX size={22} aria-hidden="true" /> : <HiMenuAlt3 size={22} aria-hidden="true" />}
            </button>
          </div>

        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            id="stroane-mobile-nav"
            className="mobile-nav-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-nav-sheet__header">
              <Link to="/" className="mobile-nav-sheet__brand" onClick={() => setMenuOpen(false)}>
                <img
                  src="/assets/logos/logo_long.png"
                  alt="Stroane Solutions"
                  className="mobile-nav-sheet__logo"
                />
              </Link>
              <button
                type="button"
                className="mobile-nav-sheet__close"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <HiX size={20} aria-hidden="true" />
              </button>
            </div>

            <nav className="mobile-nav-sheet__body" aria-label="Mobile navigation">
              <div className="mobile-nav-sheet__links">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="mobile-nav-sheet__link"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <button
                type="button"
                className="mobile-nav-sheet__search"
                onClick={() => {
                  setMenuOpen(false);
                  setSearchOpen(true);
                }}
              >
                <HiOutlineSearch size={18} aria-hidden="true" />
                <span>Search the site</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-overlay__box" onClick={(e) => e.stopPropagation()}>
            <span className="search-overlay__icon">
              <HiOutlineSearch size={18} aria-hidden="true" />
            </span>
            <form onSubmit={handleSearch} className="search-overlay__form">
              <input
                autoFocus
                type="search"
                className="search-overlay__input"
                placeholder="Search services, resources, products…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
            <kbd className="search-overlay__esc" onClick={() => setSearchOpen(false)}>esc</kbd>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
