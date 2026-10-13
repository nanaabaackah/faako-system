import { useEffect, useMemo, useState } from "react";
import { ArrowDown2, ArrowSwapVertical, ArrowUp2 } from "iconsax-react";

const collator = new Intl.Collator("en-GH", { numeric: true, sensitivity: "base" });
const isMissing = (value) => value == null || value === ""
  || (typeof value === "number" && !Number.isFinite(value));

function sortRows(rows, accessors, sort) {
  const accessor = sort && Object.hasOwn(accessors, sort.key) ? accessors[sort.key] : null;
  if (typeof accessor !== "function") return rows;
  const direction = sort.direction === "desc" ? -1 : 1;
  return rows.map((row, index) => ({ row, index, value: accessor(row, index) }))
    .sort((left, right) => {
      if (isMissing(left.value) || isMissing(right.value)) {
        return Number(isMissing(left.value)) - Number(isMissing(right.value)) || left.index - right.index;
      }
      const comparison = typeof left.value === "number" && typeof right.value === "number"
        ? left.value - right.value
        : collator.compare(String(left.value), String(right.value));
      return comparison * direction || left.index - right.index;
    })
    .map(({ row }) => row);
}

export function TableSortHeader({ column, sort, onSort, children, label, className }) {
  const active = sort?.key === column;
  const Icon = active ? (sort.direction === "asc" ? ArrowUp2 : ArrowDown2) : ArrowSwapVertical;
  const nextDirection = active && sort.direction === "asc" ? "descending" : "ascending";
  return (
    <th
      className={className}
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        className="sort-header table-sort-control"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label || children}`}
        title={`Sort ${nextDirection}`}
      >
        {children}
        <Icon size={14} variant="Linear" color="currentColor" aria-hidden="true" />
      </button>
    </th>
  );
}

export function useTableView(rows, accessors, { pageSize = 10, resetKey = "" } = {}) {
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const sortedRows = useMemo(() => sortRows(rows, accessors, sort), [rows, accessors, sort]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageIndex = Math.min(page, pageCount - 1);
  useEffect(() => { setPage(0); }, [resetKey]);
  return {
    sort,
    onSort: (key) => {
      setSort((current) => ({
        key,
        direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
      }));
      setPage(0);
    },
    rows: sortedRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    pagination: {
      total: rows.length,
      pageIndex,
      pageSize,
      pageCount,
      onPrevious: () => setPage(Math.max(0, pageIndex - 1)),
      onNext: () => setPage(Math.min(pageCount - 1, pageIndex + 1)),
    },
  };
}

export const tableDate = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};
