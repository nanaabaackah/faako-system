import React from "react";
import { AppIcon } from "/src/components/Icon/Icon";
import { faBoxArchive } from "/src/icons/iconSet";

export default function CustomerArchiveButton({
  customer,
  onArchive,
  isRemoving,
  className = "",
  showLabel = true,
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onArchive(customer);
      }}
      disabled={isRemoving}
      aria-label={`Archive ${customer.name || "customer"}`}
      title={`Archive ${customer.name || "customer"}`}
    >
      <AppIcon icon={faBoxArchive} />
      <span>{showLabel ? (isRemoving ? "Archiving..." : "Archive") : "Archive"}</span>
    </button>
  );
}
