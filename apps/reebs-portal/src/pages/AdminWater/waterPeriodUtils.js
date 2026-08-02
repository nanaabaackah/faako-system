const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTimestampValue = (value) => {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const getWaterRecordTimestamp = (record) => {
  const datedAt = getTimestampValue(record?.date);
  if (Number.isFinite(datedAt)) return datedAt;
  const createdAt = getTimestampValue(record?.createdAt);
  return Number.isFinite(createdAt) ? createdAt : Number.NEGATIVE_INFINITY;
};

const compareWaterRecords = (left, right) => {
  const primaryDiff = getWaterRecordTimestamp(left) - getWaterRecordTimestamp(right);
  if (primaryDiff !== 0) return primaryDiff;
  const createdDiff = getTimestampValue(left?.createdAt) - getTimestampValue(right?.createdAt);
  if (Number.isFinite(createdDiff) && createdDiff !== 0) return createdDiff;
  return toNumber(left?.id) - toNumber(right?.id);
};

const formatPackCount = (value) => {
  const quantity = Math.max(0, Math.round(toNumber(value, 0)));
  return `${quantity} pack${quantity === 1 ? "" : "s"}`;
};

export const buildRestockPeriods = (restocks = [], formatDateLabel = (value) => value) => {
  const ordered = [...restocks].sort(compareWaterRecords);
  return ordered
    .map((restock, index) => {
      const nextRestock = ordered[index + 1] || null;
      const restockId = Number(restock?.id);
      const quantity = Math.max(0, Math.round(toNumber(restock?.quantity, 0)));
      const startAt = getWaterRecordTimestamp(restock);
      const endAt = nextRestock ? getWaterRecordTimestamp(nextRestock) : null;

      return {
        value:
          Number.isFinite(restockId) && restockId > 0
            ? `restock:${restockId}`
            : `restock:index:${index}`,
        id: Number.isFinite(restockId) && restockId > 0 ? restockId : null,
        quantity,
        date: restock?.date || "",
        startAt,
        endAt,
        isCurrent: index === ordered.length - 1,
        label: `${formatDateLabel(restock?.date)} · ${formatPackCount(quantity)}`,
      };
    })
    .reverse();
};

export const filterEntriesByRestockPeriod = (entries = [], period = null) => {
  if (!Array.isArray(entries)) return [];
  if (!period) return entries;

  const periodStart = Number.isFinite(period?.startAt) ? period.startAt : Number.NEGATIVE_INFINITY;
  const periodEnd = Number.isFinite(period?.endAt) ? period.endAt : Number.POSITIVE_INFINITY;

  return entries.filter((entry) => {
    const entryTime = getWaterRecordTimestamp(entry);
    if (!Number.isFinite(entryTime)) return false;
    if (entryTime < periodStart) return false;
    if (entryTime >= periodEnd) return false;
    return true;
  });
};
