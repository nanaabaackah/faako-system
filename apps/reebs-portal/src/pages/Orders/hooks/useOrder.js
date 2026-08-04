import { useCallback, useEffect, useState } from "react";
import { reebsApiResponse } from "../../../api/client.js";

export default function useOrder(orderId) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState("");

  const refetch = useCallback((signal) => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      setError("");
      return Promise.resolve(null);
    }

    const fallbackController = signal ? null : new AbortController();
    const fetchSignal = signal || fallbackController.signal;
    setLoading(true);
    setError("");
    return reebsApiResponse(`/api/orders?id=${encodeURIComponent(orderId)}`, { signal: fetchSignal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load order.");
        }
        setOrder(payload);
        return payload;
      })
      .catch((err) => {
        if (err.name === "AbortError") return null;
        setError(err.message || "Failed to load order.");
        setOrder(null);
        return null;
      })
      .finally(() => {
        if (!fetchSignal?.aborted) setLoading(false);
      });
  }, [orderId]);

  useEffect(() => {
    const controller = new AbortController();
    refetch(controller.signal);
    return () => controller.abort();
  }, [refetch]);

  return { order, setOrder, loading, error, refetch };
}
