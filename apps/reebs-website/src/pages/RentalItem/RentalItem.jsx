import React, { useEffect, useMemo, useState } from "react";
import "./RentalItem.css";
import { Link, useNavigate, useParams } from "react-router-dom";
import AddToCartButton from "/src/components/AddToCartButton/AddToCartButton";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowLeftLong,
  faArrowRightLong,
  faClipboardList,
  faClock,
  faShieldHeart,
  faTruckFast,
} from "/src/icons/iconSet";
import { useCart } from "/src/components/CartContext/CartContext";
import SiteLoader from "/src/components/SiteLoader/SiteLoader";
import { applySeo } from "/src/utils/seo";
import { fetchInventoryWithCache } from "/src/utils/inventoryCache";
import { getRentalCartItem } from "/src/utils/cartItems";
import {
  createCatalogCssImageStyle,
  getCatalogItemBackground,
  getCatalogItemDisplayName,
  getCatalogItemImage,
} from "/src/utils/itemMediaBackgrounds";
// Bouncy castle variants are fetched from the database

const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const rentalPath = (item) => {
  const idSlug = String(item?.id || item?.productId || "").trim();
  const nameSlug = slugify(item?.name);
  const pageSlug = slugify(item?.page?.split("/").filter(Boolean).pop() || "");
  return `/Rentals/${idSlug || nameSlug || pageSlug || ""}`;
};

const getRentalCategoryBackground = (item = {}) => getCatalogItemBackground(item);

const getRentalIdentity = (item = {}) =>
  String(item.id || item.productId || slugify(item.name || ""));

const sortRecommendationItems = (a, b) => {
  const aQuantity = Number(a.quantity ?? a.stock ?? 0);
  const bQuantity = Number(b.quantity ?? b.stock ?? 0);
  const quantityDiff = (Number.isFinite(bQuantity) ? bQuantity : 0) - (Number.isFinite(aQuantity) ? aQuantity : 0);
  if (quantityDiff !== 0) return quantityDiff;
  return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
};

const formatRentalPrice = (item, convertPrice, formatCurrency) => {
  if (item?.id === 8) return "Contact for more info.";
  
  // Prefer the new price column but keep a fallback for legacy priceCents
  const priceValue = item?.price ?? (typeof item?.priceCents === "number" ? item.priceCents / 100 : undefined); 
  
  if (!priceValue || priceValue === "0" || priceValue === 0) {
    return "Contact for price";
  }
  
  if (typeof priceValue === "string" && priceValue.includes("-")) {
    const [min, max] = priceValue.split("-").map((part) => Number(part.trim()));
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return `${formatCurrency(convertPrice(min))} - ${formatCurrency(
        convertPrice(max)
      )} ${item.rate || ""}`.trim();
    }
  }

  const numericPrice = Number(priceValue);
  if (Number.isNaN(numericPrice)) return "Contact for price";
  return `${formatCurrency(convertPrice(numericPrice))} ${item.rate || ""}`.trim();
};

const formatStatus = (status, isActive) => {
  if (typeof status === "boolean") return status ? "Available" : "Unavailable";
  if (typeof isActive === "boolean") return isActive ? "Available" : "Unavailable";
  if (!status) return "Available";
  const lower = status.toString().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const formatAge = (age) => {
  if (!age) return "All ages";
  return age;
};

const formatAttendantsNeeded = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Not required";
  return `${parsed} attendant${parsed === 1 ? "" : "s"}`;
};

const isBouncyCastleRental = (item) => {
  if (!item) return false;
  const nameSlug = slugify(item.name);
  const pageSlug = slugify(item.page?.split("/").filter(Boolean).pop() || "");
  return nameSlug.includes("bouncy") || pageSlug.includes("bouncy");
};

