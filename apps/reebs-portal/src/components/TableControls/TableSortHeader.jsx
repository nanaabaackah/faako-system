import { ArrowDown2, ArrowUp2, ArrowSwapVertical } from "iconsax-react";
import "./TableControls.css";

export default function TableSortHeader({ column, sort, onSort, children, label, className }) {
  const active = sort?.key === column;
  const Icon = active ? (sort.direction === "asc" ? ArrowUp2 : ArrowDown2) : ArrowSwapVertical;
  const nextDirection = active && sort.direction === "asc" ? "descending" : "ascending";
  return (
    <th className={className} scope="col" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className="sort-header table-sort-control" onClick={() => onSort(column)}
        aria-label={`Sort by ${label || children}`} title={`Sort ${nextDirection}`}>
        {children}<Icon size={14} variant="Linear" color="currentColor" aria-hidden="true" />
      </button>
    </th>
  );
}
