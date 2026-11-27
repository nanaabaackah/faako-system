import { useEffect, useRef, useState } from "react";
import { ERPDrawer, ErpMobileBottomNavFrame, ErpNavSidebar, useSidebarCollapsedState } from "@faako/ui";
import { getPortalModules } from "../lib/portalModules.js";
import NavigationIcon from "./NavigationIcon.jsx";
import logo from "../../../travel-with-ease-web/public/brand/Primary gold.png";
import brandMark from "../../../travel-with-ease-web/public/brand/navy symbol.png";
import "../styles/navigation.css";
import packageManifest from "../../package.json";

const { version } = packageManifest;

const releaseLabel = version === "0.0.0" ? "Pre-release" : `v${version}`;

const mobileShortcutIds = [
  "overview",
  "enquiries",
  "content",
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
  const [collapsed, setCollapsed] = useSidebarCollapsedState({ storageKey: "twe.sidebar.collapsed" });
  const menu = useRef(null);
  const identity = session
    ? `${session.user.id}:${session.user.role}:${session.user.permissions?.join(",")}`
    : "";
  useEffect(() => {
    setOpen(false);
  }, [identity]);
  useEffect(() => {
    const media = matchMedia("(min-width:901px)");
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
        ".portal-shell > .ui-page-shell,.portal-sidebar,.twe-faako-sidebar,.twe-bottom-nav",
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
    if (navigate(id) && open) close();
  };
  const button = ([id, label], mobile = false) => (
    <button
      key={id}
      type="button"
      className={mobile ? "twe-bottom-nav__tab" : undefined}
      aria-current={section === id ? "page" : undefined}
      aria-label={label}
      onClick={() => choose(id)}
    >
      <NavigationIcon name={mobile && id === "settings" ? "staff" : id} />
      <span>{label}</span>
    </button>
  );
  const shortcuts = mobileShortcutIds
    .map((id) => navigation.find((item) => item[0] === id))
    .filter(Boolean);
  const modules = getPortalModules(navigation);
  const activeModule = modules.find(module => module.children.some(child => child.id === section));
  const account = navigation.find(([id]) => id === "settings");
  const goModule = path => {
    const module = modules.find(item => item.path === path);
    if (!module) return;
    if (module.id === activeModule?.id && module.children.length > 1) {
      if (collapsed) setCollapsed(false);
      return;
    }
    if (navigate(module.children[0].id) && collapsed && module.children.length > 1) setCollapsed(false);
  };
  return (
    <>
      {session && (
        <ErpNavSidebar
          className="twe-faako-sidebar"
          brand={{ name: "Travel With Ease", sidebarMarkUrl: brandMark, homePath: "/overview" }}
          items={modules}
          currentPath={activeModule?.path || "/account"}
          fallbackPath="/overview"
          navLabel="Staff navigation"
          hideBrandEyebrow
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(value => !value)}
          onNavigate={goModule}
          renderIcon={name => <NavigationIcon name={name} />}
          renderContext={item => item.children.length > 1 && (
            <div className="twe-context-nav" role="group" aria-label={item.label + " sections"}>
              {item.children.map(child => (
                <button type="button" key={child.id} aria-current={section === child.id ? "page" : undefined}
                  onClick={() => navigate(child.id)}>
                  <NavigationIcon name={child.id}/><span>{child.label}</span>
                </button>
              ))}
            </div>
          )}
          footer={<div className="twe-sidebar-footer">
            {account && <button type="button" className="twe-sidebar-account"
              aria-label="Account" title={collapsed ? "Account" : undefined}
              aria-current={section === "settings" ? "page" : undefined}
              onClick={() => navigate("settings")}>
              <NavigationIcon name="staff"/><span>Account</span>
            </button>}
            <small className="twe-release-label" title={releaseLabel}>{collapsed ? (version === "0.0.0" ? "Pre" : `v${version.split(".")[0]}`) : releaseLabel}</small>
          </div>}
        />
      )}
      <aside className={`portal-sidebar twe-mobile-sidebar${session ? " has-session" : ""}`}>
        <div className="portal-brand">
          <img src={logo} alt="Travel With Ease" width="184" height="72" />
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
      </aside>
      <ERPDrawer
        open={open && Boolean(session)}
        side="left"
        title="Travel With Ease menu"
        onClose={close}
        closeOnBackdrop
        className="twe-menu-drawer"
      >
        <nav aria-label="All workspace modules">
          {navigation.map((item) => button(item))}
        </nav>
        <small className="twe-release-label">{releaseLabel}</small>

      </ERPDrawer>
      {session && (
        <ErpMobileBottomNavFrame
          className="twe-bottom-nav"
          ariaLabel="Workspace shortcuts"
        >
          {shortcuts.map(([id, label]) =>
            button([id, id === "overview" ? "Home" : label], true),
          )}
        </ErpMobileBottomNavFrame>
      )}
    </>
  );
}
