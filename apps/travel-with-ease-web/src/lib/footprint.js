// Public projection only. No staff records or traveller details belong here.
export function footprintRows(records, countries, allowDemo = false) {
  const seen = new Set();
  return records.map(record => {
    if (!record || !["verified", "demo"].includes(record.status) || (record.status === "demo" && !allowDemo)) throw new Error("Unapproved footprint data.");
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
