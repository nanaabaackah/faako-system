import { useCallback, useEffect, useMemo, useState } from "react";
import { buildQueueSummary } from "../status/queueSummary.js";
import { createIndexedDbQueueStorage } from "../storage/queueStorage.js";

export const useSyncQueueSummary = ({
  storage,
  sourceApp = "",
  organizationId = "",
  actorId = "",
  enabled = true,
  pollIntervalMs = 8000,
  requireScope = true,
} = {}) => {
  const queueStorage = useMemo(() => storage || createIndexedDbQueueStorage(), [storage]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError("");
      return [];
    }

    setLoading(true);
    try {
      const nextItems = await queueStorage.list();
      setItems(Array.isArray(nextItems) ? nextItems : []);
      setError("");
      return Array.isArray(nextItems) ? nextItems : [];
    } catch (nextError) {
      setError(nextError.message || "Unable to load local sync queue.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled, queueStorage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !pollIntervalMs || typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, pollIntervalMs, refresh]);

  const summary = useMemo(
    () =>
      buildQueueSummary(items, {
        sourceApp,
        organizationId,
        actorId,
        requireScope,
      }),
    [actorId, items, organizationId, requireScope, sourceApp]
  );

  return {
    ...summary,
    loading,
    error,
    refresh,
    storage: queueStorage,
  };
};
