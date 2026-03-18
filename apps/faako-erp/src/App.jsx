import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ErpBottomNav, ErpNavSidebar, ErpShellFrame } from "@faako/ui";
import { filterItemsByRole, getErpPageTitle } from "@faako/utils";
import Dashboard from "./pages/Dashboard.jsx";
import Orders from "./pages/Orders.jsx";
import Inventory from "./pages/Inventory.jsx";
import Bookings from "./pages/Bookings.jsx";
import Vendors from "./pages/Vendors.jsx";
import Expenses from "./pages/Expenses.jsx";
import Finance from "./pages/Finance.jsx";
import Reports from "./pages/Reports.jsx";
import People from "./pages/People.jsx";
import Customers from "./pages/Customers.jsx";
import Notifications from "./pages/Notifications.jsx";
import Modules from "./pages/Modules.jsx";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound.jsx";
import shellConfig from "./config/erpShell.js";
import "./styles/components/panel.css";

function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    document.title = getErpPageTitle(
      location.pathname,
      shellConfig.brand.name,
      shellConfig.pageTitles,
      "/",
    );
  }, [location.pathname]);

  return (
    <ErpShellFrame
      brand={shellConfig.brand}
      layout="split"
      sidebar={
        <ErpNavSidebar
          brand={shellConfig.brand}
          currentPath={location.pathname}
          fallbackPath="/"
          items={filterItemsByRole(shellConfig.sidebarItems, null)}
        />
      }
      bottomNav={
        <ErpBottomNav
          currentPath={location.pathname}
          fallbackPath="/"
          items={filterItemsByRole(shellConfig.bottomNavItems, null)}
        />
      }
    >
      <div className="erp-app-content">
        <header className="erp-content-header">
          <span className="erp-content-header__label">{shellConfig.brand.topbarLabel}</span>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/people" element={<People />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </ErpShellFrame>
  );
}

export default function App() {
  return <AppLayout />;
}
