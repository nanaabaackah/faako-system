import React from "react";

export default function CustomerActivityList({
  title,
  emptyText,
  items,
  renderMeta,
  renderValue,
  keyPrefix,
}) {
  return (
    <section className="glass-card crm-detail-block">
      <div className="crm-detail-block-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>
      {items.length ? (
        <div className="crm-detail-activity-list">
          {items.map((item) => {
            const meta = renderMeta(item);

            return (
              <article className="crm-detail-activity-row" key={`${keyPrefix}-${item.id}`}>
                <div>
                  <strong>{meta.title}</strong>
                  <p>{meta.subtitle}</p>
                </div>
                <span>{renderValue(item)}</span>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="crm-muted">{emptyText}</p>
      )}
    </section>
  );
}
