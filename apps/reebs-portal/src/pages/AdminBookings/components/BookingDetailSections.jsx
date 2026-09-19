import React from "react";
import { DateField, ERPFormNotice, SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import SearchField from "/src/components/SearchField/SearchField";
import { faPlus } from "/src/icons/iconSet";

export const BookingRentalItemsSection = React.memo(function BookingRentalItemsSection({
  booking,
  canInlineEdit,
  editableItems,
  detailItems,
  productMap,
  productQuery,
  setProductQuery,
  saving,
  filteredProducts,
  listVariants,
  productIsVariantParent,
  availableForVariant,
  addItem,
  formatVariant,
  formItems,
  buildLineKey,
  updateItemPrice,
  updateItemQuantity,
  removeItem,
  form,
  setForm,
  formatBookingCurrency,
  bookingTotalCents,
  formatAttendantsNeeded,
}) {
  return (
    <section className="glass-card bookings-detail-section">
      <div className="bookings-detail-section-head">
        <h3>Rental items</h3>
        <span>{editableItems.length}</span>
      </div>
      {canInlineEdit ? (
        <div className="bookings-detail-items-editor">
          <label className="bookings-expense-field">
            <span>Add items</span>
            <SearchField
              value={productQuery}
              onChange={(event) => setProductQuery?.(event.target.value)}
              onClear={() => setProductQuery?.("")}
              placeholder="Search rentals"
              aria-label="Search rentals"
              disabled={saving}
            />
          </label>
          <div className="booking-items-picker">
            <div className="booking-items-list">
              {filteredProducts.slice(0, 10).map((product) => {
                const variants = listVariants(product).filter(
                  (variant) => String(variant.status || "active") === "active"
                );
                if (productIsVariantParent(product)) {
                  return (
                    <div key={product.id} className="booking-item-add booking-item-add--variants">
                      <strong>{product.name}</strong>
                      <div className="booking-item-variant-buttons">
                        {variants.map((variant) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => addItem?.(product, variant)}
                            disabled={saving || availableForVariant(variant) <= 0}
                          >
                            {formatVariant(product, variant).replace(`${product.name} / `, "")}
                            <small>{availableForVariant(variant)} left</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="booking-item-add"
                    onClick={() => addItem?.(product)}
                    disabled={saving}
                  >
                    {product.name}
                  </button>
                );
              })}
            </div>

            {formItems.length > 0 ? (
              <div className="booking-items-selected">
                {formItems.map((item) => {
                  const product = productMap.get(Number(item.productId));
                  const lineKey = buildLineKey(item.productId, item.variantId);
                  const itemName = item.variantLabel || item.productName || product?.name || `Product ${item.productId}`;
                  return (
                    <div key={lineKey} className="booking-item-row">
                      <span>{itemName}</span>
                      <div className="booking-item-controls">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price ?? ""}
                          onChange={(event) => updateItemPrice?.(lineKey, event.target.value)}
                          placeholder={product?.price ? (product.price / 100).toFixed(2) : "0.00"}
                          aria-label="Override price"
                          disabled={saving}
                        />
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) => updateItemQuantity?.(lineKey, event.target.value)}
                          aria-label="Quantity"
                          disabled={saving}
                        />
                        <button type="button" onClick={() => removeItem?.(lineKey)} disabled={saving}>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="booking-item-total">
                  <div className="booking-item-total-left">
                    <span>Discount</span>
                    <div className="booking-discount-input">
                      <SelectField
                        value={form.discountType}
                        onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
                        ariaLabel="Discount type"
                        disabled={saving}
                      >
                        <option value="amount">Amount</option>
                        <option value="percent">Percent</option>
                      </SelectField>
                      <input
                        type="number"
                        min="0"
                        step={form.discountType === "percent" ? "1" : "0.01"}
                        value={form.discount}
                        onChange={(event) => setForm((prev) => ({ ...prev, discount: event.target.value }))}
                        placeholder={form.discountType === "percent" ? "0" : "0.00"}
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="booking-item-total-right">
                    <span>Total</span>
                    <strong>{formatBookingCurrency(bookingTotalCents / 100)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p className="bookings-muted">No rental items selected.</p>
            )}
          </div>
        </div>
      ) : detailItems.length > 0 ? (
        <ul className="booking-detail-list">
          {detailItems.map((item) => {
            const product = productMap.get(Number(item.productId));
            const productName = item.variantLabel || item.productName || product?.name || `Product ${item.productId}`;
            const imageSrc = item.productImage || product?.imageUrl || product?.image || "";
            return (
              <li key={item._key || `${booking.id}-${item.productId}`}>
                <div className="booking-detail-item">
                  {imageSrc ? (
                    <img className="booking-detail-item-image" src={imageSrc} alt={productName} loading="lazy" />
                  ) : (
                    <div className="booking-detail-item-fallback" aria-hidden="true">
                      {productName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="bookings-cell-stack bookings-cell-stack--primary">
                    <strong>{productName}</strong>
                    <span>{formatAttendantsNeeded(product?.attendantsNeeded)}</span>
                  </div>
                </div>
                <div className="booking-detail-metrics">
                  <strong>{formatBookingCurrency(Number(item.lineTotal ?? item.price * item.quantity) / 100)}</strong>
                  <span>{item.quantity} × {formatBookingCurrency(Number(item.price || 0) / 100)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bookings-muted">No items listed.</p>
      )}
    </section>
  );
});

export const BookingPricingSection = React.memo(function BookingPricingSection({
  booking,
  canInlineEdit,
  bookingTotalCents,
  detailExpenseTotal,
  formatBookingCurrency,
  formatMoney,
}) {
  const bookingTotal = canInlineEdit ? bookingTotalCents / 100 : Number(booking?.totalAmount || 0) / 100;
  const subtotal = canInlineEdit
    ? bookingTotalCents / 100
    : Number(booking?.subtotalCents ?? booking?.totalAmount ?? 0) / 100;
  const discount = canInlineEdit ? 0 : Number(booking?.discountCents || 0) / 100;
  const fees = canInlineEdit ? 0 : Number(booking?.feeCents || 0) / 100;
  const tax = canInlineEdit ? 0 : Number(booking?.taxCents || 0) / 100;
  const deposit = Number(booking?.depositRequiredCents || 0) / 100;

  return (
    <section className="glass-card bookings-detail-section bookings-detail-combined-total">
      <div className="bookings-detail-section-head"><h3>Pricing</h3></div>
      <div className="bookings-detail-summary-breakdown">
        <div><span>Rental subtotal</span><strong>{formatBookingCurrency(subtotal)}</strong></div>
        {discount > 0 ? <div><span>Discount</span><strong>- {formatBookingCurrency(discount)}</strong></div> : null}
        {fees > 0 ? <div><span>Service fees</span><strong>{formatBookingCurrency(fees)}</strong></div> : null}
        {tax > 0 ? <div><span>Tax</span><strong>{formatBookingCurrency(tax)}</strong></div> : null}
        <div className="bookings-detail-summary-total">
          <span>Booking total</span><strong>{formatBookingCurrency(bookingTotal)}</strong>
        </div>
        {deposit > 0 ? <div><span>Deposit required</span><strong>{formatBookingCurrency(deposit)}</strong></div> : null}
        <div>
          <span>Linked operating expenses</span>
          <strong>{formatMoney(detailExpenseTotal || 0, booking?.currency || "GHS")}</strong>
        </div>
      </div>
    </section>
  );
});

export const BookingExpensesSection = React.memo(function BookingExpensesSection({
  booking,
  detailExpenses,
  detailExpenseTotal,
  detailExpenseDraft,
  setDetailExpenseDraft,
  detailExpenseSaving,
  detailExpenseError,
  setDetailExpenseError,
  detailExpenseSuccess,
  setDetailExpenseSuccess,
  addDetailExpense,
  bookingLocked,
  formatDate,
  formatMoney,
}) {
  const expenseQuery = String(detailExpenseDraft?.query || "").trim().toLowerCase();
  const filteredExpenses = detailExpenses.filter((expense) => {
    if (!expenseQuery) return true;
    return [expense?.description, expense?.name, expense?.item, expense?.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(expenseQuery);
  });

  return (
    <section className="glass-card bookings-detail-section">
      <div className="bookings-detail-section-head">
        <h3>Expenses</h3><span>{formatMoney(detailExpenseTotal, "GHS")}</span>
      </div>
      <form className="bookings-expense-entry" onSubmit={addDetailExpense}>
        <label className="bookings-expense-field bookings-expense-field--search">
          <span>Expense</span>
          <SearchField
            value={detailExpenseDraft?.query || ""}
            onChange={(event) => setDetailExpenseDraft((current) => ({ ...current, query: event.target.value }))}
            onClear={() => setDetailExpenseDraft((current) => ({ ...current, query: "" }))}
            placeholder="Fuel, setup, staff, extras"
            aria-label="Search or add expense"
            disabled={detailExpenseSaving}
          />
        </label>
        <label className="bookings-expense-field bookings-expense-field--amount">
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={detailExpenseDraft?.amount || ""}
            onChange={(event) => setDetailExpenseDraft((current) => ({ ...current, amount: event.target.value }))}
            placeholder="0.00"
            disabled={detailExpenseSaving || bookingLocked}
          />
        </label>
        <DateField
          fieldClassName="bookings-expense-field bookings-expense-field--date"
          label="Date"
          value={detailExpenseDraft?.date || ""}
          onChange={(event) => setDetailExpenseDraft((current) => ({ ...current, date: event.target.value }))}
          disabled={detailExpenseSaving || bookingLocked}
        />
        <button
          type="submit"
          className="bookings-primary"
          disabled={
            bookingLocked
            || detailExpenseSaving
            || !String(detailExpenseDraft?.query || "").trim()
            || !String(detailExpenseDraft?.amount || "").trim()
            || !String(detailExpenseDraft?.date || "").trim()
          }
          title={bookingLocked ? "Completed and cancelled bookings are locked" : "Add expense"}
        >
          {detailExpenseSaving ? "Adding..." : <><AppIcon icon={faPlus} /><span>Add expense</span></>}
        </button>
      </form>
      {bookingLocked ? (
        <p className="bookings-inline-note">Completed and cancelled bookings are locked. Existing expenses remain view-only.</p>
      ) : null}
      {detailExpenseError ? (
        <ERPFormNotice tone="danger" title="Expense not added" onDismiss={() => setDetailExpenseError?.("")}>
          {detailExpenseError}
        </ERPFormNotice>
      ) : null}
      {detailExpenseSuccess ? (
        <ERPFormNotice tone="success" title="Expense added" onDismiss={() => setDetailExpenseSuccess?.("")}>
          {detailExpenseSuccess}
        </ERPFormNotice>
      ) : null}
      {expenseQuery && detailExpenses.length > 0 ? (
        <p className="bookings-inline-note">Showing {filteredExpenses.length} of {detailExpenses.length} linked expenses.</p>
      ) : null}
      {filteredExpenses.length > 0 ? (
        <ul className="bookings-expense-list">
          {filteredExpenses.map((expense) => (
            <li key={expense.id || `${booking.id}-${expense.name}-${expense.amount}`}>
              <div className="bookings-cell-stack bookings-cell-stack--primary">
                <strong>{expense.description || expense.name || expense.item || expense.category || "Expense"}</strong>
                <span>{expense.category || "Expense"} · {formatDate(expense.expenseDate || expense.createdAt || expense.date)}</span>
              </div>
              <div className="booking-detail-metrics">
                <strong>{formatMoney(Number(expense.amount || 0) / 100, "GHS")}</strong>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bookings-muted">
          {detailExpenses.length > 0 && expenseQuery ? "No expenses match this search." : "No expenses linked."}
        </p>
      )}
    </section>
  );
});
