import { Link } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function ErpBreadcrumb({ items = [] }: { items?: BreadcrumbItem[] }) {
  const segments = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <nav className="erp-breadcrumb admin-breadcrumb" aria-label="Breadcrumb">
      <ol className="erp-breadcrumb__list">
        <li className="erp-breadcrumb__item erp-breadcrumb__item--root">
          <Link to="/admin" className="erp-breadcrumb__link erp-breadcrumb__link--root">
            <span className="erp-breadcrumb__home-marker" aria-hidden="true" />
            <span className="erp-breadcrumb__label">Admin</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          if (!segment?.label) return null;

          const isLast = index === segments.length - 1;

          return (
            <li
              key={`${segment.label}-${index}`}
              className={`erp-breadcrumb__item${isLast ? " is-current" : ""}`}
            >
              <span className="erp-breadcrumb__sep admin-breadcrumb-sep">/</span>
              {segment.to && !isLast ? (
                <Link to={segment.to} className="erp-breadcrumb__link">
                  <span className="erp-breadcrumb__label">{segment.label}</span>
                </Link>
              ) : (
                <span
                  className="erp-breadcrumb__current"
                  aria-current={isLast ? "page" : undefined}
                >
                  <span className="erp-breadcrumb__label">{segment.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
