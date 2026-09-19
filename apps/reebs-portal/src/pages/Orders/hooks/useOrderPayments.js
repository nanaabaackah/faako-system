import { useCallback, useState } from "react";

export default function useOrderPayments(orderId) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refetch = useCallback((signal) => {
    if (!orderId) {
      setPayments([]);
      setLoading(false);
      setError("");
      return Promise.resolve([]);
    }

    const fallbackController = signal ? null : new AbortController();
    const fetchSignal = signal || fallbackController.signal;
    setLoading(true);
    setError("");
    return fetch(`/api/orderPayments?orderId=${encodeURIComponent(orderId)}`, { signal: fetchSignal })
      .then(async (response) => {
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load payments.");
        }
        const nextPayments = Array.isArray(payload) ? payload : [];
        setPayments(nextPayments);
        return nextPayments;
      })
      .catch((err) => {
        if (err.name === "AbortError") return [];
        setError(err.message || "Failed to load payments.");
        setPayments([]);
        return [];
      })
      .finally(() => {
        if (!fetchSignal?.aborted) setLoading(false);
      });
  }, [orderId]);

  const recordPayment = useCallback(async (payload, { idempotencyKey } = {}) => {
    const controller = new AbortController();
    const requestKey = idempotencyKey
      || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `order-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const response = await fetch("/api/orderPayments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestKey,
      },
      body: JSON.stringify({ ...payload, orderId }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || "Failed to record payment.");
    }
    return result;
  }, [orderId]);

  return { payments, loading, error, refetch, recordPayment };
}
