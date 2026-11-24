import { Button } from "@faako/ui";
import NavigationIcon from "./NavigationIcon.jsx";

// Keep Faako semantics and variants; add an explicit, decorative action glyph.
export default function ActionButton({ icon = "arrow", loading = false, loadingLabel = "Working…", children, className = "", disabled, ...props }) {
  return <Button className={`twe-action-button${loading ? " is-loading" : ""} ${className}`} aria-busy={loading || undefined} disabled={disabled || loading} {...props}>
    <span>{loading ? loadingLabel : children}</span>
    <span className="action-icon" aria-hidden="true">{loading ? <span className="twe-action-spinner" /> : <NavigationIcon name={icon} />}</span>
  </Button>;
}
