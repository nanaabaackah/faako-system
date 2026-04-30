import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineSearch } from "react-icons/hi";
import "../styles/components/Header.css";

const NAV_LINKS = [
  { label: "About Us",  to: "/about" },
  { label: "Services",  to: "/services" },
  { label: "Store",     to: "/shop" },
  { label: "Resources", to: "/resources" },
];

const FloatingHeader: React.FC = () => {
  const [scrolled, setScrolled]       = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [query, setQuery]             = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      {/* ── In-hero header (fades out on scroll) ── */}
      <div className={`hero-header${scrolled ? " is-hidden" : ""}`}>
        {/* White logo tab */}
        <div className="logo-tab">
          <img
            src="/assets/logos/logo_long.svg"
            alt="Stroane Solutions"
            className="logo-tab__img"
          />
        </div>

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

        {/* Nav */}
        <nav className="navbar flex-1 flex justify-center">
          <ul className="navbar-links flex items-center gap-10 text-white text-[15px] font-medium list-none m-0 p-0">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="hover:opacity-75 transition-opacity">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                className="nav-search-btn"
                onClick={() => setSearchOpen(true)}
                aria-label="Open search"
              >
                <HiOutlineSearch size={18} aria-hidden="true" />
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* ── Scrolled fixed header ── */}
      {scrolled && (
        <header className="scrolled-header">
          <div className="scrolled-header__inner">
            <img
              src="/assets/logos/logo_long.svg"
              alt="Stroane Solutions"
              className="scrolled-header__logo"
            />
            <nav>
              <ul className="scrolled-header__links">
                {NAV_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
                <li>
                  <button
                    className="nav-search-btn nav-search-btn--dark"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Open search"
                  >
                    <HiOutlineSearch size={18} aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </header>
      )}

      {/* ── Search overlay ── */}
      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-overlay__box" onClick={(e) => e.stopPropagation()}>
            <span className="search-overlay__icon"><HiOutlineSearch size={18} aria-hidden="true" /></span>
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

export default FloatingHeader;
