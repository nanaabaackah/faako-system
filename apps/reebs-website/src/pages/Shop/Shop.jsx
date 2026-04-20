import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Shop.css";
import { Link, useSearchParams } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faMagnifyingGlass,
  faTimes,
} from "/src/icons/iconSet";
import AddToCartButton from "/src/components/AddToCartButton/AddToCartButton";
import CookieBanner from "/src/components/CookieBanner/CookieBanner";
import { useAuth } from "/src/components/AuthContext/AuthContext";
import SideNav from "/src/components/SideNav/SideNav";
import SiteLoader from "/src/components/SiteLoader/SiteLoader";
import { useCart } from "/src/components/CartContext/CartContext";
import SearchField from "/src/components/SearchField/SearchField";
import ShopImageAsset from "/src/components/shop/ShopImageAsset";
import {
  isOnlineShopItem,
  isTestCategoryItem,
} from "/src/utils/frontendInventoryFilters";
import { fetchInventoryWithCache, readInventoryCache } from "/src/utils/inventoryCache";
import {
  createCatalogCssImageStyle,
  getCatalogItemBackground,
  getCatalogItemDisplayName,
  getCatalogItemImage,
} from "/src/utils/itemMediaBackgrounds";

const SHOP_CATEGORY_PAGE_SIZE = 15;
const MAX_SHOP_QUERY_LENGTH = 80;
const SEARCH_DIACRITICS = /[\u0300-\u036f]/g;
const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const isUnavailableImageSource = (src = "") => {
  const normalized = src.toString().trim().toLowerCase();
  if (!normalized) return true;
  return normalized.includes("placeholder");
};

