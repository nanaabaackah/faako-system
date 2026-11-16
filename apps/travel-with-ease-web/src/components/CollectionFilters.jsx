import { useEffect, useState } from "react";
// eslint-disable-next-line no-unused-vars -- JSX components, matching the existing website island convention
import { TextField, SelectField } from "@faako/ui";

/**
 * @param {{
 *   scope: string,
 *   options: string[],
 *   label: string,
 *   seriesOptions?: string[],
 *   occasions?: ReadonlyArray<{ value: string, label: string }>
 * }} props
 */
export default function CollectionFilters({ scope, options, label, occasions = [], seriesOptions = [] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [series, setSeries] = useState("");
  const [occasion, setOccasion] = useState("");
  const [groupOnly, setGroupOnly] = useState(false);
  const [count, setCount] = useState(null);
  useEffect(() => {
    // Deep-link the homepage "See all tips" CTA to the Journal's Travel tip
    // category while keeping SSR output and non-Journal collections unchanged.
    const params = new URLSearchParams(window.location.search);
    const linkedCategory = params.get("category");
    const linkedSeries = params.get("series");
    if (linkedCategory && options.includes(linkedCategory)) setCategory(linkedCategory);
    if (linkedSeries && seriesOptions.includes(linkedSeries)) setSeries(linkedSeries);
  }, [scope]); // Options are supplied by the static Astro island and do not change.
  function chooseFilter(key, value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
    if (key === "category") setCategory(value);
    if (key === "series") setSeries(value);
  }
  useEffect(() => {
    const cards =
      document
        .getElementById(scope)
        ?.querySelectorAll("[data-collection-item]") || [];
    let visible = 0;
    for (const card of cards) {
      const matches =
        (!category || card.dataset.category === category) &&
        (!series || card.dataset.series === series) &&
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
  }, [scope, category, series, search, occasion, groupOnly]);
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
        onChange={(event) => chooseFilter("category", event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </SelectField>
      {seriesOptions.length > 0 && (
        <SelectField
          fieldClassName="collection-series-filter"
          label="Series"
          value={series}
          onChange={(event) => chooseFilter("series", event.target.value)}
        >
          <option value="">All series</option>
          {seriesOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </SelectField>
      )}
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
