import { Link } from "react-router-dom";
import AppIcon from "../Icon/Icon";
import "./PortalAction.css";

// Action controls only: navigation, tabs, quantity presets and field triggers
// retain their visible labels. All icon-only actions retain an accessible name.
export default function PortalAction({ label, icon, action, to, href, className = "", children, ...props }) {
  const iconOnly = ["add", "delete", "view", "open", "archive"].includes(action);
  const Component = to ? Link : href ? "a" : "button";
  const destination = to ? { to } : href ? { href } : { type: "button" };
  return <Component {...destination} {...props} aria-label={label} title={label}
    className={`ui-erp-action ui-erp-action--secondary ui-erp-action--md portal-action ${iconOnly ? "portal-action--icon" : ""} ${className}`}>
    <AppIcon icon={icon} size={20} aria-hidden="true" />
    <span className="portal-action__label">{label}</span>
    {children}
  </Component>;
}
