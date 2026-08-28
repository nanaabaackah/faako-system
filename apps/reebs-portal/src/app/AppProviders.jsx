import { BrowserRouter } from "react-router-dom";
import { TemplateConfigProvider } from "@faako/core";
import { UiSystemProvider } from "@faako/ui";
import appSystem from "../../appSystem.js";
import AuthProvider from "../components/AuthContext/AuthContext";
import { CartProvider } from "../components/CartContext/CartContext";

export default function AppProviders({ children }) {
  return (
    <UiSystemProvider appSystem={appSystem}>
      <BrowserRouter>
        <CartProvider>
          <TemplateConfigProvider>
            <AuthProvider>{children}</AuthProvider>
          </TemplateConfigProvider>
        </CartProvider>
      </BrowserRouter>
    </UiSystemProvider>
  );
}