const normalizeCategoryKey = (value) => {
  if (value == null) return "";
  return String(value)
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const toTitleCase = (value = "") =>
  value.replace(/\b\w/g, (letter) => letter.toUpperCase());

const clampShopQuery = (value = "") =>
  value
    .toString()
    .slice(0, MAX_SHOP_QUERY_LENGTH);

const normalizeSearchText = (value = "") =>
  value
    .toString()
    .normalize("NFKD")
    .replace(SEARCH_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeShopCategoryLabel = (value = "") => {
  const key = normalizeCategoryKey(value ?? "");
  if (!key) return "Other";

  if (["kids toys", "kid toys", "kids toy", "kid toy"].includes(key)) {
    return "Kids Toys";
  }
  if (["party supplies", "party supply"].includes(key)) {
    return "Party Supplies";
  }
  if (
    [
      "household supplies",
      "household supply",
      "household items",
      "household item",
      "home supplies",
      "home supply",
      "home items",
      "home item",
    ].includes(key)
  ) {
    return "Household Supplies";
  }
  if (["gift items", "gift item"].includes(key)) {
    return "Gift Items";
  }

  return toTitleCase(key);
};
const getCategoryPageState = (items, currentPage = 0) => {
  const pageCount = Math.max(1, Math.ceil(items.length / SHOP_CATEGORY_PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount - 1);
  const start = safePage * SHOP_CATEGORY_PAGE_SIZE;

  return {
    currentPage: safePage,
    pageCount,
    visibleItems: items.slice(start, start + SHOP_CATEGORY_PAGE_SIZE),
  };
};

function Shop() {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announce, setAnnounce] = useState("");
  const [activeHeroPanelIndex, setActiveHeroPanelIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showSideNav, setShowSideNav] = useState(false);
  const [categoryPages, setCategoryPages] = useState({});
  const [pendingScrollTarget, setPendingScrollTarget] = useState("");
  const gridRef = useRef(null);
  const [searchParams] = useSearchParams();

  const { isAuthenticated, authReady } = useAuth();
  const { convertPrice, formatCurrency, openCart } = useCart();
  const routeSearchQuery = clampShopQuery(searchParams.get("q") || "");

  const getPrice = useCallback(
    (item) =>
      item.price ??
      (typeof item.priceCents === "number" ? item.priceCents / 100 : undefined),
    []
  );

  const getQuantity = useCallback((item) => item.quantity ?? item.stock ?? 0, []);

  const getCategoryLabel = useCallback((item) => {
    const raw = item.specificCategory || item.specificcategory || item.type || item.category;
    return normalizeShopCategoryLabel(raw);
  }, []);

  const getShopCategoryBackground = useCallback(
    (item) => getCatalogItemBackground(item),
    []
  );

  const getImage = useCallback((item) => getCatalogItemImage(item), []);

  const getStatusValue = useCallback((item) => {
    if (typeof item?.status === "string") return item.status.toLowerCase();
    if (item?.status === false || item?.isActive === false) return "unavailable";
    return "available";
  }, []);

  const isSoldOutItem = useCallback(
    (item) => getStatusValue(item) === "unavailable" || getQuantity(item) <= 0,
    [getQuantity, getStatusValue]
  );

  const hasRealImage = useCallback((item) => {
    const src = getImage(item);
    return !isUnavailableImageSource(src);
  }, [getImage]);

  useEffect(() => {
    let isMounted = true;
    const cached = readInventoryCache();
    const hasCached = Array.isArray(cached);
    if (hasCached) {
      setInventory(cached.filter(isOnlineShopItem));
    }
    setLoading(!hasCached);

    const controller = new AbortController();
    fetchInventoryWithCache({ signal: controller.signal })
      .then(({ items }) => {
        const visibleProducts = (Array.isArray(items) ? items : []).filter(
          isOnlineShopItem
        );
        if (!isMounted) return;
        setInventory(visibleProducts);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Error fetching shop inventory:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("shop-theme");
    return () => document.body.classList.remove("shop-theme");
  }, []);

  useEffect(() => {
    setSearchQuery(routeSearchQuery);
    setDebouncedQuery(routeSearchQuery);
    if (routeSearchQuery) {
      setCategoryFilter("All");
      setActiveCategory(null);
    }
  }, [routeSearchQuery]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(clampShopQuery(searchQuery)), 200);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const visibleInventory = useMemo(() => {
    if (isAuthenticated) return inventory;
    return inventory.filter((item) => !isTestCategoryItem(item));
  }, [inventory, isAuthenticated]);

  const inventorySearchIndex = useMemo(
    () =>
      visibleInventory.map((item) => {
        const categoryLabel = getCategoryLabel(item);
        return {
          item,
          categoryLabel,
          searchText: normalizeSearchText(
            [
              item?.name,
              item?.description,
              categoryLabel,
              item?.sku,
              item?.specificCategory,
              item?.specificcategory,
            ]
              .filter(Boolean)
              .join(" ")
          ),
        };
      }),
    [visibleInventory, getCategoryLabel]
  );

  const categories = useMemo(() => {
    const uniq = new Set(inventorySearchIndex.map(({ categoryLabel }) => categoryLabel));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [inventorySearchIndex]);

  useEffect(() => {
    if (categoryFilter !== "All" && !categories.includes(categoryFilter)) {
      setCategoryFilter("All");
    }
  }, [categories, categoryFilter]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchText(debouncedQuery);

    return inventorySearchIndex
      .filter(
        ({ item, categoryLabel, searchText }) =>
          (categoryFilter === "All" || categoryLabel === categoryFilter) &&
          (!normalizedQuery || searchText.includes(normalizedQuery)) &&
          (!inStockOnly || !isSoldOutItem(item))
      )
      .map(({ item }) => item)
      .sort((a, b) => {
        const aHasImage = hasRealImage(a);
        const bHasImage = hasRealImage(b);
        if (aHasImage !== bHasImage) return aHasImage ? -1 : 1;

        const aSold = isSoldOutItem(a);
        const bSold = isSoldOutItem(b);
        if (aSold !== bSold) return aSold ? 1 : -1;

        return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
      });
  }, [
    categoryFilter,
    debouncedQuery,
    hasRealImage,
    inventorySearchIndex,
    inStockOnly,
    isSoldOutItem,
  ]);

  const groupedProducts = useMemo(() => {
    const grouped = new Map();
    for (const item of filteredProducts) {
      const category = getCategoryLabel(item);
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(item);
    }

    return Array.from(grouped.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((category) => ({
        category,
        id: slugify(category),
        items: grouped.get(category),
      }));
  }, [filteredProducts, getCategoryLabel]);

  const visibleNavItems = useMemo(
    () => groupedProducts.map(({ category, id }) => ({ id, label: category })),
    [groupedProducts]
  );
  const trimmedSearchQuery = searchQuery.trim();
  const hasActiveFilters = Boolean(
    trimmedSearchQuery || categoryFilter !== "All" || inStockOnly
  );
  const noShopMatches = groupedProducts.length === 0;
  const showCategoryNav = visibleNavItems.length > 0 && !noShopMatches;
  const emptyStateTitle =
    visibleInventory.length === 0
      ? "No shop items are available right now"
      : "No shop items match your current filters";
  const emptyStateMessage =
    visibleInventory.length === 0
      ? "The catalog is temporarily empty. Check back soon or browse rentals while inventory updates."
      : "Try a broader keyword, switch categories, or clear your filters to bring items back.";
  const emptyStateTips = hasActiveFilters
    ? [
        "Try a shorter or broader search term.",
        categoryFilter !== "All"
          ? "Switch back to All categories to widen the results."
          : "Browse a different category to uncover more items.",
        inStockOnly
          ? 'Turn off "In stock only" to include upcoming restocks.'
          : "Use the category filters to narrow the catalog more intentionally.",
      ]
    : [
        "New shop items will appear here as soon as they are live.",
        "Rentals stay available while the retail catalog is updating.",
        "Contact us if you need a specific party or household item sourced quickly.",
      ];

  const resetShopFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setCategoryFilter("All");
    setInStockOnly(false);
  }, []);

  useEffect(() => {
    setCategoryPages((prev) => {
      const next = {};
      let changed = false;

      for (const group of groupedProducts) {
        const { id, items } = group;
        const maxPage = Math.max(0, Math.ceil(items.length / SHOP_CATEGORY_PAGE_SIZE) - 1);
        const currentPage = prev[id] ?? 0;
        const clampedPage = Math.min(currentPage, maxPage);
        next[id] = clampedPage;
        if (clampedPage !== currentPage) {
          changed = true;
        }
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) {
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [groupedProducts]);

  const heroProducts = useMemo(() => {
    const picturedItems = visibleInventory.filter(hasRealImage);
    const ranked = [...picturedItems]
      .filter((item) => !isSoldOutItem(item))
      .sort((a, b) => {
        const qtyDiff = getQuantity(b) - getQuantity(a);
        if (qtyDiff !== 0) return qtyDiff;
        return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
      })
      .slice(0, 4);
    if (ranked.length) return ranked;

    return [...picturedItems]
      .sort((a, b) => {
        const qtyDiff = getQuantity(b) - getQuantity(a);
        if (qtyDiff !== 0) return qtyDiff;
        return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
      })
      .slice(0, 4);
  }, [visibleInventory, getQuantity, hasRealImage, isSoldOutItem]);

  useEffect(() => {
    if (!heroProducts.length) {
      setActiveHeroPanelIndex(0);
      return;
    }
    setActiveHeroPanelIndex((prev) => Math.min(prev, heroProducts.length - 1));
  }, [heroProducts.length]);

  const handleSideNavItemClick = useCallback((id) => {
    const target = document.getElementById(id);
    if (!target) return;

    const scrollHost = document.querySelector(".main");
    const offset = 108;

    if (scrollHost) {
      const hostRect = scrollHost.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = scrollHost.scrollTop + (targetRect.top - hostRect.top) - offset;
      scrollHost.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    } else {
      const nextTop =
        (window.scrollY || window.pageYOffset || 0) +
        target.getBoundingClientRect().top -
        offset;
      window.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    }

    setActiveCategory(id);
  }, []);

  const handleHeroPanelClick = useCallback(
    (item) => {
      const category = getCategoryLabel(item);
      const sectionId = slugify(category);
      setCategoryFilter(category);
      setPendingScrollTarget(sectionId);
    },
    [getCategoryLabel]
  );

  useEffect(() => {
    if (!pendingScrollTarget) return undefined;
    if (!groupedProducts.some(({ id }) => id === pendingScrollTarget)) return undefined;

    const rafId = window.requestAnimationFrame(() => {
      handleSideNavItemClick(pendingScrollTarget);
      setPendingScrollTarget("");
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [groupedProducts, handleSideNavItemClick, pendingScrollTarget]);

  useEffect(() => {
    const scrollHost = document.querySelector(".main");
    const scrollTarget = scrollHost || window;
    const sections = groupedProducts
      .map(({ id }) => document.getElementById(id))
      .filter((section) => section instanceof HTMLElement);

    if (!sections.length) {
      setActiveCategory(null);
      setShowSideNav(false);
      return undefined;
    }

    const getScrollTop = () =>
      scrollHost ? scrollHost.scrollTop : window.scrollY || window.pageYOffset || 0;

    const getOffsetTop = (element) => {
      if (!scrollHost) {
        return element.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
      }
      const hostRect = scrollHost.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      return scrollHost.scrollTop + (elementRect.top - hostRect.top);
    };

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const scrollTop = getScrollTop();
        const activeTrigger = scrollTop + 170;
        let currentId = sections[0].id;

        sections.forEach((section) => {
          if (activeTrigger >= getOffsetTop(section)) {
            currentId = section.id;
          }
        });

        setActiveCategory((prev) => (prev === currentId ? prev : currentId));

        const grid = document.getElementById("shop-catalog");
        if (grid) {
          const showThreshold = getOffsetTop(grid) - 140;
          const shouldShow = scrollTop >= showThreshold;
          setShowSideNav((prev) => (prev === shouldShow ? prev : shouldShow));
        }

        ticking = false;
      });
    };

    handleScroll();
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener("scroll", handleScroll);
  }, [groupedProducts]);

  useEffect(() => {
    const gridEl = gridRef.current;
    if (pendingScrollTarget) return;
    if (!gridEl || typeof gridEl.scrollIntoView !== "function") return;
    gridEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [categoryFilter, pendingScrollTarget]);

  if (loading || !authReady) {
    return (
      <SiteLoader
        label="Loading shop"
        sublabel="Pulling in the latest online-available party supplies."
      />
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <CookieBanner />

      <main className="shop-page page-shell" role="main" id="main">
        <section id="shop-intro" className="shop-hero page-hero" aria-labelledby="shop-hero-heading">
          <div className="shop-hero-copy page-hero-copy">
            <h1 id="shop-hero-heading" className="page-hero-title">Shop everyday and event essentials</h1>
            <p className="shop-sub">
              Party picks, home supplies, stationery, and practical extras ready for quick
              pickup or delivery, with options that still pair smoothly with your rentals.
            </p>

            <div className="shop-hero-actions">
              <button
                className="shop-cart-btn hero-btn hero-btn-primary"
                onClick={() => openCart()}
              >
                View cart
              </button>
              <Link className="hero-btn hero-btn-ghost" to="/rentals">
                Browse rentals
              </Link>
            </div>

          </div>

          {heroProducts.length > 0 && (
            <div className="shop-hero-panels" role="list" aria-label="Popular shop items">
              {heroProducts.map((item, index) => {
                const isActive = index === activeHeroPanelIndex;
                const imageSrc = getImage(item);
                const hasImage = !isUnavailableImageSource(imageSrc);
                const categoryBg = getShopCategoryBackground(item);
                const itemDisplayName = getCatalogItemDisplayName(item, "Popular shop item");
                return (
                  <button
                    type="button"
                    key={item.id || item.productId || `${item.name}-${index}`}
                    className={`shop-hero-panel ${isActive ? "is-active" : ""} ${hasImage ? "" : "is-missing-image"}`}
                    role="listitem"
                    style={createCatalogCssImageStyle(categoryBg, "--shop-panel-bg")}
                    onMouseEnter={() => setActiveHeroPanelIndex(index)}
                    onFocus={() => setActiveHeroPanelIndex(index)}
                    onClick={() => handleHeroPanelClick(item)}
                  >
                    <ShopImageAsset
                      src={imageSrc}
                      alt={itemDisplayName}
                      fallbackClassName="shop-hero-image-fallback"
                    />
                    <span className="shop-hero-panel-overlay" aria-hidden="true" />
                    <div className="shop-hero-panel-copy">
                      <p>{getCategoryLabel(item)}</p>
                      <h3>{itemDisplayName}</h3>
                      <span className="shop-hero-panel-cta">Browse this category →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section id="shop-catalog" className="shop-catalog-section">
          <div className={`shop-catalog-main ${showCategoryNav ? "" : "is-empty"}`}>
            {showCategoryNav ? (
              <SideNav
                items={visibleNavItems}
                activeId={activeCategory}
                label="Shop categories"
                className={`glass-card shop-side-menu ${showSideNav ? "is-visible" : "is-hidden"}`}
                onItemClick={handleSideNavItemClick}
              />
            ) : null}

            <div className="shop-catalog-content" ref={gridRef}>
              <div className="shop-toolbar">
                <div className="shop-toolbar-head">
                  <div>
                    <h2 className="shop-results-title">Find your items quickly</h2>
                    <p className="shop-meta">
                      {filteredProducts.length} items shown · {categories.length} categories
                    </p>
                  </div>
                  <div className="shop-toolbar-actions">
                    <label className="availability-filter">
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                      />
                      In stock only
                    </label>
                  </div>
                </div>

                <div className="shop-controls">
                  <SearchField
                    className="search-wrapper"
                    inputClassName="search-bar"
                    clearClassName="shop-search-clear"
                    placeholder="Start typing to search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(clampShopQuery(e.target.value))}
                    onClear={() => {
                      setSearchQuery("");
                      setDebouncedQuery("");
                    }}
                    clearAriaLabel="Clear shop search"
                    aria-label="Search shop products"
                    maxLength={MAX_SHOP_QUERY_LENGTH}
                  />
                </div>

                <div className="filter-chips" role="list" aria-label="Shop category filters">
                  <button
                    type="button"
                    className={`filter-chip ${categoryFilter === "All" ? "active" : ""}`}
                    onClick={() => setCategoryFilter("All")}
                    aria-pressed={categoryFilter === "All"}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`filter-chip ${categoryFilter === cat ? "active" : ""}`}
                      onClick={() => setCategoryFilter(cat)}
                      aria-pressed={categoryFilter === cat}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="shop-breadcrumb-row">
                  <span className="shop-results">
                    {filteredProducts.length === 0
                      ? "No items to show"
                      : `${filteredProducts.length} item${filteredProducts.length === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>

              {noShopMatches && (
                <div className="shop-empty" role="status" aria-live="polite">
                  <div className="shop-empty-hero">

                    <div className="shop-empty-copy">
                      <p className="shop-empty-kicker">
                        {hasActiveFilters ? "No matches found" : "Inventory unavailable"}
                      </p>
                      <h2>{emptyStateTitle}</h2>
                      <p>{emptyStateMessage}</p>

                      {hasActiveFilters ? (
                        <div className="shop-empty-chips" aria-label="Active filters">
                          {trimmedSearchQuery ? (
                            <span className="shop-empty-chip">Search: {trimmedSearchQuery}</span>
                          ) : null}
                          {categoryFilter !== "All" ? (
                            <span className="shop-empty-chip">Category: {categoryFilter}</span>
                          ) : null}
                          {inStockOnly ? (
                            <span className="shop-empty-chip">In stock only</span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="shop-empty-actions">
                        {hasActiveFilters ? (
                          <button
                            className="hero-btn hero-btn-primary"
                            type="button"
                            onClick={resetShopFilters}
                          >
                            Reset filters
                          </button>
                        ) : null}
                        <Link
                          className={`hero-btn ${hasActiveFilters ? "hero-btn-ghost" : "hero-btn-primary"}`}
                          to="/rentals"
                        >
                          Browse rentals
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="shop-empty-next">
                    <div className="shop-empty-panel">
                      <p className="shop-empty-panel-label">Try next</p>
                      <ul className="shop-empty-tips">
                        {emptyStateTips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </div>

                    {hasActiveFilters ? (
                      <button
                        type="button"
                        className="shop-empty-card"
                        onClick={resetShopFilters}
                      >
                        <span className="shop-empty-card-kicker">Quick reset</span>
                        <strong>Show the full catalog again</strong>
                        <span>Clear search, category, and stock filters in one step.</span>
                      </button>
                    ) : (
                      <Link className="shop-empty-card" to="/rentals">
                        <span className="shop-empty-card-kicker">Available now</span>
                        <strong>Browse popular rentals</strong>
                        <span>Keep planning with castles, games, tents, and event essentials.</span>
                      </Link>
                    )}

                    <Link className="shop-empty-card" to="/contact">
                      <span className="shop-empty-card-kicker">Need something specific?</span>
                      <strong>Talk to us directly</strong>
                      <span>We can help you source the right item or suggest a close match.</span>
                    </Link>
                  </div>
                </div>
              )}

              {groupedProducts.map(({ category, id, items }) => {
                const { currentPage, pageCount, visibleItems } = getCategoryPageState(
                  items,
                  categoryPages[id] ?? 0
                );

                return (
                  <div id={id} key={id} className="shop-category-section">
                    <div className="section-header shop-section-header">
                      <div className="shop-section-topline">
                        <span className="shop-section-count">{items.length} items</span>
                      </div>
                      <h2>{category}</h2>
                    </div>

                    <div className="shop-grid">
                      {visibleItems.map((item) => {
                        const isSoldOut = isSoldOutItem(item);
                        const imageSrc = getImage(item);
                        const canPreviewImage = !isUnavailableImageSource(imageSrc);
                        const categoryBg = getShopCategoryBackground(item);
                        const itemDisplayName = getCatalogItemDisplayName(item, "Shop item");
                        return (
                          <article
                            key={item.id || item.productId || `${item.name}-${category}`}
                            className={`shop-card ${isSoldOut ? "sold-out" : ""}`}
                          >
                            <button
                              type="button"
                              className={`shop-image shop-image-trigger ${canPreviewImage ? "" : "is-disabled"}`}
                              onClick={() => {
                                if (!canPreviewImage) return;
                                setLightboxImage({
                                  image: imageSrc,
                                  background: categoryBg,
                                  name: itemDisplayName,
                                });
                              }}
                              aria-label={
                                canPreviewImage
                                  ? `Open image for ${itemDisplayName}`
                                  : `Image not available for ${itemDisplayName}`
                              }
                              style={createCatalogCssImageStyle(categoryBg, "--shop-item-bg")}
                              disabled={!canPreviewImage}
                            >
                              <ShopImageAsset
                                src={imageSrc}
                                alt={itemDisplayName}
                                fallbackClassName="shop-card-image-fallback"
                              />
                              {isSoldOut && <span className="shop-out-banner">Out of stock</span>}
                              {canPreviewImage && (
                                <span className="shop-zoom" aria-hidden="true">
                                  <AppIcon icon={faMagnifyingGlass} />
                                </span>
                              )}
                            </button>

                            <div className="shop-details">
                              <span className="shop-pill">{getCategoryLabel(item)}</span>
                              <h3>{itemDisplayName}</h3>
                              <p className="price">
                                {formatCurrency(convertPrice(getPrice(item) || 0))}
                              </p>
                              <p className="shop-stock">
                                {isSoldOut
                                  ? "Unavailable"
                                  : `${getQuantity(item)} left in stock`}
                              </p>
                              <AddToCartButton
                                item={{ ...item, quantity: getQuantity(item) }}
                                onCartChange={(action) => {
                                  if (action === "removed") {
                                    setAnnounce(`${itemDisplayName} removed from cart`);
                                  } else if (action === "decremented") {
                                    setAnnounce(`${itemDisplayName} quantity reduced`);
                                  } else if (action === "incremented") {
                                    setAnnounce(`${itemDisplayName} quantity increased`);
                                  } else {
                                    setAnnounce(`${itemDisplayName} added to cart`);
                                  }
                                  openCart();
                                }}
                              />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {items.length > SHOP_CATEGORY_PAGE_SIZE && (
                      <div className="table-pagination shop-category-pagination">
                        <span>
                          Page {currentPage + 1} of {pageCount}
                        </span>
                        <div className="table-pagination-controls">
                          <button
                            type="button"
                            onClick={() =>
                              setCategoryPages((prev) => ({
                                ...prev,
                                [id]: Math.max(0, (prev[id] ?? 0) - 1),
                              }))
                            }
                            disabled={currentPage === 0}
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCategoryPages((prev) => ({
                                ...prev,
                                [id]: Math.min(pageCount - 1, (prev[id] ?? 0) + 1),
                              }))
                            }
                            disabled={currentPage >= pageCount - 1}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="sr-only" aria-live="polite">
          {announce}
        </div>
      </main>

      {lightboxImage && (
        <div
          className="lightbox shop-lightbox"
          onClick={() => setLightboxImage(null)}
          style={createCatalogCssImageStyle(
            lightboxImage.background || lightboxImage.image,
            "--shop-lightbox-bg"
          )}
        >
          <button
            type="button"
            className="lightbox-close"
            aria-label="Close image preview"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <AppIcon icon={faTimes} />
          </button>
          <img
            src={lightboxImage.image}
            alt={`${lightboxImage.name} enlarged`}
            className="lightbox-img"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export default Shop;
