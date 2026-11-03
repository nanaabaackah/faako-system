import { useEffect, useState } from "react";
// eslint-disable-next-line no-unused-vars -- JSX components, matching the existing website island convention
import { TextField, SelectField } from "@faako/ui";

/**
 * @param {{
 *   scope: string,
 *   options: string[],
 *   label: string,
 *   occasions?: ReadonlyArray<{ value: string, label: string }>
 * }} props
 */
export default function CollectionFilters({ scope, options, label, occasions = [] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [occasion, setOccasion] = useState("");
  const [groupOnly, setGroupOnly] = useState(false);
  const [count, setCount] = useState(null);
  useEffect(() => {
    const cards =
      document
        .getElementById(scope)
        ?.querySelectorAll("[data-collection-item]") || [];
    let visible = 0;
    for (const card of cards) {
      const matches =
        (!category || card.dataset.category === category) &&
        (!occasion || (card.dataset.occasions || "").split(" ").includes(occasion)) &&
        (!groupOnly || card.dataset.groupFriendly === "true") &&
        card.dataset.search.includes(search.trim().toLocaleLowerCase());
      card.hidden = !matches;
      if (matches) visible++;
    }
    setCount(visible);
    return () =>
      cards.forEach((card) => {
        card.hidden = false;
      });
  }, [scope, category, search, occasion, groupOnly]);
  return (
    <div className="collection-filters">
      <TextField
        fieldClassName="collection-search"
        label="Search"
        type="search"
        value={search}
        maxLength={120}
        onChange={(event) => setSearch(event.target.value)}
      />
      <SelectField
        fieldClassName="collection-filter"
        label={label}
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </SelectField>
      {occasions.length > 0 && (
        <>
          <SelectField
            fieldClassName="collection-filter"
            label="Occasion"
            value={occasion}
            onChange={(event) => setOccasion(event.target.value)}
          >
            <option value="">All occasions</option>
            {occasions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </SelectField>
          <label className="collection-group-filter">
            <input
              type="checkbox"
              checked={groupOnly}
              onChange={(event) => setGroupOnly(event.target.checked)}
            />
            Group-friendly only
          </label>
        </>
      )}
      <p role="status" aria-live="polite">
        {count === null
          ? "All entries are shown."
          : count
            ? `${count} ${count === 1 ? "entry" : "entries"} shown`
            : "No entries match. Clear the filters to see everything."}
      </p>
    </div>
  );
}
