import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { buildUserScopedCacheKey, readOfflineCache, writeOfflineCache } from "../utils/offlineCache";

const useDashboardData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const payload = await apiGet("/api/dashboard", {
          fallbackMessage: "Unable to load dashboard",
        });
        setData(payload);
        const cacheKey = buildUserScopedCacheKey("dashboard");
        writeOfflineCache(cacheKey, payload);
      } catch (err) {
        if (err.name !== "AbortError") {
          const cacheKey = buildUserScopedCacheKey("dashboard");
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
    []
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
