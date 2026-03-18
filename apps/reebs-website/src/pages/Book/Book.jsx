import React, { useEffect, useMemo, useState } from "react";
import "./Book.css";
import { Link, useSearchParams } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faMagnifyingGlass,
  faShieldHeart,
  faTruckFast,
  faWandMagicSparkles,
} from "/src/icons/iconSet";
import SearchField from "../../components/SearchField/SearchField";
import { useCart } from "../../components/CartContext/CartContext";
import SiteLoader from "/src/components/SiteLoader/SiteLoader";
import { fetchInventoryWithCache } from "/src/utils/inventoryCache";
import {
  getCatalogItemBackgroundStyle,
  getCatalogItemDisplayName,
  getCatalogItemImage,
} from "/src/utils/itemMediaBackgrounds";
import {
  clearExpiringDraft,
  loadExpiringDraft,
  saveExpiringDraft,
} from "/src/utils/formDrafts";
// Bouncy castles are loaded from the database

const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const rentalSlug = (item) => {
  const pageSlug = item?.page?.split("/").filter(Boolean).pop();
  const nameSlug = slugify(item?.name);
  return pageSlug || nameSlug || item?.id || "";
};

const getCategory = (item) =>
  (item?.specificCategory || item?.specificcategory || item?.category || "").toString().trim();

const shouldExcludeFromBooking = (item) => {
  const name = `${item?.name || ""}`.toLowerCase();
  return (
    name.includes("air blower") ||
    name.includes("air-blower") ||
    name.includes("airblower") ||
    name.includes("blower pump")
  );
};

const isBoardGameBundle = (item) =>
  `${item?.name || ""}`.toLowerCase().includes("board game bundle");

const isIndoorGameItem = (item) => {
  const name = `${item?.name || ""}`.toLowerCase();
  const category = getCategory(item).toLowerCase();
  return category.includes("indoor game") || name.includes("indoor game");
};

const isTrampolineItem = (item) =>
  `${item?.name || ""}`.toLowerCase().includes("trampoline");

const isPerHeadRate = (rate) => {
  const normalized = String(rate || "").toLowerCase();
  return normalized.includes("per head") || normalized.includes("per person") || normalized.includes("per guest");
};

const getRateLabel = (item, fallback = "Per booking") => {
  if (isIndoorGameItem(item) || isTrampolineItem(item)) return "per day";
  if (item?.rate) return item.rate;
  return fallback;
};

const isBouncyRental = (item) => {
  if (!item) return false;
  const name = item.name?.toLowerCase() || "";
  const page = item.page?.toLowerCase() || "";
  return name.includes("bouncy") || page.includes("bouncy");
};

const getItemPrice = (item) => {
  if (item?.price !== undefined && item.price !== null && item.price !== "") return item.price;
  if (item?.priceRange !== undefined && item.priceRange !== null && item.priceRange !== "") return item.priceRange;
  if (item?.displayPrice !== undefined && item.displayPrice !== null && item.displayPrice !== "") return item.displayPrice;
  if (typeof item?.priceCents === "number") return item.priceCents / 100;
  return undefined;
};

const parseNumericPrice = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = value.toString().trim();
  if (!raw) return null;
  if (raw.includes("-")) {
    const [min] = raw.split("-").map((part) => Number(part.trim()));
    return Number.isFinite(min) ? min : null;
  }
  const parsed = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatRentalPrice = (item, convertPrice, formatCurrency, guestCount = 0) => {
  if (item?.id === 8) return "Contact for more info.";
  const priceValue = getItemPrice(item);
  if (priceValue === undefined || priceValue === null || priceValue === 0 || priceValue === "0") {
    return "Contact for price";
  }
  const rateLabel = getRateLabel(item, "");

  if (typeof priceValue === "string" && priceValue.includes("-")) {
    const [min, max] = priceValue.split("-").map((part) => Number(part.trim()));
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return `${formatCurrency(convertPrice(min))} - ${formatCurrency(
        convertPrice(max)
      )} ${rateLabel || ""}`.trim();
    }
  }

  const numericPrice = Number(priceValue);
  if (Number.isNaN(numericPrice)) return "Contact for price";
  if (isPerHeadRate(item?.rate) && guestCount > 0) {
    return `${formatCurrency(convertPrice(numericPrice * guestCount))} total`;
  }
  return `${formatCurrency(convertPrice(numericPrice))} ${rateLabel || ""}`.trim();
};

