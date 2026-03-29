import React from "react";
import { formatMoney } from "../crmShared";
import {
  CustomerKanbanCard,
  CustomerListTable,
  CustomerResultCard,
} from "./CustomerResultViews";

export default function CustomerResultsSection({
  activeViewMode,
  visibleCustomers,
  kanbanColumns,
  dragOverSegment,
  onKanbanDragOver,
  onKanbanDragLeave,
  onKanbanDrop,
  onOpenDetail,
  onArchiveCustomer,
  removingCustomerId,
  draggedCustomerId,
  movingCustomerId,
  onKanbanDragStart,
  onKanbanDragEnd,
  searchTerm,
}) {
  if (!visibleCustomers.length) {
    return (
      <div className="glass-card crm-empty-state">
        <h3>No customers</h3>
        <p>{searchTerm ? "Try a different search." : "Create the first customer record."}</p>
      </div>
    );
  }

  if (activeViewMode === "kanban") {
    return (
      <section className="crm-board" aria-label="Customer kanban">
        {kanbanColumns.map((column) => (
          <article
            key={column.key}
            className={`crm-column ${dragOverSegment === column.key ? "is-drop-target" : ""}`}
            onDragOver={onKanbanDragOver(column.key)}
            onDragLeave={onKanbanDragLeave(column.key)}
            onDrop={onKanbanDrop(column.key)}
          >
            <div className="crm-column-head">
              <div>
                <h3>{column.label}</h3>
                <p className="crm-column-meta">{formatMoney(column.totalValue)}</p>
              </div>
              <span className="crm-column-count">{column.items.length}</span>
            </div>
            <div className="crm-column-list">
              {column.items.length ? (
                column.items.map((customer) => (
                  <CustomerKanbanCard
                    key={customer.id}
                    customer={customer}
                    onOpen={onOpenDetail}
                    onArchive={onArchiveCustomer}
                    isRemoving={removingCustomerId === customer.id}
                    isDragging={draggedCustomerId === customer.id}
                    isMoving={movingCustomerId === customer.id}
                    onDragStart={onKanbanDragStart(customer)}
                    onDragEnd={onKanbanDragEnd}
                  />
                ))
              ) : (
                <p className="crm-muted crm-column-empty">No customers</p>
              )}
            </div>
          </article>
        ))}
      </section>
    );
  }

  if (activeViewMode === "list") {
    return (
      <CustomerListTable
        customers={visibleCustomers}
        onOpen={onOpenDetail}
        onArchive={onArchiveCustomer}
        removingCustomerId={removingCustomerId}
      />
    );
  }

  return (
    <section className="crm-customer-grid is-card" aria-label="Customer cards">
      {visibleCustomers.map((customer) => (
        <CustomerResultCard
          key={customer.id}
          customer={customer}
          onOpen={onOpenDetail}
          onArchive={onArchiveCustomer}
          isRemoving={removingCustomerId === customer.id}
        />
      ))}
    </section>
  );
}
