import React from "react";
import { AppIcon } from "/src/components/Icon/Icon";
import SearchField from "../../../components/SearchField/SearchField";
import { SEGMENT_OPTIONS, SORT_OPTIONS, VIEW_OPTIONS } from "../crmShared";
import CrmSelectField from "./CrmSelectField";

export default function CustomerToolbar({
  searchTerm,
  onSearchChange,
  onSearchClear,
  segmentFilter,
  onSegmentFilterChange,
  sortKey,
  onSortKeyChange,
  viewMode,
  onViewModeChange,
  isMobileCardView,
}) {
  return (
    <section className="crm-toolbar" aria-label="Customer filters">
      <SearchField
        className="crm-search-field"
        inputClassName="crm-search-input"
        clearClassName="crm-search-clear"
        value={searchTerm}
        onChange={onSearchChange}
        onClear={onSearchClear}
        placeholder="Search customer, phone, segment or value"
      />

      {!isMobileCardView ? (
        <div className="admin-view-toggle crm-view-tabs" role="tablist" aria-label="Customer views">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={viewMode === option.key}
              tabIndex={viewMode === option.key ? 0 : -1}
              className={`admin-chip ${viewMode === option.key ? "is-active" : ""}`}
              onClick={() => onViewModeChange(option.key)}
            >
              <AppIcon icon={option.icon} />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="crm-toolbar-selects">
        <CrmSelectField
          value={segmentFilter}
          onChange={onSegmentFilterChange}
          ariaLabel="Filter customers"
        >
          {SEGMENT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </CrmSelectField>

        <CrmSelectField value={sortKey} onChange={onSortKeyChange} ariaLabel="Sort customers">
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </CrmSelectField>
      </div>
    </section>
  );
}