const formatStatus = (status, isActive) => {
  if (typeof status === "boolean") return status ? "Available" : "Unavailable";
  if (typeof isActive === "boolean") return isActive ? "Available" : "Unavailable";
  if (!status) return "Available";
  const lower = status.toString().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const formatDateShort = (value) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const BUNDLE_MIN_ITEMS = 3;
const BUNDLE_DISCOUNT_RATE = 0.1;
const BOOKING_DRAFT_KEY = "bookingDraft";
const EVENT_WINDOW_OPTIONS = [
  { value: "Morning setup (7am - 11am)", label: "Morning setup (7am – 11am)", endMinutes: 11 * 60 },
  { value: "Midday setup (11am - 2pm)", label: "Midday setup (11am – 2pm)", endMinutes: 14 * 60 },
  { value: "Afternoon setup (2pm - 5pm)", label: "Afternoon setup (2pm – 5pm)", endMinutes: 17 * 60 },
  { value: "Evening pickup", label: "Evening pickup" },
  { value: "Flex / tell us", label: "I’ll share a specific time" },
];

function Book() {
  const { convertPrice, formatCurrency } = useCart();
  const defaultFormValues = {
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    eventWindow: "",
    location: "",
    guestCount: "",
    contactPreference: "",
  };
  const [rentals, setRentals] = useState([]);
  const [bouncyTypes, setBouncyTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [itemsNote, setItemsNote] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormValues);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [bookingReceipt, setBookingReceipt] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [selectedIndoorGameIds, setSelectedIndoorGameIds] = useState([]);
  const [searchParams] = useSearchParams();
  const today = now.toISOString().split("T")[0];
  const draftLoadedRef = React.useRef(false);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const guestCountValue = Number.parseInt(formValues.guestCount, 10) || 0;

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const draft = loadExpiringDraft(BOOKING_DRAFT_KEY);
    if (!draft) {
      draftLoadedRef.current = true;
      return;
    }

    if (draft?.formValues) {
      setFormValues((prev) => ({ ...prev, ...draft.formValues }));
    }
    if (Array.isArray(draft?.selectedIds)) {
      setSelectedIds(draft.selectedIds);
    }
    if (typeof draft?.itemsNote === "string") {
      setItemsNote(draft.itemsNote);
    }
    if (typeof draft?.noteTouched === "boolean") {
      setNoteTouched(draft.noteTouched);
    }
    if (Array.isArray(draft?.selectedIndoorGameIds)) {
      setSelectedIndoorGameIds(draft.selectedIndoorGameIds);
    }
    draftLoadedRef.current = true;
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        const [inventoryResult, bouncyRes] = await Promise.all([
          fetchInventoryWithCache({ signal: controller.signal }),
          fetch("/.netlify/functions/bouncy_castles", { signal: controller.signal }),
        ]);

        const inventoryData = inventoryResult.items;
        const bouncyData = bouncyRes.ok ? await bouncyRes.json() : [];

        const rentalsOnly = (Array.isArray(inventoryData) ? inventoryData : []).filter((item) => {
          const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toString().toLowerCase();
          const isRental = source ? source === "rental" : (item.sku || "").toString().toUpperCase().startsWith("REN");
          const isActive = (item.status ?? item.isActive) !== false;
          return isRental && isActive && !shouldExcludeFromBooking(item);
        });

        if (!active) return;
        setRentals(rentalsOnly);
        setBouncyTypes(Array.isArray(bouncyData) ? bouncyData : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("❌ Error fetching rental:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("rentals-theme");
    return () => document.body.classList.remove("rentals-theme");
  }, []);

  const bookingRentals = useMemo(() => {
    if (!rentals.length) return [];
    const baseBouncy = rentals.find((item) => isBouncyRental(item));
    if (!baseBouncy) return rentals;

    const availableBouncy = bouncyTypes.filter((type) =>
      Number.isFinite(Number(type.productId))
    );
    const bouncyOptions = availableBouncy.map((type) => ({
      id: `bouncy-${slugify(type.name)}`,
      name: type.name,
      image: type.image,
      imageUrl: type.image,
      rate: baseBouncy.rate,
      status: baseBouncy.status,
      isActive: baseBouncy.isActive,
      displayPrice: type.priceRange,
      productId: Number(type.productId),
      specificCategory: baseBouncy.specificCategory || baseBouncy.specificcategory || baseBouncy.category || "Bouncy Castle",
      detailSlug: rentalSlug(baseBouncy),
      type: "bouncy",
    }));

    const filtered = rentals
      .filter((item) => !isBouncyRental(item))
      .map((item) => ({
        ...item,
        productId: Number.isFinite(Number(item.productId)) ? Number(item.productId) : item.id,
      }));
    return [...bouncyOptions, ...filtered];
  }, [rentals, bouncyTypes]);

  useEffect(() => {
    if (!bookingRentals.length) return;
    const rentalSlugParam = searchParams.get("rental");
    if (!rentalSlugParam) return;

    const normalized = rentalSlugParam.toLowerCase();
    const bouncyParam = searchParams.get("bouncy");
    let match = null;

    if (bouncyParam) {
      const bouncyId = `bouncy-${bouncyParam.toLowerCase()}`;
      match = bookingRentals.find((item) => item.id === bouncyId);
    } else {
      match = bookingRentals.find((item) => {
        const slug = (item.detailSlug || rentalSlug(item)).toLowerCase();
        return slug === normalized;
      });
      if (match?.type === "bouncy") {
        match = null;
      }
    }

    if (match) {
      setSelectedIds((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
    }
  }, [bookingRentals, searchParams]);

  const filteredRentals = useMemo(() => {
    if (!searchQuery) return bookingRentals;
    const q = searchQuery.toLowerCase();
    return bookingRentals.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        item.specificCategory?.toLowerCase().includes(q) ||
        item.specificcategory?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    });
  }, [bookingRentals, searchQuery]);

  const selectedRentals = useMemo(
    () => bookingRentals.filter((item) => selectedIds.includes(item.id)),
    [bookingRentals, selectedIds]
  );

  const indoorGameOptions = useMemo(
    () => bookingRentals.filter((item) => isIndoorGameItem(item) && !isBoardGameBundle(item)),
    [bookingRentals]
  );

  const selectedIndoorGames = useMemo(
    () => indoorGameOptions.filter((item) => selectedIndoorGameIds.includes(item.id)),
    [indoorGameOptions, selectedIndoorGameIds]
  );

  const bundleSelected = useMemo(
    () => selectedRentals.some((item) => isBoardGameBundle(item)),
    [selectedRentals]
  );

  useEffect(() => {
    if (!bundleSelected) {
      setSelectedIndoorGameIds([]);
    }
  }, [bundleSelected]);

  useEffect(() => {
    setSelectedIndoorGameIds((prev) =>
      prev.filter((id) => indoorGameOptions.some((item) => item.id === id))
    );
  }, [indoorGameOptions]);

  const toggleIndoorGame = (id) => {
    setSelectedIndoorGameIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
    );
  };

  const getItemTotal = (item) => {
    const unitPrice = parseNumericPrice(getItemPrice(item));
    if (!Number.isFinite(unitPrice)) return 0;
    if (isPerHeadRate(item?.rate) && guestCountValue > 0) {
      return unitPrice * guestCountValue;
    }
    return unitPrice;
  };

  const bundleEligible = selectedRentals.length >= BUNDLE_MIN_ITEMS;
  const subtotal = selectedRentals.reduce((sum, item) => {
    return sum + getItemTotal(item);
  }, 0);
  const bundleDiscount = bundleEligible ? subtotal * BUNDLE_DISCOUNT_RATE : 0;
  const totalAfterDiscount = Math.max(0, subtotal - bundleDiscount);
  const bundleRemaining = Math.max(0, BUNDLE_MIN_ITEMS - selectedRentals.length);

  useEffect(() => {
    if (!noteTouched) {
      setItemsNote(selectedRentals.map((item) => getCatalogItemDisplayName(item, "Rental item")).join(", "));
    }
  }, [selectedRentals, noteTouched]);

  useEffect(() => {
    if (!draftLoadedRef.current) return;
    const draft = {
      formValues,
      selectedIds,
      itemsNote,
      noteTouched,
      selectedIndoorGameIds,
    };
    saveExpiringDraft(BOOKING_DRAFT_KEY, draft);
  }, [formValues, selectedIds, itemsNote, noteTouched, selectedIndoorGameIds]);

  const toggleRental = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  };

  const isEventWindowDisabled = (selectedDate, option) => {
    if (!selectedDate || selectedDate !== today) return false;
    if (typeof option.endMinutes !== "number") return false;
    return currentMinutes >= option.endMinutes;
  };

  const pruneEventWindow = (selectedDate, selectedValue) => {
    if (!selectedDate || selectedDate !== today) return selectedValue;
    const match = EVENT_WINDOW_OPTIONS.find((option) => option.value === selectedValue);
    if (!match || typeof match.endMinutes !== "number") return selectedValue;
    return currentMinutes >= match.endMinutes ? "" : selectedValue;
  };

  const updateFormValue = (field) => (event) => {
    const value = event.target.value;
    setFormValues((prev) => {
      if (field !== "eventDate") {
        return { ...prev, [field]: value };
      }
      return {
        ...prev,
        eventDate: value,
        eventWindow: pruneEventWindow(value, prev.eventWindow),
      };
    });
  };

  useEffect(() => {
    setFormValues((prev) => {
      if (!prev.eventDate || prev.eventDate !== today) return prev;
      const pruned = pruneEventWindow(prev.eventDate, prev.eventWindow);
      if (pruned === prev.eventWindow) return prev;
      return { ...prev, eventWindow: pruned };
    });
  }, [today, currentMinutes]);

  const itemsSummaryValue = [
    ...selectedRentals.map(
      (item) =>
        `${getCatalogItemDisplayName(item, "Rental item")} (${item.specificCategory || item.specificcategory || item.category || "Rental"})`
    ),
    bundleSelected && selectedIndoorGames.length
      ? `Board game bundle picks: ${selectedIndoorGames
          .map((item) => getCatalogItemDisplayName(item, "Rental item"))
          .join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  const itemsSummaryDisplay = itemsSummaryValue || "Add rentals to your booking";

  const formatAmount = (amount) => (amount > 0 ? formatCurrency(convertPrice(amount)) : "TBD");
  const formatBookingTotal = (amountCents) => {
    const parsed = Number(amountCents);
    if (!Number.isFinite(parsed) || parsed <= 0) return "TBD";
    return formatCurrency(convertPrice(parsed / 100));
  };
  const bundleLabel = `Bundle discount (${Math.round(BUNDLE_DISCOUNT_RATE * 100)}% off ${BUNDLE_MIN_ITEMS}+ items)`;
  const subtotalReady = subtotal > 0;
  const discountDisplay = bundleEligible
    ? subtotalReady
      ? `- ${formatAmount(bundleDiscount)}`
      : "Applied at confirmation"
    : `Add ${bundleRemaining} more`;
  const totalDisplay = subtotalReady ? formatAmount(totalAfterDiscount) : "TBD";

  const fetchExistingCustomer = async ({ email: lookupEmail, phone: lookupPhone, name: lookupName }) => {
    const lookups = [];
    if (lookupEmail) {
      lookups.push(`/.netlify/functions/customers?email=${encodeURIComponent(lookupEmail)}`);
    }
    if (lookupPhone) {
      lookups.push(`/.netlify/functions/customers?phone=${encodeURIComponent(lookupPhone)}`);
    }
    if (lookupName) {
      lookups.push(`/.netlify/functions/customers?name=${encodeURIComponent(lookupName)}`);
    }
    for (const lookupUrl of lookups) {
      const existingRes = await fetch(lookupUrl);
      if (!existingRes.ok) continue;
      const payload = await existingRes.json();
      if (payload?.id) return payload;
    }
    return null;
  };

  const buildBookingItems = () => {
    const baseItems = selectedRentals
      .map((item) => {
        const quantity = isPerHeadRate(item?.rate) && guestCountValue > 0 ? guestCountValue : 1;
        return {
          productId: Number(item.productId ?? item.id),
          quantity,
        };
      })
      .filter((item) => Number.isFinite(item.productId));

    if (bundleSelected && selectedIndoorGames.length) {
      const existing = new Set(baseItems.map((item) => item.productId));
      selectedIndoorGames.forEach((item) => {
        const productId = Number(item.productId ?? item.id);
        if (!Number.isFinite(productId) || existing.has(productId)) return;
        baseItems.push({ productId, quantity: 1, price: 0 });
      });
    }

    return baseItems;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!selectedRentals.length) {
      setSubmitError("Select at least one rental item before booking.");
      return;
    }
    if (bundleSelected && selectedIndoorGameIds.length < 3) {
      setSubmitError("Select at least three indoor games for the board game bundle.");
      return;
    }
    if (selectedRentals.some((item) => isPerHeadRate(item?.rate)) && guestCountValue <= 0) {
      setSubmitError("Enter a guest count to price per-head rentals.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    setBookingReceipt(null);

    const name = formValues.name.trim();
    const email = formValues.email.trim();
    const phone = formValues.phone.trim();
    const eventDate = formValues.eventDate.trim();
    const eventWindow = formValues.eventWindow.trim();
    const location = formValues.location.trim();

    try {
      let customerPayload = await fetchExistingCustomer({ email, phone, name });
      if (!customerPayload?.id) {
        const customerRes = await fetch("/.netlify/functions/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone }),
        });
        customerPayload = await customerRes.json();
        if (!customerRes.ok) {
          if (customerRes.status === 409) {
            const existing = await fetchExistingCustomer({ email, phone, name });
            if (existing) {
              customerPayload = existing;
            }
          }
          if (!customerPayload?.id) {
            throw new Error(customerPayload?.error || "Failed to save customer.");
          }
        }
      }

      const bookingItems = buildBookingItems();
      if (!bookingItems.length) {
        throw new Error("Selected items are missing product data. Try again.");
      }

      const bookingBody = {
        customerId: customerPayload.id,
        eventDate,
        startTime: eventWindow || null,
        endTime: null,
        venueAddress: location,
        items: bookingItems,
        discount: bundleEligible ? bundleDiscount : 0,
        applyBundleDiscount: true,
        status: "pending",
      };
      let bookingRes = await fetch("/.netlify/functions/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingBody),
      });
      let bookingPayload = await bookingRes.json();
      if (!bookingRes.ok && typeof bookingPayload?.error === "string" && bookingPayload.error.toLowerCase().includes("customer")) {
        const existing = await fetchExistingCustomer({ email, phone, name });
        if (existing?.id) {
          bookingBody.customerId = existing.id;
          bookingRes = await fetch("/.netlify/functions/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookingBody),
          });
          bookingPayload = await bookingRes.json();
        }
      }
      if (!bookingRes.ok) {
        throw new Error(bookingPayload?.error || "Failed to create booking.");
      }

      setBookingReceipt({
        ...bookingPayload,
        bundleApplied: bundleEligible,
        bundleSubtotal: subtotal,
        bundleDiscount: bundleEligible ? bundleDiscount : 0,
      });
      setSubmitSuccess(`Booking #${bookingPayload.id} received! We’ll confirm availability shortly.`);
      setSelectedIds([]);
      setItemsNote("");
      setNoteTouched(false);
      setFormValues(defaultFormValues);
      clearExpiringDraft(BOOKING_DRAFT_KEY);
      form.reset();
    } catch (err) {
      setSubmitError(err.message || "Unable to submit booking right now.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SiteLoader
        label="Loading booking options"
        sublabel="Preparing your rental list and pricing."
      />
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div className="booking-page rentals-theme" id="main">
        <main className="booking-shell page-shell">
          <section className="booking-hero glass-card page-hero" aria-labelledby="booking-hero-heading">
            <div className="booking-hero-copy page-hero-copy">
              <h1 id="booking-hero-heading" className="page-hero-title">Reserve your rentals</h1>
              <p className="booking-hero-sub">
                Pick the bounce house, decor, or concessions you want. We confirm availability, delivery,
                and setup details for your date.
              </p>
              <div className="booking-pills" aria-label="Booking highlights">
                <span>
                  <AppIcon icon={faWandMagicSparkles} /> Rentals only
                </span>
                <span>
                  <AppIcon icon={faTruckFast} /> Delivery & pickup handled
                </span>
                <span>
                  <AppIcon icon={faShieldHeart} /> Sanitized + kid-safe
                </span>
              </div>
              <div className="booking-cta-row" role="group" aria-label="Booking actions">
                <a className="hero-btn hero-btn-primary" href="#booking-form">
                  Start booking
                </a>
                <Link className="hero-btn hero-btn-ghost" to="/Rentals">
                  Browse rentals
                </Link>
              </div>
            </div>
            <div className="booking-hero-card glass-card">
              <p className="kicker">Why this form</p>
              <h2>Built for rentals</h2>
              <p className="booking-hero-note">
                This booking form is only for rental items (bounce castles, decor, concessions, props).
                For balloons or full styling, use the Contact page instead.
              </p>
              <div className="booking-hero-stats">
                <div>
                  <strong>{rentals.length}</strong>
                  <span>Rental items live</span>
                </div>
                <div>
                  <strong>Accra</strong>
                  <span>Delivery & pickup</span>
                </div>
                <div>
                  <strong>48 hrs</strong>
                  <span>Reschedule window</span>
                </div>
              </div>
            </div>
          </section>

          <section className="booking-grid">
            <article className="booking-form-card glass-card" id="booking-form" aria-labelledby="booking-form-heading">
              <div className="section-header rent-section-header">
                <h2 id="booking-form-heading">Tell us about your event</h2>
                <p className="rental-sub">
                  Add the rentals you want, your date, and where we’re delivering. We confirm availability quickly.
                </p>
              </div>
              <form
                className="contact-form booking-form"
                name="rental-booking"
                method="POST"
                data-netlify="true"
                netlify-honeypot="bot-field"
                onSubmit={handleSubmit}
              >
                <input type="hidden" name="form-name" value="rental-booking" />
                <p className="hidden">
                  <label>
                    Don’t fill this out: <input name="bot-field" />
                  </label>
                </p>
                <input type="hidden" name="selectedRentals" value={itemsSummaryValue} />

                <div className="form-overview booking-form-overview">
                  <div className="form-overview-copy">
                    <p className="form-kicker">Booking brief</p>
                    <h4>Lock in the details clearly</h4>
                    <p className="contact-form-note">
                      Rentals only. We hold your date and reply with confirmation and the delivery window.
                    </p>
                  </div>
                  <div className="form-overview-metrics" aria-label="Booking summary">
                    <span>{selectedRentals.length} {selectedRentals.length === 1 ? "rental" : "rentals"} selected</span>
                    <span>{totalDisplay} estimate</span>
                    <span>{formValues.eventDate ? formatDateShort(formValues.eventDate) : "Choose a date"}</span>
                  </div>
                </div>

                <section className="form-section" aria-labelledby="booking-contact-heading">
                  <div className="form-section-head">
                    <p className="form-section-kicker">01</p>
                    <h4 id="booking-contact-heading">Your contact details</h4>
                    <p>Tell us who is booking so we can confirm the request and delivery timing fast.</p>
                  </div>
                  <div className="contact-form-grid form-section-grid">
                    <div className="form-group">
                      <label htmlFor="fullName">Name</label>
                      <input
                        id="fullName"
                        type="text"
                        name="name"
                        autoComplete="name"
                        placeholder="Your full name"
                        value={formValues.name}
                        onChange={updateFormValue("name")}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={formValues.email}
                        onChange={updateFormValue("email")}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="phone">Phone / WhatsApp</label>
                      <input
                        id="phone"
                        type="tel"
                        name="phone"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+233 24 423 8419"
                        pattern="^[0-9+\\-()\\s]{7,}$"
                        value={formValues.phone}
                        onChange={updateFormValue("phone")}
                        required
                      />
                      <small className="hint">We’ll confirm on call or WhatsApp.</small>
                    </div>
                  </div>
                </section>

                <section className="form-section" aria-labelledby="booking-event-heading">
                  <div className="form-section-head">
                    <p className="form-section-kicker">02</p>
                    <h4 id="booking-event-heading">Event logistics</h4>
                    <p>Share the date, window, and venue so we can check stock and routing accurately.</p>
                  </div>
                  <div className="contact-form-grid form-section-grid">
                    <div className="form-group">
                      <label htmlFor="eventDate">Event date</label>
                      <input
                        id="eventDate"
                        type="date"
                        name="eventDate"
                        min={today}
                        value={formValues.eventDate}
                        onChange={updateFormValue("eventDate")}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="eventWindow">Setup & pickup window</label>
                      <select
                        id="eventWindow"
                        name="eventWindow"
                        value={formValues.eventWindow}
                        onChange={updateFormValue("eventWindow")}
                      >
                        <option value="" disabled>
                          Choose a timing window
                        </option>
                        {EVENT_WINDOW_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            disabled={isEventWindowDisabled(formValues.eventDate, option)}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="location">Location / venue</label>
                      <input
                        id="location"
                        type="text"
                        name="location"
                        placeholder="Neighborhood or venue in Accra"
                        autoComplete="address-level2"
                        value={formValues.location}
                        onChange={updateFormValue("location")}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="guestCount">Guest count</label>
                      <input
                        id="guestCount"
                        type="number"
                        name="guestCount"
                        min="1"
                        placeholder="Approx. guests"
                        value={formValues.guestCount}
                        onChange={updateFormValue("guestCount")}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="contactPreference">How should we confirm?</label>
                      <select
                        id="contactPreference"
                        name="contactPreference"
                        value={formValues.contactPreference}
                        onChange={updateFormValue("contactPreference")}
                      >
                        <option value="" disabled>
                          Choose a contact method
                        </option>
                        <option value="Phone call">Phone call</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Email">Email</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="form-section" aria-labelledby="booking-notes-heading">
                  <div className="form-section-head">
                    <p className="form-section-kicker">03</p>
                    <h4 id="booking-notes-heading">Rental notes</h4>
                    <p>Confirm your picks and list any theme notes, special requests, or delivery details.</p>
                  </div>
                  <div className="contact-form-grid form-section-grid">
                    <div className="form-group full-width">
                      <label htmlFor="rentalNotes">Rental picks & notes</label>
                      <textarea
                        id="rentalNotes"
                        name="rentalNotes"
                        rows="5"
                        placeholder="List the rentals you want and any themes or must-haves."
                        value={itemsNote}
                        onChange={(e) => {
                          setNoteTouched(true);
                          setItemsNote(e.target.value);
                        }}
                        required
                      ></textarea>
                      <small className="hint">Selected rentals: {itemsSummaryDisplay}</small>
                    </div>
                  </div>
                </section>

                <div className="form-footer">
                  <small className="hint">We reply same day for bookings within Accra.</small>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Submitting..." : "Request booking"}
                  </button>
                </div>
                {submitError && <p className="form-error">{submitError}</p>}
                {submitSuccess && <p className="form-success">{submitSuccess}</p>}
              </form>
              {bookingReceipt && (
                <div className="booking-receipt" role="status" aria-live="polite">
                  <div className="booking-receipt-head">
                    <div>
                      <p className="kicker">Booking received</p>
                      <h3>Booking #{bookingReceipt.id}</h3>
                      <p className="booking-receipt-meta">
                        {formatDateShort(bookingReceipt.eventDate)}
                        {bookingReceipt.startTime ? ` · ${bookingReceipt.startTime}` : ""}
                      </p>
                    </div>
                    {bookingReceipt.bundleApplied && (
                      <span className="booking-receipt-pill">Bundle discount applied</span>
                    )}
                  </div>
                  <div className="booking-receipt-list">
                    {(bookingReceipt.items || []).map((item) => (
                      <div key={item.id || item.productId} className="booking-receipt-item">
                        <div
                          className="booking-receipt-media category-image-bg"
                          style={getCatalogItemBackgroundStyle(item)}
                        >
                          <img
                            src={getCatalogItemImage(item)}
                            alt={item.productName || "Rental item"}
                          />
                        </div>
                        <div className="booking-receipt-info">
                          <h4>{item.productName || `Item ${item.productId}`}</h4>
                          <p>
                            Qty {item.quantity || 1} ·{" "}
                            {formatBookingTotal(item.price)}
                          </p>
                        </div>
                        <strong className="booking-receipt-line-total">
                          {formatBookingTotal((item.price || 0) * (item.quantity || 1))}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="booking-receipt-total">
                    <span>Total</span>
                    <strong>{formatBookingTotal(bookingReceipt.totalAmount)}</strong>
                  </div>
                </div>
              )}
            </article>

            <aside className="booking-rentals glass-card" aria-label="Add rentals to your booking">
              <div className="section-header rent-section-header">
                <p className="kicker">Add rentals</p>
                <h3>Choose items to include</h3>
                <p className="rental-sub">
                  This form is for rentals only. Search and add items to pre-fill your booking note.
                </p>
              </div>
              <div className="booking-rental-search">
                <label htmlFor="rentalSearch" className="sr-only">
                  Search rentals
                </label>
                <SearchField
                  id="rentalSearch"
                  placeholder="Search bounce houses, decor, concessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery("")}
                  aria-label="Search rentals"
                />
              </div>
              <div className="booking-selected" aria-live="polite">
                <p className="rent-meta">Selected rentals</p>
                {selectedRentals.length === 0 ? (
                  <p className="booking-empty">No rentals added yet.</p>
                ) : (
                  <>
                    <div className="booking-selected-chips">
                      {selectedRentals.map((item) => (
                        <span key={item.id} className="booking-chip">
                          {getCatalogItemDisplayName(item, "Rental item")}
                        </span>
                      ))}
                    </div>
                    {bundleSelected && (
                      <div className="booking-bundle-picker">
                        <p className="rent-meta">Board game bundle picks (choose at least 3)</p>
                        {indoorGameOptions.length ? (
                          <div className="booking-bundle-list">
                            {indoorGameOptions.map((item) => {
                              const checked = selectedIndoorGameIds.includes(item.id);
                              return (
                                <label
                                  key={item.id}
                                  className={`booking-bundle-option ${checked ? "is-selected" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleIndoorGame(item.id)}
                                  />
                                  <span>{getCatalogItemDisplayName(item, "Rental item")}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="booking-empty">No indoor games available.</p>
                        )}
                        {selectedIndoorGameIds.length < 3 && (
                          <p className="booking-bundle-hint">
                            Select {3 - selectedIndoorGameIds.length} more to continue.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="booking-summary">
                      <div className="booking-summary-row">
                        <span>Subtotal</span>
                        <strong>{formatAmount(subtotal)}</strong>
                      </div>
                      <div className={`booking-summary-row ${bundleEligible ? "is-discount" : ""}`}>
                        <span>{bundleLabel}</span>
                        <strong>{discountDisplay}</strong>
                      </div>
                      <div className="booking-summary-total">
                        <span>Estimated total</span>
                        <strong>{totalDisplay}</strong>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="booking-rental-list">
                {filteredRentals.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  const detailSlug = item.detailSlug || rentalSlug(item);
                  const itemDisplayName = getCatalogItemDisplayName(item, "Rental item");
                  return (
                    <div
                      key={item.id}
                      className={`booking-rental-card glass-card ${selected ? "is-selected" : ""}`}
                    >
                      <div
                        className="booking-rental-media category-image-bg"
                        style={getCatalogItemBackgroundStyle(item)}
                      >
                        <img src={getCatalogItemImage(item)} alt={itemDisplayName} />
                        <span className="rent-tag">{item.specificCategory || item.category}</span>
                      </div>
                      <div className="booking-rental-body">
                        <div className="booking-rental-head">
                          <h4>{itemDisplayName}</h4>
                        <p className="price">
                          {item.displayPrice || formatRentalPrice(item, convertPrice, formatCurrency, guestCountValue)}
                        </p>
                      </div>
                      <p className="rent-meta">
                        {formatStatus(item.status, item.isActive)} · {getRateLabel(item)}
                      </p>
                        <div className="booking-rental-actions">
                          <button
                            type="button"
                            className={`hero-btn hero-btn-link ${selected ? "selected" : ""}`}
                            onClick={() => toggleRental(item.id)}
                            aria-pressed={selected}
                          >
                            {selected ? "Remove" : "Add to booking"}
                          </button>
                          <Link className="hero-btn hero-btn-ghost" to={`/Rentals/${detailSlug}`}>
                            View details
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          </section>
        </main>
      </div>
    </>
  );
}

export default Book;
