const PROJECT_HEALTH_VALUES = new Set(["ON_TRACK", "AT_RISK", "BLOCKED"]);

export const normalizeProjectHealth = (value, fallback = "ON_TRACK") => {
  const candidate = value === undefined ? fallback : value;
  const normalized = String(candidate ?? "").trim().toUpperCase();
  return PROJECT_HEALTH_VALUES.has(normalized) ? normalized : null;
};

export const parseProjectProgressPercent = (value, fallback = 0) => {
  const candidate = value === undefined ? fallback : value;
  if (
    candidate === null ||
    typeof candidate === "boolean" ||
    (typeof candidate === "string" && candidate.trim() === "")
  ) {
    return null;
  }

  const parsed = Number(candidate);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};

export const parseProjectDate = (value) => {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return { date: null };
  }
  if (typeof value !== "string" && !(value instanceof Date)) {
    return { error: "Date must be a valid date or null." };
  }

  const normalizedValue = typeof value === "string" ? value.trim() : value;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return { error: "Date must be a valid date or null." };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) && date.toISOString().slice(0, 10) !== normalizedValue) {
    return { error: "Date must be a valid date or null." };
  }
  return { date };
};

export const isProjectDateRangeValid = ({ startDate, dueDate }) =>
  !startDate || !dueDate || startDate.getTime() <= dueDate.getTime();

export const buildProjectAccessWhere = ({ projectId, organizationId, globalAccess = false }) =>
  globalAccess ? { id: projectId } : { id: projectId, organizationId };

export const buildProjectSearchWhere = (value) => {
  const search = String(value || "").trim().slice(0, 180);
  if (!search) return {};
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
    ],
  };
};

export const buildProjectArchiveVisibilityWhere = (includeArchived = false) =>
  includeArchived ? {} : { archivedAt: null };

export const resolveProjectArchiveUpdate = ({
  archived,
  archivedAt,
  currentArchivedAt = null,
  now = new Date(),
}) => {
  if (archivedAt !== undefined) {
    if (archivedAt === null || (typeof archivedAt === "string" && !archivedAt.trim())) {
      return { provided: true, archivedAt: null };
    }
    if (typeof archivedAt !== "string" && !(archivedAt instanceof Date)) {
      return { error: "archivedAt must be a valid date or null." };
    }
    const parsed = new Date(archivedAt);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "archivedAt must be a valid date or null." };
    }
    return { provided: true, archivedAt: parsed };
  }

  if (archived === undefined) return { provided: false };
  if (typeof archived !== "boolean") {
    return { error: "archived must be true or false." };
  }
  return {
    provided: true,
    archivedAt: archived ? currentArchivedAt || now : null,
  };
};

export const serializeProject = (project) => ({
  id: project.id,
  organizationId: project.organizationId,
  organization: project.organization
    ? {
        id: project.organization.id,
        name: project.organization.name,
        slug: project.organization.slug,
      }
    : null,
  ownerUserId: project.ownerUserId ?? null,
  ownerUser: project.ownerUser
    ? {
        id: project.ownerUser.id,
        fullName: project.ownerUser.fullName,
        email: project.ownerUser.email,
      }
    : null,
  title: project.title,
  clientName: project.clientName ?? null,
  projectType: project.projectType,
  stage: project.stage,
  priority: project.priority,
  currency: project.currency ?? null,
  budgetAmount:
    project.budgetAmount === null || project.budgetAmount === undefined
      ? null
      : typeof project.budgetAmount?.toNumber === "function"
        ? project.budgetAmount.toNumber()
        : Number(project.budgetAmount),
  startDate: project.startDate ? project.startDate.toISOString() : null,
  dueDate: project.dueDate ? project.dueDate.toISOString() : null,
  progressPercent: project.progressPercent ?? 0,
  health: project.health ?? "ON_TRACK",
  description: project.description ?? null,
  externalRef: project.externalRef ?? null,
  archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
  createdAt: project.createdAt ? project.createdAt.toISOString() : null,
  updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
});
