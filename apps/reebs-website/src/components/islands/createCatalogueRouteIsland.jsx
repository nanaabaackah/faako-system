import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import { TemplateConfigProvider } from "@faako/core";
import AuthProvider from "../AuthContext/AuthContext.jsx";
import { CartProvider } from "../CartContext/CartContext.jsx";
import CartOverlay from "../CartOverlay/CartOverlay.jsx";

export const createCatalogueRouteIsland = (PageComponent, routePattern) => {
  function CatalogueRouteIsland({ path = routePattern, ...pageProps }) {
    const routePath = String(path || routePattern);

    return (
      <MemoryRouter initialEntries={[routePath]}>
        <CartProvider>
          <TemplateConfigProvider>
            <AuthProvider>
              <div className="main astro-route-island">
                <Routes>
                  <Route
                    path={routePattern}
                    element={<PageComponent {...pageProps} />}
                  />
                </Routes>
                <CartOverlay />
              </div>
            </AuthProvider>
          </TemplateConfigProvider>
        </CartProvider>
      </MemoryRouter>
    );
  }

  CatalogueRouteIsland.displayName =
    `${PageComponent.displayName || PageComponent.name || "Catalogue"}Island`;
  return CatalogueRouteIsland;
};
