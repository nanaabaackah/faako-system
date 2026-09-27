import { useMemo, useState } from "react";
import { nextTableSort, sortTableRows } from "./tableRows.js";

export default function useTableSort(rows, accessors, initialSort = null) {
  const [sort, setSort] = useState(initialSort);
  const sortedRows = useMemo(() => sortTableRows(rows, accessors, sort), [rows, accessors, sort]);
  const onSort = (key) => setSort((current) => nextTableSort(current, key));
  return { rows: sortedRows, sort, onSort, clearSort: () => setSort(initialSort) };
}
