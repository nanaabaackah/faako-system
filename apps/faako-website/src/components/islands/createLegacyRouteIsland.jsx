import { MemoryRouter, Route, Routes } from "react-router-dom";

export const createLegacyRouteIsland = (PageComponent, routePattern) => {
  function LegacyRouteIsland({ path = routePattern }) {
    return (
      <MemoryRouter
        initialEntries={[path]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path={routePattern} element={<PageComponent />} />
        </Routes>
      </MemoryRouter>
    );
  }

  LegacyRouteIsland.displayName = `${PageComponent.displayName || PageComponent.name || "Page"}Island`;
  return LegacyRouteIsland;
};
