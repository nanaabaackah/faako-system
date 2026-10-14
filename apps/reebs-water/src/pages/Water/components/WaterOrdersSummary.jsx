export default function WaterOrdersSummary({ sales, loading, formatCurrency }) {
  const totals = sales.reduce((sum, sale) => ({
    value: sum.value + Number(sale.totalAmount || 0),
    outstanding: sum.outstanding + Number(sale.balanceDueCents || 0),
    open: sum.open + (Number(sale.balanceDueCents) > 0 ? 1 : 0),
  }), { value: 0, outstanding: 0, open: 0 });
  return <section aria-label="Water order summary" aria-busy={loading}>
    <p className="water-module-inline-note">Selected Water product and stock period · current search and status filters. Order value is not cash received.</p>
    <div className="water-module-kpis">
      {[["Orders", sales.length], ["Order value", formatCurrency(totals.value)],
        ["Outstanding", formatCurrency(totals.outstanding)], ["Open orders", totals.open]].map(([label, value]) => (
        <article key={label} className="water-module-kpi bubble-card">
          <p className="water-module-kpi-label">{label}</p>
          <div className="water-module-kpi-value"><strong>{loading ? "—" : value}</strong></div>
        </article>
      ))}
    </div>
  </section>;
}
