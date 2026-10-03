import React, { useState } from "react";
import PortalAction from "../../components/PortalAction/PortalAction";
import { faExternalLinkAlt } from "../../icons/iconSet";
import TablePagination from "../../components/TablePagination/TablePagination";
import TableSortHeader from "../../components/TableControls/TableSortHeader";
import { nextTableSort, sortTableRows, tableDate } from "../../components/TableControls/tableRows";
import { formatDashboardDateTime } from "./dashboardViewModel";

const accessors = { reference: (row) => row.reference, summary: (row) => row.summary, status: (row) => row.status, date: (row) => tableDate(row.createdAt) };

export default function DashboardActivity({ activity, incomplete }) {
  const [sort, setSort] = useState({ key: "date", direction: "desc" });
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 5;
  const rows = sortTableRows(activity, accessors, sort);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const headers = { sort, onSort: (key) => { setSort((current) => nextTableSort(current, key)); setPageIndex(0); } };
  return <section className="glass-card reebs-dashboard-section reebs-dashboard-activity" aria-labelledby="dashboard-activity-heading">
    <div className="reebs-dashboard-section-head"><div><h2 id="dashboard-activity-heading">Recent activity</h2><p>Latest eight Core updates within the selected period.</p></div></div>
    {incomplete && <p className="reebs-dashboard-inline-error" role="status">Some activity sources are unavailable.</p>}
    {!rows.length ? <p className="reebs-dashboard-empty">{incomplete ? "Activity could not be fully loaded." : "No Core activity in this period for your role."}</p> : <div className="admin-table">
      <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="Recent activity table">
        <table><thead><tr>
          <TableSortHeader {...headers} column="reference">Record</TableSortHeader>
          <TableSortHeader {...headers} column="summary">Activity</TableSortHeader>
          <TableSortHeader {...headers} column="status">Status</TableSortHeader>
          <TableSortHeader {...headers} column="date">Date</TableSortHeader>
          <th><span className="sr-only">Open record</span></th>
        </tr></thead><tbody>{rows.slice(page * pageSize, (page + 1) * pageSize).map((item) => <tr key={item.id}>
          <td data-label="Record">{item.reference || item.kind}</td><td data-label="Activity">{item.summary}</td>
          <td data-label="Status">{item.status.replaceAll("_", " ")}</td>
          <td data-label="Date">{formatDashboardDateTime(item.createdAt)}</td>
          <td><PortalAction to={item.href} action="open" icon={faExternalLinkAlt} label={`Open ${item.reference || item.kind}`} /></td>
        </tr>)}</tbody></table>
      </div>
      <TablePagination total={rows.length} pageIndex={page} pageSize={pageSize} pageCount={pageCount} onPrevious={() => setPageIndex(Math.max(0, page - 1))} onNext={() => setPageIndex(Math.min(pageCount - 1, page + 1))} />
    </div>}
  </section>;
}
