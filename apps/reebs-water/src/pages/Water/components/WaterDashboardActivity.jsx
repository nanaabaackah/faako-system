import { Link } from "react-router-dom";
import { ArrowRight2 } from "iconsax-react";
import { AppIcon } from "../../../components/AppIcon.jsx";

export default function WaterDashboardActivity({ sales, summary, product, formatCurrency, formatDate }) {
  const recent = [...sales].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()).slice(0, 5);
  return (
    <section className="water-dashboard-activity" aria-label="Water operations overview">
      <article className="admin-card bubble-card water-dashboard-panel">
        <header><h2>Recent orders</h2><Link className="water-dashboard-open" to="/orders" aria-label="Open Water orders" title="Open Water orders"><AppIcon icon={ArrowRight2} /></Link></header>
        {recent.length ? <ul className="water-dashboard-orders">{recent.map((sale) => <li key={sale.id}>
          <div><strong>{sale.customerName || "Walk-in"}</strong><small>{formatDate(sale.date)} · {Number(sale.quantity) || 0} packs</small></div>
          <strong>{formatCurrency(sale.totalAmount)}</strong>
        </li>)}</ul> : <p>No Water orders in this period.</p>}
      </article>
      <article className="admin-card bubble-card water-dashboard-panel">
        <header><h2>Stock overview</h2><Link className="water-dashboard-open" to="/stock" aria-label="Open Water stock" title="Open Water stock"><AppIcon icon={ArrowRight2} /></Link></header>
        <p>{product.name} · selected stock period</p>
        <dl className="water-dashboard-stock">
          <div><dt>Packs restocked</dt><dd>{summary.unitsRestocked}</dd></div>
          <div><dt>Packs sold</dt><dd>{summary.unitsSold}</dd></div>
          <div><dt>Stock corrections</dt><dd>{summary.adjustmentUnits}</dd></div>
        </dl>
      </article>
    </section>
  );
}
