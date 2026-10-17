// A value alone is not publishable evidence. Never invent a measurement period.
export const verifiedImpact = (stats = []) => stats.filter(stat =>
  stat.verificationStatus === "verified" &&
  [stat.value, stat.label, stat.source, stat.period].every(value =>
    typeof value === "string" && value.trim().length > 0
  )
);
