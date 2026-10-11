const configuredWaterUrl = String(import.meta.env?.VITE_WATER_APP_URL || "").trim();
const isLocalPortal = typeof window !== "undefined"
  && ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const WATER_APP_URL = configuredWaterUrl
  || (isLocalPortal ? "http://localhost:5179" : "https://water.reebspartythemes.com");
