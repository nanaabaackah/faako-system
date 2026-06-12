export const registerStroaneServiceWorker = () => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/stroane-portal-sw.js").catch(() => {
      // Offline support is progressive; the portal still works without SW support.
    });
  });
};
