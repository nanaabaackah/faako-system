const safeText = (value, max = 500) => String(value || "").trim().slice(0, max);

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toISOString().slice(0, 10);
};

export const buildTrelloEmailCard = (task) => {
  const projectTitle = safeText(task?.project?.title, 240) || "Dev ERP project";
  const assignee = safeText(task?.assigneeUser?.fullName || task?.assigneeUser?.email, 240) || "Unassigned";
  const description = safeText(task?.description, 2000);
  const lines = [
    description,
    description ? "" : null,
    `Project: ${projectTitle}`,
    `Status: ${safeText(task?.status, 80).replace(/_/g, " ") || "Backlog"}`,
    `Priority: ${safeText(task?.priority, 80) || "Medium"}`,
    `Assignee: ${assignee}`,
    `Start date: ${formatDate(task?.startDate)}`,
    `Due date: ${formatDate(task?.dueDate)}`,
    `Dev ERP task: #${task?.id}`,
  ].filter((line) => line !== null);

  return {
    subject: safeText(task?.title, 240) || `Dev ERP task #${task?.id}`,
    text: lines.join("\n"),
  };
};

export const createTrelloEmailSyncService = ({
  prisma,
  sendEmailToBoard,
  configured = false,
  boardName = "",
  listName = "",
}) => ({
  getConfiguration() {
    return {
      mode: "email_to_board",
      configured: Boolean(configured && typeof sendEmailToBoard === "function"),
      boardName: safeText(boardName, 180) || "Trello board",
      listName: safeText(listName, 180) || null,
    };
  },

  async syncTask(taskId) {
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { id: true, title: true } },
        assigneeUser: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!task || task.archivedAt) return { synced: false, skipped: true };
    if (!configured || typeof sendEmailToBoard !== "function") {
      return { synced: false, skipped: true, reason: "not_configured" };
    }
    if (task.trelloSyncStatus === "SYNCED") {
      return { synced: false, skipped: true, reason: "already_delivered", task };
    }

    try {
      await sendEmailToBoard(buildTrelloEmailCard(task));
      const now = new Date();
      const updatedTask = await prisma.projectTask.update({
        where: { id: task.id },
        data: {
          trelloSyncStatus: "SYNCED",
          trelloLastSyncSource: "DEV_ERP",
          trelloLastSyncedAt: now,
          trelloLastError: null,
        },
      });
      return { synced: true, task: updatedTask };
    } catch (error) {
      const message = safeText(error?.message || "Trello email delivery failed.", 500);
      const updatedTask = await prisma.projectTask.update({
        where: { id: task.id },
        data: { trelloSyncStatus: "ERROR", trelloLastError: message },
      }).catch(() => null);
      return { synced: false, error: message, task: updatedTask };
    }
  },
});
