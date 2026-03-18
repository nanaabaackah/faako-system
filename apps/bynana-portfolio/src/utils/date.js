export const toSafeDate = (value) => {
  if (!value) return null;
  const normalized = typeof value === 'string' && !value.includes('T') ? `${value}T00:00:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatSafeDate = (value) => {
  const parsed = toSafeDate(value);
  if (!parsed) return value || '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const compareDatesDesc = (a, b) => {
  const dateA = toSafeDate(a);
  const dateB = toSafeDate(b);
  const timeA = dateA ? dateA.getTime() : 0;
  const timeB = dateB ? dateB.getTime() : 0;
  return timeB - timeA;
};
