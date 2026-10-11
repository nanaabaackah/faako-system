import { useMemo, useState } from "react";
import { AddCircle, Refresh } from "iconsax-react";
import SearchField from "../../../components/SearchField.jsx";
import PortalAction from "../../../components/PortalAction.jsx";
import TablePagination from "../../../components/TablePagination.jsx";
import { TableSortHeader, useTableView } from "../../../components/TableControls.jsx";

const accessors = { name: (customer) => customer.name, phone: (customer) => customer.phone };

export default function WaterCustomers({ customers, loading, error, onRetry, canCreate, onCreate, saving, createError }) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const rows = useMemo(() => customers.filter((customer) => `${customer.name || ""} ${customer.phone || ""}`.toLowerCase().includes(query.trim().toLowerCase())), [customers, query]);
  const table = useTableView(rows, accessors, { resetKey: query });
  return (
    <section aria-label="Water customers" className="water-module-customers">
      {canCreate && <form className="admin-card water-module-card water-module-form" onSubmit={async (event) => {
        event.preventDefault();
        const customer = await onCreate(name.trim(), phone.trim());
        if (customer) { setName(""); setPhone(""); }
      }}>
        <h2>Add customer</h2>
        <label>Customer name<input required value={name} onChange={(event) => setName(event.target.value)} disabled={saving} maxLength={160} /></label>
        <label>Phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={saving} maxLength={32} /></label>
        {createError && <p role="alert">{createError}</p>}
        <PortalAction label="Add customer" icon={AddCircle} action="add" type="submit" disabled={saving || !name.trim()} />
      </form>}
      <article className="admin-card water-module-table-card">
        <h2>Customers</h2>
        <p className="water-module-inline-note">Water customer directory. Showing up to 200 customers.</p>
        {loading ? <p role="status">Loading Water customers…</p> : error ? <div role="alert"><p>{error}</p><PortalAction label="Retry customers" icon={Refresh} onClick={onRetry} /></div> : <>
          <SearchField aria-label="Search Water customers" placeholder="Search name or phone" value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} />
          {rows.length ? <div className="water-module-table-wrap">
            <TablePagination {...table.pagination} header />
            <table className="water-module-table water-module-table--customers">
              <thead><tr><TableSortHeader {...table} column="name">Customer</TableSortHeader><TableSortHeader {...table} column="phone">Phone</TableSortHeader></tr></thead>
              <tbody>{table.rows.map((customer) => <tr key={customer.id}><td>{customer.name}</td><td>{customer.phone || "—"}</td></tr>)}</tbody>
            </table>
            <TablePagination {...table.pagination} />
          </div> : <p className="water-module-empty">{query ? "No matching Water customers." : "No Water customers yet."}</p>}
        </>}
      </article>
    </section>
  );
}
