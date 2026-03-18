import React from "react";
import { Link } from "react-router-dom";

function AdminBreadcrumb({ items }) {
  const segments = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <nav className="admin-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/admin">Admin</Link>
        </li>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          if (!segment?.label) return null;

          return (
            <li key={`${segment.label}-${index}`}>
              <span className="admin-breadcrumb-sep">/</span>
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

export default AdminBreadcrumb;
