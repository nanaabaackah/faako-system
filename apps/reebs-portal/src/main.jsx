import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@faako/ui/compat.css";
import App from "./App.jsx";
import { patchOrganizationFetch } from "@faako/core";
import { initializeReebsGoogleAnalytics } from "./utils/analytics.js";
import { syncMobileBrowserChrome } from "@faako/utils";

patchOrganizationFetch();
syncMobileBrowserChrome({ fallbackColor: "#f6f7f9" });
initializeReebsGoogleAnalytics();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
