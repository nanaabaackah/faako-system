import { useState } from "react";

export default function useTableSelection(eligibleRows, resetKey = "") {
  const [state, setState] = useState({ key: resetKey, ids: new Set() });
  // Filter changes and refreshed/archived records cannot retain hidden selections.
  const ids = new Set(eligibleRows.filter((row) => state.key === resetKey && state.ids.has(row.id)).map((row) => row.id));
  const toggle = (id) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id); else next.add(id);
    setState({ key: resetKey, ids: next });
  };
  const togglePage = (pageRows) => {
    const next = new Set(ids);
    const allSelected = pageRows.every((row) => ids.has(row.id));
    pageRows.forEach((row) => { if (allSelected) next.delete(row.id); else next.add(row.id); });
    setState({ key: resetKey, ids: next });
  };
  return { ids, toggle, togglePage, clear: () => setState({ key: resetKey, ids: new Set() }) };
}
