import { IconsaxIcon } from "@faako/ui";

// Reuse the native disclosure interaction with the portal's Faako iconography.
export default function HistoryDisclosure({ title, count, children }) {
  return (
    <details className="twe-history-disclosure">
      <summary className="twe-history-disclosure__summary">
        <span className="twe-history-disclosure__title">{title}</span>
        <span className="twe-history-disclosure__actions">
          <span className="twe-history-disclosure__count" aria-label={`${count} entries`}>{count}</span>
          <span className="twe-history-disclosure__chevron" aria-hidden="true">
            <IconsaxIcon name="ArrowDown2" />
          </span>
        </span>
      </summary>
      <div className="twe-history-disclosure__body">{children}</div>
    </details>
  );
}