const BouncyVariantCard = ({ type, selected, onSelect }) => {
  const images = type.images?.length ? type.images : type.image ? [type.image] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;
  const currentImage = images[activeIndex] || null;

  const handlePrev = () => {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <article className={`bouncy-card glass-card ${selected ? "is-selected" : ""}`}>
      {currentImage && (
        <div className="bouncy-card-media">
          <img src={currentImage} alt={`${type.name} angle ${activeIndex + 1}`} loading="lazy" />
          {hasMultiple && (
            <>
              <button type="button" className="bouncy-nav bouncy-nav-left" onClick={handlePrev} aria-label={`Previous ${type.name} photo`}>
                <AppIcon icon={faArrowLeftLong} />
              </button>
              <button type="button" className="bouncy-nav bouncy-nav-right" onClick={handleNext} aria-label={`Next ${type.name} photo`}>
                <AppIcon icon={faArrowRightLong} />
              </button>
              <span className="bouncy-counter">{activeIndex + 1} / {images.length}</span>
            </>
          )}
        </div>
      )}
      <div className="bouncy-card-head">
        <div>
          <p className="kicker">Style</p>
          <h3>{type.name}</h3>
        </div>
        <span className="bouncy-price">Price: GHS{type.priceRange}</span>
      </div>
      <dl className="bouncy-specs">
        <div>
          <dt>Capacity</dt>
          <dd>{type.capacity}</dd>
        </div>
        <div>
          <dt>Recommended age</dt>
          <dd>{type.recommendedAge}</dd>
        </div>
      </dl>
      <button
        type="button"
        className={`hero-btn hero-btn-link bouncy-select ${selected ? "selected" : ""}`}
        onClick={() => onSelect(type)}
        aria-pressed={selected}
      >
        {selected ? "Selected for booking" : "Select this castle"}
      </button>
    </article>
  );
};

