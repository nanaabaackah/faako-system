import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import "./Navbar.css";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from "../AuthContext/AuthContext";
import { useCart } from "../CartContext/CartContext";
import { SUPPORTED_CURRENCIES } from "../CurrencyContext/CurrencyContext";
import { AppIcon } from "/src/components/Icon/Icon";
import { faMagnifyingGlass, faShoppingCart, faSignInAlt, faTimes, faUser } from "/src/icons/iconSet";
import { fetchInventoryWithCache, splitInventory } from '/src/utils/inventoryCache';
import { isOnlineShopItem, isTestCategoryItem } from '/src/utils/frontendInventoryFilters';
import { getCatalogItemDisplayName } from '/src/utils/itemMediaBackgrounds';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Shop', path: '/Shop' },
  { label: 'Rentals', path: '/Rentals' },
  { label: 'Contact', path: '/Contact' }
];

const PORTAL_HOSTNAME = 'portal.reebspartythemes.com';
const PORTAL_LOGIN_URL = `https://${PORTAL_HOSTNAME}/login`;

const SEARCH_SHORTCUTS = [
  {
    kind: 'page',
    label: 'Quick Link',
    title: 'Book your party',
    description: 'Start a booking request, package inquiry, or event plan.',
    path: '/book',
    keywords: 'book booking quote reserve rental event plan party',
    featured: true,
    priority: 24,
  },
  {
    kind: 'page',
    label: 'Quick Link',
    title: 'Shop essentials',
    description: 'Browse balloons, decor, household supplies, and party add-ons.',
    path: '/shop',
    keywords: 'shop balloons decor tableware household stationery supplies cart',
    featured: true,
    priority: 22,
  },
  {
    kind: 'page',
    label: 'Quick Link',
    title: 'Explore rentals',
    description: 'See bouncy castles, games, setup rentals, and concessions.',
    path: '/rentals',
    keywords: 'rentals bouncy castle concession setup indoor games bounce house',
    featured: true,
    priority: 20,
  },
  {
    kind: 'page',
    label: 'Quick Link',
    title: 'Talk to REEBS',
    description: 'Get in touch for planning help, pricing, and delivery questions.',
    path: '/contact',
    keywords: 'contact phone email whatsapp support help delivery pricing',
    featured: true,
    priority: 18,
  },
  {
    kind: 'page',
    label: 'Info',
    title: 'About REEBS',
    description: 'Learn more about REEBS, our style, and how we plan memorable events.',
    path: '/about',
    keywords: 'about reebs story company event planner ghana party themes team',
    featured: false,
    priority: 14,
  },
  {
    kind: 'page',
    label: 'Info',
    title: 'Read FAQs',
    description: 'Find quick answers about bookings, timing, payments, and delivery.',
    path: '/faq',
    keywords: 'faq questions answers delivery payments setup timing',
    featured: false,
    priority: 12,
  },
];

const AI_SEARCH_GUIDES = [
  {
    path: '/rentals',
    title: 'This sounds like a rental request',
    description: 'Jump into rentals for bounce houses, party setups, games, and bookable equipment.',
    keywords: 'rental rentals rent bounce bouncy castle trampoline jenga machine popcorn snow cone cotton candy setup chair table canopy game',
  },
  {
    path: '/shop',
    title: 'This looks like a shop item search',
    description: 'Open the shop for balloons, decor, household supplies, tableware, and party add-ons.',
    keywords: 'shop buy balloon balloons decor tableware supplies supply household stationery gift party disposable plate cup favor',
  },
  {
    path: '/book',
    title: 'Start a booking or quote request',
    description: 'Head to the booking form for event details, package planning, and date-based requests.',
    keywords: 'book booking reserve reservation quote quote pricing price date event package bundle availability available',
  },
  {
    path: '/contact',
    title: 'Talk to REEBS directly',
    description: 'Best for delivery questions, timing, custom themes, and anything that needs a quick answer.',
    keywords: 'help support contact whatsapp call email delivery setup timing urgent custom theme question ask',
  },
];

