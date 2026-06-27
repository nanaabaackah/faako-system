import React from "react";
import { AppIcon } from "/src/components/Icon/Icon";
import { faChevronLeft, faChevronRight } from "/src/icons/iconSet";

export default function TablePagination({
  total,
  pageIndex,
  pageSize,
  pageCount,
  onPrevious,
  onNext,
  header = false,
  className = "",
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 1);
  const safePageCount = Math.max(1, Number(pageCount) || Math.ceil(safeTotal / safePageSize) || 1);
  const safePageIndex = Math.min(Math.max(0, Number(pageIndex) || 0), safePageCount - 1);
  const start = safeTotal === 0 ? 0 : safePageIndex * safePageSize + 1;
  const end = Math.min(safeTotal, (safePageIndex + 1) * safePageSize);
  const displayPage = safeTotal === 0 ? 0 : safePageIndex + 1;
  const displayCount = safeTotal === 0 ? 0 : safePageCount;
  const classes = [
    "table-pagination",
    "inventory-register-pagination",
    header ? "inventory-register-pagination-header" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className="inventory-register-pagination-copy">
        <strong className="inventory-register-pagination-range">
          Showing {start}-{end} of {safeTotal}
        </strong>
      </div>
      <div className="inventory-register-pagination-meta">
        <div className="table-pagination-controls inventory-register-pagination-controls">
          <button type="button" onClick={onPrevious} disabled={safePageIndex === 0}>
            <AppIcon icon={faChevronLeft} size={12} />
            <span>Previous</span>
          </button>
          <span className="inventory-register-pagination-page">
            Page {displayPage} of {displayCount}
          </span>
          <button type="button" onClick={onNext} disabled={safePageIndex >= safePageCount - 1}>
            <AppIcon icon={faChevronRight} size={12} />
            <span>Next</span>
          </button>
        </div>
      </div>
    </div>
  );
}
