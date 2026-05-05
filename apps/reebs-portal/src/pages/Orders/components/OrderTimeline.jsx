import React from "react";
import { StatusPill } from "@faako/ui";
import { formatDateTime, formatStatusLabel, getStatusTone } from "../orderUi";

export default function OrderTimeline({ events = [] }) {
  const safeEvents = Array.isArray(events) ? events : [];

  return (
    <section className="glass-card orders-panel orders-timeline-panel">
      <div className="orders-panel-header">
        <div>
          <h3>Timeline</h3>
          <span>{safeEvents.length} events</span>
        </div>
      </div>

      {safeEvents.length ? (
        <ol className="orders-timeline-list">
          {safeEvents.map((event) => (
            <li key={event.id || `${event.type}-${event.createdAt}`} className="orders-timeline-item">
              <span className="orders-timeline-marker" aria-hidden="true" />
              <div className="bubble-card orders-timeline-card">
                <div className="orders-timeline-head">
                  <StatusPill
                    tone={getStatusTone(event.type)}
                    className="orders-timeline-pill"
                  >
                    {formatStatusLabel(event.type, "Event")}
                  </StatusPill>
                  <time>{formatDateTime(event.createdAt)}</time>
                </div>
                <p>{event.summary || formatStatusLabel(event.type, "Order event")}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="orders-empty">No timeline events found.</p>
      )}
    </section>
  );
}
