import React from "react";
import { AppIcon } from "/src/components/Icon/Icon";
import { faCircleCheck, faPen, faUsers } from "/src/icons/iconSet";
import { SEGMENT_OPTIONS, formatMoney } from "../crmShared";

export default function CustomerSummaryPanel({ summary, segmentFilter, onSegmentFilterChange }) {
  return (
    <>
      <div className="crm-segment-bar" role="tablist" aria-label="Customer segments">
        {SEGMENT_OPTIONS.map((option) => {
          const count = option.key === "all" ? summary.count : summary[option.key] || 0;

          return (
            <button
              key={option.key}
              type="button"
              className={`crm-segment-chip ${segmentFilter === option.key ? "is-active" : ""}`}
              onClick={() => onSegmentFilterChange(option.key)}
              aria-pressed={segmentFilter === option.key}
            >
              <span>{option.label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      <section className="crm-overview-grid" aria-label="Customer summary">
        <article className="bubble-card crm-kpi-card">
          <p>Customers</p>
          <h2>{summary.count}</h2>
          <span>{summary.connected} linked</span>
        </article>
        <article className="bubble-card crm-kpi-card">
          <p>Active</p>
          <h2>{summary.active + summary.loyal}</h2>
          <span>{summary.loyal} loyal</span>
        </article>
        <article className="bubble-card crm-kpi-card">
          <p>Value</p>
          <h2>{formatMoney(summary.value)}</h2>
          <span>Avg {formatMoney(summary.avgValue)}</span>
        </article>
        <article className="bubble-card crm-kpi-card">
          <p>At risk</p>
          <h2>{summary.risk}</h2>
          <span>{summary.openContactRequests} open requests</span>
        </article>
      </section>

      <section className="crm-mini-grid" aria-label="Customer connections">
        <article className="bubble-card crm-mini-card">
          <div className="crm-mini-card-head">
            <AppIcon icon={faUsers} />
            <span>Connected</span>
          </div>
          <strong>{summary.orders + summary.bookings + summary.contactRequests}</strong>
          <p>Orders {summary.orders} · Bookings {summary.bookings} · Requests {summary.contactRequests}</p>
        </article>
        <article className="bubble-card crm-mini-card">
          <div className="crm-mini-card-head">
            <AppIcon icon={faCircleCheck} />
            <span>Reach</span>
          </div>
          <strong>{summary.phone}/{summary.count || 0}</strong>
          <p>Phone · Email {summary.email}/{summary.count || 0}</p>
        </article>
        <article className="bubble-card crm-mini-card">
          <div className="crm-mini-card-head">
            <AppIcon icon={faPen} />
            <span>Needs detail</span>
          </div>
          <strong>{summary.contactGaps}</strong>
          <p>Missing phone or email</p>
        </article>
      </section>
    </>
  );
}
