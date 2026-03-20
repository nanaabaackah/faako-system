import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { patchOrganizationFetch } from "./utils/organization.js";
import { syncMobileBrowserChrome } from "../../../packages/utils/src/mobileBrowserChrome";

patchOrganizationFetch();
syncMobileBrowserChrome({ fallbackColor: "#ffffff" });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
