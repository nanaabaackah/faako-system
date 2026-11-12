import { SelectField, TextField } from "@faako/ui";
import Button from "./ActionButton.jsx";
import countries from "../../../travel-with-ease-web/src/lib/footprint-countries.json";
import tiny from "../../../travel-with-ease-web/src/lib/footprint-small-countries.json";

const choices = [...countries, ...tiny.countries].sort((a, b) => a.name.localeCompare(b.name));

export default function ExperienceEditor({ items, onChange }) {
  const update = (index, changes) => onChange(items.map((item, i) =>
    i === index ? { ...item, ...changes } : item));
  return (
    <section aria-label="Travel experience countries">
      <h3>Countries explored</h3>
      <p>
        Keep the source and count quality accurate. Public country labels show
        visits, not agency-organised trip totals. Unknown visit counts stay blank.
      </p>
      {items.map((item, index) => (
        <fieldset key={index}>
          <legend>Country {index + 1}</legend>
          <SelectField label="Country" value={item.countryCode}
            onChange={event => update(index, { countryCode: event.target.value })}>
            {choices.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
          </SelectField>
          <SelectField label="Record source (internal)" value={item.source}
            onChange={event => update(index, { source: event.target.value })}>
            <option value="founder">Founder travel</option>
            <option value="business">Business travel</option>
          </SelectField>
          <TextField label="Supplied visit count (leave blank if unspecified)" type="number"
            min="1" max="1000000" step="1" value={item.visitCount ?? ""}
            onChange={event => update(index, {
              visitCount: event.target.value === "" ? null : Number(event.target.value),
              ...(event.target.value === "" ? { countQualifier: "unspecified" } : {}),
            })} />
          <SelectField label="Count wording" value={item.countQualifier}
            onChange={event => update(index, { countQualifier: event.target.value })}>
            <option value="unspecified">Visited — no count supplied</option>
            <option value="exact">Exact supplied count</option>
            <option value="approximate">About this many visits</option>
            <option value="at_least">At least this many visits (+)</option>
          </SelectField>
          <Button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))}>
            Remove country {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button type="button" disabled={items.length >= choices.length} onClick={() => {
        const next = choices.find(country => !items.some(item => item.countryCode === country.code));
        if (next) onChange([...items, { countryCode: next.code, source: "founder",
          visitCount: null, countQualifier: "unspecified" }]);
      }}>Add explored country</Button>
    </section>
  );
}
