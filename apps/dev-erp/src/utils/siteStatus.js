export const getAggregateSiteStatus = (pages = []) => {
  if (!Array.isArray(pages) || !pages.length) return "unknown";
  if (pages.some((page) => page?.status === "offline")) return "offline";
  if (pages.some((page) => page?.status === "degraded")) return "degraded";
  if (pages.every((page) => page?.status === "not_configured")) return "not_configured";
  if (pages.every((page) => page?.status === "online")) return "online";
  return "unknown";
};
