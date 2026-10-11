import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SidebarEdgeToggle, useSidebarCollapsedState } from "@faako/ui";
import { Category, Box, Receipt, People, AddCircle, Menu, SearchNormal1, Logout } from "iconsax-react";
import { AppIcon } from "./AppIcon.jsx";
import PortalAction from "./PortalAction.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

const icons = { dashboard: Category, orders: Receipt, stock: Box, sales: AddCircle, customers: People };

export default function WaterNavigation({ permissions }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useSidebarCollapsedState({ storageKey: "reebs-water.sidebar-collapsed" });
  const toggleRef = useRef(null);
  const items = [
    ["dashboard", "Dashboard", true],
    ["sales", "Sales", permissions.canRecordSales],
    ["orders", "Orders", true],
    ["customers", "Customers", true],
    ["stock", "Stock", true],
  ].filter(([, , allowed]) => allowed).map(([id, label]) => ({ id, label, path: id === "dashboard" ? "/" : `/${id}` }));
  const visibleItems = items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const followModule = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      const heading = document.querySelector(".water-module-page h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.scrollIntoView({ block: "start" });
      heading?.focus({ preventScroll: true });
    });
  };

  return (
    <aside className={`portal-sidebar water-sidebar ${collapsed ? "" : "is-expanded"} ${open ? "is-mobile-open" : ""}`}
      aria-label="Water navigation" onKeyDown={(event) => {
        if (event.key === "Escape" && open) { setOpen(false); toggleRef.current?.focus(); }
      }}>
      <div className="portal-sidebar__panel">
        <div className="portal-sidebar__header">
          <Link to="/" className="portal-sidebar__brand" aria-label="REEBS Water home" onClick={followModule}>
            <span className="portal-sidebar__brand-mark" aria-hidden="true"><img className="water-brand-logo" src="/imgs/reebs-logo.svg" alt="" /></span>
            <span className="portal-sidebar__brand-copy"><span className="portal-sidebar__brand-full">REEBS Water</span></span>
          </Link>
          <button ref={toggleRef} type="button" className="portal-sidebar__toggle-btn water-navigation-toggle"
            aria-label="Water navigation" aria-expanded={open} aria-controls="water-navigation-panel" onClick={() => setOpen(!open)}>
            <AppIcon icon={Menu} />
          </button>
        </div>
        <div id="water-navigation-panel" className="water-sidebar-modules">
          {!collapsed && <label className="portal-sidebar__search">
            <AppIcon icon={SearchNormal1} />
            <input className="portal-sidebar__search-input" type="search" aria-label="Search Water modules"
              placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>}
          <nav className="portal-sidebar__nav" aria-label="REEBS Water navigation">
            <ul className="portal-sidebar__list">
              {visibleItems.map((item) => <li key={item.id} className={pathname === item.path ? "is-active" : undefined}>
                <Link to={item.path} className={`portal-sidebar__link ${pathname === item.path ? "is-active" : ""}`}
                  aria-current={pathname === item.path ? "page" : undefined} aria-label={item.label} title={item.label} onClick={followModule}>
                  <span className="portal-sidebar__link-main">
                    <span className="portal-sidebar__link-icon"><AppIcon icon={icons[item.id]} /></span>
                    <span className="portal-sidebar__link-label">{item.label}</span>
                  </span>
                </Link>
              </li>)}
            </ul>
            {!visibleItems.length && <p role="status">No matching modules.</p>}
          </nav>
        </div>
        <div className="portal-sidebar__footer water-sidebar-account">
          <span className="water-sidebar-user">{user?.name || user?.fullName || user?.email || "Signed in"}</span>
          <PortalAction label="Sign out" icon={Logout} onClick={logout} />
        </div>
      </div>
      <SidebarEdgeToggle className="portal-sidebar__edge-toggle" collapsed={collapsed}
        onClick={() => setCollapsed(!collapsed)} />
    </aside>
  );
}
