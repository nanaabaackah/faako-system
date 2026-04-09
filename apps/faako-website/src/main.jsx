import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { UiSystemProvider } from "@faako/ui";
import App from "./App.jsx";
import appSystem from "../appSystem.js";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { CartProvider } from "./contexts/CartContext.jsx";
import { CurrencyProvider } from "./contexts/CurrencyContext.jsx";
import "./styles/global.css";
import "./styles/header.css";
import "./styles/footer.css";
import "@faako/ui/compat.css";
import { syncMobileBrowserChrome } from "../../../packages/utils/src/mobileBrowserChrome";

syncMobileBrowserChrome({ fallbackColor: "#fbfbfb" });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <AuthProvider>
        <CurrencyProvider>
          <CartProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}
            >
              <App />
            </BrowserRouter>
          </CartProvider>
        </CurrencyProvider>
      </AuthProvider>
    </UiSystemProvider>
  </React.StrictMode>
);
