/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Checkout.css";
import { Link } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBagShopping,
  faReceipt,
  faShieldHeart,
  faTruckFast,
} from "/src/icons/iconSet";
import { useCart } from "../../components/CartContext/CartContext";
import {
  getCatalogItemBackgroundStyle,
  getCatalogItemDisplayName,
  getCatalogItemImage,
} from "/src/utils/itemMediaBackgrounds";
import {
  getCartItemBillingQuantity,
  getCartItemLineTotal,
  getCartItemPrice,
  getCartItemRateLabel,
  isRentalCartItem,
  splitCartItems,
} from "/src/utils/cart";
import {
  clearExpiringDraft,
  loadExpiringDraft,
  saveExpiringDraft,
} from "/src/utils/formDrafts";

const TIME_WINDOW_OPTIONS = [
  { value: "9am-11am", label: "9:00am – 11:00am", endMinutes: 11 * 60 },
  { value: "11am-1pm", label: "11:00am – 1:00pm", endMinutes: 13 * 60 },
  { value: "1pm-3pm", label: "1:00pm – 3:00pm", endMinutes: 15 * 60 },
  { value: "3pm-5pm", label: "3:00pm – 5:00pm", endMinutes: 17 * 60 },
  { value: "5pm-7pm", label: "5:00pm – 7:00pm", endMinutes: 19 * 60 },
];

const PAYMENT_METHODS = new Set(["card", "momo", "bank"]);
const MOMO_PROVIDER_OPTIONS = [
  { value: "mtn-momo", label: "MTN MoMo" },
  { value: "telecel-cash", label: "Telecel Cash" },
  { value: "airteltigo-money", label: "AirtelTigo Money" },
  { value: "g-money", label: "G-Money" },
];
const MOMO_PROVIDER_ALIASES = {
  mtn: "mtn-momo",
  "mtn-momo": "mtn-momo",
  vodafone: "telecel-cash",
  "telecel-cash": "telecel-cash",
  telecash: "telecel-cash",
  telecel: "telecel-cash",
  "airtel-tigo": "airteltigo-money",
  airteltigo: "airteltigo-money",
  "airteltigo-money": "airteltigo-money",
  gmoney: "g-money",
  "g-money": "g-money",
};
const MOMO_PROVIDERS = new Set(MOMO_PROVIDER_OPTIONS.map((option) => option.value));
const PHONE_CODE_OPTIONS = [
  { value: "+233", label: "GH +233" },
  { value: "+1", label: "US +1" },
  { value: "+44", label: "UK +44" },
];
const DEFAULT_PHONE_CODE = PHONE_CODE_OPTIONS[0].value;
const PAYMENT_OPTION_CARDS = [
  {
    value: "card",
    title: "Card",
  },
  {
    value: "momo",
    title: "Mobile money",
  },
  {
    value: "bank",
    title: "Bank transfer",
  },
];

const cleanDraftText = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const normalizePhoneDigits = (value, maxLength = 10) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, maxLength);

const parsePhoneDraft = (value, fallbackCode = DEFAULT_PHONE_CODE) => {
  const raw = cleanDraftText(value, 40);
  if (!raw) return { code: fallbackCode, local: "" };

  const matchedCode = PHONE_CODE_OPTIONS.find((option) => raw.startsWith(option.value));
  if (matchedCode) {
    return {
      code: matchedCode.value,
      local: normalizePhoneDigits(raw.slice(matchedCode.value.length)),
    };
  }

  return {
    code: fallbackCode,
    local: normalizePhoneDigits(raw).slice(-10),
  };
};

const formatPhoneNumber = (code, local) => {
  const normalizedCode = PHONE_CODE_OPTIONS.some((option) => option.value === code)
    ? code
    : DEFAULT_PHONE_CODE;
  const digits = normalizePhoneDigits(local);
  return digits ? `${normalizedCode} ${digits}` : "";
};

const sanitizeDraftPaymentDetails = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const method = PAYMENT_METHODS.has(value.method) ? value.method : "card";
  const rawMomoProvider = cleanDraftText(value.momoProvider, 24).toLowerCase();
  const momoProvider = MOMO_PROVIDER_ALIASES[rawMomoProvider] || "";
  const phoneDraft = parsePhoneDraft(value.phone, value.phoneCode || DEFAULT_PHONE_CODE);

  return {
    name: cleanDraftText(value.name, 80),
    email: cleanDraftText(value.email, 120),
    phoneCode: phoneDraft.code,
    phoneLocal: value.phoneLocal ? normalizePhoneDigits(value.phoneLocal) : phoneDraft.local,
    method,
    momoProvider: MOMO_PROVIDERS.has(momoProvider) ? momoProvider : "",
  };
};

const sanitizeDraftDeliveryDetails = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const phoneDraft = parsePhoneDraft(value.contact, value.contactCode || DEFAULT_PHONE_CODE);
  return {
    address: cleanDraftText(value.address, 180),
    contact: formatPhoneNumber(
      value.contactCode || phoneDraft.code,
      value.contactNumber || phoneDraft.local
    ),
    contactCode: PHONE_CODE_OPTIONS.some((option) => option.value === value.contactCode)
      ? value.contactCode
      : phoneDraft.code,
    contactNumber: value.contactNumber
      ? normalizePhoneDigits(value.contactNumber)
      : phoneDraft.local,
    date: cleanDraftText(value.date, 20),
    window: cleanDraftText(value.window, 40),
    notes: cleanDraftText(value.notes, 240),
  };
};

const CHECKOUT_SECTION_CONFIG = {
  rentals: {
    title: "Rental items",
  },
  shop: {
    title: "Shop items",
  },
};

