import { useState } from "react";
import NavigationIcon from "./NavigationIcon.jsx";

// Each record is a native keyboard-operable disclosure. Keep fields mounted
// so opening another question never destroys draft input or option ordering.
export default function BuilderDisclosure({ title, detail, initiallyOpen = false, children }) {
  // Keep long operational forms scannable at every viewport. Editors can open
  // the section they need without an entire desktop page expanding by default.
  const [open, setOpen] = useState(initiallyOpen);
  return <details className="twe-builder-disclosure" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><strong>{title}</strong>{detail && <small>{detail}</small>}</span><NavigationIcon name="arrow"/></summary>
    <div className="twe-builder-body">{children}</div>
  </details>;
}