const normalizeSearchValue = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase();

const getSearchItemCategory = (item = {}) =>
  item.specificCategory || item.specificcategory || item.type || item.category || 'General';

const buildInventorySearchEntries = (items = []) => {
  const visibleItems = items.filter((item) => !isTestCategoryItem(item));
  const { rentals, products } = splitInventory(visibleItems);

  const rentalEntries = rentals
    .filter((item) => (item.status ?? item.isActive) !== false)
    .map((item) => ({
      kind: 'rental',
      label: 'Rental',
      title: getCatalogItemDisplayName(item, 'Rental item'),
      description: `Rental · ${getSearchItemCategory(item)}`,
      path: `/rentals?q=${encodeURIComponent(item.name || '')}`,
      keywords: [
        item.name,
        getCatalogItemDisplayName(item, ''),
        item.description,
        item.specificCategory,
        item.specificcategory,
        item.category,
        item.type,
        'rental',
      ]
        .filter(Boolean)
        .join(' '),
      priority: 10,
    }));

  const productEntries = products
    .filter((item) => isOnlineShopItem(item))
    .map((item) => ({
      kind: 'shop',
      label: 'Shop Item',
      title: getCatalogItemDisplayName(item, 'Shop item'),
      description: `Shop · ${getSearchItemCategory(item)}`,
      path: `/shop?q=${encodeURIComponent(item.name || '')}`,
      keywords: [
        item.name,
        getCatalogItemDisplayName(item, ''),
        item.description,
        item.specificCategory,
        item.specificcategory,
        item.category,
        item.type,
        'shop',
      ]
        .filter(Boolean)
        .join(' '),
      priority: 8,
    }));

  return [...rentalEntries, ...productEntries].filter((entry) => entry.title);
};

const getSearchScore = (entry, query) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return entry.priority || 0;

  const title = normalizeSearchValue(entry.title);
  const description = normalizeSearchValue(entry.description);
  const keywords = normalizeSearchValue(entry.keywords);
  let score = entry.priority || 0;

  if (title === normalizedQuery) score += 160;
  if (title.startsWith(normalizedQuery)) score += 110;
  if (title.includes(normalizedQuery)) score += 72;
  if (keywords.includes(normalizedQuery)) score += 42;
  if (description.includes(normalizedQuery)) score += 24;

  normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      if (title.includes(token)) {
        score += 20;
      } else if (keywords.includes(token)) {
        score += 10;
      } else if (description.includes(token)) {
        score += 6;
      }
    });

  return score;
};

const getSearchResults = (query, inventoryEntries = []) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return [...SEARCH_SHORTCUTS]
      .filter((entry) => entry.featured)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 4);
  }

  return [...SEARCH_SHORTCUTS, ...inventoryEntries]
    .map((entry) => ({ entry, score: getSearchScore(entry, normalizedQuery) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return `${a.entry.title || ''}`.localeCompare(`${b.entry.title || ''}`);
    })
    .slice(0, 8)
    .map(({ entry }) => entry);
};

const getAiSearchGuide = (query) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return null;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  let bestGuide = null;
  let bestScore = 0;

  AI_SEARCH_GUIDES.forEach((guide) => {
    const keywords = normalizeSearchValue(guide.keywords);
    let score = 0;

    tokens.forEach((token) => {
      if (keywords.includes(token)) {
        score += 18;
      }
      if (normalizeSearchValue(guide.title).includes(token)) {
        score += 12;
      }
      if (normalizeSearchValue(guide.description).includes(token)) {
        score += 6;
      }
    });

    if (score > bestScore) {
      bestGuide = guide;
      bestScore = score;
    }
  });

  if (bestGuide && bestScore > 0) {
    const includeQuery = bestGuide.path === '/shop' || bestGuide.path === '/rentals';
    return {
      kind: 'ai',
      label: 'AI Guide',
      title: bestGuide.title,
      description: bestGuide.description,
      path: includeQuery ? `${bestGuide.path}?q=${encodeURIComponent(query.trim())}` : bestGuide.path,
    };
  }

  return {
    kind: 'ai',
    label: 'AI Guide',
    title: `Ask about "${query.trim()}"`,
    description: 'No exact hit yet. Open contact for a tailored recommendation from REEBS.',
    path: '/contact',
  };
};

