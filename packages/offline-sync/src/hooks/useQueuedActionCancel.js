import { useCallback, useState } from "react";
import { cancelQueuedAction } from "../storage/queueActions.js";

export const useQueuedActionCancel = ({ storage, onAfterChange } = {}) => {
  const [cancellingId, setCancellingId] = useState("");
  const [error, setError] = useState("");

  const cancel = useCallback(async (itemOrId, options = {}) => {
    if (!storage) return undefined;
    const item = itemOrId && typeof itemOrId === "object" ? itemOrId : await storage.get(itemOrId);
    if (!item?.id) return undefined;

    setCancellingId(item.id);
    setError("");
    try {
      const updated = await cancelQueuedAction(storage, item, options);
      await onAfterChange?.(updated);
      return updated;
    } catch (nextError) {
      const message = nextError.message || "Unable to cancel queued action.";
      setError(message);
      throw nextError;
    } finally {
      setCancellingId("");
    }
  }, [onAfterChange, storage]);

  return {
    cancel,
    cancellingId,
    error,
  };
};
