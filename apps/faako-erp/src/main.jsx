import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { UiSystemProvider } from "@faako/ui";
import App from "./App.jsx";
import appSystem from "../appSystem.js";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { CurrencyProvider } from "./contexts/CurrencyContext.jsx";
import "./styles/global.css";
import { syncMobileBrowserChrome } from "../../../packages/utils/src/mobileBrowserChrome";

syncMobileBrowserChrome({ fallbackColor: "#f2f4f8" });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <AuthProvider>
        <CurrencyProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </CurrencyProvider>
      </AuthProvider>
    </UiSystemProvider>
  </React.StrictMode>
);
