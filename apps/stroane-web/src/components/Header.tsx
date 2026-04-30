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

const Header: React.FC = () => {
  const [scrolled, setScrolled]     = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery]           = useState("");
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
      <header className={`page-header${scrolled ? " page-header--scrolled" : " page-header--transparent"}`}>
        <div className="page-header__inner">

          {/* Logo — far left */}
          <Link to="/">
            <img
              src="/assets/logos/logo_long.svg"
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
              className={`nav-search-btn${scrolled ? " nav-search-btn--dark" : ""}`}
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
            >
              <HiOutlineSearch size={18} aria-hidden="true" />
            </button>
          </div>

        </div>
      </header>

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
