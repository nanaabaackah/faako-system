import { useEffect, useState } from "react";
import useTableSort from "./useTableSort.js";

/** Client-side registers only: never pass an already server-paginated result. */
export default function useTableView(rows, accessors, { pageSize = 10, resetKey = "" } = {}) {
  const sorted = useTableSort(rows, accessors);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageIndex = Math.min(page, pageCount - 1);
  useEffect(() => { setPage(0); }, [resetKey]);
  return {
    sort: sorted.sort,
    onSort: (key) => { sorted.onSort(key); setPage(0); },
    rows: sorted.rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    pagination: {
      total: rows.length, pageIndex, pageSize, pageCount,
      onPrevious: () => setPage(Math.max(0, pageIndex - 1)),
      onNext: () => setPage(Math.min(pageCount - 1, pageIndex + 1)),
    },
  };
}
