import { useEffect, useRef } from "react";
import "./TableControls.css";

export default function TableSelectionCheckbox({ label, checked, mixed = false, onChange, disabled = false }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return (
    <label className="table-selection-control" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <input ref={ref} type="checkbox" aria-label={label} aria-checked={mixed ? "mixed" : checked}
        checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}
