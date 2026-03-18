import React, { useCallback, useEffect, useMemo, useState } from 'react';
import "./Rentals.css";
//import rentalItems from "/src/data/rentalItems.json"
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SideNav from '/src/components/SideNav/SideNav';
import AddToCartButton from "/src/components/AddToCartButton/AddToCartButton";
import { useCart } from "/src/components/CartContext/CartContext";
import { AppIcon } from '/src/components/Icon/Icon';
import SearchField from "/src/components/SearchField/SearchField";
import SiteLoader from '/src/components/SiteLoader/SiteLoader';
import { fetchInventoryWithCache } from '/src/utils/inventoryCache';
import { getRentalCartItem } from '/src/utils/cartItems';
import {
    createCatalogCssImageStyle,
    getCatalogItemBackground,
    getCatalogItemDisplayName,
    getCatalogItemImage,
} from '/src/utils/itemMediaBackgrounds';

const MAX_RENTALS_QUERY_LENGTH = 80;
const SEARCH_DIACRITICS = /[\u0300-\u036f]/g;

const slugify = (value = "") =>
    value
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

const CATEGORY_ORDER = ["Bouncy Castles", "Kids Rentals", "Indoor Games", "Setup"];
const RENTALS_CACHE_KEY = "reebs_rentals_cache_v1";
const RENTALS_CACHE_TTL = 5 * 60 * 1000;

const RENTALS_QUICK_STRIP = [
    {
        title: "Kids party favorites",
        copy: "Bouncy castles, games, and treats in one coordinated setup."
    },
    {
        title: "Corporate fun day picks",
        copy: "Reliable group-friendly rentals with delivery and pickup support."
    },
    {
        title: "Birthday setup bundles",
        copy: "Decor, seating, and crowd-pleasers ready before guests arrive."
    }
];

const readRentalsCache = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(RENTALS_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.items || !parsed?.ts) return null;
        if (Date.now() - parsed.ts > RENTALS_CACHE_TTL) return null;
        return parsed.items;
    } catch {
        return null;
    }
};

const writeRentalsCache = (items) => {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(
            RENTALS_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), items })
        );
    } catch {
        // ignore cache write failures
    }
};

const sortCategories = (a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a);
    const bIndex = CATEGORY_ORDER.indexOf(b);
    const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
};

const rentalPath = (item) => {
    const idSlug = String(item?.id || item?.productId || "").trim();
    const nameSlug = slugify(item?.name);
    const pageSlug = slugify(item?.page?.split("/").filter(Boolean).pop() || "");
    return `/Rentals/${idSlug || nameSlug || pageSlug || ""}`;
};

const clampRentalsQuery = (value = "") =>
    value
        .toString()
        .slice(0, MAX_RENTALS_QUERY_LENGTH);

