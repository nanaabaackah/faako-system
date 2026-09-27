const collator = new Intl.Collator("en-GH", { numeric: true, sensitivity: "base" });

const isMissing = (value) => value == null || value === "" || (typeof value === "number" && !Number.isFinite(value));

/** Stable full-result sorting. Accessors return numbers for amounts and timestamps for dates. */
export function sortTableRows(rows, accessors, sort) {
  const accessor = sort && Object.hasOwn(accessors, sort.key) ? accessors[sort.key] : null;
  if (typeof accessor !== "function") return rows;
  const direction = sort.direction === "desc" ? -1 : 1;
  return rows.map((row, index) => ({ row, index, value: accessor(row, index) }))
    .sort((a, b) => {
      // Missing values stay last in both directions, including restricted Water amounts.
      if (isMissing(a.value) || isMissing(b.value)) {
        return Number(isMissing(a.value)) - Number(isMissing(b.value)) || a.index - b.index;
      }
      const comparison = typeof a.value === "number" && typeof b.value === "number"
        ? a.value - b.value : collator.compare(String(a.value), String(b.value));
      return comparison * direction || a.index - b.index;
    }).map(({ row }) => row);
}

export function nextTableSort(current, key) {
  return { key, direction: current?.key === key && current.direction === "asc" ? "desc" : "asc" };
}

export function tableDate(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}
