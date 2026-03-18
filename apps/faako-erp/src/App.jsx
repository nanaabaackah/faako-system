import { NavLink, Route, Routes } from "react-router-dom";
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
import "./styles/components/panel.css";

export default function App() {
  return (
    <div className="erp-shell">
      <aside className="erp-sidebar">
        <div className="brand">Faako ERP</div>
        <nav className="erp-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? "active" : "")}>
            Orders
          </NavLink>
          <NavLink
            to="/inventory"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Inventory
          </NavLink>
          <NavLink to="/bookings" className={({ isActive }) => (isActive ? "active" : "")}>
            Bookings
          </NavLink>
          <NavLink to="/vendors" className={({ isActive }) => (isActive ? "active" : "")}>
            Vendors
          </NavLink>
          <NavLink
            to="/expenses"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Expenses
          </NavLink>
          <NavLink to="/finance" className={({ isActive }) => (isActive ? "active" : "")}>
            Finance
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
            Reports
          </NavLink>
          <NavLink to="/people" className={({ isActive }) => (isActive ? "active" : "")}>
            People
          </NavLink>
          <NavLink
            to="/customers"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Customers
          </NavLink>
          <NavLink
            to="/notifications"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Notifications
          </NavLink>
          <NavLink to="/modules" className={({ isActive }) => (isActive ? "active" : "")}>
            Modules
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            Settings
          </NavLink>
        </nav>
      </aside>
      <div className="erp-main">
        <header className="erp-topbar">
          <span>Workspace overview</span>
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
    </div>
  );
}
