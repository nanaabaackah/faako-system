import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { buildUserScopedCacheKey, readOfflineCache, writeOfflineCache } from "../utils/offlineCache";

const useDashboardData = ({ range = "7d" } = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const normalizedRange = ["24h", "7d", "30d"].includes(range) ? range : "7d";

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const query = new URLSearchParams({ range: normalizedRange });
        const payload = await apiGet(`/api/dashboard?${query.toString()}`, {
          fallbackMessage: "Unable to load dashboard",
        });
        setData(payload);
        const cacheKey = buildUserScopedCacheKey(`dashboard:${normalizedRange}`);
        writeOfflineCache(cacheKey, payload);
      } catch (err) {
        if (err.name !== "AbortError") {
          const cacheKey = buildUserScopedCacheKey(`dashboard:${normalizedRange}`);
          const cached = readOfflineCache(cacheKey);
          if (cached?.payload) {
            setData(cached.payload);
            setError("Offline mode: showing your most recent dashboard snapshot.");
          } else {
            setError(err.message);
          }
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [normalizedRange]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    data,
    loading,
    isRefreshing,
    error,
    reload: loadDashboard,
  };
};

export default useDashboardData;