const getNavbarLoginTarget = () => {
  if (!import.meta.env?.PROD || typeof window === 'undefined') {
    return '/login';
  }

  const currentHost = window.location.hostname.toLowerCase();
  if (currentHost === PORTAL_HOSTNAME) {
    return '/login';
  }

  return PORTAL_LOGIN_URL;
};

const isPathActive = (pathname, path) => {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
};

const Navbar = ({ scrollContainerRef }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, authReady } = useAuth();
  const { cart, openCart, currency, setCurrency } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndexReady, setSearchIndexReady] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [inventorySearchEntries, setInventorySearchEntries] = useState([]);
  const searchInputRef = useRef(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let rafId = null;
    const scrollHost = scrollContainerRef?.current || window;
    const usingWindow = scrollHost === window;

    const getScrollTop = () =>
      usingWindow ? window.scrollY || window.pageYOffset || 0 : scrollHost.scrollTop;

    const handleScroll = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const next = getScrollTop() > 42;
        setScrolled((prev) => (prev === next ? prev : next));
      });
    };

    handleScroll();
    scrollHost.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId);
      scrollHost.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname, scrollContainerRef]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia('(max-width: 980px)');
    const handleChange = () => {
      if (!media.matches) {
        setMobileOpen(false);
      }
    };

    handleChange();
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const rafId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!searchOpen || searchIndexReady) return undefined;

    let isMounted = true;
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError('');

    fetchInventoryWithCache({ signal: controller.signal })
      .then(({ items }) => {
        if (!isMounted) return;
        setInventorySearchEntries(buildInventorySearchEntries(Array.isArray(items) ? items : []));
      })
      .catch((error) => {
        if (!isMounted || error?.name === 'AbortError') return;
        console.error('Error loading site search index:', error);
        setSearchError('Search shortcuts are ready, but inventory results could not load.');
      })
      .finally(() => {
        if (!isMounted) return;
        setSearchLoading(false);
        setSearchIndexReady(true);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [searchIndexReady, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/login', { replace: true, state: { signedOut: true } });
  };

  const isAuthenticated = Boolean(authReady && user);
  const authPath = isAuthenticated ? '/admin' : getNavbarLoginTarget();
  const useExternalAuthPath = !isAuthenticated && authPath.startsWith('http');
  const authLabel = authReady && user ? 'Dashboard' : 'Sign in';
  const authIcon = authReady && user ? faUser : faSignInAlt;
  const cartItemCount = cart.reduce(
    (total, item) => total + Number(item?.cartQuantity || 1),
    0
  );
  const cartAriaLabel =
    cartItemCount > 0 ? `Cart with ${cartItemCount} items` : 'Cart';
  const searchResults = getSearchResults(deferredSearchQuery, inventorySearchEntries);
  const hasSearchQuery = Boolean(deferredSearchQuery.trim());
  const aiSearchGuide = hasSearchQuery ? getAiSearchGuide(deferredSearchQuery) : null;
  const displayedSearchResults = aiSearchGuide
    ? [aiSearchGuide, ...searchResults.filter((result) => result.path !== aiSearchGuide.path)]
        .slice(0, 8)
    : searchResults;

  const handleHeaderWheel = (event) => {
    const scrollHost = scrollContainerRef?.current;
    if (!scrollHost) return;
    if (event.defaultPrevented) return;
    if (event.deltaY === 0 && event.deltaX === 0) return;

    scrollHost.scrollBy({
      top: event.deltaY,
      left: event.deltaX,
      behavior: 'auto',
    });
    event.preventDefault();
  };

  const openSearch = () => {
    setMobileOpen(false);
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  const handleCartOpen = () => {
    setMobileOpen(false);
    openCart();
  };

  const handleSearchNavigate = (path) => {
    closeSearch();
    navigate(path);
  };

  const renderLinks = (onClick) => (
    <ul className="navbar-links" role="list">
      {NAV_LINKS.map((item) => (
        <li key={item.path}>
          <Link
            to={item.path}
            className={isPathActive(location.pathname, item.path) ? 'is-active' : ''}
            aria-current={isPathActive(location.pathname, item.path) ? 'page' : undefined}
            onClick={onClick}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  const renderSearchTrigger = (className = '') => (
    <button
      type="button"
      className={`navbar-search-btn navbar-icon-btn ${className}`.trim()}
      aria-label="Open site search"
      title="Search REEBS"
      onClick={openSearch}
    >
      <AppIcon icon={faMagnifyingGlass} aria-hidden="true" />
      <span className="sr-only">Search</span>
    </button>
  );

  const renderCurrencySelect = (className = '') => (
    <select
      value={currency}
      onChange={(event) => setCurrency(event.target.value)}
      className={`navbar-currency-select ${className}`.trim()}
      aria-label="Set global currency"
      title="Set global currency"
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );

  const renderAuthAction = (onClick) => {
    if (useExternalAuthPath) {
      return (
        <a
          href={authPath}
          className="navbar-signin navbar-icon-btn"
          aria-label={authLabel}
          title={authLabel}
          onClick={onClick}
        >
          <AppIcon icon={authIcon} aria-hidden="true" />
          <span className="sr-only">{authLabel}</span>
        </a>
      );
    }

    return (
      <Link
        to={authPath}
        className="navbar-signin navbar-icon-btn"
        aria-label={authLabel}
        title={authLabel}
        onClick={onClick}
      >
        <AppIcon icon={authIcon} aria-hidden="true" />
        <span className="sr-only">{authLabel}</span>
      </Link>
    );
  };

  return (
    <header className="site-header" onWheel={handleHeaderWheel}>
      <div className="navbar-top-rail" aria-hidden="true" />
      {mobileOpen ? (
        <button
          type="button"
          className="navbar-mobile-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <nav className={`navbar navbar-desktop ${scrolled ? 'is-scrolled' : ''}`} aria-label="Main navigation">
        <div className="navbar-corner navbar-corner-left" aria-hidden="true">
          <svg viewBox="0 0 44 44" focusable="false" role="presentation">
            <path d="M0 0H44V44C44 19.7 40 0 0 0Z" />
          </svg>
        </div>
        <div className="navbar-corner navbar-corner-right" aria-hidden="true">
          <svg viewBox="0 0 44 44" focusable="false" role="presentation">
            <path d="M0 0H44V44C44 19.7 40 0 0 0Z" />
          </svg>
        </div>

        <div className="navbar-col navbar-col-links">
          {renderLinks()}
        </div>

        <div className="navbar-col navbar-col-logo">
          <Link to="/" className="navbar-logo-link" aria-label="REEBS home">
            <img
              src="/imgs/brand/reebs_logo.svg"
              alt="REEBS"
              width="174"
              height="58"
              decoding="async"
            />
          </Link>
        </div>

        <div className="navbar-col navbar-col-actions">
          {renderCurrencySelect()}
          {renderSearchTrigger()}
          <button
            type="button"
            className="navbar-cart-btn navbar-icon-btn"
            aria-label={cartAriaLabel}
            title={cartAriaLabel}
            onClick={handleCartOpen}
          >
            <AppIcon icon={faShoppingCart} aria-hidden="true" />
            <span className="sr-only">Cart</span>
            {cartItemCount > 0 ? (
              <span className="navbar-cart-count" aria-hidden="true">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            ) : null}
          </button>
          {renderAuthAction()}
          {authReady && user ? (
            <button type="button" className="navbar-signout" onClick={handleLogout}>
              Sign out
            </button>
          ) : null}
        </div>
      </nav>

      <nav className={`navbar navbar-mobile ${mobileOpen ? 'is-open' : ''}`} aria-label="Mobile navigation">
        <div className="navbar-mobile-top">
          <Link to="/" className="navbar-logo-link" aria-label="REEBS home">
            <img
              src="/imgs/brand/reebs_logo.svg"
              alt="REEBS"
              width="164"
              height="54"
              decoding="async"
            />
          </Link>
          <div className="navbar-mobile-top-actions">
            {renderSearchTrigger('navbar-search-btn-mobile')}
            <button
              type="button"
              className="navbar-mobile-toggle"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        <div className={`navbar-mobile-panel ${mobileOpen ? 'is-open' : ''}`}>
          {renderLinks(() => setMobileOpen(false))}
          <div className="navbar-mobile-actions">
            {renderCurrencySelect('navbar-currency-select-mobile')}
            <button
              type="button"
              className="navbar-cart-btn navbar-icon-btn"
              aria-label={cartAriaLabel}
              title={cartAriaLabel}
              onClick={handleCartOpen}
            >
              <AppIcon icon={faShoppingCart} aria-hidden="true" />
              <span className="sr-only">Cart</span>
              {cartItemCount > 0 ? (
                <span className="navbar-cart-count" aria-hidden="true">
                  {cartItemCount > 99 ? "99+" : cartItemCount}
                </span>
              ) : null}
            </button>
            {renderAuthAction(() => setMobileOpen(false))}
            {authReady && user ? (
              <button type="button" className="navbar-signout" onClick={handleLogout}>
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      {searchOpen ? (
        <div className="navbar-search-layer" role="dialog" aria-modal="true" aria-labelledby="site-search-title">
          <button type="button" className="navbar-search-backdrop" onClick={closeSearch} aria-label="Close search" />
          <div className="navbar-search-dialog">
            <div className="navbar-search-header">
              <div>
                <p className="navbar-search-kicker">Sitewide Search</p>
                <h2 id="site-search-title">Find pages, rentals, and shop items</h2>
              </div>
              <button
                type="button"
                className="navbar-search-close"
                onClick={closeSearch}
                aria-label="Close search"
              >
                <AppIcon icon={faTimes} aria-hidden="true" />
              </button>
            </div>

            <div className="navbar-search-field">
              <AppIcon icon={faMagnifyingGlass} className="navbar-search-field-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search booking help, bouncy castles, balloons, decor..."
                aria-label="Search the site"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="navbar-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <AppIcon icon={faTimes} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <p className="navbar-search-note">
              Smart matching across core pages, rental inventory, and shop inventory.
            </p>

            <div className="navbar-search-results">
              {searchLoading && !searchIndexReady ? (
                <p className="navbar-search-status">Loading live inventory results...</p>
              ) : null}

              {searchError ? (
                <p className="navbar-search-status is-warning">{searchError}</p>
              ) : null}

              {displayedSearchResults.length ? (
                <>
                  <p className="navbar-search-section-label">
                    {hasSearchQuery ? 'Smart Matches' : 'Quick Links'}
                  </p>
                  <div className="navbar-search-result-list" role="list">
                    {displayedSearchResults.map((result) => (
                      <button
                        key={`${result.path}-${result.title}`}
                        type="button"
                        className={`navbar-search-result ${result.kind === 'ai' ? 'is-ai-guide' : ''}`.trim()}
                        role="listitem"
                        onClick={() => handleSearchNavigate(result.path)}
                      >
                        <span className="navbar-search-result-meta">{result.label}</span>
                        <strong>{result.title}</strong>
                        <span>{result.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : hasSearchQuery ? (
                <div className="navbar-search-empty">
                  <p>No direct matches found for "{deferredSearchQuery.trim()}".</p>
                  <button type="button" className="navbar-search-fallback" onClick={() => handleSearchNavigate('/contact')}>
                    Ask REEBS for help instead
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
