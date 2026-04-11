import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@faako/ui/compat.css";
import appSystem from "../appSystem.js";
import { syncMobileBrowserChrome } from "../../../packages/utils/src/mobileBrowserChrome";
import App from "./App.jsx";

syncMobileBrowserChrome({ fallbackColor: appSystem.brand.browserChromeColor || "#f8fafc" });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
