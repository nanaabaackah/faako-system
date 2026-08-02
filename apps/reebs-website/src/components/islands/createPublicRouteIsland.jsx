import { useRef } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import { TemplateConfigProvider } from "@faako/core";
import AuthProvider from "../AuthContext/AuthContext.jsx";
import { CartProvider } from "../CartContext/CartContext.jsx";
import BackToTop from "../BackToTop/BackToTop.jsx";
import CartOverlay from "../CartOverlay/CartOverlay.jsx";
import Footer from "../Footer/Footer.jsx";
import Navbar from "../Navbar/Navbar.jsx";
import PartyConfetti from "../PartyConfetti/PartyConfetti.jsx";

export const createPublicRouteIsland = (
  PageComponent,
  routePattern,
  pageProps = {},
) => {
  function PublicRouteIsland({
    path = routePattern,
    chrome = true,
    ...runtimePageProps
  }) {
    const publicScrollRef = useRef(null);
    const routePath = String(path || routePattern);

    const routeContent = (
      <>
        <Routes>
          <Route
            path={routePattern}
            element={<PageComponent {...pageProps} {...runtimePageProps} />}
          />
        </Routes>
        <CartOverlay />
      </>
    );

    return (
      <MemoryRouter initialEntries={[routePath]}>
        <CartProvider>
          <TemplateConfigProvider>
            <AuthProvider>
              {chrome ? (
                <div className="site-shell">
                  <div className="main" ref={publicScrollRef}>
                    <PartyConfetti className="site-shell-confetti party-confetti-rentals" />
                    <Navbar scrollContainerRef={publicScrollRef} />
                    {routeContent}
                    <Footer />
                    <BackToTop scrollContainerRef={publicScrollRef} />
                  </div>
                </div>
              ) : (
                <div className="main astro-route-island" ref={publicScrollRef}>
                  {routeContent}
                  <BackToTop scrollContainerRef={publicScrollRef} />
                </div>
              )}
            </AuthProvider>
          </TemplateConfigProvider>
        </CartProvider>
      </MemoryRouter>
    );
  }

  PublicRouteIsland.displayName =
    `${PageComponent.displayName || PageComponent.name || "Page"}Island`;
  return PublicRouteIsland;
};
