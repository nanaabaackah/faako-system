import { useCallback, useEffect, useRef, useState } from "react";

const readJson = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  return response.json();
};

export default function useDashboardOverview(windowKey) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const query = new URLSearchParams({ scope: "core", window: windowKey });
      const response = await fetch(`/api/dashboardOverview?${query.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload?.error || "Dashboard data is temporarily unavailable.");
      if (controller.signal.aborted) return;
      setData(payload);
      setError("");
    } catch (requestError) {
      if (requestError?.name === "AbortError") return;
      setError(requestError?.message || "Dashboard data is temporarily unavailable.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [windowKey]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  return { data, loading, refreshing, error, reload: () => load({ silent: true }) };
}
