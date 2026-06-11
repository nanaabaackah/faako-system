import { useCallback, useEffect, useState } from "react";

export default function useOrderPayments(orderId) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(Boolean(orderId));
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

  const recordPayment = useCallback(async (payload) => {
    const controller = new AbortController();
    const response = await fetch("/api/orderPayments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, orderId }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || "Failed to record payment.");
    }
    const refreshController = new AbortController();
    await refetch(refreshController.signal);
    return result;
  }, [orderId, refetch]);

  useEffect(() => {
    const controller = new AbortController();
    refetch(controller.signal);
    return () => controller.abort();
  }, [refetch]);

  return { payments, loading, error, refetch, recordPayment };
}
