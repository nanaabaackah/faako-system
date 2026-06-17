import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  HiMenuAlt3,
  HiOutlineSearch,
  HiX,
  HiArrowRight,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineShoppingCart,
} from "react-icons/hi";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { PORTAL_LOGIN_URL } from "../config/appSurface";
import "../styles/components/Header.css";

const NAV_LINKS = [
  { label: "About Us",  to: "/about" },
  { label: "Services",  to: "/services" },
  { label: "Shop",     to: "/shop" },
  { label: "Resources", to: "/resources" },
];

const SEARCH_SUGGESTIONS = [
  "Food safety audits",
  "HACCP",
  "Ghana FDA compliance",
  "Thermometers",
];

const FloatingHeader: React.FC = () => {
  const [scrolled, setScrolled]       = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [query, setQuery]             = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { totalCount } = useCart();

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

  const submitSearch = (value = query) => {
    const q = value.trim();
    setSearchOpen(false);
    setQuery("");
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const handleSearch = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitSearch();
  };

  const cartAriaLabel = `View cart${
    totalCount ? `, ${totalCount} item${totalCount === 1 ? "" : "s"}` : ""
  }`;

  const renderCartButton = (dark = false) => (
    <Link
      to="/checkout"
      className={`nav-search-btn nav-cart-btn${dark ? " nav-search-btn--dark" : ""}`}
      aria-label={cartAriaLabel}
    >
      <HiOutlineShoppingCart size={18} aria-hidden="true" />
      {totalCount ? <span className="nav-cart-btn__count">{totalCount}</span> : null}
    </Link>
  );

  return (
    <>
      {/* ── In-hero header (fades out on scroll) ── */}
      <div className={`hero-header${scrolled ? " is-hidden" : ""}`}>
        {/* White logo tab */}
        <Link to="/" className="logo-tab" aria-label="Stroane Solutions home">
          <img
            src="/assets/logos/logo_long.png"
            alt="Stroane Solutions"
            className="logo-tab__img"
          />
        </Link>

        {/* Concave corner — bottom of logo tab */}
        <div className="logo-tab__corner logo-tab__corner--bottom" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 44 44" focusable="false" role="presentation">
            <path d="M0 0H44V44C44 5 45 0 0 0Z" fill="var(--color-white)" />
          </svg>
        </div>

        {/* Concave corner — right of logo tab */}
        <div className="logo-tab__corner logo-tab__corner--right" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 44 44" focusable="false" role="presentation">
            <path d="M0 0H44V44C44 5 45 0 0 0Z" fill="var(--color-white)" />
          </svg>
        </div>

        <div className="hero-header__actions">
          <button
            className="nav-search-btn"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
            aria-label="Open search"
          >
            <HiOutlineSearch size={18} aria-hidden="true" />
          </button>
          {renderCartButton()}
          {user ? (
            <button
              className="nav-search-btn"
              type="button"
              onClick={signOut}
              aria-label={`Sign out (${user.name})`}
              title={`Sign out — ${user.name}`}
            >
              <HiOutlineLogout size={18} aria-hidden="true" />
            </button>
          ) : (
            <a
              href={PORTAL_LOGIN_URL}
              className="nav-search-btn"
              aria-label="Open admin portal"
              title="Open admin portal"
            >
              <HiOutlineUser size={20} aria-hidden="true" />
            </a>
          )}
          <Link to="/contact" className="page-header__cta">
            Contact Stroane
          </Link>
          <button
            className="hero-header__menu-btn"
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="stroane-floating-mobile-nav"
          >
            {menuOpen ? <HiX size={22} aria-hidden="true" /> : <HiMenuAlt3 size={22} aria-hidden="true" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="navbar flex-1 flex justify-center">
          <ul className="navbar-links flex items-center gap-10 text-white text-[15px] font-medium list-none m-0 p-0">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `hover:opacity-75 transition-opacity${isActive ? " is-active" : ""}`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li className="navbar-actions">
              <button
                className="nav-search-btn"
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Open search"
              >
                <HiOutlineSearch size={18} aria-hidden="true" />
              </button>
              {renderCartButton()}
              {user ? (
                <button
                  className="nav-search-btn"
                  type="button"
                  onClick={signOut}
                  aria-label={`Sign out (${user.name})`}
                  title={`Sign out — ${user.name}`}
                >
                  <HiOutlineLogout size={18} aria-hidden="true" />
                </button>
              ) : (
                <a
                  href={PORTAL_LOGIN_URL}
                  className="nav-search-btn"
                  aria-label="Open admin portal"
                  title="Open admin portal"
                >
                  <HiOutlineUser size={18} aria-hidden="true" />
                </a>
              )}
              <Link to="/contact" className="navbar-cta">
                Contact Stroane
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* ── Scrolled fixed header ── */}
      {scrolled && (
        <header className="scrolled-header">
          <div className="scrolled-header__inner">
            <Link to="/" aria-label="Stroane Solutions home">
              <img
                src="/assets/logos/logo_long.png"
                alt="Stroane Solutions"
                className="scrolled-header__logo"
              />
            </Link>
            <nav>
              <ul className="scrolled-header__links">
                {NAV_LINKS.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) => (isActive ? "is-active" : "")}
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
                <li className="navbar-actions">
                  <button
                    className="nav-search-btn nav-search-btn--dark"
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Open search"
                  >
                    <HiOutlineSearch size={18} aria-hidden="true" />
                  </button>
                  {renderCartButton(true)}
                  {user ? (
                    <button
                      className="nav-search-btn nav-search-btn--dark"
                      type="button"
                      onClick={signOut}
                      aria-label={`Sign out (${user.name})`}
                      title={`Sign out — ${user.name}`}
                    >
                      <HiOutlineLogout size={18} aria-hidden="true" />
                    </button>
                  ) : (
                    <a
                      href={PORTAL_LOGIN_URL}
                      className="nav-search-btn nav-search-btn--dark"
                      aria-label="Open admin portal"
                      title="Open admin portal"
                    >
                      <HiOutlineUser size={18} aria-hidden="true" />
                    </a>
                  )}
                  <Link to="/contact" className="navbar-cta navbar-cta--dark">
                    Contact Stroane
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="scrolled-header__actions">
              <button
                className="nav-search-btn nav-search-btn--dark"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setSearchOpen(true);
                }}
                aria-label="Open search"
              >
                <HiOutlineSearch size={18} aria-hidden="true" />
              </button>
              {renderCartButton(true)}
              {user ? (
                <button
                  className="nav-search-btn nav-search-btn--dark"
                  type="button"
                  onClick={signOut}
                  aria-label={`Sign out (${user.name})`}
                  title={`Sign out — ${user.name}`}
                >
                  <HiOutlineLogout size={18} aria-hidden="true" />
                </button>
              ) : (
                <a
                  href={PORTAL_LOGIN_URL}
                  className="nav-search-btn nav-search-btn--dark"
                  aria-label="Open admin portal"
                  title="Open admin portal"
                >
                  <HiOutlineUser size={18} aria-hidden="true" />
                </a>
              )}
              <Link
                to="/contact"
                className="page-header__cta page-header__cta--dark"
              >
                Contact Stroane
              </Link>
              <button
                className="page-header__menu-btn page-header__menu-btn--dark"
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={menuOpen}
                aria-controls="stroane-floating-mobile-nav"
              >
                {menuOpen ? <HiX size={22} aria-hidden="true" /> : <HiMenuAlt3 size={22} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </header>
      )}

      {menuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            id="stroane-floating-mobile-nav"
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
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `mobile-nav-sheet__link${isActive ? " is-active" : ""}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="mobile-nav-sheet__label">{link.label}</span>
                    <HiArrowRight
                      className="mobile-nav-sheet__arrow"
                      size={18}
                      aria-hidden="true"
                    />
                  </NavLink>
                ))}
              </div>

              <div className="mobile-nav-sheet__footer">
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
                <Link
                  to="/checkout"
                  className="mobile-nav-sheet__search"
                  aria-label={cartAriaLabel}
                  onClick={() => setMenuOpen(false)}
                >
                  <HiOutlineShoppingCart size={18} aria-hidden="true" />
                  <span>{totalCount ? `Cart (${totalCount})` : "Cart"}</span>
                </Link>
                {user ? (
                  <button
                    type="button"
                    className="mobile-nav-sheet__search"
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                    }}
                  >
                    <HiOutlineLogout size={18} aria-hidden="true" />
                    <span>Sign out ({user.name})</span>
                  </button>
                ) : (
                  <a
                    href={PORTAL_LOGIN_URL}
                    className="mobile-nav-sheet__search"
                    onClick={() => setMenuOpen(false)}
                  >
                    <HiOutlineUser size={18} aria-hidden="true" />
                    <span>Admin portal</span>
                  </a>
                )}
                <Link
                  to="/contact"
                  className="mobile-nav-sheet__cta"
                  onClick={() => setMenuOpen(false)}
                >
                  <span>Contact Stroane</span>
                  <HiArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* ── Search overlay ── */}
      {searchOpen && (
        <div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search Stroane"
          onClick={() => setSearchOpen(false)}
        >
          <div className="search-overlay__box" onClick={(e) => e.stopPropagation()}>
            <div className="search-overlay__row">
              <span className="search-overlay__icon">
                <HiOutlineSearch size={18} aria-hidden="true" />
              </span>
              <form onSubmit={handleSearch} className="search-overlay__form">
                <input
                  autoFocus
                  type="search"
                  className="search-overlay__input"
                  placeholder="Search services, resources, products..."
                  aria-label="Search services, resources, products, and pages"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="search-overlay__submit">
                  Search
                </button>
              </form>
              <button
                type="button"
                className="search-overlay__esc"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                esc
              </button>
            </div>
            <div className="search-overlay__suggestions" aria-label="Suggested searches">
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="search-overlay__suggestion"
                  onClick={() => submitSearch(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingHeader;
