import {
  isProjectDateRangeValid,
  parseProjectDate,
  resolveProjectArchiveUpdate,
} from "./projectFields.js";

export const PROJECT_TASK_STATUSES = new Set([
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "BLOCKED",
  "DONE",
]);

export const PROJECT_TASK_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const parseProjectTaskId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeProjectTaskText = (
  value,
  { maxLength = 240, nullable = true } = {}
) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return nullable ? null : "";
  return normalized.slice(0, maxLength);
};

export const normalizeProjectTaskStatus = (value, fallback = "BACKLOG") => {
  const candidate = value === undefined ? fallback : value;
  const normalized = String(candidate ?? "").trim().toUpperCase();
  return PROJECT_TASK_STATUSES.has(normalized) ? normalized : null;
};

export const normalizeProjectTaskPriority = (value, fallback = "MEDIUM") => {
  const candidate = value === undefined ? fallback : value;
  const normalized = String(candidate ?? "").trim().toUpperCase();
  return PROJECT_TASK_PRIORITIES.has(normalized) ? normalized : null;
};

export const buildProjectTaskAccessWhere = ({ taskId, projectId, organizationId }) => ({
  id: taskId,
  projectId,
  organizationId,
});

export const buildProjectTaskListWhere = ({
  projectId,
  organizationId,
  includeArchived = false,
}) => ({
  projectId,
  organizationId,
  ...(includeArchived ? {} : { archivedAt: null }),
});

export const resolveProjectTaskCompletion = ({
  status,
  currentCompletedAt = null,
  now = new Date(),
}) => (status === "DONE" ? currentCompletedAt || now : null);

export const parseProjectTaskDates = ({ startDate, dueDate }) => {
  const parsedStartDate = parseProjectDate(startDate ?? null);
  if (parsedStartDate.error) return { error: "startDate must be a valid date or null." };
  const parsedDueDate = parseProjectDate(dueDate ?? null);
  if (parsedDueDate.error) return { error: "dueDate must be a valid date or null." };
  if (!isProjectDateRangeValid({ startDate: parsedStartDate.date, dueDate: parsedDueDate.date })) {
    return { error: "startDate cannot be later than dueDate." };
  }
  return { startDate: parsedStartDate.date, dueDate: parsedDueDate.date };
};

export const resolveProjectTaskArchiveUpdate = resolveProjectArchiveUpdate;

export const serializeProjectTask = (task) => ({
  id: task.id,
  organizationId: task.organizationId,
  projectId: task.projectId,
  title: task.title,
  description: task.description ?? null,
  status: task.status,
  priority: task.priority,
  assigneeUserId: task.assigneeUserId ?? null,
  assigneeUser: task.assigneeUser
    ? {
        id: task.assigneeUser.id,
        fullName: task.assigneeUser.fullName,
        email: task.assigneeUser.email,
      }
    : null,
  startDate: task.startDate ? task.startDate.toISOString() : null,
  dueDate: task.dueDate ? task.dueDate.toISOString() : null,
  completedAt: task.completedAt ? task.completedAt.toISOString() : null,
  archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
  createdAt: task.createdAt ? task.createdAt.toISOString() : null,
  updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
  trelloCardId: task.trelloCardId ?? null,
  trelloCardUrl: task.trelloCardUrl ?? null,
  trelloSyncStatus: task.trelloSyncStatus || "NOT_LINKED",
  trelloLastSyncSource: task.trelloLastSyncSource ?? null,
  trelloLastSyncedAt: task.trelloLastSyncedAt ? task.trelloLastSyncedAt.toISOString() : null,
  trelloLastError: task.trelloLastError ?? null,
});
