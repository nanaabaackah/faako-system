import React, { createContext, useContext, useState, useEffect } from "react";
import { FALLBACK_RATES } from "../CurrencyContext/CurrencyContext";
import {
  getCartItemKey,
  getCartItemMaxSelectableQuantity,
  getCartItemQuantity,
  isRentalCartItem,
  normalizeCartKey,
} from "/src/utils/cart";

const CartContext = createContext();
const readStoredJson = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};
const readStoredCart = () => {
  const stored = readStoredJson("cart", []);
  return Array.isArray(stored) ? stored : [];
};
const readStoredCurrency = () => {
  if (typeof window === "undefined") return "GHS";
  const stored = window.localStorage.getItem("currency");
  return typeof stored === "string" && stored.trim() ? stored : "GHS";
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(readStoredCart);
  const [cartOpen, setCartOpen] = useState(false);

  const [currency, setCurrency] = useState(readStoredCurrency);

  const [rates, setRates] = useState(FALLBACK_RATES);
  const apiKey = import.meta.env.VITE_CURRENCY_API_KEY;
  const RATES_CACHE_KEY = "reebs_rates_cache_v1";
  const RATES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart));
    } catch {
      // ignore storage write failures
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem("currency", currency);
    } catch {
      // ignore storage write failures
    }
  }, [currency]);

  // fetch exchange rates
  useEffect(() => {
    const cached = (() => {
      return readStoredJson(RATES_CACHE_KEY, null);
    })();

    if (cached?.rates) {
      setRates({ ...FALLBACK_RATES, ...cached.rates });
    }

    const cacheFresh =
      cached?.timestamp && Date.now() - Number(cached.timestamp) < RATES_CACHE_TTL_MS;

    if (!apiKey || cacheFresh) return;

    async function fetchRates() {
      try {
        const response = await fetch(
          `https://v6.exchangerate-api.com/v6/${apiKey}/latest/GHS`
        );
        const data = await response.json();
        if (data.result === "success") {
          const nextRates = { ...FALLBACK_RATES, ...data.conversion_rates };
          setRates(nextRates);
          try {
            localStorage.setItem(
              RATES_CACHE_KEY,
              JSON.stringify({ rates: nextRates, timestamp: Date.now() })
            );
          } catch {
            // ignore storage write failures
          }

          if (!localStorage.getItem("currency")) {
            const region = navigator.language.split("-")[1];
            let defaultCurrency = "GHS";
            if (region === "US") defaultCurrency = "USD";
            else if (region === "GB") defaultCurrency = "GBP";
            else if (region === "CA") defaultCurrency = "CAD";
            else if (
              ["DE", "FR", "ES", "IT", "NL", "BE", "PT", "FI", "IE"].includes(region)
            ) {
              defaultCurrency = "EUR";
            }
            setCurrency(defaultCurrency);
          }
        } else {
          setRates(FALLBACK_RATES);
        }
      } catch (error) {
        console.error("Error fetching rates:", error);
        setRates(FALLBACK_RATES);
      }
    }
    fetchRates();
  }, [apiKey]);

  // 🔹 Cart actions
  const addToCart = (item) => {
    const itemKey = getCartItemKey(item);
    if (!itemKey) return;
    const normalizedItem = {
      ...item,
      id: item.id ?? itemKey,
      cartKind: item.cartKind || (isRentalCartItem(item) ? "rental" : "shop"),
      price:
        item.price ??
        (typeof item.priceCents === "number" ? item.priceCents / 100 : 0),
      quantity: getCartItemQuantity(item),
    };

    setCart((prev) => {
      const exists = prev.find((p) => getCartItemKey(p) === itemKey);
      const stockLimit = getCartItemMaxSelectableQuantity({
        ...exists,
        ...normalizedItem,
      });
      if (exists) {
        if (stockLimit > 0 && exists.cartQuantity >= stockLimit) return prev;
        return prev.map((p) =>
          getCartItemKey(p) === itemKey
            ? {
                ...p,
                ...normalizedItem,
                id: normalizedItem.id ?? p.id ?? itemKey,
                cartQuantity:
                  stockLimit > 0
                    ? Math.min(p.cartQuantity + 1, stockLimit)
                    : p.cartQuantity + 1,
              }
            : p
        );
      }
      return [
        ...prev,
        {
          ...normalizedItem,
          id: normalizedItem.id ?? itemKey,
          cartQuantity: 1,
        },
      ];
    });
  };

  const removeFromCart = (itemOrKey) => {
    const targetKey =
      typeof itemOrKey === "object" ? getCartItemKey(itemOrKey) : normalizeCartKey(itemOrKey);
    setCart((prev) => prev.filter((p) => getCartItemKey(p) !== targetKey));
  };

  // now updateQuantity expects a delta (+1 / -1)
  const updateQuantity = (itemOrKey, change) => {
    if (Number.isNaN(change) || change === 0) return;
    const targetKey =
      typeof itemOrKey === "object" ? getCartItemKey(itemOrKey) : normalizeCartKey(itemOrKey);

    setCart((prev) =>
      prev.map((p) => {
        if (getCartItemKey(p) === targetKey) {
          let newQty = p.cartQuantity + change;
          const stockLimit = getCartItemMaxSelectableQuantity(p);

          if (newQty < 1) newQty = 1;
          if (stockLimit > 0 && newQty > stockLimit) newQty = stockLimit;

          return { ...p, cartQuantity: newQty };
        }
        return p;
      })
    );
  };

  const clearCart = () => setCart([]);
  const openCart = () => setCartOpen(true);
  const closeCart = () => setCartOpen(false);
  const toggleCart = () => setCartOpen((prev) => !prev);

  // Currency helpers
  const convertPrice = (priceInGHS) => {
    if (!rates || !rates[currency]) return priceInGHS;
    return Number((priceInGHS * rates[currency]).toFixed(2));
  };

  const formatCurrency = (value) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }).format(value);
    } catch {
      return value + " " + currency;
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartOpen,
        openCart,
        closeCart,
        toggleCart,
        currency,
        setCurrency,
        convertPrice,
        formatCurrency,
        rates,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
