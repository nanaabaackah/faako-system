import React from "react";
import PropTypes from "prop-types";

function SideNav({ items, activeId, label = "Page sections", className = "", onItemClick }) {
  if (!items || !items.length) return null;

  return (
    <nav className={`side-menu ${className}`.trim()} aria-label={label}>
      <ul>
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
          <li key={item.id} className={isActive ? "active" : undefined}>
            <a
              href={`#${item.id}`}
              aria-current={isActive ? "true" : undefined}
              className={isActive ? "is-active" : undefined}
              onClick={(event) => {
                if (!onItemClick) return;
                event.preventDefault();
                onItemClick(item.id);
              }}
            >
              {item.label}
            </a>
          </li>
          );
        })}
      </ul>
    </nav>
  );
}

SideNav.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeId: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
  onItemClick: PropTypes.func,
};

export default SideNav;
