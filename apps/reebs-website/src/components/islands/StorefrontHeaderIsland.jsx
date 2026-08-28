import { MemoryRouter } from "react-router-dom";
import { TemplateConfigProvider } from "@faako/core";
import AuthProvider from "../AuthContext/AuthContext.jsx";
import { CartProvider } from "../CartContext/CartContext.jsx";
import CartOverlay from "../CartOverlay/CartOverlay.jsx";
import Navbar from "../Navbar/Navbar.jsx";

function StorefrontHeaderIsland({ path = "/" }) {
  return (
    <MemoryRouter initialEntries={[String(path || "/")]}>
      <CartProvider>
        <TemplateConfigProvider>
          <AuthProvider>
            <Navbar />
            <CartOverlay />
          </AuthProvider>
        </TemplateConfigProvider>
      </CartProvider>
    </MemoryRouter>
  );
}

export default StorefrontHeaderIsland;
