import { useEffect, useRef, useState } from "react";
import { ERPDrawer, ErpMobileBottomNavFrame } from "@faako/ui";
import NavigationIcon from "./NavigationIcon.jsx";
import logo from "../../../travel-with-ease-web/public/brand/Primary gold.png";
import "../styles/navigation.css";

const mobileShortcutIds = [
  "content",
  "enquiries",
  "overview",
  "media",
  "settings",
];
export default function PortalNavigation({
  navigation,
  section,
  navigate,
  session,
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("twe.sidebar.collapsed") === "true";
    } catch {
      return false;
    }
  });
  const menu = useRef(null);
  const identity = session
    ? `${session.user.id}:${session.user.role}:${session.user.permissions?.join(",")}`
    : "";
  useEffect(() => {
    setOpen(false);
  }, [identity]);
  useEffect(() => {
    const media = matchMedia("(min-width:801px)");
    const close = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const nodes = [
      ...document.querySelectorAll(
        ".portal-shell > .ui-page-shell,.portal-sidebar,.twe-bottom-nav",
      ),
    ];
    const previous = nodes.map((node) => node.inert);
    nodes.forEach((node) => {
      node.inert = true;
    });
    return () => {
      nodes.forEach((node, index) => {
        node.inert = previous[index];
      });
    };
  }, [open]);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => menu.current?.focus());
  };
  const choose = (id) => {
    if (navigate(id)) close();
  };
  const button = ([id, label]) => (
    <button
      key={id}
      type="button"
      className={id === "overview" ? "nav-overview" : ""}
      aria-current={section === id ? "page" : undefined}
      aria-label={label}
      title={label}
      onClick={() => choose(id)}
    >
      <NavigationIcon name={id} />
      <span>{label}</span>
    </button>
  );
  const shortcuts = mobileShortcutIds
    .map((id) => navigation.find((item) => item[0] === id))
    .filter(Boolean);
  return (
    <>
      <aside className={`portal-sidebar${collapsed ? " is-collapsed" : ""}`}>
        <div className="portal-brand">
          <img src={logo} alt="Travel With Ease" width="184" height="72" />
          <small>Staff workspace</small>
          {session && (
            <button
              ref={menu}
              type="button"
              className="portal-menu-button"
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
            >
              Menu <NavigationIcon name="content" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="portal-sidebar-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => {
            setCollapsed(!collapsed);
            try {
              localStorage.setItem("twe.sidebar.collapsed", String(!collapsed));
            } catch {
              /* UI preference only */
            }
          }}
        >
          <NavigationIcon name={collapsed ? "arrow" : "back"} />
          <span>{collapsed ? "Expand" : "Collapse"} menu</span>
        </button>
        <nav aria-label="Staff navigation">{navigation.map(button)}</nav>
      </aside>
      <ERPDrawer
        open={open && Boolean(session)}
        side="left"
        title="Travel With Ease menu"
        onClose={close}
        closeOnBackdrop
        className="twe-menu-drawer"
      >
        <nav aria-label="All workspace modules">{navigation.map(button)}</nav>
        <p>
          Only modules available to your account are shown. Tutorial controls
          and sign-out remain in your workspace.
        </p>
      </ERPDrawer>
      {session && (
        <ErpMobileBottomNavFrame className="twe-bottom-nav">
          <div className="twe-bottom-nav__group">
            {shortcuts
              .filter(([id]) => ["content", "enquiries"].includes(id))
              .map(button)}
          </div>
          {shortcuts.find(([id]) => id === "overview") &&
            button(shortcuts.find(([id]) => id === "overview"))}
          <div className="twe-bottom-nav__group">
            {shortcuts
              .filter(([id]) => ["media", "settings"].includes(id))
              .map(button)}
          </div>
        </ErpMobileBottomNavFrame>
      )}
    </>
  );
}
