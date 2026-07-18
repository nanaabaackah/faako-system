export const createDefaultProjectFilters = () => ({
  stage: "all",
  priority: "all",
  health: "all",
  type: "all",
});

export const appendProjectFilterParams = (params, { filters, searchQuery }) => {
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });

  const search = String(searchQuery || "").trim();
  if (search) params.set("search", search);
  return params;
};

export const hasActiveProjectFilters = ({ filters, searchQuery }) =>
  Boolean(String(searchQuery || "").trim()) ||
  Object.values(filters || {}).some((value) => value && value !== "all");
