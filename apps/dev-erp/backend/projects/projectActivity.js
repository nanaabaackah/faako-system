import { getRequestIp, writeAuditLog } from "../audit/audit.service.js";

export const PROJECT_ACTIVITY_ACTIONS = Object.freeze({
  PROJECT_CREATED: "PROJECT_CREATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  PROJECT_ARCHIVED: "PROJECT_ARCHIVED",
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_COMPLETED: "TASK_COMPLETED",
  TASK_REOPENED: "TASK_REOPENED",
  TASK_ARCHIVED: "TASK_ARCHIVED",
});

export const PROJECT_ACTIVITY_ACTION_VALUES = Object.freeze(
  Object.values(PROJECT_ACTIVITY_ACTIONS)
);

const actorLabelForRequest = (req) =>
  String(req?.user?.fullName || req?.user?.email || "User").trim().slice(0, 160);

export const recordProjectActivity = async ({
  prisma,
  req,
  action,
  organizationId,
  project,
  task = null,
  summary,
  metadata = {},
}) => {
  const projectId = Number(project?.id);
  if (!PROJECT_ACTIVITY_ACTION_VALUES.includes(action) || !Number.isInteger(projectId)) return null;

  return writeAuditLog(prisma, {
    organizationId,
    userId: req?.user?.userId,
    action,
    targetType: task ? "ProjectTask" : "Project",
    targetId: String(task?.id || projectId),
    source: "projects",
    category: "project_activity",
    status: "ok",
    summary,
    actorType: "user",
    actorLabel: actorLabelForRequest(req),
    ipAddress: getRequestIp(req),
    metadata: {
      projectId,
      projectTitle: String(project?.title || "").slice(0, 180) || null,
      ...(task
        ? {
            taskId: task.id,
            taskTitle: String(task.title || "").slice(0, 240) || null,
          }
        : {}),
      ...metadata,
    },
  });
};

export const buildProjectActivityWhere = ({ projectId, organizationId }) => ({
  organizationId,
  action: { in: PROJECT_ACTIVITY_ACTION_VALUES },
  OR: [
    { targetType: "Project", targetId: String(projectId) },
    {
      targetType: "ProjectTask",
      metadata: { path: ["projectId"], equals: projectId },
    },
  ],
});

export const serializeProjectActivity = (entry = {}) => ({
  id: entry.id,
  action: entry.action,
  summary: entry.summary || "Project activity",
  actor: {
    userId: entry.userId ?? null,
    label: entry.actorLabel || "System",
  },
  projectId: entry.metadata?.projectId ?? null,
  task: entry.metadata?.taskId
    ? {
        id: entry.metadata.taskId,
        title: entry.metadata.taskTitle || null,
      }
    : null,
  metadata: entry.metadata ?? null,
  createdAt: entry.createdAt,
});

export const getTaskActivityActions = ({ previousTask, updatedTask, changedFields = [] }) => {
  const actions = [];
  if (previousTask.status !== updatedTask.status) {
    if (updatedTask.status === "DONE") actions.push(PROJECT_ACTIVITY_ACTIONS.TASK_COMPLETED);
    else if (previousTask.status === "DONE") actions.push(PROJECT_ACTIVITY_ACTIONS.TASK_REOPENED);
    else actions.push(PROJECT_ACTIVITY_ACTIONS.TASK_STATUS_CHANGED);
  }
  if (previousTask.assigneeUserId !== updatedTask.assigneeUserId) {
    actions.push(PROJECT_ACTIVITY_ACTIONS.TASK_ASSIGNED);
  }
  if (changedFields.length) actions.push(PROJECT_ACTIVITY_ACTIONS.TASK_UPDATED);
  return actions;
};
