import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../api/client";
import { TIMELINE_RANGES } from "./monitoringConfig";

const POLLING_INTERVAL_MS = 30_000;

const getApiRange = (range) => TIMELINE_RANGES.find((item) => item.value === range)?.apiValue || "24h";

export const useMonitoringData = (range) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [partialErrors, setPartialErrors] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const requestVersionRef = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const payload = await apiGet(`/api/monitoring/summary?range=${getApiRange(range)}`, {
        cache: "no-store",
        signal: controller.signal,
        fallbackMessage: "Unable to load system monitoring data.",
      });
      if (requestVersion !== requestVersionRef.current) return null;
      setData(payload);
      setPartialErrors(Array.isArray(payload?.errors) ? payload.errors : []);
      setLastUpdatedAt(payload?.generatedAt || new Date().toISOString());
      setError("");
      return payload;
    } catch (requestError) {
      if (requestError?.name !== "AbortError" && requestVersion === requestVersionRef.current) {
        setError(requestError.message || "Unable to load system monitoring data.");
      }
      return null;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        inFlightRef.current = false;
      }
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range]);

  useEffect(() => {
    abortControllerRef.current?.abort();
    requestVersionRef.current += 1;
    inFlightRef.current = false;
    void load();
    return () => abortControllerRef.current?.abort();
  }, [load]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    const intervalId = window.setInterval(poll, POLLING_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [load]);

  const runManualCheck = useCallback(async (serviceId) => {
    const payload = await apiPost(
      `/api/monitoring/services/${serviceId}/run-check?range=${getApiRange(range)}`,
      {},
      { fallbackMessage: "Unable to run the manual health check." }
    );
    await load({ silent: true });
    return payload;
  }, [load, range]);

  return { data, loading, refreshing, error, partialErrors, lastUpdatedAt, reload: load, runManualCheck };
};

export { POLLING_INTERVAL_MS };
