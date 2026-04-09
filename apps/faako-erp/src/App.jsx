import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ErpBottomNav, ErpNavSidebar, ErpShellFrame } from "@faako/ui";
import { filterItemsByRole, getErpPageTitle, toTitleCase } from "@faako/utils";
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

const iconStrokeProps = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const ShellNavIcon = ({ children }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
  >
    {children}
  </svg>
);

const renderShellIcon = (_iconKey, label) => {
  const normalized = String(label || "").trim().toLowerCase();

  if (normalized === "dashboard" || normalized === "home") {
    return (
      <ShellNavIcon>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" {...iconStrokeProps} />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" {...iconStrokeProps} />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" {...iconStrokeProps} />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "orders") {
    return (
      <ShellNavIcon>
        <path d="M7 4.5h8l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z" {...iconStrokeProps} />
        <path d="M10 9.5h6" {...iconStrokeProps} />
        <path d="M10 13h6" {...iconStrokeProps} />
        <path d="M10 16.5h4" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "inventory" || normalized === "stock") {
    return (
      <ShellNavIcon>
        <path d="M12 3.8 19 7.5v9L12 20.2 5 16.5v-9L12 3.8Z" {...iconStrokeProps} />
        <path d="M5 7.5 12 11l7-3.5" {...iconStrokeProps} />
        <path d="M12 11v9.2" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "bookings") {
    return (
      <ShellNavIcon>
        <rect x="4" y="5.5" width="16" height="14" rx="2.5" {...iconStrokeProps} />
        <path d="M8 3.8v3.4" {...iconStrokeProps} />
        <path d="M16 3.8v3.4" {...iconStrokeProps} />
        <path d="M4 9.5h16" {...iconStrokeProps} />
        <path d="M8.5 13h2.5" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "vendors") {
    return (
      <ShellNavIcon>
        <path d="M4.5 9.5 7 5h10l2.5 4.5" {...iconStrokeProps} />
        <path d="M5 9.5h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9Z" {...iconStrokeProps} />
        <path d="M9 13h6" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "expenses") {
    return (
      <ShellNavIcon>
        <rect x="3.5" y="6" width="17" height="12" rx="2.5" {...iconStrokeProps} />
        <path d="M3.5 10h17" {...iconStrokeProps} />
        <path d="M8 15h4" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "finance") {
    return (
      <ShellNavIcon>
        <path d="M4.5 7.5h15v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Z" {...iconStrokeProps} />
        <path d="M4.5 9.5h15" {...iconStrokeProps} />
        <path d="M12 12.2c1.3 0 2.2.6 2.2 1.6s-.9 1.6-2.2 1.6-2.2.6-2.2 1.6.9 1.6 2.2 1.6" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "reports") {
    return (
      <ShellNavIcon>
        <path d="M7 4.5h8l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z" {...iconStrokeProps} />
        <path d="M9 16.5 11.7 13.8l2.2 2.2 3.1-4" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "people") {
    return (
      <ShellNavIcon>
        <circle cx="9" cy="9" r="2.6" {...iconStrokeProps} />
        <circle cx="16.5" cy="10.2" r="2.1" {...iconStrokeProps} />
        <path d="M4.8 18.8c.9-2.4 2.8-3.6 5.3-3.6s4.4 1.2 5.3 3.6" {...iconStrokeProps} />
        <path d="M15.2 18.1c.5-1.4 1.5-2.2 3-2.5" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "customers" || normalized === "crm") {
    return (
      <ShellNavIcon>
        <circle cx="12" cy="8.5" r="3" {...iconStrokeProps} />
        <path d="M6 19c1.2-2.6 3.2-4 6-4s4.8 1.4 6 4" {...iconStrokeProps} />
        <path d="M18 6.5h2.5" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "alerts" || normalized === "notifications") {
    return (
      <ShellNavIcon>
        <path d="M12 4.5a4 4 0 0 1 4 4v2.2c0 .8.2 1.5.7 2.1l1.1 1.4H6.2l1.1-1.4c.5-.6.7-1.3.7-2.1V8.5a4 4 0 0 1 4-4Z" {...iconStrokeProps} />
        <path d="M10 18.2a2.2 2.2 0 0 0 4 0" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "modules") {
    return (
      <ShellNavIcon>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" {...iconStrokeProps} />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" {...iconStrokeProps} />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" {...iconStrokeProps} />
        <path d="M13.5 16.8h6.5" {...iconStrokeProps} />
        <path d="M16.75 13.5v6.5" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  if (normalized === "settings") {
    return (
      <ShellNavIcon>
        <circle cx="12" cy="12" r="2.6" {...iconStrokeProps} />
        <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.7 7.7 0 0 0-1.9-1.1l-.4-2.5h-4l-.4 2.5a7.7 7.7 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .7.1 1.1l-2 1.5 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.5h4l.4-2.5c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" {...iconStrokeProps} />
      </ShellNavIcon>
    );
  }

  return (
    <ShellNavIcon>
      <circle cx="12" cy="12" r="7" {...iconStrokeProps} />
      <path d="M12 8.5v4.2" {...iconStrokeProps} />
      <path d="M12 15.8h.01" {...iconStrokeProps} />
    </ShellNavIcon>
  );
};

const getTopbarLabel = (pathname) => {
  const currentPath = pathname.replace(/\/+$/, "") || "/";

  if (shellConfig.pageTitles?.[currentPath]) {
    return shellConfig.pageTitles[currentPath];
  }

  if (currentPath === "/") {
    return "Dashboard";
  }

  return toTitleCase(currentPath.replace(/^\/+/, "")) || "Dashboard";
};

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
      contentClassName="faako-erp-shell-content"
      sidebar={
        <ErpNavSidebar
          brand={shellConfig.brand}
          currentPath={location.pathname}
          fallbackPath="/"
          items={filterItemsByRole(shellConfig.sidebarItems, null)}
          renderIcon={renderShellIcon}
        />
      }
      bottomNav={
        <ErpBottomNav
          currentPath={location.pathname}
          fallbackPath="/"
          items={filterItemsByRole(shellConfig.bottomNavItems, null)}
          renderIcon={renderShellIcon}
        />
      }
    >
      <div className="erp-app-content">
        <header className="erp-topbar">
          <div className="topbar-title">
            <span>{getTopbarLabel(location.pathname)}</span>
          </div>
          <div className="topbar-actions">
            <span className="erp-topbar__context">{shellConfig.brand.topbarLabel}</span>
          </div>
        </header>
        <main className="erp-content">
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
