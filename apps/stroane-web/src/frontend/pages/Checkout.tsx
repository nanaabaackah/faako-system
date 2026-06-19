import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import useCatalogueData from "../../hooks/useCatalogueData";
import {
  orderApi,
  type CheckoutFulfillmentMethod,
  type CheckoutOrderResponse,
  type DeliveryLocation,
} from "../../api/orders";
import {
  getLineTotal,
  isCheckoutEligibleProduct,
  isPricedProduct,
  type Product,
} from "../../data/products";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import CheckoutConfirmation from "../components/checkout/CheckoutConfirmation";
import CheckoutDetailsForm from "../components/checkout/CheckoutDetailsForm";
import CheckoutOrderSummary from "../components/checkout/CheckoutOrderSummary";
import { isLikelyEmail, isLikelyPhone } from "../../utils/contactValidation";
import "../styles/Checkout.css";

const PICKUP_SPOTS = [
  {
    id: "accra-central",
    name: "Accra Central pickup",
    address: "Stroane Solutions, Accra Central",
    detail: "Best for central Accra and Osu routes",
  },
  {
    id: "east-legon",
    name: "East Legon pickup",
    address: "East Legon business district",
    detail: "Best for East Legon, Madina, and Adenta",
  },
  {
    id: "tema-community-1",
    name: "Tema Community 1 pickup",
    address: "Tema Community 1 collection point",
    detail: "Best for Tema, Spintex, and Ashaiman",
  },
];

const PICKUP_WINDOWS = [
  {
    value: "10:00",
    label: "Morning, 10:00 AM - 12:00 PM",
  },
  {
    value: "13:00",
    label: "Afternoon, 1:00 PM - 4:00 PM",
  },
  {
    value: "17:00",
    label: "Evening, 5:00 PM - 7:00 PM",
  },
];

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

const parseDateInput = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSundayPickupDate = (value: string) => parseDateInput(value)?.getDay() === 0;

