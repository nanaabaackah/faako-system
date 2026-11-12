// Public projection only. No staff records or traveller details belong here.
export function footprintRows(records, countries) {
  const seen = new Set();
  return records.map(record => {
    if (!record || record.status !== "verified") throw new Error("Unapproved footprint data.");
    const country = countries.find(item => item.code === record.countryCode);
    if (!country || seen.has(record.countryCode) || !Number.isSafeInteger(record.total) || record.total < 0) throw new Error("Invalid footprint aggregate.");
    seen.add(record.countryCode);
    return { countryCode: record.countryCode, name: country.name, total: record.total, status: record.status };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
// Fixed logarithmic bins remain comparable across both instances and releases.
export function footprintBand(total) {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid total.");
  return total === 0 ? 0 : Math.min(4, Math.floor(Math.log10(total)) + 1);
}

// A visit is not an agency-planned trip. Keep its source/quality metadata
// separate, and never turn unknown or approximate visits into exact totals.
export function experienceRows(records, countries) {
  const seen = new Set();
  return records.map(record => {
    const country = countries.find(item => item.code === record.countryCode);
    if (!country || seen.has(record.countryCode) ||
      !["founder", "business"].includes(record.source)) throw new Error("Invalid travel experience country.");
    const count = record.visitCount;
    const qualifier = record.countQualifier;
    if (count === null ? qualifier !== "unspecified" :
      !Number.isSafeInteger(count) || count < 1 ||
      !["exact", "approximate", "at_least"].includes(qualifier)) {
      throw new Error("Invalid travel experience count.");
    }
    seen.add(record.countryCode);
    const label = count === null ? "Visited" :
      qualifier === "at_least" ? `${count}+ visits` :
      qualifier === "approximate" ? `About ${count} visits` : `${count} visits`;
    return { countryCode: country.code, name: country.name, label,
      band: count === null ? 1 : count < 10 ? 2 : 3 };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
