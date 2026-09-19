import React from "react";
import CustomerArchiveButton from "./CustomerArchiveButton";
import { getSegmentLabel, getTouchLabel } from "../crmShared";

export function CustomerResultCard({ customer, onOpen, onArchive, isRemoving, canMutateCustomers }) {
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
              <p>{customer.reference || "No reference"}{customer.contactPersonName ? ` · ${customer.contactPersonName}` : ""}</p>
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

      {canMutateCustomers ? (
        <CustomerArchiveButton
          customer={customer}
          onArchive={onArchive}
          isRemoving={isRemoving}
          className="crm-item-remove"
        />
      ) : null}
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
  canMutateCustomers,
}) {
  return (
    <article
      className={`bubble-card crm-card crm-card--compact crm-kanban-card ${
        isDragging ? "is-dragging" : ""
      } ${isMoving ? "is-moving" : ""}`}
      draggable={canMutateCustomers && !isRemoving && !isMoving}
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
              <p>{customer.reference || (customer.customerType === "organization" ? "Organization" : "Individual")}</p>
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

      {canMutateCustomers ? (
        <CustomerArchiveButton
          customer={customer}
          onArchive={onArchive}
          isRemoving={isRemoving}
          className="crm-item-remove crm-item-remove--kanban"
        />
      ) : null}
    </article>
  );
}

export function CustomerListTable({ customers, onOpen, onArchive, removingCustomerId, canMutateCustomers }) {
  const ordersTotal = customers.reduce((sum, customer) => sum + Number(customer.orders || 0), 0);
  const bookingsTotal = customers.reduce((sum, customer) => sum + Number(customer.bookings || 0), 0);

  return (
    <section className="admin-table crm-list-table" aria-label="Customer list">
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
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => (
              <tr key={customer.id}>
                <td className="table-row-index">{index + 1}</td>
                <td>
                  <button
                    type="button"
                    className="admin-product crm-table-name crm-table-open"
                    onClick={() => onOpen(customer)}
                    aria-label={`Open ${customer.name || "customer"}`}
                  >
                    <span className="admin-product-name">{customer.name || "Unnamed customer"}</span>
                    <small>{customer.reference || "No reference"}{customer.contactPersonName ? ` · ${customer.contactPersonName}` : ""}</small>
                  </button>
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
                  {canMutateCustomers ? (
                    <CustomerArchiveButton
                      customer={customer}
                      onArchive={onArchive}
                      isRemoving={removingCustomerId === customer.id}
                      className="crm-item-remove crm-item-remove--inline"
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          {customers.length > 0 && (
            <tfoot className="admin-table-footer">
              <tr>
                <td className="admin-table-summary-cell is-count" colSpan={4}>
                  <span className="admin-table-summary-value">{customers.length} customers</span>
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
      </div>
    </section>
  );
}