const Checkout: React.FC = () => {
  const { products: catalogueProducts, loading, notice } = useCatalogueData();
  const { cart, updateQuantity, remove, clear } = useCart();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<
    "email" | "phone" | "whatsapp"
  >("email");
  const [businessName, setBusinessName] = useState("");
  const [fulfillmentMethod, setFulfillmentMethod] =
    useState<CheckoutFulfillmentMethod>("delivery");
  const [address, setAddress] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [deliveryLocationResults, setDeliveryLocationResults] = useState<DeliveryLocation[]>([]);
  const [deliveryLocationLoading, setDeliveryLocationLoading] = useState(false);
  const [deliveryLocationError, setDeliveryLocationError] = useState("");
  const [pickupSpotId, setPickupSpotId] = useState(PICKUP_SPOTS[0]?.id || "");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CheckoutOrderResponse | null>(null);
  const [paymentFallback, setPaymentFallback] = useState("");

  useSEOMeta({
    title: "Checkout | Stroane",
    description: "Review your Stroane order request.",
    canonical: "https://stroanesolutions.com/checkout",
    noIndex: true,
  });

  const pricedProducts = useMemo(
    () => catalogueProducts.filter(isPricedProduct),
    [catalogueProducts]
  );

  useEffect(() => {
    if (loading) return;

    const pricedProductIds = new Set(pricedProducts.map((product) => product.id));
    Object.keys(cart).forEach((productId) => {
      if (!pricedProductIds.has(productId)) remove(productId);
    });
  }, [cart, loading, pricedProducts, remove]);

  const lines = useMemo(
    () =>
      pricedProducts
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({ product, qty: cart[product.id] })),
    [cart, pricedProducts]
  );

  const unavailableLines = lines.filter(
    ({ product, qty }) => !isCheckoutEligibleProduct(product, qty)
  );
  const purchasableLines = lines.filter(
    (line): line is { product: Product & { price: number }; qty: number } =>
      isCheckoutEligibleProduct(line.product, line.qty)
  );

  const total = purchasableLines.reduce(
    (sum, line) => sum + getLineTotal(line.product, line.qty),
    0
  );

  const selectedPickupSpot = useMemo(
    () => PICKUP_SPOTS.find((spot) => spot.id === pickupSpotId) || PICKUP_SPOTS[0],
    [pickupSpotId]
  );
  const fulfillmentAddress =
    fulfillmentMethod === "pickup"
      ? [selectedPickupSpot?.name, selectedPickupSpot?.address].filter(Boolean).join(" - ")
      : address.trim();
  const expectedDeliveryDate =
    fulfillmentMethod === "pickup" && pickupDate && pickupTime
      ? `${pickupDate}T${pickupTime}:00`
      : undefined;
  const minimumPickupDate = useMemo(getTodayInputValue, []);
  const pickupWindowValues = useMemo(
    () => new Set(PICKUP_WINDOWS.map((window) => window.value)),
    []
  );

  useEffect(() => {
    if (fulfillmentMethod !== "delivery") {
      setDeliveryLocationResults([]);
      setDeliveryLocationLoading(false);
      setDeliveryLocationError("");
      return undefined;
    }

    const query = address.trim();
    if (query.length < 3 || deliveryLocation?.address === query || deliveryLocation?.label === query) {
      setDeliveryLocationResults([]);
      setDeliveryLocationLoading(false);
      setDeliveryLocationError("");
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDeliveryLocationLoading(true);
      setDeliveryLocationError("");
      orderApi
        .searchDeliveryLocations(query, { signal: controller.signal, limit: 6 })
        .then((locations) => {
          setDeliveryLocationResults(locations);
        })
        .catch((searchError) => {
          if (controller.signal.aborted) return;
          setDeliveryLocationResults([]);
          setDeliveryLocationError(
            searchError instanceof Error
              ? searchError.message
              : "Unable to search delivery locations."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setDeliveryLocationLoading(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [address, deliveryLocation, fulfillmentMethod]);

  const validateDetails = () => {
    if (!lines.length) return "Your basket is empty.";
    if (unavailableLines.length) {
      return "Remove unavailable or unpriced items before checkout.";
    }
    if (!name.trim()) return "Add your full name.";
    if (!isLikelyEmail(email)) return "Add a valid email address.";
    if (!isLikelyPhone(phone)) return "Add a valid phone number.";
    if (fulfillmentMethod === "delivery" && !address.trim()) return "Add a delivery address.";
    if (fulfillmentMethod === "delivery" && !deliveryLocation) {
      return "Select a delivery address from the GPS results.";
    }
    if (fulfillmentMethod === "pickup" && !pickupSpotId) return "Choose a pickup spot.";
    if (fulfillmentMethod === "pickup" && !pickupDate) return "Choose a pickup date.";
    if (fulfillmentMethod === "pickup" && isSundayPickupDate(pickupDate)) {
      return "Sunday pickups are not available. Choose Monday to Saturday.";
    }
    if (fulfillmentMethod === "pickup" && !pickupTime) return "Choose a pickup window.";
    if (fulfillmentMethod === "pickup" && !pickupWindowValues.has(pickupTime)) {
      return "Choose a pickup window between 10:00 AM and 7:00 PM.";
    }
    if (website.trim()) return "The checkout request could not be submitted.";
    return "";
  };

  const markDetailsChanged = () => setReviewing(false);

  const updateFulfillmentMethod = (method: CheckoutFulfillmentMethod) => {
    setFulfillmentMethod(method);
    markDetailsChanged();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const validationMessage = validateDetails();
    if (validationMessage) {
      setError(validationMessage);
      setReviewing(false);
      return;
    }

    if (!reviewing) {
      setReviewing(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await orderApi.createOrder({
        customer: {
          name,
          email,
          phone,
          preferredContactMethod,
          businessName,
          deliveryAddress: fulfillmentAddress,
          deliveryNotes,
        },
        items: purchasableLines.map(({ product, qty }) => ({
          productSlug: product.id,
          quantity: qty,
        })),
        source: "checkout",
        fulfillmentMethod,
        deliveryMethod: fulfillmentMethod,
        deliveryLocation: fulfillmentMethod === "delivery" ? deliveryLocation : null,
        pickupLocationId: fulfillmentMethod === "pickup" ? pickupSpotId : undefined,
        pickupLocationName: fulfillmentMethod === "pickup" ? selectedPickupSpot?.name : undefined,
        pickupDate: fulfillmentMethod === "pickup" ? pickupDate : undefined,
        pickupTime: fulfillmentMethod === "pickup" ? pickupTime : undefined,
        expectedDeliveryDate,
        website,
      });
      clear();
      try {
        const paymentResponse = await orderApi.initializePaystackPayment(response.order.id);
        window.location.assign(paymentResponse.payment.authorizationUrl);
      } catch (paymentError) {
        setPaymentFallback(
          paymentError instanceof Error
            ? paymentError.message
            : "Payment could not be started. Stroane will follow up with payment instructions."
        );
        setCreatedOrder(response);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not prepare your order. Please contact Stroane directly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdOrder) {
    return (
      <Layout>
        <CheckoutConfirmation
          createdOrder={createdOrder}
          name={name}
          paymentFallback={paymentFallback}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="checkout-page">
        <div className="checkout-page__inner">
          <header className="checkout-head">
            <span className="checkout-kicker">Checkout</span>
            <h1>Review your order here</h1>
            <p>
              Submit your details, review the order, then continue to payment.
            </p>
          </header>

          {lines.length === 0 ? (
            <div className="checkout-empty">
              <p>Your basket is empty.</p>
              <Link to="/shop" className="checkout-empty__cta">
                Browse the store
                <HiArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="checkout-grid">
              <CheckoutDetailsForm
                name={name}
                email={email}
                phone={phone}
                businessName={businessName}
                address={address}
                deliveryLocation={deliveryLocation}
                deliveryLocationResults={deliveryLocationResults}
                deliveryLocationLoading={deliveryLocationLoading}
                deliveryLocationError={deliveryLocationError}
                deliveryNotes={deliveryNotes}
                fulfillmentMethod={fulfillmentMethod}
                pickupSpots={PICKUP_SPOTS}
                pickupSpotId={pickupSpotId}
                pickupWindows={PICKUP_WINDOWS}
                pickupDate={pickupDate}
                pickupTime={pickupTime}
                minimumPickupDate={minimumPickupDate}
                website={website}
                preferredContactMethod={preferredContactMethod}
                notice={notice}
                error={error}
                reviewing={reviewing}
                submitting={submitting}
                hasLines={Boolean(lines.length)}
                onSubmit={handleSubmit}
                onEdit={() => setReviewing(false)}
                onNameChange={(value) => {
                  setName(value);
                  markDetailsChanged();
                }}
                onEmailChange={(value) => {
                  setEmail(value);
                  markDetailsChanged();
                }}
                onPhoneChange={(value) => {
                  setPhone(value);
                  markDetailsChanged();
                }}
                onBusinessNameChange={(value) => {
                  setBusinessName(value);
                  markDetailsChanged();
                }}
                onFulfillmentMethodChange={updateFulfillmentMethod}
                onAddressChange={(value) => {
                  setAddress(value);
                  setDeliveryLocation(null);
                  markDetailsChanged();
                }}
                onDeliveryLocationSelect={(location) => {
                  setDeliveryLocation(location);
                  setAddress(location.address || location.label);
                  setDeliveryLocationResults([]);
                  markDetailsChanged();
                }}
                onPickupSpotChange={(value) => {
                  setPickupSpotId(value);
                  markDetailsChanged();
                }}
                onPickupDateChange={(value) => {
                  setPickupDate(value);
                  markDetailsChanged();
                }}
                onPickupTimeChange={(value) => {
                  setPickupTime(value);
                  markDetailsChanged();
                }}
                onDeliveryNotesChange={(value) => {
                  setDeliveryNotes(value);
                  markDetailsChanged();
                }}
                onWebsiteChange={setWebsite}
                onPreferredContactMethodChange={(value) => {
                  setPreferredContactMethod(value);
                  markDetailsChanged();
                }}
              />

              <CheckoutOrderSummary
                lines={lines}
                unavailableLinesCount={unavailableLines.length}
                total={total}
                onUpdateQuantity={updateQuantity}
                onRemove={remove}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
