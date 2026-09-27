import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./Primitives";
import type { DataTableColumn, DataTableSummaryCell } from "../types";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

type TableState = "ready" | "loading" | "empty" | "error";

type DataTablePagination = {
  total: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
};

const normalizeSortValue = (value: unknown) => {
  if (typeof value === "number") return value;
  return String(value || "").toLowerCase();
};

export function DataTable<Row>({
  title,
  description = "",
  actions = null,
  columns,
  rows,
  rowKey,
  state = "ready",
  emptyTitle = "Nothing to show yet",
  emptyMessage = "Add data or widen the filters to see results here.",
  errorMessage = "We could not load this table right now.",
  summary = [],
  className = "",
  dense = false,
  caption,
  pageSize,
  renderPagination,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  rowKey: keyof Row | ((row: Row, index: number) => string | number);
  state?: TableState;
  emptyTitle?: ReactNode;
  emptyMessage?: ReactNode;
  errorMessage?: ReactNode;
  summary?: DataTableSummaryCell[];
  className?: string;
  dense?: boolean;
  caption?: string;
  /** Opt-in client pagination; rows must contain the complete result to sort. */
  pageSize?: number;
  renderPagination?: (pagination: DataTablePagination, header: boolean) => ReactNode;
}) {
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: "asc" | "desc" } | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => { setPageIndex(0); }, [rows, pageSize]);

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const column = columns.find((item) => item.id === sortConfig.columnId);
    if (!column) return rows;

    const nextRows = [...rows];
    nextRows.sort((left, right) => {
      const leftValue = normalizeSortValue(
        column.sortValue
          ? column.sortValue(left)
          : column.accessor
            ? left[column.accessor]
            : "",
      );
      const rightValue = normalizeSortValue(
        column.sortValue
          ? column.sortValue(right)
          : column.accessor
            ? right[column.accessor]
            : "",
      );

      if (leftValue < rightValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (leftValue > rightValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    return nextRows;
  }, [columns, rows, sortConfig]);

  const resolvedState =
    state === "ready" && !rows.length
      ? "empty"
      : state;

  // Existing consumers remain unpaginated unless they provide both the size
  // and controls. Never silently hide rows without a way to reach them.
  const paginate = Boolean(renderPagination && Number.isInteger(pageSize) && Number(pageSize) > 0);
  const safePageSize = paginate ? Number(pageSize) : Math.max(1, rows.length);
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleRows = paginate
    ? sortedRows.slice(safePageIndex * safePageSize, (safePageIndex + 1) * safePageSize)
    : sortedRows;
  const pagination = {
    total: rows.length, pageIndex: safePageIndex, pageSize: safePageSize, pageCount,
    onPrevious: () => setPageIndex(Math.max(0, safePageIndex - 1)),
    onNext: () => setPageIndex(Math.min(pageCount - 1, safePageIndex + 1)),
  };

  const handleSort = (columnId: string) => {
    setPageIndex(0);
    setSortConfig((current) => {
      if (!current || current.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { columnId, direction: "desc" };
      }
      return null;
    });
  };

  return (
    <section className={joinClasses("ui-data-table", dense && "is-dense", className)}>
      {(title || description || actions) ? (
        <div className="ui-data-table__header">
          <div className="ui-data-table__copy">
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="ui-data-table__actions">{actions}</div> : null}
        </div>
      ) : null}

      {resolvedState === "loading" ? (
        <EmptyState title="Loading table" message="Pulling the latest rows now." />
      ) : null}

      {resolvedState === "error" ? (
        <EmptyState title="Table unavailable" message={errorMessage} />
      ) : null}

      {resolvedState === "empty" ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : null}

      {resolvedState === "ready" ? (
        <>
        {paginate ? renderPagination?.(pagination, true) : null}
        <div className="ui-data-table__scroll">
          <table>
            {caption ? <caption>{caption}</caption> : null}
            <thead>
              <tr>
                {columns.map((column) => {
                  const isActive = sortConfig?.columnId === column.id;
                  const isSortable = column.sortable !== false;
                  return (
                    <th
                      key={column.id}
                      style={column.width ? { width: column.width } : undefined}
                      className={column.align ? `is-${column.align}` : undefined}
                      aria-sort={
                        isSortable
                          ? isActive
                            ? sortConfig?.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                          : undefined
                      }
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          className={joinClasses("ui-data-table__sort", isActive && "is-active")}
                          onClick={() => handleSort(column.id)}
                          aria-label={`Sort by ${String(column.header)}${isActive ? `, currently ${sortConfig?.direction === "asc" ? "ascending" : "descending"}` : ""}`}
                        >
                          <span>{column.header}</span>
                          <span aria-hidden="true">
                            {isActive ? (sortConfig?.direction === "asc" ? "↑" : "↓") : "↕"}
                          </span>
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, visibleIndex) => {
                const rowIndex = paginate ? safePageIndex * safePageSize + visibleIndex : visibleIndex;
                const key =
                  typeof rowKey === "function"
                    ? rowKey(row, rowIndex)
                    : String(row[rowKey] ?? rowIndex);

                return (
                  <tr key={key}>
                    {columns.map((column) => {
                      const content = column.render
                        ? column.render(row, rowIndex)
                        : column.accessor
                          ? (row[column.accessor] as ReactNode)
                          : null;
                      return (
                        <td key={column.id} className={column.align ? `is-${column.align}` : undefined}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {summary.length ? (
              <tfoot>
                <tr>
                  {summary.map((cell) => (
                    <td
                      key={cell.id}
                      className={joinClasses(
                        cell.align ? `is-${cell.align}` : undefined,
                        cell.empty && "is-empty",
                      )}
                    >
                      {cell.content}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        {paginate ? renderPagination?.(pagination, false) : null}
        </>
      ) : null}
    </section>
  );
}
