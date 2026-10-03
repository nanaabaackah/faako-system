import React from "react";

const Lines = () => <><span className="ui-animated-loading-state__skeleton-line is-heading" /><span className="ui-animated-loading-state__skeleton-line is-body" /><span className="ui-animated-loading-state__skeleton-line is-body is-short" /></>;
const Cards = () => <>{[0, 1].map((index) => <div key={index} className="bubble-card reebs-dashboard-summary-card"><Lines /></div>)}</>;

export default function DashboardSkeleton() {
  return <div className="reebs-dashboard-skeleton" role="status" aria-label="Loading Core operations" aria-busy="true">
    <span className="sr-only">Loading Core operations</span>
    <div aria-hidden="true">
      <div className="reebs-dashboard-main-grid">
        <div className="reebs-dashboard-supporting"><Cards /></div>
        <div className="glass-card reebs-dashboard-section reebs-dashboard-collections"><Lines /><div className="reebs-dashboard-skeleton-chart"><Lines /></div></div>
        <div className="reebs-dashboard-financial"><Cards /></div>
      </div>
      <div className="reebs-dashboard-lower-grid">
        <div className="reebs-dashboard-activity-stack">
          <div className="glass-card reebs-dashboard-section"><Lines /><div className="reebs-dashboard-skeleton-chart"><Lines /></div></div>
          <div className="glass-card reebs-dashboard-section"><Lines /></div>
        </div>
        <div className="glass-card reebs-dashboard-section"><Lines /><div className="reebs-dashboard-skeleton-chart"><Lines /></div></div>
      </div>
    </div>
  </div>;
}
