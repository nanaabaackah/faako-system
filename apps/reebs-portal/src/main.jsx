import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { UiSystemProvider } from "@faako/ui";
import "./index.css";
import "@faako/ui/compat.css";
import App from "./App.jsx";
import appSystem from "../appSystem.js";
import { patchOrganizationFetch } from "./utils/organization.js";
import { syncMobileBrowserChrome } from "../../../packages/utils/src/mobileBrowserChrome";

patchOrganizationFetch();
syncMobileBrowserChrome({ fallbackColor: "#f6f7f9" });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UiSystemProvider>
  </StrictMode>
);
