import SearchField from "../../../components/SearchField/SearchField";
import { AppIcon } from "/src/components/Icon/Icon";
import { faRotateRight, faTrash } from "/src/icons/iconSet";

export default function WaterLedgersSection({
  loading,
  saving,
  filteredSales,
  sales,
  orderQuery,
  setOrderQuery,
  orderStatusFilter,
  setOrderStatusFilter,
  orderStatusOptions,
  activeOrderId,
  openOrderEditor,
  handleOrderDelete,
  formatDate,
  formatCurrency,
  normalizeSalePaymentStatus,
  getSalePaymentStatusLabel,
  stockTimeline,
  netMovement,
  activeLedgerItem,
  openStockEntryEditor,
  handleStockEntryUndo,
  expenses,
  openExpenseEditor,
  handleExpenseDelete,
}) {
  const orderSummary = filteredSales.reduce(
    (accumulator, sale) => {
      accumulator.count += 1;
      accumulator.quantity += Number(sale.quantity) || 0;
      accumulator.price += Number(sale.unitPrice) || 0;
      accumulator.total += Number(sale.totalAmount) || 0;
      return accumulator;
    },
    { count: 0, quantity: 0, price: 0, total: 0 }
  );
  const stockSummary = stockTimeline.reduce(
    (accumulator, entry) => {
      accumulator.count += 1;
      accumulator.quantity += Number(entry.quantity) || 0;
      accumulator.value += entry.amount === null ? 0 : Number(entry.amount) || 0;
      return accumulator;
    },
    { count: 0, quantity: 0, value: 0 }
  );
  const expenseSummary = expenses.reduce(
    (accumulator, expense) => {
      accumulator.count += 1;
      accumulator.amount += Number(expense.amount) || 0;
      return accumulator;
    },
    { count: 0, amount: 0 }
  );

  return (
    <section className="water-module-ledgers">
      <article className="admin-card water-module-table-card water-module-table-card--orders">
        <div className="water-module-card-head">
          <div>
            <h3>Orders</h3>
          </div>
          <span className="water-module-card-tag">
            {filteredSales.length}/{sales.length}
          </span>
        </div>
        {loading ? (
          <p className="water-module-empty">Loading orders...</p>
        ) : sales.length ? (
          <>
            <div className="water-module-orders-toolbar">
              <SearchField
                value={orderQuery}
                onChange={(event) => setOrderQuery(event.target.value)}
                onClear={() => setOrderQuery("")}
                placeholder="Search customer, phone, order #"
                aria-label="Search orders"
                className="water-module-orders-search"
              />
              <div className="water-module-status-filters" aria-label="Order status filters">
                {orderStatusOptions.map((option) => {
                  const isActive = orderStatusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`water-module-status-filter ${isActive ? "is-active" : ""}`}
                      onClick={() => setOrderStatusFilter(option.value)}
                      aria-pressed={isActive}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredSales.length ? (
              <div className="water-module-table-wrap">
                <table className="water-module-table water-module-table--orders">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale, index) => {
                      const paymentStatus = normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod);
                      const isActive = Number(activeOrderId) === Number(sale.id);
                      return (
                        <tr
                          key={sale.id}
                          className={`water-module-order-row ${isActive ? "is-active" : ""}`}
                          onClick={() => openOrderEditor(sale)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openOrderEditor(sale);
                            }
                          }}
                          tabIndex={0}
                          aria-label={`Edit water order ${sale.id}`}
                        >
                          <td data-label="#">{index}</td>
                          <td data-label="Date">{formatDate(sale.date)}</td>
                          <td data-label="Customer">
                            <div className="water-module-order-primary">
                              <strong>{sale.customerName || "Walk-in"}</strong>
                            </div>
                          </td>
                          <td data-label="Status">
                            <div className="water-module-order-status">
                              <span className={`water-module-order-pill is-${paymentStatus}`}>
                                {getSalePaymentStatusLabel(sale.paymentStatus, sale.paymentMethod)}
                              </span>
                            </div>
                          </td>
                          <td data-label="Qty">{Number(sale.quantity) || 0}</td>
                          <td data-label="Price">{formatCurrency(sale.unitPrice)}</td>
                          <td data-label="Total">
                            <div className="water-module-order-total">
                              <strong>{formatCurrency(sale.totalAmount)}</strong>
                            </div>
                          </td>
                          <td className="water-module-order-actions" data-label="Action">
                            <button
                              type="button"
                              className="water-module-row-delete"
                              onClick={(event) => handleOrderDelete(sale, event)}
                              onKeyDown={(event) => event.stopPropagation()}
                              aria-label={`Archive water order ${sale.id}`}
                              disabled={saving || loading}
                            >
                              <AppIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="admin-table-footer">
                    <tr>
                      <td className="admin-table-summary-cell is-count">
                        <span className="admin-table-summary-value">{orderSummary.count} orders</span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">{orderSummary.quantity}</span>
                      </td>
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          {formatCurrency(orderSummary.count ? orderSummary.price / orderSummary.count : 0)}
                        </span>
                      </td>
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">{formatCurrency(orderSummary.total)}</span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="water-module-empty">No orders match this filter.</p>
            )}
          </>
        ) : (
          <p className="water-module-empty">No orders yet.</p>
        )}
      </article>

      <article className="admin-card water-module-table-card">
        <div className="water-module-card-head">
          <div>
            <h3>Stock Movement</h3>
          </div>
          <span className="water-module-card-tag">Net movement {netMovement}</span>
        </div>
        {loading ? (
          <p className="water-module-empty">Loading stock history...</p>
        ) : stockTimeline.length ? (
          <div className="water-module-table-wrap water-module-table-wrap--stock">
            <table className="water-module-table water-module-table--stock">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Qty</th>
                  <th>Value</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {stockTimeline.map((entry, index) => {
                  const isActive =
                    activeLedgerItem?.type === entry.type &&
                    Number(activeLedgerItem?.id) === Number(entry.sourceId);
                  return (
                    <tr
                      key={entry.id}
                      className={`water-module-click-row ${isActive ? "is-active" : ""}`}
                      onClick={() => openStockEntryEditor(entry)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openStockEntryEditor(entry);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Edit ${entry.label.toLowerCase()} ${entry.sourceId || ""}`}
                    >
                      <td data-label="#">{index}</td>
                      <td data-label="Date">{formatDate(entry.date)}</td>
                      <td data-label="Type">{entry.label}</td>
                      <td data-label="Details">{entry.detail}</td>
                      <td data-label="Qty" className={entry.quantity < 0 ? "is-negative" : "is-positive"}>
                        {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                      </td>
                      <td data-label="Value">{entry.amount === null ? "—" : formatCurrency(entry.amount)}</td>
                      <td className="water-module-order-actions">
                        <button
                          type="button"
                          className="water-module-row-undo"
                          onClick={(event) => handleStockEntryUndo(entry, event)}
                          onKeyDown={(event) => event.stopPropagation()}
                          aria-label={`Undo ${entry.label.toLowerCase()} ${entry.sourceId || ""}`}
                          disabled={saving || loading}
                        >
                          <AppIcon icon={faRotateRight} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="admin-table-footer">
                <tr>
                  <td className="admin-table-summary-cell is-count">
                    <span className="admin-table-summary-value">{stockSummary.count} entries</span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">
                      {stockSummary.quantity > 0 ? `+${stockSummary.quantity}` : stockSummary.quantity}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">{formatCurrency(stockSummary.value)}</span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="water-module-empty">No stock movement recorded yet.</p>
        )}
      </article>

      <article className="admin-card water-module-table-card">
        <div className="water-module-card-head">
          <div>
            <h3>Expenses</h3>
          </div>
        </div>
        {loading ? (
          <p className="water-module-empty">Loading expenses...</p>
        ) : expenses.length ? (
          <div className="water-module-table-wrap">
            <table className="water-module-table water-module-table--expenses">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense, index) => {
                  const isActive =
                    activeLedgerItem?.type === "expense" &&
                    Number(activeLedgerItem?.id) === Number(expense.id);
                  return (
                    <tr
                      key={expense.id}
                      className={`water-module-click-row ${isActive ? "is-active" : ""}`}
                      onClick={() => openExpenseEditor(expense)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openExpenseEditor(expense);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Edit water expense ${expense.id}`}
                    >
                      <td data-label="#">{index}</td>
                      <td data-label="Date">{formatDate(expense.date)}</td>
                      <td data-label="Category">{expense.category}</td>
                      <td data-label="Details">{expense.description}</td>
                      <td data-label="Amount">{formatCurrency(expense.amount)}</td>
                      <td className="water-module-order-actions" data-label="Action">
                        <button
                          type="button"
                          className="water-module-row-delete"
                          onClick={(event) => handleExpenseDelete(expense, event)}
                          onKeyDown={(event) => event.stopPropagation()}
                          aria-label={`Archive water expense ${expense.id}`}
                          disabled={saving || loading}
                        >
                          <AppIcon icon={faTrash} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="admin-table-footer">
                <tr>
                  <td className="admin-table-summary-cell is-count">
                    <span className="admin-table-summary-value">{expenseSummary.count} expenses</span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">{formatCurrency(expenseSummary.amount)}</span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="water-module-empty">No extra expenses logged yet.</p>
        )}
      </article>
    </section>
  );
}
