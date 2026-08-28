import { SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBoxesStacked,
  faChartLine,
  faMoneyCheckDollar,
  faReceipt,
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

      <section className="water-module-kpis" aria-label="Water business summary">
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">In stock</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faBoxesStacked} />
            <strong>{liveSummary.stockOnHand}</strong>
          </div>
          <span>Live value {formatCurrency(liveSummary.inventoryValue)}</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Water orders</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faReceipt} />
            <strong>{salesCount}</strong>
          </div>
          <span>{unpaidOrderCount} open</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Water revenue</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faReceipt} />
            <strong>{formatCurrency(trackingSummary.revenue)}</strong>
          </div>
          <span>{trackingSummary.unitsSold} packs sold</span>
        </article>
        <article className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">Water net profit</p>
          <div className="water-module-kpi-value">
            <AppIcon icon={faChartLine} />
            <strong>{formatCurrency(trackingSummary.netProfit)}</strong>
          </div>
          <span>After Water stock costs and extra expenses</span>
        </article>
      </section>

      <section className="water-module-finance-breakdown" aria-labelledby="water-finance-breakdown-title">
        <div className="water-module-finance-breakdown__heading">
          <AppIcon icon={faMoneyCheckDollar} aria-hidden="true" />
          <div>
            <p className="water-module-kpi-label">Water finance detail</p>
            <h2 id="water-finance-breakdown-title">Cash, credit and cost breakdown</h2>
          </div>
        </div>
        <dl>
          <div><dt>Gross profit</dt><dd>{formatCurrency(trackingSummary.grossProfit)}</dd></div>
          <div><dt>Water stock costs</dt><dd>{formatCurrency(trackingSummary.costOfGoodsSold)}</dd></div>
          <div><dt>Extra expenses</dt><dd>{formatCurrency(trackingSummary.extraExpenses)}</dd></div>
          <div><dt>Cash position</dt><dd>{formatCurrency(trackingSummary.cashPosition)}</dd></div>
          <div><dt>Outstanding credit</dt><dd>{formatCurrency(trackingSummary.outstandingCredit)} · {totalCreditCount} orders</dd></div>
          <div><dt>Cash sales</dt><dd>{formatCurrency(trackingSummary.cashSalesTotal)} · {formatCurrency(trackingSummary.pendingCash)} pending</dd></div>
          <div><dt>MoMo sales</dt><dd>{formatCurrency(trackingSummary.momoSalesTotal)} · {formatCurrency(trackingSummary.pendingMomo)} pending</dd></div>
          <div><dt>Collected</dt><dd>{formatCurrency(trackingSummary.cashCollected)}</dd></div>
        </dl>
      </section>
    </section>
  );
}