function RentalItem() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { convertPrice, formatCurrency } = useCart();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBouncyType, setSelectedBouncyType] = useState(null);
  const [bouncyTypes, setBouncyTypes] = useState([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchInventoryWithCache({ signal: controller.signal })
      .then(({ items }) => {
        const rentalsOnly = (Array.isArray(items) ? items : []).filter((item) => {
          const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toLowerCase();
          const isRental = source ? source === "rental" : (item.sku || "").toString().toUpperCase().startsWith("REN");
          const isActive = (item.status ?? item.isActive) !== false;
          return isRental && isActive;
        });
        if (!active) return;
        setRentals(rentalsOnly);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("❌ Error fetching rental:", err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    fetch("/.netlify/functions/bouncy_castles")
      .then((res) => res.json())
      .then((data) => {
        setBouncyTypes(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("❌ Error fetching bouncy castles:", err);
      });
  }, []);

  useEffect(() => {
    document.body.classList.add("rentals-theme");
    return () => document.body.classList.remove("rentals-theme");
  }, []);

const rental = useMemo(() => {
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  const directMatch =
    rentals.find((item) => {
      const pageSlug = slugify(item.page?.split("/").filter(Boolean).pop() || "");
      const nameSlug = slugify(item.name);
      const idSlug = String(item.id || "").toLowerCase();
      return pageSlug === normalized || nameSlug === normalized || idSlug === normalized;
    }) || null;
  if (directMatch) return directMatch;
  const bouncyMatch = bouncyTypes.find((type) => slugify(type.name) === normalized);
  if (bouncyMatch) {
    return rentals.find((item) => isBouncyCastleRental(item)) || null;
  }
  return null;
}, [rentals, slug, bouncyTypes]);

useEffect(() => {
  if (!slug || !bouncyTypes.length) return;
  const normalized = slug.toLowerCase();
  const matched = bouncyTypes.find((type) => slugify(type.name) === normalized);
  if (matched) {
    setSelectedBouncyType(matched);
  }
}, [slug, bouncyTypes]);

  const displayRental = useMemo(() => {
    if (!rental || !selectedBouncyType) return rental;

    return {
      ...rental,
      name: selectedBouncyType.name,
      image: selectedBouncyType.image || rental.image,
      imageUrl: selectedBouncyType.image || rental.imageUrl,
      price: selectedBouncyType.priceRange ?? rental.price,
      age: selectedBouncyType.recommendedAge ?? rental.age,
    };
  }, [rental, selectedBouncyType]);

  const rentalBackgroundImage = useMemo(
    () => (displayRental ? getRentalCategoryBackground(displayRental) : ""),
    [displayRental]
  );
  const displayRentalName = useMemo(
    () => getCatalogItemDisplayName(displayRental, "Rental item"),
    [displayRental]
  );
  const requiresBouncySelection = isBouncyCastleRental(rental) && !selectedBouncyType;
  const cartReadyRental = useMemo(
    () => (displayRental && !requiresBouncySelection ? getRentalCartItem(displayRental) : null),
    [displayRental, requiresBouncySelection]
  );

  const similar = useMemo(() => {
    if (!rental) return [];
    const currentId = getRentalIdentity(rental);
    const currentCategory = getRentalCategoryKey(rental) || "other";
    const maxItems = 3;
    const sameCategoryLimit = currentCategory === "bouncy castles" ? 1 : 2;

    const candidates = rentals.filter((item) => getRentalIdentity(item) !== currentId);
    const sameCategory = [];
    const otherCategories = [];

    candidates.forEach((item) => {
      const itemCategory = getRentalCategoryKey(item) || "other";
      if (itemCategory === currentCategory) {
        sameCategory.push(item);
      } else {
        otherCategories.push(item);
      }
    });

    sameCategory.sort(sortRecommendationItems);
    otherCategories.sort(sortRecommendationItems);

    const picks = [];
    const pushUnique = (item) => {
      const key = getRentalIdentity(item);
      if (!picks.some((entry) => getRentalIdentity(entry) === key)) {
        picks.push(item);
      }
    };

    sameCategory.slice(0, sameCategoryLimit).forEach(pushUnique);
    otherCategories.forEach((item) => {
      if (picks.length < maxItems) pushUnique(item);
    });
    sameCategory.slice(sameCategoryLimit).forEach((item) => {
      if (picks.length < maxItems) pushUnique(item);
    });

    return picks.slice(0, maxItems);
  }, [rental, rentals]);

  const statusValue =
    typeof rental?.status === "string"
      ? rental.status.toLowerCase()
      : rental?.status === false
        ? "unavailable"
        : rental?.isActive === false
          ? "unavailable"
          : "available";
  const isAvailable = statusValue === "available";
  const showBouncyTable = isBouncyCastleRental(rental);
  const bookingSlug = rentalPath(rental).split("/").filter(Boolean).pop();
  const selectedBouncySlug = selectedBouncyType ? slugify(selectedBouncyType.name) : "";
  const bookingLink = showBouncyTable
    ? `/Book?rental=${bookingSlug}${selectedBouncySlug ? `&bouncy=${selectedBouncySlug}` : ""}`
    : `/Book?rental=${bookingSlug}`;
  const attendantsNeeded = formatAttendantsNeeded(
    selectedBouncyType?.attendantsNeeded ?? rental?.attendantsNeeded
  );

  useEffect(() => {
    const normalizedPath = `/rentals/${slug || ""}`;
    if (displayRental?.name) {
      const canonicalUrl = `https://www.reebspartythemes.com${normalizedPath}`;
      const numericPrice = Number(
        displayRental.price ?? (typeof displayRental.priceCents === "number" ? displayRental.priceCents / 100 : NaN)
      );
      const offer = {
        "@type": "Offer",
        priceCurrency: "GHS",
        availability: isAvailable
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: canonicalUrl,
      };
      if (Number.isFinite(numericPrice) && numericPrice > 0) {
        offer.price = numericPrice;
      }

      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": `${canonicalUrl}#product`,
        name: displayRentalName,
        image:
          displayRental.image ||
          displayRental.imageUrl ||
          "https://www.reebspartythemes.com/imgs/ui/placeholder.png",
        description: `Book ${displayRentalName} from REEBS Party Themes with setup and delivery options in Ghana.`,
        brand: {
          "@type": "Brand",
          name: "REEBS Party Themes",
        },
        category:
          displayRental.specificCategory ||
          displayRental.specificcategory ||
          displayRental.category ||
          "Party rental",
        offers: offer,
      };

      applySeo({
        pathname: normalizedPath,
        title: `${displayRentalName} Rental | REEBS Party Themes`,
        description: `View details, pricing, and booking options for ${displayRentalName} at REEBS Party Themes.`,
        type: "product",
        schema: [productSchema],
      });
      return;
    }
    if (!loading && !rental) {
      applySeo({
        pathname: normalizedPath,
        title: "Rental Not Found | REEBS Party Themes",
        description: "This rental item may have moved or become unavailable. Explore current REEBS rental options.",
      });
    }
  }, [displayRental, isAvailable, loading, rental, slug]);

  useEffect(() => {
    const scrollHost = document.querySelector(".main");
    if (!scrollHost) return undefined;

    if (!rentalBackgroundImage) {
      scrollHost.classList.remove("rental-detail-main-bg");
      scrollHost.style.removeProperty("--rental-detail-main-bg");
      return undefined;
    }

    scrollHost.classList.add("rental-detail-main-bg");
    scrollHost.style.setProperty("--rental-detail-main-bg", `url("${rentalBackgroundImage}")`);

    return () => {
      scrollHost.classList.remove("rental-detail-main-bg");
      scrollHost.style.removeProperty("--rental-detail-main-bg");
    };
  }, [rentalBackgroundImage]);

  const handleBookingClick = (event) => {
    if (!showBouncyTable || selectedBouncyType) return;
    event.preventDefault();
    const target = document.getElementById("bouncy-table-heading");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading) {
    return (
      <SiteLoader
        label="Loading rental details"
        sublabel="Getting item photos, pricing, and booking info."
      />
    );
  }

  if (!rental) {
    return (
      <>
        <div className="rental-detail rentals-page rental-item-page">
          <main className="rental-detail-shell rental-item-shell page-shell">
            <section className="rental-detail-card glass-card rental-not-found-card">
              <p className="kicker">Rental not found</p>
              <h1>We couldn’t find that rental.</h1>
              <p>It may have moved or is no longer available. Let’s get you back.</p>
              <div className="rental-actions">
                <button
                  type="button"
                  className="hero-btn hero-btn-primary"
                  onClick={() => navigate("/Rentals")}
                >
                  Back to rentals
                </button>
                <Link className="hero-btn hero-btn-ghost" to="/Contact">
                  Talk to our team
                </Link>
              </div>
            </section>
          </main>
        </div>
      </>
    );
  }

  const detailHighlights = [
    "Freshly cleaned and inspected before every booking",
    "Delivery, setup, and pickup across Accra available",
    "Theme styling options to match your event",
    "On-call support the day of your party",
  ];

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div
        className="rental-detail rentals-page rental-item-page"
        id="main"
        style={createCatalogCssImageStyle(rentalBackgroundImage, "--rental-detail-bg")}
      >
        <main className="rental-detail-shell rental-item-shell page-shell">
          <nav className="rental-breadcrumb rental-item-breadcrumb">
            <button
              type="button"
              className="breadcrumb-back"
              onClick={() => navigate(-1)}
            >
              <AppIcon icon={faArrowLeftLong} /> Back
            </button>
            <Link to="/Rentals">Rentals</Link>
            <AppIcon icon={faArrowRightLong} aria-hidden="true" />
            <span>{displayRentalName}</span>
          </nav>

          <section className="rental-hero-card glass-card rental-item-hero page-hero">
            <div
              className="rental-hero-media category-image-bg"
              style={createCatalogCssImageStyle(rentalBackgroundImage, "--item-category-bg")}
            >
              <img src={getCatalogItemImage(displayRental)} alt={displayRentalName} />
              <span className="rent-tag">{displayRental.specificCategory || displayRental.specificcategory || displayRental.category}</span>
            </div>
            <div className="rental-hero-copy page-hero-copy">
              <h1 className="page-hero-title">{displayRentalName}</h1>
              <p className="rental-sub">
                Styled the REEBS way — delivered, set up, and ready for fun.
              </p>

              <div className="rental-price-line">
                <div>
                  <p className="price">{formatRentalPrice(displayRental, convertPrice, formatCurrency)}</p>
                  <p className="rent-meta">
                    {displayRental.quantity ? `${displayRental.quantity} available` : "Availability upon request"}
                  </p>
                </div>
              </div>

              <div className="rental-meta-grid">
                <div className={isAvailable ? "status-available dark-card" : ""}>
                  <span className="rent-meta">Status</span>
                  <strong>{formatStatus(rental.status, rental.isActive)}</strong>
                </div>
                <div>
                  <span className="rent-meta">Age range</span>
                  <strong>{formatAge(displayRental.age)}</strong>
                </div>
                <div>
                  <span className="rent-meta">Attendants needed</span>
                  <strong>{attendantsNeeded}</strong>
                </div>
              </div>

              <div className="rental-actions">
                <Link
                  className={`hero-btn hero-btn-primary ${showBouncyTable && !selectedBouncyType ? "is-disabled" : ""}`}
                  to={bookingLink}
                  onClick={handleBookingClick}
                  aria-disabled={showBouncyTable && !selectedBouncyType}
                >
                  Book this rental
                </Link>
                {cartReadyRental ? (
                  <div className="rental-cart-slot">
                    <AddToCartButton item={cartReadyRental} />
                  </div>
                ) : null}
                <Link className="hero-btn hero-btn-ghost" to="/Rentals">
                  Browse all rentals
                </Link>
              </div>
            </div>
          </section>

          {showBouncyTable && (
            <section className="rental-detail-card bouncy-card-section rental-item-bouncy" aria-labelledby="bouncy-table-heading">
              <div className="section-header rent-section-header">
                <p className="kicker">Bouncy castles</p>
                <h2 id="bouncy-table-heading">Choose the right size for your party</h2>
                <p className="rental-sub">
                  Compare capacity and pricing so you can match the castle to your guest count and venue space.
                </p>
              </div>
              <div className="bouncy-card-grid">
                {bouncyTypes.map((type) => (
                  <BouncyVariantCard
                    key={type.name}
                    type={type}
                    selected={selectedBouncyType?.name === type.name}
                    onSelect={setSelectedBouncyType}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="rental-detail-grid rental-item-detail-grid">
            <div className="rental-detail-card glass-card rental-item-info-card">
              <div className="section-header rent-section-header">
                <p className="kicker">What to expect</p>
                <h2>Included with your booking</h2>
              </div>
              <ul className="rental-includes">
                {detailHighlights.map((item) => (
                  <li key={item}>
                    <AppIcon icon={faShieldHeart} /> {item}
                  </li>
                ))}
              </ul>
              <div className="rental-feature-row">
                <div>
                  <AppIcon icon={faTruckFast} />
                  <div>
                    <strong>Delivery & Pickup</strong>
                    <p>Handled by our team within Accra. We confirm timing after you book.</p>
                  </div>
                </div>
                <div>
                  <AppIcon icon={faClock} />
                  <div>
                    <strong>Timeline</strong>
                    <p>Most setups take under an hour. We’ll align with your venue schedule.</p>
                  </div>
                </div>
                <div>
                  <AppIcon icon={faClipboardList} />
                  <div>
                    <strong>Custom notes</strong>
                    <p>Share your theme and guest count so we tailor the setup.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rental-detail-card glass-card rental-item-similar-shell">
              <div className="section-header rent-section-header">
                <p className="kicker">Need more?</p>
                <h2>Pair it with these</h2>
              </div>
              {similar.length === 0 && (
                <p className="rent-meta">We’ll suggest add-ons when more rentals are available.</p>
              )}
              <div className="rental-similar-grid">
                {similar.map((item) => {
                  const itemDisplayName = getCatalogItemDisplayName(item, "Rental item");
                  return (
                    <Link
                      key={getRentalIdentity(item)}
                      to={rentalPath(item)}
                      className="rental-similar-card glass-card"
                    >
                      <div
                        className="rental-similar-media category-image-bg"
                        style={createCatalogCssImageStyle(
                          getRentalCategoryBackground(item),
                          "--item-category-bg"
                        )}
                      >
                        <img src={getCatalogItemImage(item)} alt={itemDisplayName} />
                      </div>
                      <div>
                        <span className="rent-meta">{item.specificCategory || item.specificcategory || item.category}</span>
                        <h3>{itemDisplayName}</h3>
                        <p className="price">
                          {formatRentalPrice(item, convertPrice, formatCurrency)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default RentalItem;
