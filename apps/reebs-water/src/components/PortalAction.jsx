import { AppIcon } from "./AppIcon.jsx";

export default function PortalAction({
  label,
  icon,
  action,
  className = "",
  children,
  ...props
}) {
  const iconOnly = ["add", "delete", "view", "open", "archive"].includes(action);
  return (
    <button
      {...props}
      type={props.type || "button"}
      aria-label={label}
      title={label}
      className={`ui-erp-action ui-erp-action--secondary ui-erp-action--md portal-action${iconOnly ? " portal-action--icon" : ""} ${className}`}
    >
      <AppIcon icon={icon} size={20} aria-hidden="true" />
      <span className="portal-action__label">{label}</span>
      {children}
    </button>
  );
}
