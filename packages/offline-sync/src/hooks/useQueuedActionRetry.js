import { useCallback, useState } from "react";
import { SYNC_STATES } from "../constants/syncStates.js";
import { incrementRetryMetadata } from "../retry/retryMetadata.js";
import {
  markQueuedActionRetrying,
  retryQueuedAction,
} from "../storage/queueActions.js";

export const useQueuedActionRetry = ({ storage, onRetry, onAfterChange } = {}) => {
  const [retryingId, setRetryingId] = useState("");
  const [error, setError] = useState("");

  const retry = useCallback(async (itemOrId, options = {}) => {
    if (!storage) return undefined;
    const item = itemOrId && typeof itemOrId === "object" ? itemOrId : await storage.get(itemOrId);
    if (!item?.id) return undefined;

    setRetryingId(item.id);
    setError("");
    try {
      if (typeof onRetry === "function") {
        const retrying = await markQueuedActionRetrying(storage, item, options);
        const result = await onRetry(retrying || item, options);
        await onAfterChange?.(result);
        return result;
      }

      const updated = await retryQueuedAction(storage, item, {
        status: options.status || SYNC_STATES.PENDING,
        note:
          options.note ||
          "Retry requested. Existing app sync handlers will submit this action to the server.",
      });
      await onAfterChange?.(updated);
      return updated;
    } catch (nextError) {
      const message = nextError.message || "Unable to retry queued action.";
      const updated = await storage.updateStatus(item.id, SYNC_STATES.FAILED, {
        retry: incrementRetryMetadata(item.retry, {
          now: new Date(),
          lastError: message,
        }),
        review: {
          lastError: message,
        },
      });
      setError(message);
      await onAfterChange?.(updated);
      return updated;
    } finally {
      setRetryingId("");
    }
  }, [onAfterChange, onRetry, storage]);

  return {
    retry,
    retryingId,
    error,
  };
};
