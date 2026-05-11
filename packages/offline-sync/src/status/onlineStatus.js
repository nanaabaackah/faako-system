import { SYNC_STATES } from "../constants/syncStates.js";

export const getOnlineStatus = () => {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }
  return navigator.onLine;
};

export const getOnlineSyncState = () => (getOnlineStatus() ? SYNC_STATES.ONLINE : SYNC_STATES.OFFLINE);

export const subscribeOnlineStatus = (listener) => {
  if (typeof window === "undefined" || typeof listener !== "function") {
    return () => {};
  }

  const notify = () => listener(getOnlineStatus());
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);

  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
