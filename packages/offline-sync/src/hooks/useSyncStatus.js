import { useMemo } from "react";
import { buildSyncStatusSummary } from "../status/syncStatus.js";
import { useOnlineStatus } from "./useOnlineStatus.js";

export const useSyncStatus = (options = {}) => {
  const online = useOnlineStatus(options.online);

  return useMemo(
    () =>
      buildSyncStatusSummary({
        ...options,
        online,
      }),
    [
      online,
      options.syncing,
      options.pendingCount,
      options.failedCount,
      options.conflictCount,
      options.lastSyncedAt,
    ]
  );
};
