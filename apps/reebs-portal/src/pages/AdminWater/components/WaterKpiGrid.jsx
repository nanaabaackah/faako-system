import { SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBoxesStacked,
  faChartLine,
  faMoneyCheckDollar,
  faReceipt,
  faStore,
} from "/src/icons/iconSet";

export default function WaterKpiGrid({
  liveSummary,
  trackingSummary,
  salesCount,
  unpaidOrderCount,
  totalCreditCount,
  stockPeriodFilter,
  setStockPeriodFilter,
  stockPeriodOptions,
  stockPeriodDetail,
  formatCurrency,
}) {
  return (
    <section className="water-module-kpi-stack">
      <div className="water-module-kpi-toolbar">
        <div className="water-module-kpi-toolbar-copy">
          <p className="water-module-kpi-label">Stock period</p>
          <span>{stockPeriodDetail}</span>
        </div>
        <SelectField
          ariaLabel="Select water stock period"
          fieldClassName="water-module-stock-period-field"
          value={stockPeriodFilter}
          onChange={(event) => setStockPeriodFilter(String(event.target.value))}
        >
          {stockPeriodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      <section className="water-module-kpis">
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">In stock</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faBoxesStacked} />
            <strong>{liveSummary.stockOnHand}</strong>
          </div>
          <span>Live value {formatCurrency(liveSummary.inventoryValue)}</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Orders</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faReceipt} />
            <strong>{salesCount}</strong>
          </div>
          <span>{unpaidOrderCount} open</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Revenue</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faReceipt} />
            <strong>{formatCurrency(trackingSummary.revenue)}</strong>
          </div>
          <span>{trackingSummary.unitsSold} packs sold</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Gross profit</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faChartLine} />
            <strong>{formatCurrency(trackingSummary.grossProfit)}</strong>
          </div>
          <span>After {formatCurrency(trackingSummary.costOfGoodsSold)} COGS</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Cash position</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faMoneyCheckDollar} />
            <strong>{formatCurrency(trackingSummary.cashPosition)}</strong>
          </div>
          <span>{formatCurrency(trackingSummary.cashCollected)} collected</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Total credit</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faMoneyCheckDollar} />
            <strong>{formatCurrency(trackingSummary.outstandingCredit)}</strong>
          </div>
          <span>{totalCreditCount} credit orders</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Extra expenses</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faStore} />
            <strong>{formatCurrency(trackingSummary.extraExpenses)}</strong>
          </div>
          <span>Net profit {formatCurrency(trackingSummary.netProfit)}</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Cash</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faMoneyCheckDollar} />
            <strong>{formatCurrency(trackingSummary.cashSalesTotal)}</strong>
          </div>
          <span>{formatCurrency(trackingSummary.pendingCash)} pending</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">MoMo</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faMoneyCheckDollar} />
            <strong>{formatCurrency(trackingSummary.momoSalesTotal)}</strong>
          </div>
          <span>{formatCurrency(trackingSummary.pendingMomo)} pending</span>
        </article>
      </section>
    </section>
  );
}
