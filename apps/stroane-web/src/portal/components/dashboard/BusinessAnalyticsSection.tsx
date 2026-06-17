import React from "react";
import { Link } from "react-router-dom";

export interface BusinessAnalyticsItem {
  label: string;
  value: string;
  detail: string;
  to: string;
  tone: string;
  icon: React.ReactNode;
  drilldown?: unknown;
}

interface BusinessAnalyticsSectionProps {
  items: BusinessAnalyticsItem[];
  onSelect?: (item: BusinessAnalyticsItem) => void;
}

const BusinessAnalyticsSection: React.FC<BusinessAnalyticsSectionProps> = ({ items, onSelect }) => (
  <section
    className="glass-card stroane-portal-overview__business"
    aria-labelledby="stroane-business-title"
  >
    <header>
      <span>Business analytics</span>
      <h2 id="stroane-business-title">Revenue and catalogue health</h2>
    </header>
    <div>
      {items.map((item) => {
        const content = (
          <>
            <span>{item.icon}</span>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
            <em>{item.detail}</em>
          </>
        );

        return item.drilldown && onSelect ? (
          <button
            className="bubble-card stroane-portal-overview__business-item"
            key={item.label}
            type="button"
            data-tone={item.tone}
            onClick={() => onSelect(item)}
          >
            {content}
          </button>
        ) : (
          <Link key={item.label} to={item.to} data-tone={item.tone}>
            {content}
          </Link>
        );
      })}
    </div>
  </section>
);

export default BusinessAnalyticsSection;
