import { asyncHandler } from "../utils/asyncHandler.js";
import {
  PROJECT_ACTIVITY_ACTIONS,
  getTaskActivityActions,
  recordProjectActivity,
} from "./projectActivity.js";
import { buildProjectAccessWhere } from "./projectFields.js";
import {
  buildProjectTaskAccessWhere,
  buildProjectTaskListWhere,
  normalizeProjectTaskPriority,
  normalizeProjectTaskStatus,
  normalizeProjectTaskText,
  parseProjectTaskDates,
  parseProjectTaskId,
  resolveProjectTaskArchiveUpdate,
  resolveProjectTaskCompletion,
  serializeProjectTask,
} from "./projectTaskFields.js";

const taskInclude = {
  assigneeUser: { select: { id: true, fullName: true, email: true } },
};

const taskActivityValue = (value) => {
  if (value instanceof Date) return value.getTime();
  return value ?? null;
};

const getChangedTaskFields = (previousTask, updatedTask) =>
  ["title", "description", "priority", "startDate", "dueDate"].filter(
    (field) => taskActivityValue(previousTask[field]) !== taskActivityValue(updatedTask[field])
  );

export const createProjectTaskHandlers = ({
  prisma,
  isGlobalAdmin,
  recordActivity = recordProjectActivity,
  syncTaskToTrello = null,
}) => {
  const loadProject = async (req, res, { writable = false } = {}) => {
    const projectId = parseProjectTaskId(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ error: "Project id must be a valid number." });
      return null;
    }

    const project = await prisma.project.findFirst({
      where: buildProjectAccessWhere({
        projectId,
        organizationId: req.user.organizationId,
        globalAccess: isGlobalAdmin(req.user),
      }),
      select: { id: true, organizationId: true, title: true, archivedAt: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return null;
    }
    if (writable && project.archivedAt) {
      res.status(409).json({ error: "Archived projects cannot be changed." });
      return null;
    }
    return project;
  };

  const loadTask = async (req, res, project) => {
    const taskId = parseProjectTaskId(req.params.taskId);
    if (!taskId) {
      res.status(400).json({ error: "Task id must be a valid number." });
      return null;
    }
    const task = await prisma.projectTask.findFirst({
      where: buildProjectTaskAccessWhere({
        taskId,
        projectId: project.id,
        organizationId: project.organizationId,
      }),
      include: taskInclude,
    });
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return null;
    }
    return task;
  };

  const resolveAssignee = async (value, organizationId) => {
    if (value === undefined) return { provided: false };
    if (value === null || value === "") return { provided: true, assigneeUserId: null };
    const assigneeUserId = parseProjectTaskId(value);
    if (!assigneeUserId) return { error: "assigneeUserId must be a valid user id or null." };
    const user = await prisma.user.findFirst({
      where: { id: assigneeUserId, organizationId },
      select: { id: true },
    });
    if (!user) return { error: "assigneeUserId must belong to the task organization." };
    return { provided: true, assigneeUserId: user.id };
  };

  const updateTask = async (req, res, { statusOnly = false } = {}) => {
    const project = await loadProject(req, res, { writable: true });
    if (!project) return;
    const task = await loadTask(req, res, project);
    if (!task) return;
    if (task.archivedAt) {
      return res.status(409).json({ error: "Archived tasks cannot be changed." });
    }

    const updateData = {};
    if (!statusOnly && req.body?.title !== undefined) {
      const title = normalizeProjectTaskText(req.body.title, { maxLength: 240, nullable: false });
      if (!title) return res.status(400).json({ error: "title is required" });
      updateData.title = title;
    }
    if (!statusOnly && req.body?.description !== undefined) {
      updateData.description = normalizeProjectTaskText(req.body.description, { maxLength: 2000 });
    }
    if (req.body?.status !== undefined) {
      const status = normalizeProjectTaskStatus(req.body.status, "");
      if (!status) {
        return res.status(400).json({ error: "status must be BACKLOG, TODO, IN_PROGRESS, REVIEW, BLOCKED, or DONE" });
      }
      updateData.status = status;
      updateData.completedAt = resolveProjectTaskCompletion({
        status,
        currentCompletedAt: task.completedAt,
      });
    } else if (statusOnly) {
      return res.status(400).json({ error: "status is required" });
    }

    if (!statusOnly && req.body?.priority !== undefined) {
      const priority = normalizeProjectTaskPriority(req.body.priority, "");
      if (!priority) {
        return res.status(400).json({ error: "priority must be LOW, MEDIUM, HIGH, or URGENT" });
      }
      updateData.priority = priority;
    }

    if (!statusOnly) {
      const assignee = await resolveAssignee(req.body?.assigneeUserId, project.organizationId);
      if (assignee.error) return res.status(400).json({ error: assignee.error });
      if (assignee.provided) updateData.assigneeUserId = assignee.assigneeUserId;

      if (req.body?.startDate !== undefined || req.body?.dueDate !== undefined) {
        const dates = parseProjectTaskDates({
          startDate: req.body?.startDate !== undefined ? req.body.startDate : task.startDate,
          dueDate: req.body?.dueDate !== undefined ? req.body.dueDate : task.dueDate,
        });
        if (dates.error) return res.status(400).json({ error: dates.error });
        if (req.body?.startDate !== undefined) updateData.startDate = dates.startDate;
        if (req.body?.dueDate !== undefined) updateData.dueDate = dates.dueDate;
      }
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({ error: "No supported task fields were provided." });
    }

    const updatedTask = await prisma.projectTask.update({
      where: { id: task.id },
      data: updateData,
      include: taskInclude,
    });
    const changedFields = getChangedTaskFields(task, updatedTask);
    const activityActions = getTaskActivityActions({
      previousTask: task,
      updatedTask,
      changedFields,
    });
    await Promise.all(activityActions.map((action) => {
      let summary = `Updated task ${updatedTask.title}.`;
      let metadata = { changedFields };
      if (action === PROJECT_ACTIVITY_ACTIONS.TASK_COMPLETED) {
        summary = `Completed task ${updatedTask.title}.`;
        metadata = { previousStatus: task.status, status: updatedTask.status };
      } else if (action === PROJECT_ACTIVITY_ACTIONS.TASK_REOPENED) {
        summary = `Reopened task ${updatedTask.title}.`;
        metadata = { previousStatus: task.status, status: updatedTask.status };
      } else if (action === PROJECT_ACTIVITY_ACTIONS.TASK_STATUS_CHANGED) {
        summary = `Moved task ${updatedTask.title} from ${task.status} to ${updatedTask.status}.`;
        metadata = { previousStatus: task.status, status: updatedTask.status };
      } else if (action === PROJECT_ACTIVITY_ACTIONS.TASK_ASSIGNED) {
        summary = updatedTask.assigneeUser
          ? `Assigned task ${updatedTask.title} to ${updatedTask.assigneeUser.fullName}.`
          : `Unassigned task ${updatedTask.title}.`;
        metadata = {
          previousAssigneeUserId: task.assigneeUserId,
          assigneeUserId: updatedTask.assigneeUserId,
        };
      }
      return recordActivity({
        prisma,
        req,
        action,
        organizationId: project.organizationId,
        project,
        task: updatedTask,
        summary,
        metadata,
      });
    }));
    let responseTask = updatedTask;
    if (syncTaskToTrello && activityActions.length) {
      const syncResult = await syncTaskToTrello(updatedTask.id);
      if (syncResult?.task) responseTask = { ...updatedTask, ...syncResult.task };
    }
    return res.json(serializeProjectTask(responseTask));
  };

  return {
    assignees: async (req, res) => {
      const project = await loadProject(req, res);
      if (!project) return;
      const users = await prisma.user.findMany({
        where: { organizationId: project.organizationId, status: "ACTIVE" },
        select: { id: true, fullName: true, email: true },
        orderBy: [{ fullName: "asc" }, { email: "asc" }],
      });
      res.json({ assignees: users });
    },

    list: async (req, res) => {
      const project = await loadProject(req, res);
      if (!project) return;
      const includeArchived = String(req.query?.includeArchived || "").toLowerCase() === "true";
      const tasks = await prisma.projectTask.findMany({
        where: buildProjectTaskListWhere({
          projectId: project.id,
          organizationId: project.organizationId,
          includeArchived,
        }),
        include: taskInclude,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      });
      res.json({ tasks: tasks.map(serializeProjectTask) });
    },

    detail: async (req, res) => {
      const project = await loadProject(req, res);
      if (!project) return;
      const task = await loadTask(req, res, project);
      if (task) res.json(serializeProjectTask(task));
    },

    create: async (req, res) => {
      const project = await loadProject(req, res, { writable: true });
      if (!project) return;
      const title = normalizeProjectTaskText(req.body?.title, { maxLength: 240, nullable: false });
      if (!title) return res.status(400).json({ error: "title is required" });
      const status = normalizeProjectTaskStatus(req.body?.status);
      if (!status) {
        return res.status(400).json({ error: "status must be BACKLOG, TODO, IN_PROGRESS, REVIEW, BLOCKED, or DONE" });
      }
      const priority = normalizeProjectTaskPriority(req.body?.priority);
      if (!priority) {
        return res.status(400).json({ error: "priority must be LOW, MEDIUM, HIGH, or URGENT" });
      }
      const dates = parseProjectTaskDates({
        startDate: req.body?.startDate,
        dueDate: req.body?.dueDate,
      });
      if (dates.error) return res.status(400).json({ error: dates.error });
      const assignee = await resolveAssignee(req.body?.assigneeUserId, project.organizationId);
      if (assignee.error) return res.status(400).json({ error: assignee.error });

      const task = await prisma.projectTask.create({
        data: {
          organizationId: project.organizationId,
          projectId: project.id,
          title,
          description: normalizeProjectTaskText(req.body?.description, { maxLength: 2000 }),
          status,
          priority,
          assigneeUserId: assignee.provided ? assignee.assigneeUserId : null,
          startDate: dates.startDate,
          dueDate: dates.dueDate,
          completedAt: resolveProjectTaskCompletion({ status }),
        },
        include: taskInclude,
      });
      await recordActivity({
        prisma,
        req,
        action: PROJECT_ACTIVITY_ACTIONS.TASK_CREATED,
        organizationId: project.organizationId,
        project,
        task,
        summary: `Created task ${task.title}.`,
        metadata: { status: task.status, assigneeUserId: task.assigneeUserId },
      });
      let responseTask = task;
      if (syncTaskToTrello) {
        const syncResult = await syncTaskToTrello(task.id);
        if (syncResult?.task) responseTask = { ...task, ...syncResult.task };
      }
      res.status(201).json(serializeProjectTask(responseTask));
    },

    update: (req, res) => updateTask(req, res),
    updateStatus: (req, res) => updateTask(req, res, { statusOnly: true }),

    archive: async (req, res) => {
      const project = await loadProject(req, res, { writable: true });
      if (!project) return;
      const task = await loadTask(req, res, project);
      if (!task) return;
      const archiveUpdate = resolveProjectTaskArchiveUpdate({
        archived: req.body?.archived === undefined ? true : req.body.archived,
        currentArchivedAt: task.archivedAt,
      });
      if (archiveUpdate.error) return res.status(400).json({ error: archiveUpdate.error });
      const updatedTask = await prisma.projectTask.update({
        where: { id: task.id },
        data: { archivedAt: archiveUpdate.archivedAt },
        include: taskInclude,
      });
      if (!task.archivedAt && updatedTask.archivedAt) {
        await recordActivity({
          prisma,
          req,
          action: PROJECT_ACTIVITY_ACTIONS.TASK_ARCHIVED,
          organizationId: project.organizationId,
          project,
          task: updatedTask,
          summary: `Archived task ${updatedTask.title}.`,
        });
      } else if (task.archivedAt && !updatedTask.archivedAt) {
        await recordActivity({
          prisma,
          req,
          action: PROJECT_ACTIVITY_ACTIONS.TASK_UPDATED,
          organizationId: project.organizationId,
          project,
          task: updatedTask,
          summary: `Restored task ${updatedTask.title}.`,
          metadata: { changedFields: ["archivedAt"] },
        });
      }
      res.json(serializeProjectTask(updatedTask));
    },
  };
};

export const registerProjectTaskRoutes = (
  app,
  { prisma, authMiddleware, isGlobalAdmin, syncTaskToTrello = null }
) => {
  const handlers = createProjectTaskHandlers({ prisma, isGlobalAdmin, syncTaskToTrello });
  const collectionPath = "/api/projects/:projectId/tasks";
  const itemPath = "/api/projects/:projectId/tasks/:taskId";

  app.get("/api/projects/:projectId/task-assignees", authMiddleware, asyncHandler(handlers.assignees));
  app.get(collectionPath, authMiddleware, asyncHandler(handlers.list));
  app.post(collectionPath, authMiddleware, asyncHandler(handlers.create));
  app.get(itemPath, authMiddleware, asyncHandler(handlers.detail));
  app.patch(itemPath, authMiddleware, asyncHandler(handlers.update));
  app.patch(`${itemPath}/status`, authMiddleware, asyncHandler(handlers.updateStatus));
  app.patch(`${itemPath}/archive`, authMiddleware, asyncHandler(handlers.archive));
};
