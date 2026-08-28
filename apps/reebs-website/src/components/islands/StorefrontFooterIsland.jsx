import { MemoryRouter } from "react-router-dom";
import { TemplateConfigProvider } from "@faako/core";
import { CartProvider } from "../CartContext/CartContext.jsx";
import Footer from "../Footer/Footer.jsx";

function StorefrontFooterIsland({ path = "/" }) {
  return (
    <MemoryRouter initialEntries={[String(path || "/")]}>
      <CartProvider>
        <TemplateConfigProvider>
          <Footer />
        </TemplateConfigProvider>
      </CartProvider>
    </MemoryRouter>
  );
}

export default StorefrontFooterIsland;
