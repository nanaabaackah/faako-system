import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBoxesStacked,
  faMinus,
  faMoneyCheckDollar,
  faPlus,
} from "/src/icons/iconSet";

export default function WaterOperationsGrid({
  expenseCategoryOptions,
  customExpenseCategory,
  expenseQuickAmounts,
  expenseForm,
  setExpenseForm,
  expenseAmountValue,
  setExpenseAmountValue,
  adjustExpenseAmount,
  expenseSummaryLabel,
  expenseSummaryAmount,
  onExpenseSubmit,
  adjustmentQuickQuantities,
  adjustmentForm,
  setAdjustmentForm,
  adjustmentQuantity,
  setAdjustmentQuantityValue,
  adjustAdjustmentQuantity,
  adjustmentReasonOptions,
  adjustmentReasonOptionsByMode,
  customAdjustmentReason,
  adjustmentHasCustomReason,
  adjustmentSummaryLabel,
  onAdjustmentSubmit,
  formatCurrency,
  saving,
  loading,
}) {
  return (
    <section className="water-module-grid">
      <article className="admin-card water-module-card">
        <div className="water-module-card-head">
          <div>
            <h3>Expenses</h3>
          </div>
        </div>
        <form className="water-module-form" onSubmit={onExpenseSubmit}>
          <div className="water-module-sale-block">
            <div className="water-module-inline-head">
              <span className="water-module-field-label">Category</span>
            </div>
            <div className="water-module-quick-actions">
              {expenseCategoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`water-module-quick-btn ${expenseForm.category === category ? "is-active" : ""}`}
                  onClick={() =>
                    setExpenseForm((prev) => ({
                      ...prev,
                      category,
                      customCategory: "",
                    }))
                  }
                >
                  {category}
                </button>
              ))}
              <button
                type="button"
                className={`water-module-quick-btn ${
                  expenseForm.category === customExpenseCategory ? "is-active" : ""
                }`}
                onClick={() =>
                  setExpenseForm((prev) => ({
                    ...prev,
                    category: customExpenseCategory,
                  }))
                }
              >
                Other
              </button>
            </div>
            {expenseForm.category === customExpenseCategory ? (
              <label>
                Custom category
                <input
                  type="text"
                  value={expenseForm.customCategory}
                  onChange={(event) =>
                    setExpenseForm((prev) => ({ ...prev, customCategory: event.target.value }))
                  }
                  placeholder="Delivery, airtime, loading fee..."
                  required
                />
              </label>
            ) : null}
          </div>

          <div className="water-module-sale-block">
            <div className="water-module-inline-head">
              <span className="water-module-field-label">Amount</span>
            </div>
            <div className="water-module-quick-actions">
              {expenseQuickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`water-module-quick-btn ${expenseAmountValue === value ? "is-active" : ""}`}
                  onClick={() => setExpenseAmountValue(value)}
                >
                  {formatCurrency(value * 100)}
                </button>
              ))}
            </div>
            <div className="water-module-stepper" aria-label="Expense amount control">
              <button
                type="button"
                className="water-module-stepper-btn"
                onClick={() => adjustExpenseAmount(-1)}
                aria-label="Reduce expense amount"
              >
                <AppIcon icon={faMinus} />
              </button>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={expenseForm.amount}
                onChange={(event) => setExpenseAmountValue(event.target.value)}
                required
              />
              <button
                type="button"
                className="water-module-stepper-btn"
                onClick={() => adjustExpenseAmount(1)}
                aria-label="Increase expense amount"
              >
                <AppIcon icon={faPlus} />
              </button>
            </div>
          </div>

          <div className="water-module-inline-summary">
            <span>{expenseSummaryLabel}</span>
            <strong>{formatCurrency(expenseSummaryAmount)}</strong>
          </div>

          <button type="submit" className="admin-primary water-module-sale-submit" disabled={saving || loading}>
            <AppIcon icon={faMoneyCheckDollar} /> {saving ? "Saving..." : `Log ${formatCurrency(expenseSummaryAmount)}`}
          </button>
        </form>
      </article>

      <article className="admin-card water-module-card">
        <div className="water-module-card-head">
          <div>
            <h3>Correction</h3>
          </div>
        </div>
        <form className="water-module-form" onSubmit={onAdjustmentSubmit}>
          <div className="water-module-adjustment-block">
            <div className="water-module-toggle-row" role="radiogroup" aria-label="Correction type">
              <button
                type="button"
                className={`water-module-toggle-btn ${
                  adjustmentForm.mode === "remove" ? "is-active is-danger" : ""
                }`}
                onClick={() =>
                  setAdjustmentForm((prev) => ({
                    ...prev,
                    mode: "remove",
                    reason:
                      prev.reason === customAdjustmentReason ||
                      adjustmentReasonOptionsByMode.remove.includes(prev.reason)
                        ? prev.reason
                        : "",
                  }))
                }
                aria-pressed={adjustmentForm.mode === "remove"}
              >
                Remove
              </button>
              <button
                type="button"
                className={`water-module-toggle-btn ${
                  adjustmentForm.mode === "add" ? "is-active is-success" : ""
                }`}
                onClick={() =>
                  setAdjustmentForm((prev) => ({
                    ...prev,
                    mode: "add",
                    reason:
                      prev.reason === customAdjustmentReason ||
                      adjustmentReasonOptionsByMode.add.includes(prev.reason)
                        ? prev.reason
                        : "",
                  }))
                }
                aria-pressed={adjustmentForm.mode === "add"}
              >
                Add back
              </button>
            </div>
          </div>

          <div className="water-module-adjustment-block">
            <div className="water-module-inline-head">
              <span className="water-module-field-label">Quantity</span>
            </div>
            <div className="water-module-quick-actions">
              {adjustmentQuickQuantities.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`water-module-quick-btn ${adjustmentQuantity === value ? "is-active" : ""}`}
                  onClick={() => setAdjustmentQuantityValue(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="water-module-stepper" aria-label="Correction quantity control">
              <button
                type="button"
                className="water-module-stepper-btn"
                onClick={() => adjustAdjustmentQuantity(-1)}
                aria-label="Reduce correction quantity"
              >
                <AppIcon icon={faMinus} />
              </button>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={adjustmentForm.quantityDelta}
                onChange={(event) => setAdjustmentQuantityValue(event.target.value)}
                required
              />
              <button
                type="button"
                className="water-module-stepper-btn"
                onClick={() => adjustAdjustmentQuantity(1)}
                aria-label="Increase correction quantity"
              >
                <AppIcon icon={faPlus} />
              </button>
            </div>
          </div>

          <div className="water-module-adjustment-block">
            <div className="water-module-inline-head">
              <span className="water-module-field-label">Reason</span>
            </div>
            <div className="water-module-quick-actions">
              {adjustmentReasonOptions.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={`water-module-quick-btn ${adjustmentForm.reason === reason ? "is-active" : ""}`}
                  onClick={() => setAdjustmentForm((prev) => ({ ...prev, reason }))}
                >
                  {reason}
                </button>
              ))}
              <button
                type="button"
                className={`water-module-quick-btn ${
                  adjustmentForm.reason === customAdjustmentReason ? "is-active" : ""
                }`}
                onClick={() =>
                  setAdjustmentForm((prev) => ({
                    ...prev,
                    reason: customAdjustmentReason,
                  }))
                }
              >
                Other
              </button>
            </div>
            {adjustmentHasCustomReason ? (
              <label>
                Custom reason
                <input
                  type="text"
                  value={adjustmentForm.customReason}
                  onChange={(event) =>
                    setAdjustmentForm((prev) => ({ ...prev, customReason: event.target.value }))
                  }
                  placeholder="Breakage, count fix, returned packs..."
                  required
                />
              </label>
            ) : null}
          </div>

          <div className="water-module-inline-summary">
            <span>{adjustmentForm.mode === "add" ? "Stock increase" : "Stock decrease"}</span>
            <strong>{adjustmentSummaryLabel}</strong>
          </div>

          <button type="submit" className="admin-primary water-module-sale-submit" disabled={saving || loading}>
            <AppIcon icon={faBoxesStacked} /> {saving ? "Saving..." : "Save correction"}
          </button>
        </form>
      </article>
    </section>
  );
}