const PICKUP_VENUE_FALLBACK = "Pickup at REEBS Party Themes studio";

const parseWindowRange = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return { startTime: null, endTime: null };
  const [start, end] = normalized.split("-").map((part) => part.trim());
  return {
    startTime: start || null,
    endTime: end || null,
  };
};

const readApiPayload = async (response) => {
  const rawText = await response.text().catch(() => "");
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      error: rawText.trim() || response.statusText || "Unexpected response from server.",
    };
  }
};

const Checkout = () => {
  const { cart, convertPrice, formatCurrency, currency, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState(() =>
    cart.some((item) => isRentalCartItem(item)) ? "delivery" : "pickup"
  );
  const [deliverShopWithRentals, setDeliverShopWithRentals] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState({ state: "idle", message: "" });
  const [orderSuccess, setOrderSuccess] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState({
    address: "",
    contact: "",
    contactCode: DEFAULT_PHONE_CODE,
    contactNumber: "",
    date: "",
    window: "",
    notes: "",
  });
  const [pickupDetails, setPickupDetails] = useState({
    date: "",
    window: "",
    notes: "",
  });
  const [paymentDetails, setPaymentDetails] = useState({
    name: "",
    email: "",
    phoneCode: DEFAULT_PHONE_CODE,
    phoneLocal: "",
    method: "card",
    momoProvider: "",
  });
  const [now, setNow] = useState(() => new Date());
  const draftLoadedRef = useRef(false);
  const itemCount = cart.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const subtotal = cart.reduce((acc, item) => acc + getCartItemLineTotal(item), 0);
  const formattedSubtotal = formatCurrency(convertPrice(subtotal));
  const itemLabel = itemCount === 1 ? "item" : "items";
  const today = now.toISOString().split("T")[0];
  const modalAmount = confirmedAmount || formattedSubtotal;
  const draftKey = "checkoutPaymentDraft";
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const cartGroups = useMemo(() => splitCartItems(cart), [cart]);
  const checkoutSections = useMemo(
    () =>
      [
        { key: "rentals", items: cartGroups.rentals },
        { key: "shop", items: cartGroups.shop },
      ].filter((section) => section.items.length),
    [cartGroups]
  );
  const rentalCount = cartGroups.rentals.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const shopCount = cartGroups.shop.reduce((acc, item) => acc + getCartItemBillingQuantity(item), 0);
  const hasRentalItems = rentalCount > 0;
  const hasShopItems = shopCount > 0;
  const isMixedCart = hasRentalItems && hasShopItems;
  const selectedFulfillment = hasRentalItems ? fulfillment : "pickup";
  const shopItemsRideWithRentalDelivery =
    isMixedCart && selectedFulfillment === "delivery" && deliverShopWithRentals;
  const shouldAskShopDeliveryPreference = isMixedCart && selectedFulfillment === "delivery";
  const needsPickupDetails =
    selectedFulfillment === "pickup" || (hasShopItems && !shopItemsRideWithRentalDelivery);
  const needsDeliveryDetails = hasRentalItems && selectedFulfillment === "delivery";
  const fulfillmentBadgeLabel = isMixedCart
    ? selectedFulfillment === "delivery"
      ? shopItemsRideWithRentalDelivery
        ? "Delivery together"
        : "Rentals delivered · Shop pickup"
      : "Pickup review"
    : selectedFulfillment === "delivery"
      ? "Delivery review"
      : "Pickup review";
  const pickupFormHeading = isMixedCart && selectedFulfillment === "delivery"
    ? "Shop pickup details"
    : "Pickup details";
  const pickupFormHint = isMixedCart && selectedFulfillment === "delivery"
    ? "These details are used for the shop items in your cart."
    : isMixedCart
      ? "This pickup window will be used for both rentals and shop items."
      : "Select a pickup date and window at our studio.";
  const deliveryFormHeading = isMixedCart ? "Rental delivery details" : "Delivery details";
  const deliveryFormHint = isMixedCart
    ? shopItemsRideWithRentalDelivery
      ? "These delivery details apply to both your rental booking and the shop items riding with it."
      : "These delivery details apply to rental bookings only."
    : "Share your preferred delivery date, time, and venue.";

  const fulfillmentCopy = !hasRentalItems
    ? {
        checkoutSub:
          "Review your items and confirm the next steps. We will follow up with pickup details and payment options.",
        confirmTitle: "We will confirm pickup and payment",
        confirmHint:
          "Checkout is handled manually for now. Reach out with your pickup date and window and we will send a payment link.",
        stepTwoTitle: "Share pickup details",
        stepTwoText: "Select a pickup date and window at our studio.",
        stepFourTitle: "We confirm the pickup",
        stepFourText: "Once payment is received, your pickup is locked in.",
        fulfillmentTitle: "Pickup in store",
        fulfillmentHint: "Shop items are pickup-only and are prepared for collection at the studio.",
        summaryNote: "Taxes and pickup details are confirmed in the final invoice.",
      }
    : isMixedCart
      ? {
          checkoutSub:
            shopItemsRideWithRentalDelivery
              ? "Rental bookings and shop items can be delivered together so timing stays aligned before payment is collected."
              : "Rental bookings and shop pickup items are reviewed separately so timing stays clear before payment is collected.",
          confirmTitle: "We will confirm your booking, pickup, and payment",
          confirmHint:
            shopItemsRideWithRentalDelivery
              ? "Rentals can be delivered or picked up, and shop items can ride with the rental delivery when that works best."
              : "Rentals can still be delivered or picked up. Shop items remain pickup-only and are packed separately.",
          stepTwoTitle:
            selectedFulfillment === "delivery"
              ? shopItemsRideWithRentalDelivery
                ? "Share one delivery plan"
                : "Share delivery and pickup details"
              : "Share pickup details",
          stepTwoText:
            selectedFulfillment === "delivery"
              ? shopItemsRideWithRentalDelivery
                ? "Choose the delivery date, window, and address for the rentals and shop items together."
                : "Choose rental delivery details and a pickup window for shop items."
              : "Choose a pickup date and window for both rentals and shop items.",
          stepFourTitle: shopItemsRideWithRentalDelivery ? "We confirm the delivery plan" : "We confirm each part",
          stepFourText: shopItemsRideWithRentalDelivery
            ? "Your rental booking and shop delivery are locked in after review and payment."
            : "Your rental booking and shop pickup are locked in after review and payment.",
          fulfillmentTitle: "Rental fulfillment",
          fulfillmentHint:
            selectedFulfillment === "delivery"
              ? "Choose delivery or pickup for rentals, then decide whether shop items should ride with the rental delivery or stay pickup-only."
              : "Choose the pickup plan for the full cart.",
          summaryNote: shopItemsRideWithRentalDelivery
            ? "Rental timing, shop delivery, and final fees are confirmed in the final invoice."
            : "Rental timing and shop pickup details are confirmed in the final invoice.",
        }
    : {
        checkoutSub:
          "Review your items and confirm the next steps. We will follow up with delivery details and payment options.",
        confirmTitle: "We will confirm delivery and payment",
        confirmHint:
          "Checkout is handled manually for now. Reach out with your delivery date and location and we will send a payment link.",
        stepTwoTitle: "Share delivery details",
        stepTwoText: "Send your preferred delivery date, time, and venue.",
        stepFourTitle: "We confirm the booking",
        stepFourText: "Once payment is received, your delivery is locked in.",
        fulfillmentTitle: "Delivery or pickup?",
        fulfillmentHint: "Choose how you want to receive your items and fill in the details.",
        summaryNote: "Taxes and delivery are confirmed in the final invoice.",
      };
  const modalFulfillmentLabel = isMixedCart
    ? selectedFulfillment === "delivery"
      ? shopItemsRideWithRentalDelivery
        ? "Delivery together"
        : "Rental delivery + shop pickup"
      : "Pickup"
    : selectedFulfillment === "delivery"
      ? "Delivery"
      : "Pickup";
  const paymentMethodPanel = paymentDetails.method === "card"
    ? {
        title: "Card payments are handled securely off-site",
        body:
          "After you confirm this order, we will send a secure payment link or invoice. Do not enter card details in this form.",
      }
    : paymentDetails.method === "momo"
      ? {
          title: "Your confirmation email includes the mobile money route",
          body:
            "We include the mobile money account details in your confirmation email and note the wallet you selected.",
        }
      : {
          title: "Your confirmation email includes the bank transfer details",
          body:
            "We include the bank account details and payment reference in your confirmation email.",
        };
  const paymentConfirmationMessage =
    paymentDetails.method === "card"
      ? "We will send secure payment instructions separately."
      : "Check your confirmation email for the payment details.";

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const parsed = loadExpiringDraft(draftKey);
    if (!parsed) {
      draftLoadedRef.current = true;
      return;
    }

    if (parsed.fulfillment) setFulfillment(parsed.fulfillment);
    if (typeof parsed.deliverShopWithRentals === "boolean") {
      setDeliverShopWithRentals(parsed.deliverShopWithRentals);
    }
    if (parsed.deliveryDetails) {
      const safeDeliveryDetails = sanitizeDraftDeliveryDetails(parsed.deliveryDetails);
      if (safeDeliveryDetails) setDeliveryDetails(safeDeliveryDetails);
    }
    if (parsed.pickupDetails) setPickupDetails(parsed.pickupDetails);
    if (parsed.paymentDetails) {
      const safeDraft = sanitizeDraftPaymentDetails(parsed.paymentDetails);
      if (safeDraft) {
        setPaymentDetails((prev) => ({
          ...prev,
          ...safeDraft,
        }));
      }
    }
    draftLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (paymentStatus.state === "success") return;
    const normalizedDeliveryDetails = sanitizeDraftDeliveryDetails(deliveryDetails);
    const payload = {
      fulfillment: selectedFulfillment,
      deliverShopWithRentals,
      deliveryDetails: needsDeliveryDetails ? normalizedDeliveryDetails : null,
      pickupDetails: needsPickupDetails ? pickupDetails : null,
      paymentDetails: sanitizeDraftPaymentDetails(paymentDetails),
    };
    saveExpiringDraft(draftKey, payload);
  }, [
    selectedFulfillment,
    deliverShopWithRentals,
    needsDeliveryDetails,
    needsPickupDetails,
    deliveryDetails,
    pickupDetails,
    paymentDetails,
    paymentStatus.state,
  ]);

  const isWindowDisabled = (selectedDate, option) => {
    if (!selectedDate || selectedDate !== today) return false;
    return currentMinutes >= option.endMinutes;
  };

  const pruneWindowSelection = (selectedDate, selectedValue) => {
    if (!selectedDate || selectedDate !== today) return selectedValue;
    const match = TIME_WINDOW_OPTIONS.find((option) => option.value === selectedValue);
    if (!match) return selectedValue;
    return currentMinutes >= match.endMinutes ? "" : selectedValue;
  };

  const updateDelivery = (field) => (event) => {
    const value = event.target.value;
    setDeliveryDetails((prev) => {
      if (field !== "date") {
        return { ...prev, [field]: value };
      }
      return {
        ...prev,
        date: value,
        window: pruneWindowSelection(value, prev.window),
      };
    });
  };

  const updatePickup = (field) => (event) => {
    const value = event.target.value;
    setPickupDetails((prev) => {
      if (field !== "date") {
        return { ...prev, [field]: value };
      }
      return {
        ...prev,
        date: value,
        window: pruneWindowSelection(value, prev.window),
      };
    });
  };

  const updatePayment = (field) => (event) => {
    const value = event.target.value;
    setPaymentDetails((prev) => ({ ...prev, [field]: value }));
  };

  const updatePhoneDigits = (setter, field) => (event) => {
    const digits = normalizePhoneDigits(event.target.value);
    setter((prev) => ({ ...prev, [field]: digits }));
  };

  const resetPaymentStatus = () => setPaymentStatus({ state: "idle", message: "" });

  const createCheckoutItems = (items) =>
    items
      .map((item) => ({
        productId: Number(item.productId ?? item.id),
        quantity: getCartItemBillingQuantity(item),
        price: getCartItemPrice(item),
      }))
      .filter((item) => Number.isFinite(item.productId));

  useEffect(() => {
    setDeliveryDetails((prev) => {
      if (!prev.date || prev.date !== today) return prev;
      const pruned = pruneWindowSelection(prev.date, prev.window);
      if (pruned === prev.window) return prev;
      return { ...prev, window: pruned };
    });
    setPickupDetails((prev) => {
      if (!prev.date || prev.date !== today) return prev;
      const pruned = pruneWindowSelection(prev.date, prev.window);
      if (pruned === prev.window) return prev;
      return { ...prev, window: pruned };
    });
  }, [today, currentMinutes]);

  const resolveCustomer = async () => {
    const name = paymentDetails.name.trim();
    const email = paymentDetails.email.trim();
    const phone = formatPhoneNumber(paymentDetails.phoneCode, paymentDetails.phoneLocal);

    const createRes = await fetch("/.netlify/functions/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });

    if (createRes.ok) {
      return readApiPayload(createRes);
    }

    if (createRes.status !== 409) {
      const errorData = await readApiPayload(createRes);
      throw new Error(errorData?.error || "Failed to create customer.");
    }

    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (phone) params.set("phone", phone);
    if (name) params.set("name", name);
    const lookupRes = await fetch(`/.netlify/functions/customers?${params.toString()}`);
    if (lookupRes.ok) {
      const match = await readApiPayload(lookupRes);
      if (match?.id) return match;
    }
    return { id: null, name, email, phone };
  };

  const validatePayment = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = normalizePhoneDigits(paymentDetails.phoneLocal);
    if (!paymentDetails.name.trim() || !paymentDetails.email.trim()) {
      return "Add your name and email.";
    }
    if (!emailPattern.test(paymentDetails.email.trim())) {
      return "Enter a valid email address.";
    }
    if (!phoneDigits) {
      return "Add a phone number.";
    }
    if (phoneDigits.length !== 10) {
      return "Enter a valid 10-digit phone number.";
    }
    if (needsDeliveryDetails && !deliveryDetails.address.trim()) {
      return "Add a delivery address.";
    }
    if (needsDeliveryDetails && !deliveryDetails.date) {
      return "Select a delivery date.";
    }
    if (needsDeliveryDetails && deliveryDetails.contactNumber && normalizePhoneDigits(deliveryDetails.contactNumber).length !== 10) {
      return "Enter a valid 10-digit delivery contact number.";
    }
    if (needsPickupDetails && !pickupDetails.date) {
      return isMixedCart ? "Select a pickup date for your shop items." : "Select a pickup date.";
    }
    if (paymentDetails.method === "momo" && !paymentDetails.momoProvider.trim()) {
      return "Select a mobile money provider.";
    }
    return "";
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    resetPaymentStatus();
    setOrderSuccess("");
    const validationError = validatePayment();
    if (validationError) {
      setPaymentStatus({ state: "error", message: validationError });
      return;
    }
    if (cart.length === 0) {
      setPaymentStatus({ state: "error", message: "Your cart is empty." });
      return;
    }

    setPaymentStatus({ state: "saving", message: "Confirming your order..." });
    try {
      const customer = await resolveCustomer();
      const normalizedDeliveryDetails = sanitizeDraftDeliveryDetails(deliveryDetails) || deliveryDetails;
      if (!customer.id) {
        throw new Error("Customer already exists but could not be found.");
      }

      const createdRefs = [];
      let createdShopOrderRef = null;
      const shopUsesDelivery = shopItemsRideWithRentalDelivery;

      if (cartGroups.shop.length > 0) {
        setPaymentStatus({ state: "saving", message: "Creating shop order..." });
        const orderPayload = {
          customerId: customer.id,
          items: createCheckoutItems(cartGroups.shop),
          status: "pending",
          deliveryMethod: shopUsesDelivery ? "delivery" : "pickup",
          deliveryDetails: shopUsesDelivery ? normalizedDeliveryDetails : null,
          pickupDetails: shopUsesDelivery ? null : pickupDetails,
          paymentPreference: {
            method: paymentDetails.method,
            momoProvider: paymentDetails.method === "momo" ? paymentDetails.momoProvider : "",
          },
          source: "checkout",
        };

        const orderRes = await fetch("/.netlify/functions/createOrder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });
        const orderData = await readApiPayload(orderRes);
        if (!orderRes.ok) {
          throw new Error(orderData?.error || "Failed to create shop order.");
        }
        createdShopOrderRef = orderData.orderNumber || orderData.orderId;
        createdRefs.push(`Order ${createdShopOrderRef}`);
      }

      if (cartGroups.rentals.length > 0) {
        setPaymentStatus({ state: "saving", message: "Creating rental booking..." });
        const bookingDetails =
          selectedFulfillment === "delivery" ? normalizedDeliveryDetails : pickupDetails;
        const { startTime, endTime } = parseWindowRange(bookingDetails.window);
        const bookingPayload = {
          customerId: customer.id,
          eventDate: bookingDetails.date,
          startTime,
          endTime,
          venueAddress:
            selectedFulfillment === "delivery"
              ? normalizedDeliveryDetails.address.trim()
              : normalizedDeliveryDetails.address.trim() || PICKUP_VENUE_FALLBACK,
          items: createCheckoutItems(cartGroups.rentals),
          status: "pending",
          paymentPreference: {
            method: paymentDetails.method,
            momoProvider: paymentDetails.method === "momo" ? paymentDetails.momoProvider : "",
          },
          source: "checkout",
        };

        const bookingRes = await fetch("/.netlify/functions/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingPayload),
        });
        const bookingData = await readApiPayload(bookingRes);
        if (!bookingRes.ok) {
          if (createdShopOrderRef) {
            throw new Error(
              `${bookingData?.error || "Failed to create rental booking."} Shop order ${createdShopOrderRef} was already created. Do not resubmit; contact us to finish the booking.`
            );
          }
          throw new Error(bookingData?.error || "Failed to create rental booking.");
        }
        createdRefs.push(`Booking ${bookingData.id}`);
      }

      setPaymentStatus({
        state: "success",
        message:
          cartGroups.rentals.length > 0 && cartGroups.shop.length > 0
            ? `Booking and order created. ${paymentConfirmationMessage}`
            : cartGroups.rentals.length > 0
              ? `Booking created. ${paymentConfirmationMessage}`
              : `Order created. ${paymentConfirmationMessage}`,
      });
      setConfirmedAmount(formattedSubtotal);
      setOrderSuccess(`${createdRefs.join(" and ")} confirmed.`);
      clearCart();
      clearExpiringDraft(draftKey);
    } catch (err) {
      setPaymentStatus({ state: "error", message: err.message || "Payment failed." });
    }
  };

  return (
    <main className="checkout-shell page-shell" id="main">
      <section className="checkout-hero page-hero" aria-labelledby="checkout-heading">
        <div className="checkout-hero-copy page-hero-copy">
          <p className="checkout-kicker">Checkout</p>
          <h1 id="checkout-heading" className="page-hero-title">Finalize your bag</h1>
          <p className="checkout-sub">{fulfillmentCopy.checkoutSub}</p>
          <div className="checkout-highlights" aria-label="Order highlights">
            <span className="pill pill-accent">Subtotal {formattedSubtotal}</span>
            {rentalCount > 0 ? <span className="pill">Rentals {rentalCount}</span> : null}
            {shopCount > 0 ? <span className="pill">Shop {shopCount}</span> : null}
            <span className="pill pill-ghost">
              {fulfillmentBadgeLabel}
            </span>
          </div>
        </div>
        <div className="checkout-hero-panel">
          <p className="kicker">Before you confirm</p>
          <h2 className="checkout-hero-panel-title">
            Every order is reviewed manually before payment is collected.
          </h2>
          <p className="checkout-hero-panel-note">
            {isMixedCart && selectedFulfillment === "delivery"
              ? shopItemsRideWithRentalDelivery
                ? "Your rental timing, delivery window, and any shop add-ons riding with it are confirmed together after review."
                : "Rental delivery timing and shop pickup details are confirmed separately with you after review."
              : selectedFulfillment === "delivery"
                ? "Delivery timing, venue access, and the final payment link are confirmed with you after review."
                : "Pickup timing and your payment instructions are shared with you after review."}
          </p>
          <div className="checkout-hero-panel-points" aria-label="Checkout safeguards">
            <span><AppIcon icon={faShieldHeart} /> No card data stored</span>
            <span><AppIcon icon={faTruckFast} /> Fulfillment confirmed with you</span>
            <span><AppIcon icon={faReceipt} /> Invoice sent after review</span>
          </div>
        </div>
      </section>

      {orderSuccess && (
        <div className="checkout-success" role="status" aria-live="polite">
          {orderSuccess}
        </div>
      )}
      {cart.length === 0 ? (
        <section className="checkout-empty-card" aria-live="polite">
          <div className="checkout-empty-illus" aria-hidden="true">⋆</div>
          <h2>Your bag is empty</h2>
          <p>Add rentals or supplies to move to checkout.</p>
          <div className="checkout-empty-actions">
            <Link className="hero-btn hero-btn-primary" to="/Shop">Browse shop</Link>
            <Link className="hero-btn hero-btn-ghost" to="/Rentals">View rentals</Link>
          </div>
        </section>
      ) : (
        <section className="checkout-grid">
          <div className="checkout-card checkout-details">
            <div className="checkout-panel checkout-panel--steps">
              <div className="checkout-section">
                <p className="kicker">Next steps</p>
                <h2>{fulfillmentCopy.confirmTitle}</h2>
                <p className="checkout-hint">{fulfillmentCopy.confirmHint}</p>
              </div>
              <div className="checkout-steps">
                <div className="checkout-step">
                  <span className="checkout-step-icon">
                    <AppIcon icon={faBagShopping} />
                  </span>
                  <div>
                    <h3>Review your cart</h3>
                    <p>Double-check quantities and item choices before confirming.</p>
                  </div>
                </div>
                <div className="checkout-step">
                  <span className="checkout-step-icon">
                    <AppIcon icon={faTruckFast} />
                  </span>
                  <div>
                    <h3>{fulfillmentCopy.stepTwoTitle}</h3>
                    <p>{fulfillmentCopy.stepTwoText}</p>
                  </div>
                </div>
                <div className="checkout-step">
                  <span className="checkout-step-icon">
                    <AppIcon icon={faReceipt} />
                  </span>
                  <div>
                    <h3>Receive your invoice</h3>
                    <p>We will send the final invoice and payment instructions.</p>
                  </div>
                </div>
                <div className="checkout-step">
                  <span className="checkout-step-icon">
                    <AppIcon icon={faShieldHeart} />
                  </span>
                  <div>
                    <h3>{fulfillmentCopy.stepFourTitle}</h3>
                    <p>{fulfillmentCopy.stepFourText}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="checkout-panel checkout-panel--fulfillment">
              <div className="checkout-section">
                <p className="kicker">Fulfillment</p>
                <h2>{fulfillmentCopy.fulfillmentTitle}</h2>
                <p className="checkout-hint">{fulfillmentCopy.fulfillmentHint}</p>
              </div>
              {hasRentalItems ? (
                <div className="checkout-option-card" role="group" aria-label="Rental fulfillment method">
                  <label className={`checkout-option ${selectedFulfillment === "delivery" ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="delivery"
                      checked={selectedFulfillment === "delivery"}
                      onChange={() => setFulfillment("delivery")}
                    />
                    <span>
                      <strong>Delivery</strong>
                      <small>Share your address and preferred time window.</small>
                    </span>
                  </label>
                  <label className={`checkout-option ${selectedFulfillment === "pickup" ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="pickup"
                      checked={selectedFulfillment === "pickup"}
                      onChange={() => setFulfillment("pickup")}
                    />
                    <span>
                      <strong>Pickup</strong>
                      <small>Select a pickup window at our studio.</small>
                    </span>
                  </label>
                </div>
              ) : null}
              {shouldAskShopDeliveryPreference ? (
                <>
                  <div className="checkout-section">
                    <h2>Shop item fulfillment</h2>
                    <p className="checkout-hint">
                      Would you like the shop items in this cart delivered with your rentals?
                    </p>
                  </div>
                  <div className="checkout-option-card" role="group" aria-label="Shop item fulfillment with rentals">
                    <label
                      className={`checkout-option ${shopItemsRideWithRentalDelivery ? "is-active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="shop-delivery-with-rentals"
                        value="yes"
                        checked={shopItemsRideWithRentalDelivery}
                        onChange={() => setDeliverShopWithRentals(true)}
                      />
                      <span>
                        <strong>Yes, deliver together</strong>
                        <small>We will use the rental delivery address and time window for the shop items too.</small>
                      </span>
                    </label>
                    <label
                      className={`checkout-option ${!shopItemsRideWithRentalDelivery ? "is-active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="shop-delivery-with-rentals"
                        value="no"
                        checked={!shopItemsRideWithRentalDelivery}
                        onChange={() => setDeliverShopWithRentals(false)}
                      />
                      <span>
                        <strong>No, keep shop pickup</strong>
                        <small>We will ask for a separate pickup window for the shop items.</small>
                      </span>
                    </label>
                  </div>
                </>
              ) : null}
              {needsDeliveryDetails ? (
                <>
                  <div className="checkout-section">
                    <h2>{deliveryFormHeading}</h2>
                    <p className="checkout-hint">{deliveryFormHint}</p>
                  </div>
                <div className="checkout-form" aria-label="Delivery details">
                  <div className="checkout-field">
                    <label htmlFor="delivery-address">Delivery address</label>
                    <input
                      id="delivery-address"
                      type="text"
                      name="deliveryAddress"
                      value={deliveryDetails.address}
                      onChange={updateDelivery("address")}
                      placeholder="Street, neighborhood, landmark"
                    />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="delivery-contact">Contact number</label>
                    <div className="checkout-phone-row">
                      <select
                        id="delivery-contact-code"
                        className="checkout-phone-code"
                        value={deliveryDetails.contactCode}
                        onChange={updateDelivery("contactCode")}
                        aria-label="Delivery contact dialing code"
                      >
                        {PHONE_CODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        id="delivery-contact"
                        className="checkout-phone-local"
                        type="text"
                        name="deliveryContact"
                        inputMode="numeric"
                        value={deliveryDetails.contactNumber}
                        onChange={updatePhoneDigits(setDeliveryDetails, "contactNumber")}
                        placeholder="0241234567"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        aria-label="10-digit delivery contact number"
                      />
                    </div>
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="delivery-date">Preferred delivery date</label>
                    <input
                      id="delivery-date"
                      type="date"
                      name="deliveryDate"
                      min={today}
                      value={deliveryDetails.date}
                      onChange={updateDelivery("date")}
                    />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="delivery-window">Time window</label>
                    <select
                      id="delivery-window"
                      name="deliveryWindow"
                      value={deliveryDetails.window}
                      onChange={updateDelivery("window")}
                    >
                      <option value="" disabled>Select a window</option>
                      {TIME_WINDOW_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={isWindowDisabled(deliveryDetails.date, option)}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="checkout-field full-width">
                    <label htmlFor="delivery-notes">Delivery notes</label>
                    <textarea
                      id="delivery-notes"
                      name="deliveryNotes"
                      rows="3"
                      value={deliveryDetails.notes}
                      onChange={updateDelivery("notes")}
                      placeholder="Gate access, floor level, or anything we should know"
                    />
                  </div>
                </div>
                </>
              ) : null}
              {needsPickupDetails ? (
                <>
                  <div className="checkout-section">
                    <h2>{pickupFormHeading}</h2>
                    <p className="checkout-hint">{pickupFormHint}</p>
                  </div>
                <div className="checkout-form" aria-label="Pickup details">
                  <div className="checkout-field">
                    <label htmlFor="pickup-date">Pickup date</label>
                    <input
                      id="pickup-date"
                      type="date"
                      name="pickupDate"
                      min={today}
                      value={pickupDetails.date}
                      onChange={updatePickup("date")}
                    />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="pickup-window">Pickup window</label>
                    <select
                      id="pickup-window"
                      name="pickupWindow"
                      value={pickupDetails.window}
                      onChange={updatePickup("window")}
                    >
                      <option value="" disabled>Select a window</option>
                      {TIME_WINDOW_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={isWindowDisabled(pickupDetails.date, option)}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="checkout-field full-width">
                    <label htmlFor="pickup-notes">Pickup notes</label>
                    <textarea
                      id="pickup-notes"
                      name="pickupNotes"
                      rows="3"
                      value={pickupDetails.notes}
                      onChange={updatePickup("notes")}
                      placeholder="Who is picking up, vehicle type, or anything we should know"
                    />
                  </div>
                </div>
                </>
              ) : null}
              <div className="checkout-actions">
                <button
                  className="hero-btn hero-btn-primary"
                  type="button"
                  onClick={() => {
                    resetPaymentStatus();
                    setPaymentOpen(true);
                  }}
                >
                  Confirm order
                </button>
                <Link className="hero-btn hero-btn-ghost" to="/Cart">
                  Back to cart
                </Link>
              </div>
            </div>
          </div>

          <aside className="checkout-card checkout-summary" aria-label="Order summary">
            <div className="summary-head">
              <p className="kicker">Summary</p>
              <h3>Your order</h3>
              <p className="muted">
                {shopItemsRideWithRentalDelivery
                  ? "Your rentals and shop items are moving together on one delivery plan."
                  : "Rentals and shop items stay separated so fulfillment stays clear."}
              </p>
            </div>
            <div className="checkout-summary-overview" aria-label="Order snapshot">
              <div className="checkout-summary-stat">
                <span>Items</span>
                <strong>{itemCount}</strong>
              </div>
              {rentalCount > 0 ? (
                <div className="checkout-summary-stat">
                  <span>Rentals</span>
                  <strong>{rentalCount}</strong>
                </div>
              ) : null}
              {shopCount > 0 ? (
                <div className="checkout-summary-stat">
                  <span>Shop items</span>
                  <strong>{shopCount}</strong>
                </div>
              ) : null}
            </div>
            <div className="checkout-summary-groups">
              {checkoutSections.map((section) => {
                const sectionConfig = CHECKOUT_SECTION_CONFIG[section.key];
                const sectionCount = section.items.reduce(
                  (acc, item) => acc + getCartItemBillingQuantity(item),
                  0
                );
                const sectionSubtotal = section.items.reduce((acc, item) => acc + getCartItemLineTotal(item), 0);

                return (
                  <section
                    key={section.key}
                    className={`checkout-summary-group checkout-summary-group--${section.key}`}
                    aria-labelledby={`checkout-summary-group-${section.key}`}
                  >
                    <div className="checkout-summary-group-head">
                      <h4 id={`checkout-summary-group-${section.key}`}>{sectionConfig.title}</h4>
                      <div className="checkout-summary-group-meta">
                        <strong>{formatCurrency(convertPrice(sectionSubtotal))}</strong>
                        <span>{sectionCount} {sectionCount === 1 ? "item" : "items"}</span>
                      </div>
                    </div>
                    <div className="checkout-items checkout-summary-group-list">
                      {section.items.map((item) => (
                        (() => {
                          const itemDisplayName = getCatalogItemDisplayName(item, "Item");
                          const itemRateLabel = getCartItemRateLabel(item);
                          return (
                            <div className="checkout-item" key={`${section.key}-${item.id}`}>
                              <div
                                className="checkout-item-media category-image-bg"
                                style={getCatalogItemBackgroundStyle(item)}
                              >
                                <img src={getCatalogItemImage(item)} alt={itemDisplayName} loading="lazy" />
                              </div>
                              <div>
                                <p className="checkout-item-name">{itemDisplayName}</p>
                                <p className="checkout-item-meta">
                                  {getCartItemBillingQuantity(item)} x {formatCurrency(convertPrice(getCartItemPrice(item)))} {itemRateLabel}
                                </p>
                              </div>
                              <div className="checkout-item-total">
                                {formatCurrency(convertPrice(getCartItemLineTotal(item)))}
                              </div>
                            </div>
                          );
                        })()
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="checkout-total-rows">
              <div className="checkout-total-row">
                <span>Subtotal</span>
                <strong>{formattedSubtotal}</strong>
              </div>
              <div className="checkout-total-row">
                <span>Fulfillment</span>
                <strong>
                  {isMixedCart
                    ? selectedFulfillment === "delivery"
                      ? shopItemsRideWithRentalDelivery
                        ? "Rentals + Shop: Delivery"
                        : "Rentals: Delivery · Shop: Pickup"
                      : "Pickup"
                    : selectedFulfillment === "delivery"
                      ? "Delivery"
                      : "Pickup"}
                </strong>
              </div>
              <div className="checkout-total-row">
                <span>Currency</span>
                <strong>{currency}</strong>
              </div>
              <div className="checkout-total-row">
                <span>Total items</span>
                <strong>{itemCount} {itemLabel}</strong>
              </div>
            </div>
            <p className="checkout-note">{fulfillmentCopy.summaryNote}</p>
          </aside>
        </section>
      )}
      {paymentOpen && (
        <div
          className="checkout-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-payment-title"
          onClick={() => setPaymentOpen(false)}
        >
          <div className="checkout-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="checkout-modal-layout">
              <aside className="checkout-modal-aside" aria-label="Order confirmation summary">
                <div className="checkout-modal-spotlight">
                  <p className="kicker">Checkout</p>
                  <strong className="checkout-modal-amount">{modalAmount}</strong>
                  <p className="checkout-modal-copy">
                    We review the order first, then send the secure payment route you choose.
                  </p>
                </div>
                <div className="checkout-modal-metrics" aria-label="Confirmation details">
                  <div className="checkout-modal-metric">
                    <span>Items</span>
                    <strong>{itemCount}</strong>
                  </div>
                  <div className="checkout-modal-metric">
                    <span>Fulfillment</span>
                    <strong>{modalFulfillmentLabel}</strong>
                  </div>
                  <div className="checkout-modal-metric">
                    <span>Currency</span>
                    <strong>{currency}</strong>
                  </div>
                </div>
                <div className="checkout-modal-safeguards" aria-label="Payment safeguards">
                  <span><AppIcon icon={faShieldHeart} /> No card or payment credentials stored</span>
                  <span><AppIcon icon={faReceipt} /> Final invoice shared after review</span>
                  <span><AppIcon icon={faTruckFast} /> Fulfillment timing confirmed with you</span>
                </div>
              </aside>

              <div className="checkout-modal-main">
                <div className="checkout-modal-head">
                  <div>
                    <p className="kicker">Payment</p>
                    <h2 id="checkout-payment-title">Confirm your order</h2>
                    <p className="muted">
                      Choose your preferred payment route. We do not collect or store card numbers,
                      CVCs, bank credentials, or mobile money PINs here.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="checkout-modal-close"
                    onClick={() => setPaymentOpen(false)}
                    aria-label="Close payment form"
                  >
                    ×
                  </button>
                </div>
                <form className="checkout-modal-form" onSubmit={submitPayment}>
                  <div className="checkout-field">
                    <label htmlFor="payer-name">Full name</label>
                    <input
                      id="payer-name"
                      type="text"
                      value={paymentDetails.name}
                      onChange={updatePayment("name")}
                      placeholder="Jane Doe"
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="payer-email">Email address</label>
                    <input
                      id="payer-email"
                      type="email"
                      value={paymentDetails.email}
                      onChange={updatePayment("email")}
                      placeholder="you@example.com"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="payer-phone">Phone</label>
                    <div className="checkout-phone-row">
                      <select
                        id="payer-phone-code"
                        className="checkout-phone-code"
                        value={paymentDetails.phoneCode}
                        onChange={updatePayment("phoneCode")}
                        aria-label="Phone dialing code"
                      >
                        {PHONE_CODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        id="payer-phone"
                        className="checkout-phone-local"
                        type="text"
                        inputMode="numeric"
                        value={paymentDetails.phoneLocal}
                        onChange={updatePhoneDigits(setPaymentDetails, "phoneLocal")}
                        placeholder="0241234567"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        required
                        aria-label="10-digit phone number"
                      />
                    </div>
                  </div>
                  <div className="checkout-field full-width">
                    <span className="checkout-modal-field-label">Preferred payment route</span>
                    <div className="checkout-payment-methods" role="radiogroup" aria-label="Preferred payment route">
                      {PAYMENT_OPTION_CARDS.map((option) => (
                        <label
                          key={option.value}
                          className={`checkout-payment-choice ${paymentDetails.method === option.value ? "is-active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="payment-method"
                            value={option.value}
                            checked={paymentDetails.method === option.value}
                            onChange={updatePayment("method")}
                          />
                          <span>
                            <strong>{option.title}</strong>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {paymentDetails.method === "momo" && (
                    <div className="checkout-field">
                      <label htmlFor="momo-provider">Mobile money type</label>
                      <select
                        id="momo-provider"
                        value={paymentDetails.momoProvider}
                        onChange={updatePayment("momoProvider")}
                      >
                        <option value="">Select wallet</option>
                        {MOMO_PROVIDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="checkout-field full-width">
                    <div
                      className={`checkout-payment-panel checkout-payment-panel--${paymentDetails.method}`}
                      role="note"
                    >
                      <h3>{paymentMethodPanel.title}</h3>
                      <p>{paymentMethodPanel.body}</p>
                    </div>
                  </div>

                  <div className="checkout-modal-footer full-width">
                    <div className="checkout-modal-summary">
                      <span>Order total</span>
                      <strong>{modalAmount}</strong>
                    </div>

                    {paymentStatus.message && (
                      <div className={`checkout-modal-status ${paymentStatus.state}`}>
                        {paymentStatus.message}
                      </div>
                    )}

                    <div className="checkout-modal-actions">
                      <button
                        className="hero-btn hero-btn-primary"
                        type="submit"
                        disabled={paymentStatus.state === "saving" || paymentStatus.state === "success"}
                      >
                        {paymentStatus.state === "saving" ? "Confirming..." : "Confirm order"}
                      </button>
                      <button
                        className="hero-btn hero-btn-ghost"
                        type="button"
                        onClick={() => setPaymentOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Checkout;
