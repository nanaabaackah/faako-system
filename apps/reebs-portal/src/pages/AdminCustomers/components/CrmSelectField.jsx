import React from "react";
import { AppIcon } from "/src/components/Icon/Icon";
import { faChevronDown } from "/src/icons/iconSet";

export default function CrmSelectField({ value, onChange, children, ariaLabel }) {
  return (
    <label className="crm-select-shell">
      <select value={value} onChange={onChange} aria-label={ariaLabel}>
        {children}
      </select>
      <span className="crm-select-icon" aria-hidden="true">
        <AppIcon icon={faChevronDown} />
      </span>
    </label>
  );
}
