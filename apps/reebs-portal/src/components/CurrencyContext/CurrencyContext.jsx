import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const CurrencyContext = createContext();
export const SUPPORTED_CURRENCIES = ["GHS", "USD", "CAD", "GBP", "EUR", "NGN"];
export const FALLBACK_RATES = {
  GHS: 1,
  USD: 0.085,
  CAD: 0.115,
  GBP: 0.067,
  EUR: 0.079,
  NGN: 97,
};

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState("GHS");
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    const storedCurrency = localStorage.getItem("reebsCurrency");
    if (storedCurrency && SUPPORTED_CURRENCIES.includes(storedCurrency)) {
      setCurrency(storedCurrency);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("reebsCurrency", currency);
  }, [currency]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_EXCHANGE_API_KEY;
    if (!apiKey) return;

    const controller = new AbortController();
    setStatus("loading");

    fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/GHS`, {
      signal: controller.signal,
      cache: "force-cache",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.conversion_rates) {
          setRates((prev) => ({ ...prev, ...data.conversion_rates }));
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Error fetching exchange rates", err);
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, []);

  const value = useMemo(
    () => ({ currency, setCurrency, rates, status }),
    [currency, rates, status]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function usePrice(amount) {
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] ?? 1;

  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    return formatter.format(amount * rate);
  } catch {
    return `${(amount * rate).toFixed(2)} ${currency}`;
  }
}
