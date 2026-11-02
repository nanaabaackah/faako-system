import { Button } from "@faako/ui";
import NavigationIcon from "./NavigationIcon.jsx";

// Keep Faako semantics and variants; add an explicit, decorative action glyph.
export default function ActionButton({ icon = "arrow", children, className = "", ...props }) {
  return <Button className={`twe-action-button ${className}`} {...props}><span>{children}</span><span className="action-icon"><NavigationIcon name={icon} /></span></Button>;
}
