import { DateField } from "@faako/ui";
import { toDateInputValue } from "./commercialSettings";

export default function WaterPricePeriodFields({ draft, onChange, label, disabled, required }) {
  return (
    <div className="settings-commercial-field">
      <span className="settings-commercial-step">Effective period</span>
      <DateField
        label="Starts on"
        ariaLabel={label}
        value={draft.effectiveDate}
        onChange={(event) => onChange({ effectiveDate: event.target.value })}
        disabled={disabled}
        required={required}
      />
      <DateField
        label="Ends before (optional)"
        ariaLabel={`${label} end (exclusive)`}
        value={draft.effectiveEndDate || ""}
        onChange={(event) => onChange({ effectiveEndDate: event.target.value })}
        disabled={disabled}
      />
      <small className="settings-muted">Dates use Ghana time. Leave the end blank to keep the next scheduled price unchanged.</small>
    </div>
  );
}

export function WaterPriceHistoricalNotice({ draft }) {
  if (!draft.effectiveDate || draft.effectiveDate >= toDateInputValue()) return null;
  return (
    <p className="settings-muted settings-water-historical-notice" role="note">
      <strong>Historical price schedule</strong><br />
      This price can be used for transactions dated within this period. Existing recorded transactions will not be changed.
    </p>
  );
}
