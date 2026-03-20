import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { patchOrganizationFetch } from "./utils/organization.js";
import { syncMobileBrowserChrome } from "../../../packages/utils/src/mobileBrowserChrome";

patchOrganizationFetch();
syncMobileBrowserChrome({ fallbackColor: "#ffffff" });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
