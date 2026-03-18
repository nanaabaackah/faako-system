import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Home2, Moon, Sun1 } from 'iconsax-react';
import { HiBars3, HiXMark } from 'react-icons/hi2';
import '../styles/components/Navbar.css';

const NAV_ITEMS = [
  { href: '/about', label: 'About' },
  { href: '/projects', label: 'Projects' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

const isLinkActive = (href, pathname) => {
  if (href === '/') return pathname === '/';

  return pathname === href || pathname.startsWith(`${href}/`);
};

function Navbar({ themeControls, lightBrand = false }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const navWrapRef = useRef(null);
  const location = useLocation();

  const resolvedTheme = themeControls?.resolvedTheme ?? 'light';
  const usingSystem = themeControls?.usingSystem ?? true;
  const isDarkTheme = resolvedTheme === 'dark';
  const ThemeIcon = isDarkTheme ? Sun1 : Moon;
  const logoSrc = isDarkTheme || lightBrand ? '/assets/bn.svg' : '/assets/bn-LONG.svg';

  useEffect(() => {
    const handleScroll = () => {
      const nextScrolled = window.scrollY > 20;
      setIsScrolled(nextScrolled);

      if (!nextScrolled) {
        setIsMenuExpanded(false);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuExpanded(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!(isScrolled && isMenuExpanded)) return undefined;

    const handlePointerDown = (event) => {
      if (!navWrapRef.current?.contains(event.target)) {
        setIsMenuExpanded(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isScrolled, isMenuExpanded]);

  const navStateClass = useMemo(() => {
    if (isScrolled) return 'is-scrolled';
    return 'is-resting';
  }, [isScrolled]);

  const handleMenuToggle = () => {
    if (!isScrolled) return;
    setIsMenuExpanded((prev) => !prev);
  };

  const handleThemeToggle = (event) => {
    if (event.shiftKey && themeControls?.resetToSystem) {
      event.preventDefault();
      themeControls.resetToSystem();
      return;
    }
    themeControls?.toggleTheme?.();
  };

  return (
    <header className="site-chrome" role="banner">
      <a className="site-logo-pin" href="/" aria-label="Go to home">
        <img src={logoSrc} alt="By Nana logo" loading="lazy" />
      </a>

      <div
        ref={navWrapRef}
        className={`site-nav-wrap ${navStateClass} ${isMenuExpanded ? 'is-expanded' : ''}`}
      >
        <button
          type="button"
          className={`site-nav-toggle ${isScrolled ? 'is-visible' : ''} ${isMenuExpanded ? 'is-active' : ''}`}
          onClick={handleMenuToggle}
          aria-expanded={isMenuExpanded}
          aria-controls="primary-navigation"
          aria-label={isMenuExpanded ? 'Collapse navigation menu' : 'Expand navigation menu'}
        >
          {isMenuExpanded ? <HiXMark size={18} aria-hidden="true" /> : <HiBars3 size={18} aria-hidden="true" />}
          <span>{isMenuExpanded ? 'Close' : 'Menu'}</span>
        </button>

        <nav
          id="primary-navigation"
          className={`site-nav ${navStateClass} ${isMenuExpanded ? 'is-expanded' : ''}`}
          aria-label="Primary"
        >
          <div className="site-nav__inner">
            <a
              href="/"
              className={`site-nav__home ${isLinkActive('/', location.pathname) ? 'is-active' : ''}`}
              aria-label="Home"
              aria-current={isLinkActive('/', location.pathname) ? 'page' : undefined}
            >
              <Home2 size={18} variant="Bold" aria-hidden="true" />
              <span className="site-nav__home-text">Home</span>
            </a>

            <ul className="site-nav__links">
              {NAV_ITEMS.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    className={`site-nav__link ${isLinkActive(href, location.pathname) ? 'is-active' : ''}`}
                    aria-current={isLinkActive(href, location.pathname) ? 'page' : undefined}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="site-nav__theme"
              onClick={handleThemeToggle}
              aria-pressed={isDarkTheme}
              aria-label={usingSystem ? `Theme: auto (${resolvedTheme})` : `Theme: ${resolvedTheme}`}
              title="Toggle theme (Shift+Click to follow system)"
            >
              <ThemeIcon size={18} variant="Bold" aria-hidden="true" />
              <span>{usingSystem ? 'Auto' : isDarkTheme ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </nav>
      </div>

      <nav className="site-nav-mobile" aria-label="Mobile navigation">
        <ul className="site-nav-mobile__list">
          <li>
            <a
              href="/"
              className={`site-nav-mobile__link ${isLinkActive('/', location.pathname) ? 'is-active' : ''}`}
              aria-label="Home"
            >
              <Home2 size={18} variant="Bold" aria-hidden="true" />
            </a>
          </li>
          {NAV_ITEMS.map(({ href, label }) => (
            <li key={`mob-${href}`}>
              <a
                href={href}
                className={`site-nav-mobile__link ${isLinkActive(href, location.pathname) ? 'is-active' : ''}`}
              >
                {label}
              </a>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="site-nav-mobile__link site-nav-mobile__theme"
              onClick={handleThemeToggle}
              aria-pressed={isDarkTheme}
              aria-label="Toggle theme"
            >
              <ThemeIcon size={18} variant="Bold" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Navbar;
