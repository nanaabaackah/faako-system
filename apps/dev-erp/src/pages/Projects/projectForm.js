export const toProjectDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const buildProjectForm = (
  project = null,
  { organizationId = "" } = {}
) => ({
  title: project?.title || "",
  projectType: project?.projectType || "PERSONAL",
  stage: project?.stage || "BACKLOG",
  priority: project?.priority || "MEDIUM",
  clientName: project?.clientName || "",
  startDate: toProjectDateInput(project?.startDate),
  dueDate: toProjectDateInput(project?.dueDate),
  progressPercent: String(project?.progressPercent ?? 0),
  health: project?.health || "ON_TRACK",
  budgetAmount:
    project?.budgetAmount !== undefined && project?.budgetAmount !== null
      ? String(project.budgetAmount)
      : "",
  currency: project?.currency || "CAD",
  description: project?.description || "",
  externalRef: project?.externalRef || "",
  organizationId: project?.organization?.id
    ? String(project.organization.id)
    : String(organizationId || ""),
});

const isValidDateInput = (value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const validateProjectForm = (formState) => {
  if (!String(formState.title || "").trim()) {
    return "Project title is required.";
  }

  const budgetAmount = String(formState.budgetAmount ?? "").trim();
  if (budgetAmount && (!Number.isFinite(Number(budgetAmount)) || Number(budgetAmount) < 0)) {
    return "Budget must be a valid amount of 0 or greater.";
  }

  const progressValue = String(formState.progressPercent ?? "").trim();
  const progressPercent = Number(progressValue);
  if (
    !progressValue ||
    !Number.isInteger(progressPercent) ||
    progressPercent < 0 ||
    progressPercent > 100
  ) {
    return "Progress must be a whole number between 0 and 100.";
  }

  const startDate = String(formState.startDate || "").trim();
  const dueDate = String(formState.dueDate || "").trim();
  if (!isValidDateInput(startDate)) {
    return "Start date must be a valid date.";
  }
  if (!isValidDateInput(dueDate)) {
    return "Due date must be a valid date.";
  }
  if (startDate && dueDate && startDate > dueDate) {
    return "Start date cannot be after due date.";
  }

  return "";
};

export const buildProjectPayload = (formState, { includeOrganization = false } = {}) => {
  const budgetAmount = String(formState.budgetAmount ?? "").trim();
  return {
    title: String(formState.title || "").trim(),
    projectType: formState.projectType,
    stage: formState.stage,
    priority: formState.priority,
    clientName: String(formState.clientName || "").trim() || null,
    startDate: formState.startDate || null,
    dueDate: formState.dueDate || null,
    progressPercent: Number(formState.progressPercent),
    health: formState.health,
    budgetAmount: budgetAmount || null,
    currency: budgetAmount ? formState.currency : null,
    description: String(formState.description || "").trim() || null,
    externalRef: String(formState.externalRef || "").trim() || null,
    organizationId:
      includeOrganization && formState.organizationId
        ? Number(formState.organizationId)
        : undefined,
  };
};
