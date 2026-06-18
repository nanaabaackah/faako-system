import type {
  ChangeEventHandler,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
} from "react";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export type ERPTableState = "ready" | "loading" | "empty" | "error";

export type ERPTableColumn<Row> = {
  id: string;
  header: ReactNode;
  accessor?: keyof Row;
  render?: (row: Row, rowIndex: number) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  cellClassName?: string | ((row: Row, rowIndex: number) => string);
  mobileLabel?: string;
  hideOnMobile?: boolean;
};

export type ERPTablePaginationState = {
  pageIndex: number;
  pageCount: number;
  pageSize?: number;
  totalItems?: number;
  itemLabel?: string;
};

export function ERPTableToolbar({
  className = "",
  copyClassName = "",
  title,
  description = "",
  search = null,
  filters = null,
  actions = null,
  children = null,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  copyClassName?: string;
  title?: ReactNode;
  description?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  const hasCopy = Boolean(title || description);
  return (
    <div className={joinClasses("ui-erp-table-toolbar", className)} {...props}>
      {hasCopy ? (
        <div className={joinClasses("ui-erp-table-toolbar__copy", copyClassName)}>
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {(search || filters || actions || children) ? (
        <div className="ui-erp-table-toolbar__controls">
          {search ? <div className="ui-erp-table-toolbar__search">{search}</div> : null}
          {filters ? <div className="ui-erp-table-toolbar__filters">{filters}</div> : null}
          {actions ? <div className="ui-erp-table-toolbar__actions">{actions}</div> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ERPTableSearch({
  className = "",
  label = "Search",
  value,
  onChange,
  placeholder = "Search",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  label?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className={joinClasses("ui-erp-table-search", className)}>
      <span className="ui-erp-table-search__label">{label}</span>
      <input
        {...props}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

export function ERPTableFilters({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={joinClasses("ui-erp-table-filters", className)} {...props}>
      {children}
    </div>
  );
}

export function ERPTableActions({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={joinClasses("ui-erp-table-actions", className)} {...props}>
      {children}
    </div>
  );
}

export function ERPTableEmptyState({
  className = "",
  title = "No rows to show",
  message = "Try adjusting the filters or check back later.",
  actions = null,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: ReactNode;
  message?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={joinClasses("ui-erp-table-state", "ui-erp-table-state--empty", className)} {...props}>
      <strong>{title}</strong>
      {message ? <p>{message}</p> : null}
      {actions ? <div className="ui-erp-table-state__actions">{actions}</div> : null}
    </div>
  );
}

export function ERPTableLoadingState({
  className = "",
  message = "Loading rows...",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  message?: ReactNode;
}) {
  return (
    <div
      className={joinClasses("ui-erp-table-state", "ui-erp-table-state--loading", className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <span className="ui-erp-table-state__spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function ERPStatusBadge({
  className = "",
  tone = "neutral",
  children,
  label,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "loading";
  label?: ReactNode;
}) {
  return (
    <span className={joinClasses("ui-erp-status-badge", `ui-erp-status-badge--${tone}`, className)} {...props}>
      {children ?? label}
    </span>
  );
}

function ERPTablePaginationArrow({ direction }: { direction: "previous" | "next" }) {
  const points =
    direction === "previous"
      ? "15 18 9 12 15 6"
      : "9 18 15 12 9 6";

  return (
    <svg
      aria-hidden="true"
      className="ui-erp-table-pagination__arrow"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d={`M${points}`}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

const getPaginationButtonLabel = (value: ReactNode, fallback: string) =>
  typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function ERPTablePagination({
  className = "",
  pageIndex,
  pageCount,
  pageSize,
  totalItems,
  itemLabel = "rows",
  onPageChange,
  previousLabel = "Previous",
  nextLabel = "Next",
  ...props
}: HTMLAttributes<HTMLElement> &
  ERPTablePaginationState & {
    onPageChange: (nextPageIndex: number) => void;
    previousLabel?: ReactNode;
    nextLabel?: ReactNode;
  }) {
  const safePageCount = Math.max(0, Number(pageCount) || 0);
  const safePageIndex = safePageCount ? Math.min(Math.max(Number(pageIndex) || 0, 0), safePageCount - 1) : 0;
  const hasItems = typeof totalItems === "number" && totalItems > 0;
  const start = hasItems && pageSize ? safePageIndex * pageSize + 1 : 0;
  const end = hasItems && pageSize ? Math.min(totalItems, (safePageIndex + 1) * pageSize) : totalItems ?? 0;
  const canGoPrevious = safePageCount > 0 && safePageIndex > 0;
  const canGoNext = safePageCount > 0 && safePageIndex < safePageCount - 1;
  const previousAccessibleLabel = getPaginationButtonLabel(previousLabel, "Previous page");
  const nextAccessibleLabel = getPaginationButtonLabel(nextLabel, "Next page");

  return (
    <nav className={joinClasses("ui-erp-table-pagination", className)} aria-label="Table pagination" {...props}>
      <p className="ui-erp-table-pagination__meta">
        {hasItems && pageSize
          ? `Showing ${start}-${end} of ${totalItems} ${itemLabel}`
          : `${totalItems ?? 0} ${itemLabel}`}
      </p>
      <div className="ui-erp-table-pagination__controls">
        <button
          type="button"
          onClick={() => onPageChange(safePageIndex - 1)}
          disabled={!canGoPrevious}
          aria-label={previousAccessibleLabel}
          title={previousAccessibleLabel}
        >
          <ERPTablePaginationArrow direction="previous" />
        </button>
        <span aria-live="polite">
          Page {safePageCount ? safePageIndex + 1 : 0} of {safePageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePageIndex + 1)}
          disabled={!canGoNext}
          aria-label={nextAccessibleLabel}
          title={nextAccessibleLabel}
        >
          <ERPTablePaginationArrow direction="next" />
        </button>
      </div>
    </nav>
  );
}

export function ERPTable<Row>({
  className = "",
  tableClassName = "",
  tableProps,
  scrollClassName = "",
  title,
  description = "",
  search = null,
  filters = null,
  actions = null,
  toolbar = null,
  columns,
  rows,
  rowKey,
  rowActions,
  rowActionsHeader = "Actions",
  state = "ready",
  loadingMessage = "Loading rows...",
  emptyTitle = "No rows to show",
  emptyMessage = "Try adjusting the filters or check back later.",
  errorMessage = "Unable to load this table right now.",
  pagination,
  onPageChange,
  caption,
  dense = false,
  mobileMode = "scroll",
  rowClassName,
  getRowProps,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  tableClassName?: string;
  tableProps?: TableHTMLAttributes<HTMLTableElement>;
  scrollClassName?: string;
  title?: ReactNode;
  description?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  columns: Array<ERPTableColumn<Row>>;
  rows: Row[];
  rowKey: keyof Row | ((row: Row, index: number) => string | number);
  rowActions?: (row: Row, rowIndex: number) => ReactNode;
  rowActionsHeader?: ReactNode;
  state?: ERPTableState;
  loadingMessage?: ReactNode;
  emptyTitle?: ReactNode;
  emptyMessage?: ReactNode;
  errorMessage?: ReactNode;
  pagination?: ERPTablePaginationState;
  onPageChange?: (nextPageIndex: number) => void;
  caption?: string;
  dense?: boolean;
  mobileMode?: "scroll" | "cards";
  rowClassName?: string | ((row: Row, rowIndex: number) => string);
  getRowProps?: (row: Row, rowIndex: number) => HTMLAttributes<HTMLTableRowElement>;
}) {
  const resolvedState = state === "ready" && rows.length === 0 ? "empty" : state;
  const hasToolbar = Boolean(title || description || search || filters || actions || toolbar);
  const { className: tablePropsClassName, ...safeTableProps } = tableProps ?? {};
  const tableColumns = rowActions
    ? [...columns, { id: "__actions", header: rowActionsHeader, mobileLabel: "Actions" } satisfies ERPTableColumn<Row>]
    : columns;

  const getKey = (row: Row, rowIndex: number) =>
    typeof rowKey === "function" ? rowKey(row, rowIndex) : String(row[rowKey] ?? rowIndex);

  const getCellClassName = (column: ERPTableColumn<Row>, row: Row, rowIndex: number) =>
    joinClasses(
      column.align && `is-${column.align}`,
      column.hideOnMobile && "is-hidden-mobile",
      typeof column.cellClassName === "function" ? column.cellClassName(row, rowIndex) : column.cellClassName,
    );

  return (
    <section
      className={joinClasses(
        "ui-erp-table",
        dense && "is-dense",
        mobileMode === "cards" && "ui-erp-table--cards",
        className,
      )}
      aria-busy={resolvedState === "loading" ? true : undefined}
      {...props}
    >
      {hasToolbar ? (
        toolbar ?? (
          <ERPTableToolbar
            title={title}
            description={description}
            search={search}
            filters={filters}
            actions={actions}
          />
        )
      ) : null}

      {resolvedState === "loading" ? <ERPTableLoadingState message={loadingMessage} /> : null}
      {resolvedState === "error" ? (
        <ERPTableEmptyState title="Table unavailable" message={errorMessage} />
      ) : null}
      {resolvedState === "empty" ? (
        <ERPTableEmptyState title={emptyTitle} message={emptyMessage} />
      ) : null}

      {resolvedState === "ready" ? (
        <div className={joinClasses("ui-erp-table__scroll", scrollClassName)}>
          <table
            {...safeTableProps}
            className={joinClasses("ui-erp-table__table", tableClassName, tablePropsClassName)}
          >
            {caption ? <caption>{caption}</caption> : null}
            <thead>
              <tr>
                {tableColumns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    className={joinClasses(
                      column.align && `is-${column.align}`,
                      column.hideOnMobile && "is-hidden-mobile",
                      column.className,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const extraRowProps = getRowProps?.(row, rowIndex) ?? {};
                return (
                  <tr
                    {...extraRowProps}
                    key={getKey(row, rowIndex)}
                    className={joinClasses(
                      typeof rowClassName === "function" ? rowClassName(row, rowIndex) : rowClassName,
                      extraRowProps.className,
                    )}
                  >
                    {columns.map((column) => {
                      const content = column.render
                        ? column.render(row, rowIndex)
                        : column.accessor
                          ? (row[column.accessor] as ReactNode)
                          : null;
                      return (
                        <td
                          key={column.id}
                          className={getCellClassName(column, row, rowIndex)}
                          data-label={column.mobileLabel || (typeof column.header === "string" ? column.header : undefined)}
                        >
                          {content}
                        </td>
                      );
                    })}
                    {rowActions ? (
                      <td className="ui-erp-table__row-actions" data-label="Actions">
                        {rowActions(row, rowIndex)}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination && onPageChange ? (
        <ERPTablePagination {...pagination} onPageChange={onPageChange} />
      ) : null}
    </section>
  );
}
