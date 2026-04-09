import React from "react";
import { SelectField } from "@faako/ui";

export default function CrmSelectField({ value, onChange, children, ariaLabel }) {
  return (
    <div className="crm-select-shell">
      <SelectField value={value} onChange={onChange} ariaLabel={ariaLabel} inputClassName="crm-select-input">
        {children}
      </SelectField>
    </div>
  );
}
