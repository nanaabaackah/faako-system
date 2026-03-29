import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBoxesStacked,
  faChartLine,
  faMoneyCheckDollar,
  faReceipt,
  faStore,
} from "/src/icons/iconSet";

export default function WaterKpiGrid({
  summary,
  salesCount,
  unpaidOrderCount,
  totalCreditCount,
  formatCurrency,
}) {
  return (
    <section className="water-module-kpis">
      <article className="water-module-kpi bubble-card">
        <p className="water-module-kpi-label">In stock</p>
        <div className="water-module-kpi-value">
          <AppIcon icon={faBoxesStacked} />
          <strong>{summary.stockOnHand}</strong>
        </div>
        <span>Value {formatCurrency(summary.inventoryValue)}</span>
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
          <strong>{formatCurrency(summary.revenue)}</strong>
        </div>
        <span>{summary.unitsSold} packs sold</span>
      </article>
      <article className="water-module-kpi bubble-card">
        <p className="water-module-kpi-label">Gross profit</p>
        <div className="water-module-kpi-value">
          <AppIcon icon={faChartLine} />
          <strong>{formatCurrency(summary.grossProfit)}</strong>
        </div>
        <span>After {formatCurrency(summary.costOfGoodsSold)} COGS</span>
      </article>
      <article className="water-module-kpi bubble-card">
        <p className="water-module-kpi-label">Cash position</p>
        <div className="water-module-kpi-value">
          <AppIcon icon={faMoneyCheckDollar} />
          <strong>{formatCurrency(summary.cashPosition)}</strong>
        </div>
        <span>{formatCurrency(summary.cashCollected)} collected</span>
      </article>
      <article className="water-module-kpi bubble-card">
        <p className="water-module-kpi-label">Total credit</p>
        <div className="water-module-kpi-value">
          <AppIcon icon={faMoneyCheckDollar} />
          <strong>{formatCurrency(summary.outstandingCredit)}</strong>
        </div>
        <span>{totalCreditCount} credit orders</span>
      </article>
      <article className="water-module-kpi bubble-card">
        <p className="water-module-kpi-label">Extra expenses</p>
        <div className="water-module-kpi-value">
          <AppIcon icon={faStore} />
          <strong>{formatCurrency(summary.extraExpenses)}</strong>
        </div>
        <span>Net profit {formatCurrency(summary.netProfit)}</span>
      </article>
      <article className="water-module-kpi bubble-card">
        <p className="water-module-kpi-label">Cash</p>
        <div className="water-module-kpi-value">
          <AppIcon icon={faMoneyCheckDollar} />
          <strong>{formatCurrency(summary.cashSalesTotal)}</strong>
        </div>
        <span>{formatCurrency(summary.pendingCash)} pending</span>
      </article>
      <article className="water-module-kpi bubble-card">
        <p className="water-module-kpi-label">MoMo</p>
        <div className="water-module-kpi-value">
          <AppIcon icon={faMoneyCheckDollar} />
          <strong>{formatCurrency(summary.momoSalesTotal)}</strong>
        </div>
        <span>{formatCurrency(summary.pendingMomo)} pending</span>
      </article>
    </section>
  );
}
