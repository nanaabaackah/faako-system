import React, { useEffect, useMemo, useState } from "react";
import TablePagination from "../../../components/TablePagination/TablePagination";
import CustomerArchiveButton from "./CustomerArchiveButton";
import { getSegmentLabel, getTouchLabel } from "../crmShared";

export function CustomerResultCard({ customer, onOpen, onArchive, isRemoving }) {
  return (
    <article className="bubble-card crm-customer-card">
      <button
        type="button"
        className="crm-card-open crm-customer-card-open"
        onClick={() => onOpen(customer)}
        aria-label={`Open ${customer.name || "customer"}`}
      >
        <div className="crm-customer-card-top">
          <div className="crm-customer-profile">
            <div>
              <h3>{customer.name || "Unnamed customer"}</h3>
            </div>
          </div>
          <span className={`crm-pill is-${customer.segment}`}>{getSegmentLabel(customer.segment)}</span>
        </div>

        <div className="crm-contact-row">
          <span>{customer.phone || "No phone"}</span>
          <span>{customer.email || "No email"}</span>
        </div>

        <div className="crm-customer-stats">
          <div>
            <span>Orders</span>
            <strong>{customer.orders}</strong>
          </div>
          <div>
            <span>Bookings</span>
            <strong>{customer.bookings}</strong>
          </div>
          <div>
            <span>Last</span>
            <strong>{getTouchLabel(customer.daysSince)}</strong>
          </div>
        </div>
      </button>

      <CustomerArchiveButton
        customer={customer}
        onArchive={onArchive}
        isRemoving={isRemoving}
        className="crm-item-remove"
      />
    </article>
  );
}

export function CustomerKanbanCard({
  customer,
  onOpen,
  onArchive,
  isRemoving,
  isDragging,
  isMoving,
  onDragStart,
  onDragEnd,
}) {
  return (
    <article
      className={`bubble-card crm-card crm-card--compact crm-kanban-card ${
        isDragging ? "is-dragging" : ""
      } ${isMoving ? "is-moving" : ""}`}
      draggable={!isRemoving && !isMoving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="crm-card-open crm-kanban-card-open"
        onClick={() => onOpen(customer)}
        aria-label={`Open ${customer.name || "customer"}`}
      >
        <div className="crm-card-top">
          <div className="crm-profile">
            <div>
              <h4>{customer.name || "Unnamed customer"}</h4>
            </div>
          </div>
        </div>

        <div className="crm-metrics">
          <div>
            <span>Orders</span>
            <strong>{customer.orders}</strong>
          </div>
          <div>
            <span>Bookings</span>
            <strong>{customer.bookings}</strong>
          </div>
          <div>
            <span>Last</span>
            <strong>{getTouchLabel(customer.daysSince)}</strong>
          </div>
        </div>
      </button>

      <CustomerArchiveButton
        customer={customer}
        onArchive={onArchive}
        isRemoving={isRemoving}
        className="crm-item-remove crm-item-remove--kanban"
      />
    </article>
  );
}

export function CustomerListTable({ customers, onOpen, onArchive, removingCustomerId }) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(customers.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedCustomers = useMemo(() => {
    const start = clampedPage * pageSize;
    return customers.slice(start, start + pageSize);
  }, [customers, clampedPage]);
  const ordersTotal = paginatedCustomers.reduce((sum, customer) => sum + Number(customer.orders || 0), 0);
  const bookingsTotal = paginatedCustomers.reduce((sum, customer) => sum + Number(customer.bookings || 0), 0);
  const renderPagination = (header = false) => (
    <TablePagination
      total={customers.length}
      pageIndex={clampedPage}
      pageSize={pageSize}
      pageCount={pageCount}
      onPrevious={() => setPage((p) => Math.max(0, p - 1))}
      onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
      header={header}
    />
  );

  useEffect(() => {
    setPage(0);
  }, [customers.length]);

  return (
    <section className="admin-table crm-list-table" aria-label="Customer list">
      {renderPagination(true)}
      <div className="admin-table-scroll crm-list-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="table-row-index">#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Orders</th>
              <th>Bookings</th>
              <th>Last</th>
              <th>Status</th>
              <th>Archive</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.map((customer, index) => (
              <tr
                key={customer.id}
                onClick={() => onOpen(customer)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(customer);
                  }
                }}
              >
                <td className="table-row-index">{clampedPage * pageSize + index}</td>
                <td>
                  <div className="admin-product crm-table-name">
                    <span className="admin-product-name">{customer.name || "Unnamed customer"}</span>
                  </div>
                </td>
                <td>
                  <div className="inventory-table-category crm-table-contact">
                    <span>{customer.phone || "-"}</span>
                  </div>
                </td>
                <td>
                  <div className="inventory-table-category crm-table-contact">
                    <span>{customer.email || "-"}</span>
                  </div>
                </td>
                <td>
                  <div className="inventory-table-value crm-table-value">
                    <strong>{customer.orders}</strong>
                  </div>
                </td>
                <td>
                  <div className="inventory-table-value crm-table-value">
                    <strong>{customer.bookings}</strong>
                  </div>
                </td>
                <td>
                  <div className="inventory-table-updated crm-table-updated">
                    <span>{getTouchLabel(customer.daysSince)}</span>
                  </div>
                </td>
                <td>
                  <div className="inventory-table-category crm-table-segment">
                    <span className={`crm-pill is-${customer.segment}`}>
                      {getSegmentLabel(customer.segment)}
                    </span>
                  </div>
                </td>
                <td className="crm-table-action">
                  <CustomerArchiveButton
                    customer={customer}
                    onArchive={onArchive}
                    isRemoving={removingCustomerId === customer.id}
                    className="crm-item-remove crm-item-remove--inline"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          {customers.length > 0 && (
            <tfoot className="admin-table-footer">
              <tr>
                <td className="admin-table-summary-cell is-count" colSpan={4}>
                  <span className="admin-table-summary-value">{paginatedCustomers.length} customers</span>
                </td>
                <td className="admin-table-summary-cell">
                  <span className="admin-table-summary-value">{ordersTotal}</span>
                </td>
                <td className="admin-table-summary-cell">
                  <span className="admin-table-summary-value">{bookingsTotal}</span>
                </td>
                <td className="admin-table-summary-cell is-empty" colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
        {renderPagination()}
      </div>
    </section>
  );
}