const normalizeSearchText = (value = "") =>
    value
        .toString()
        .normalize("NFKD")
        .replace(SEARCH_DIACRITICS, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

const normalizeCategory = (value) => {
    const raw = (value || "").toString().trim();
    const lowered = raw.toLowerCase();
    if (!raw) return "Other";
    if (lowered.includes("bouncy")) return "Bouncy Castles";
    if (lowered.includes("kid") && lowered.includes("rental")) {
        return "Kids Rentals";
    }
    if (lowered.includes("machine") || lowered.includes("setup")) {
        return "Setup";
    }
    if (lowered.includes("indoor") || lowered.includes("board game") || lowered.includes("jenga")) {
        return "Indoor Games";
    }
    return raw;
};

const isKidsPartyMachine = (item = {}) => {
    const name = `${item?.name || ""}`.toLowerCase();
    return (
        name.includes("popcorn") ||
        name.includes("snow cone") ||
        name.includes("snowcone") ||
        name.includes("cotton candy")
    );
};

const getCategory = (item = {}) => {
    if (isKidsPartyMachine(item)) return "Kids Rentals";
    return normalizeCategory(item.specificCategory || item.specificcategory || item.category || "Other");
};
const isKnownRentalCategory = (item = {}) => {
    const category = getCategory(item);
    if (!category) return false;
    if (["Setup", "Indoor Games", "Bouncy Castles", "Kids Rentals"].includes(category)) return true;
    return category.toLowerCase().includes("rental");
};
const isCategoryStub = (item = {}) => {
    const nameSlug = slugify(item?.name);
    return [
        "bouncy-castle",
        "bouncy-castles",
        "indoor-games",
        "indoor-game",
        "indoor-board-games"
    ].includes(nameSlug);
};
const shouldExcludeFromRentals = (item = {}) => {
    const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toString().toLowerCase();
    if (source === "water") return true;
    const category = getCategory(item);
    if (category.toLowerCase() === "party supplies") return true;
    if (category !== "Setup") return false;
    const name = `${item?.name || ""}`.toLowerCase();
    return (
        name.includes("air blower") ||
        name.includes("air-blower") ||
        name.includes("airblower") ||
        name.includes("blower pump")
    );
};
const isContactPricing = (item = {}) => {
    const text = `${item.specificCategory || item.specificcategory || ""} ${item.category || ""} ${item.name || ""}`.toLowerCase(); 
    return (
        text.includes("package") ||
        text.includes("bundle") ||
        text.includes("deal")
    );
};

const getRentalImage = (item = {}) => getCatalogItemImage(item);
const getRentalCategoryBackground = (item = {}) => getCatalogItemBackground(item);
const asNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const getPopularityScore = (item = {}) => {
    const name = `${item.name || ""}`.toLowerCase();
    const category = getCategory(item);
    const quantity = Math.max(0, asNumber(item.quantity ?? item.stock, 0));
    const image = getRentalImage(item);
    let score = 0;

    if (name.includes("bouncy") || name.includes("castle")) score += 100;
    if (name.includes("trampoline")) score += 86;
    if (name.includes("popcorn")) score += 84;
    if (name.includes("cotton candy")) score += 82;
    if (name.includes("snow cone") || name.includes("snowcone")) score += 78;
    if (name.includes("face paint") || name.includes("face painting")) score += 66;

    if (category === "Kids Rentals") score += 42;
    if (category === "Bouncy Castles") score += 32;
    if (category === "Setup") score += 22;
    if (category === "Indoor Games") score += 16;

    score += Math.min(quantity, 40);
    if (image.includes("placeholder")) score -= 40;
    if ((item.status ?? item.isActive) === false) score -= 1000;

    return score;
};

const getRentalIdentityKey = (item = {}) =>
    item.productId || item.id || `${slugify(item.name)}-${getCategory(item)}`;

const uniqueByKey = (items = []) => {
    const unique = new Map();
    for (const item of items) {
        const key = getRentalIdentityKey(item);
        if (!unique.has(key)) {
            unique.set(key, item);
        }
    }
    return Array.from(unique.values());
};

const mergeRentalCollections = (...collections) => {
    const merged = new Map();
    for (const collection of collections) {
        for (const item of collection || []) {
            const key = getRentalIdentityKey(item);
            const existing = merged.get(key);
            merged.set(key, existing ? { ...existing, ...item } : item);
        }
    }
    return Array.from(merged.values());
};

function Rentals() {
    const [rentals, setRentals] = useState([]);
    const { convertPrice, formatCurrency, openCart } = useCart();
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [loading, setLoading] = useState(true);
    const [showSideNav, setShowSideNav] = useState(false);
    const [activeHeroPanelIndex, setActiveHeroPanelIndex] = useState(0);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const routeSearchQuery = clampRentalsQuery(searchParams.get("q") || "");

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();
        const loadRentals = async () => {
            const cached = readRentalsCache();
            if (cached?.length) {
                setRentals(cached);
            }
            setLoading(!cached);
            try {
                const inventoryPromise = fetchInventoryWithCache({ signal: controller.signal });
                const indoorPromise = fetch("/.netlify/functions/indoor_games", { signal: controller.signal });
                const bouncyPromise = fetch("/.netlify/functions/bouncy_castles", { signal: controller.signal });
                const machinesPromise = fetch("/.netlify/functions/machines", { signal: controller.signal });

                const { items: inventoryData } = await inventoryPromise;

                const rentalItems = (Array.isArray(inventoryData) ? inventoryData : [])
                    .filter((item) => {
                        const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toString().toLowerCase();
                        const isRental = source
                            ? source === "rental"
                            : (item.sku || "").toString().toUpperCase().startsWith("REN") || isKnownRentalCategory(item);
                        const isActive = (item.status ?? item.isActive) !== false;
                        return isRental && isActive;
                    });

                const baseCombined = rentalItems.filter(
                    (item) => !isCategoryStub(item) && !shouldExcludeFromRentals(item)
                );
                if (isMounted) {
                    setRentals(uniqueByKey(baseCombined));
                    setLoading(false);
                }

                const safeJson = async (result, label) => {
                    if (!result || result.status !== "fulfilled") return [];
                    const response = result.value;
                    if (!response.ok) {
                        console.error(`Failed to fetch ${label}:`, response.status);
                        return [];
                    }
                    try {
                        return await response.json();
                    } catch (err) {
                        console.error(`Failed to parse ${label} response`, err);
                        return [];
                    }
                };

                const [indoorResult, bouncyResult, machinesResult] = await Promise.allSettled([
                    indoorPromise,
                    bouncyPromise,
                    machinesPromise,
                ]);

                const [indoorData, bouncyData, machinesData] = await Promise.all([
                    safeJson(indoorResult, "indoor games"),
                    safeJson(bouncyResult, "bouncy castles"),
                    safeJson(machinesResult, "machines"),
                ]);

                const indoorItems = (Array.isArray(indoorData) ? indoorData : []).map((item) => ({
                    ...item,
                    sourceCategoryCode: "RENTAL",
                    specificCategory: "Indoor Games",
                    imageUrl: item.image,
                    rate: item.rate || "per day",
                    price: typeof item.price === "number" ? item.price / 100 : item.price,
                }));

                const bouncyItems = (Array.isArray(bouncyData) ? bouncyData : []).map((item) => ({
                    ...item,
                    sourceCategoryCode: "RENTAL",
                    specificCategory: "Bouncy Castles",
                    imageUrl: item.image,
                    page: `/Rentals/${slugify(item.name)}`,
                    price: item.priceRange || item.price,
                    rate: item.rate || "per day",
                }));

                const machineItems = (Array.isArray(machinesData) ? machinesData : []).map((item) => ({
                    ...item,
                    id: item.productId || item.id,
                    sourceCategoryCode: "RENTAL",
                    specificCategory: "Setup",
                    imageUrl: item.image,
                    rate: item.rate || "per day",
                    price: typeof item.price === "number" ? item.price / 100 : item.price,
                }));

                const merged = mergeRentalCollections(
                    rentalItems,
                    machineItems,
                    indoorItems,
                    bouncyItems
                ).filter((item) => !isCategoryStub(item) && !shouldExcludeFromRentals(item));

                if (isMounted) {
                    setRentals(merged);
                    writeRentalsCache(merged);
                }
            } catch (err) {
                if (err?.name !== "AbortError") {
                    console.error("Error loading rentals:", err);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadRentals();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

    useEffect(() => {
        document.body.classList.add("rentals-theme");
        return () => document.body.classList.remove("rentals-theme");
    }, []);

    useEffect(() => {
        setSearchQuery(routeSearchQuery);
        if (routeSearchQuery) {
            setCategoryFilter("All");
        }
    }, [routeSearchQuery]);

    const rentalsSearchIndex = useMemo(
        () =>
            rentals.map((item) => {
                const category = getCategory(item);
                const featureText = Array.isArray(item?.features)
                    ? item.features.filter(Boolean).join(" ")
                    : item?.features;

                return {
                    item,
                    category,
                    searchText: normalizeSearchText(
                        [
                            item?.name,
                            item?.description,
                            item?.specificCategory,
                            item?.specificcategory,
                            item?.category,
                            item?.bestFor,
                            featureText,
                            item?.recommendedAge,
                            item?.recommendedage,
                            item?.age,
                            item?.rate,
                            item?.notes,
                            item?.output,
                            item?.footprint,
                            category,
                        ]
                            .filter(Boolean)
                            .join(" ")
                    ),
                };
            }),
        [rentals]
    );

    const filteredRentals = useMemo(() => {
        const normalizedQuery = normalizeSearchText(searchQuery);
        return rentalsSearchIndex
            .filter(({ category, searchText }) => {
                const matchesSearch = !normalizedQuery || searchText.includes(normalizedQuery);
                const matchesCategory = categoryFilter === "All" || category === categoryFilter;
                return matchesSearch && matchesCategory;
            })
            .map(({ item }) => item);
    }, [rentalsSearchIndex, searchQuery, categoryFilter]);

    const groupedRentals = useMemo(() => {
        const grouped = new Map();
        for (const item of filteredRentals) {
            const category = getCategory(item);
            if (!grouped.has(category)) {
                grouped.set(category, []);
            }
            grouped.get(category).push(item);
        }
        const categories = Array.from(grouped.keys()).sort(sortCategories);
        return categories.map((category) => ({
            category,
            id: slugify(category),
            items: grouped.get(category),
        }));
    }, [filteredRentals]);
    const visibleNavItems = useMemo(
        () => groupedRentals.map(({ category, id }) => ({ id, label: category })),
        [groupedRentals]
    );
    const showCategoryNav = visibleNavItems.length > 0;
    const resetRentalFilters = useCallback(() => {
        setSearchQuery("");
        setCategoryFilter("All");
    }, []);

    // Track active section
    const [activeCategory, setActiveCategory] = useState(null);
    const allCategories = useMemo(() => {
        const categories = new Set();
        for (const item of rentals) {
            categories.add(getCategory(item));
        }
        return Array.from(categories).sort(sortCategories);
    }, [rentals]);
    const categoryOptions = useMemo(() => ["All", ...allCategories], [allCategories]);
    const popularHeroRentals = useMemo(() => {
        return [...rentals]
            .filter((item) => (item.status ?? item.isActive) !== false)
            .sort((a, b) => {
                const scoreDiff = getPopularityScore(b) - getPopularityScore(a);
                if (scoreDiff !== 0) return scoreDiff;
                return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
            })
            .slice(0, 4);
    }, [rentals]);

    useEffect(() => {
        if (!popularHeroRentals.length) {
            setActiveHeroPanelIndex(0);
            return;
        }
        setActiveHeroPanelIndex((prev) => Math.min(prev, popularHeroRentals.length - 1));
    }, [popularHeroRentals.length]);

    const normalizeAvailability = (value) => {
        const raw = `${value || ""}`.trim().toLowerCase();
        if (!raw) return null;
        if (raw.includes("unavail") || raw.includes("out") || raw.includes("sold")) {
            return "Unavailable";
        }
        return "Available";
    };

    const getRentalAvailability = (item = {}) => {
        const explicitAvailability = normalizeAvailability(item.availability);
        if (explicitAvailability) return explicitAvailability;

        if (typeof item.status === "string" && item.status.trim()) {
            return normalizeAvailability(item.status) || "Available";
        }
        if (item.status === false || item.isActive === false) return "Unavailable";

        const quantity = Number(item.quantity ?? item.stock);
        if (Number.isFinite(quantity) && quantity <= 0) return "Unavailable";

        return "Available";
    };

    const getRentalAgeRange = (item = {}) => {
        const ageValue = item.age ?? item.recommendedAge ?? item.recommendedage;
        if (typeof ageValue === "string" && ageValue.trim()) return ageValue.trim();

        const numericAge = Number(ageValue);
        if (Number.isFinite(numericAge) && numericAge > 0) return `${numericAge}+ years`;

        const name = `${item.name || ""}`.toLowerCase();
        if (name.includes("bouncy") || name.includes("castle") || name.includes("trampoline")) {
            return "3+ years";
        }
        return "All ages";
    };

    const getRentalPriceLabel = (item = {}) => {
        const priceValue = item.price ?? (typeof item.priceCents === "number" ? item.priceCents / 100 : undefined);

        if (isContactPricing(item)) return "Contact us for pricing";
        if (item.id === 8 || item.productId === 8) return "Contact for more info.";
        if (priceValue == null || priceValue === "" || Number(priceValue) === 0) return "Contact for price";

        const rateLabel = item.rate || "per day";

        if (typeof priceValue === "string" && priceValue.includes("-")) {
            const [rawMin, rawMax] = priceValue.split("-").map((part) => Number(part?.trim()));
            if (Number.isFinite(rawMin) && Number.isFinite(rawMax)) {
                return `${formatCurrency(convertPrice(rawMin))} - ${formatCurrency(convertPrice(rawMax))} ${rateLabel}`;
            }
            return "Contact us for pricing";
        }

        const numericPrice = Number(priceValue);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) return "Contact for price";
        return `${formatCurrency(convertPrice(numericPrice))} ${rateLabel}`;
    };

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
            const nextTop = (window.scrollY || window.pageYOffset || 0) + target.getBoundingClientRect().top - offset;
            window.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
        }

        setActiveCategory(id);
    }, []);

    useEffect(() => {
        const scrollHost = document.querySelector(".main");
        const scrollTarget = scrollHost || window;
        const sections = groupedRentals
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

                const grid = document.getElementById("rentals-grid");
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
    }, [groupedRentals]);

    if (loading) return (
        <SiteLoader
            label="Loading rentals"
            sublabel="Pulling the latest party rental options."
        />
    );

    return (
        <>
            <a href="#main" className="skip-link">Skip to main content</a>
            <div className="rentals-page" id="main" role="main">
                <main className="rentals-shell page-shell">
                    <section id='rentals-intro' className="rentals-hero page-hero" aria-labelledby="rentals-hero-heading">
                        <div className="rentals-hero-copy page-hero-copy">
                            <h1 id="rentals-hero-heading" className="page-hero-title">Party rentals by REEBS</h1>
                            <p className="hero-sub rentals-sub">
                                Bounce houses, decor, concessions, and full setup help. We prep, deliver, and style so you can enjoy the celebration.
                            </p>
                            <div className="rentals-hero-actions">
                                <button
                                    type="button"
                                    className="hero-btn hero-btn-primary"
                                    onClick={() => openCart()}
                                >
                                    View cart
                                </button>
                                <Link className="hero-btn hero-btn-ghost" to="/shop">
                                    Browse shop
                                </Link>
                            </div>
                        </div>
                        {popularHeroRentals.length > 0 && (
                            <div className="rentals-popular-panels" role="list" aria-label="Most popular rentals">
                                {popularHeroRentals.map((item, index) => {
                                    const isActive = index === activeHeroPanelIndex;
                                    const itemDisplayName = getCatalogItemDisplayName(item, "Popular rental item");
                                    return (
                                        <Link
                                            key={item.productId || item.id || `${item.name}-${index}`}
                                            className={`rentals-popular-panel ${isActive ? "is-active" : ""}`}
                                            to={rentalPath(item)}
                                            role="listitem"
                                            style={createCatalogCssImageStyle(
                                                getRentalCategoryBackground(item),
                                                "--rent-category-bg"
                                            )}
                                            onMouseEnter={() => setActiveHeroPanelIndex(index)}
                                            onFocus={() => setActiveHeroPanelIndex(index)}
                                        >
                                            <img
                                                src={getRentalImage(item)}
                                                alt={itemDisplayName}
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            <span className="rentals-popular-overlay" aria-hidden="true" />
                                            <div className="rentals-popular-copy">
                                                <p>{getCategory(item)}</p>
                                                <h3>{itemDisplayName}</h3>
                                                <span className="rentals-popular-cta">View rental →</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section id='rentals-grid' className="rentals-section">
                        <div className={`rentals-main ${showCategoryNav ? "" : "is-empty"}`}>
                            {showCategoryNav ? (
                                <SideNav
                                    items={visibleNavItems}
                                    activeId={activeCategory}
                                    label="Rental categories"
                                    className={`glass-card rentals-side-menu ${showSideNav ? "is-visible" : "is-hidden"}`}
                                    onItemClick={handleSideNavItemClick}
                                />
                            ) : null}

                                <div className="rentals-main-content">
                                    <div className="rentals-toolbar glass-card">
                                        <div className="rentals-toolbar-head">
                                            <div>
                                                <p className="kicker-small">Rental catalog</p>
                                                <h2 className="rentals-results-title">Find your party setup fast</h2>
                                                <p className="rentals-meta">
                                                    {filteredRentals.length} items shown · {allCategories.length} categories
                                                </p>
                                            </div>
                                    </div>

                                    <div className="rentals-controls">
                                        <SearchField
                                            className="search-wrapper rentals-search"
                                            inputClassName="search-bar"
                                            placeholder="Search bounce houses, decor, concessions..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(clampRentalsQuery(e.target.value))}
                                            onClear={() => setSearchQuery("")}
                                            aria-label="Search rental items"
                                            maxLength={MAX_RENTALS_QUERY_LENGTH}
                                        />
                                    </div>

                                    <div className="filter-chips" role="list" aria-label="Quick category filters">
                                        {categoryOptions.map((cat) => (
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
                                </div>

                                {groupedRentals.length === 0 && (
                                    <div className="rentals-empty glass-card" role="status" aria-live="polite">
                                        <p>No rentals match that search. Try a different keyword or reset filters.</p>
                                        <button className="hero-btn hero-btn-link" type="button" onClick={resetRentalFilters}>
                                            Reset filters
                                        </button>
                                    </div>
                                )}

                                {groupedRentals.map(({ category, id, items }) => (
                                    <div id={id} key={id} className="rent-category-section">
                                        <div className="section-header rent-section-header">
                                            <div className="rent-section-topline">
                                                <span className="rent-section-count">{items.length} items</span>
                                            </div>
                                            <h2>{category}</h2>
                                        </div>
                                        <div className='rent-grid'>
                                            {items.map((item) => {
                                                const cartItem = getRentalCartItem(item);
                                                const itemDisplayName = getCatalogItemDisplayName(item, "Rental item");

                                                return (
                                                <div
                                                    key={item.productId || item.id || rentalPath(item)}
                                                    className={`rent-card ${getCategory(item) === "Indoor Games" ? "rent-card-indoor" : ""}`}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={`View ${itemDisplayName}`}
                                                    onClick={() => navigate(rentalPath(item))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            navigate(rentalPath(item));
                                                        }
                                                    }}
                                                >
                                                    <div
                                                        className={`rent-image rent-card-bg ${getCategory(item) === "Indoor Games" ? "rent-image-indoor" : ""}`}
                                                        style={createCatalogCssImageStyle(
                                                            getRentalCategoryBackground(item),
                                                            "--rent-category-bg"
                                                        )}
                                                    >
                                                        <img
                                                            src={getRentalImage(item)}
                                                            alt={itemDisplayName}
                                                            loading="lazy"
                                                            decoding="async"
                                                        />
                                                        <span className="rent-tag">{getCategory(item)}</span>
                                                    </div>
                                                    <span className="rent-card-arrow" aria-hidden="true">→</span>
                                                    <div className="rent-details">
                                                        <div className="rent-title-row">
                                                            <h3>{itemDisplayName}</h3>
                                                        </div>
                                                        <div className="rent-card-meta">
                                                            <p className="price">{getRentalPriceLabel(item)}</p>
                                                            <p className="rent-meta-line">
                                                                <span>Availability</span>
                                                                <strong>{getRentalAvailability(item)}</strong>
                                                            </p>
                                                            <p className="rent-meta-line">
                                                                <span>Age Range</span>
                                                                <strong>{getRentalAgeRange(item)}</strong>
                                                            </p>
                                                            {cartItem ? (
                                                                <div
                                                                    className="rent-card-actions"
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    onKeyDown={(event) => event.stopPropagation()}
                                                                >
                                                                    <AddToCartButton
                                                                        item={cartItem}
                                                                        variant="compact"
                                                                        addLabel="Add"
                                                                        unavailableLabel="Unavailable"
                                                                    />
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
            </main>
        </div>
        </>
    );
}

export default Rentals;
