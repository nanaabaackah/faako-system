import { useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./Primitives";
import type { DataTableColumn, DataTableSummaryCell } from "../types";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

type TableState = "ready" | "loading" | "empty" | "error";

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
}) {
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: "asc" | "desc" } | null>(null);

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

  const handleSort = (columnId: string) => {
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
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          className={joinClasses("ui-data-table__sort", isActive && "is-active")}
                          onClick={() => handleSort(column.id)}
                          aria-sort={isActive ? (sortConfig?.direction === "asc" ? "ascending" : "descending") : "none"}
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
              {sortedRows.map((row, rowIndex) => {
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
      ) : null}
    </section>
  );
}
