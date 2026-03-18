import { Link } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function ErpBreadcrumb({ items = [] }: { items?: BreadcrumbItem[] }) {
  const segments = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <nav className="erp-breadcrumb admin-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/admin">Admin</Link>
        </li>
        {segments.map((segment, index) => {
          if (!segment?.label) return null;

          const isLast = index === segments.length - 1;

          return (
            <li key={`${segment.label}-${index}`}>
              <span className="erp-breadcrumb__sep admin-breadcrumb-sep">/</span>
              {segment.to && !isLast ? (
                <Link to={segment.to}>{segment.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{segment.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
