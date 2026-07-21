export const PROJECT_TASK_STATUS_OPTIONS = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "REVIEW", label: "Review" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];

export const PROJECT_TASK_PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const isValidDateInput = (value) => {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const buildProjectTaskForm = (task = null) => ({
  title: task?.title || "",
  description: task?.description || "",
  status: task?.status || "BACKLOG",
  priority: task?.priority || "MEDIUM",
  assigneeUserId: task?.assigneeUserId ? String(task.assigneeUserId) : "",
  startDate: toDateInput(task?.startDate),
  dueDate: toDateInput(task?.dueDate),
});

export const validateProjectTaskForm = (form) => {
  if (!String(form?.title || "").trim()) return "Task title is required.";
  if (!isValidDateInput(form?.startDate) || !isValidDateInput(form?.dueDate)) {
    return "Start date and due date must be valid dates.";
  }
  if (form?.startDate && form?.dueDate && form.startDate > form.dueDate) {
    return "Start date cannot be after due date.";
  }
  return "";
};

export const buildProjectTaskPayload = (form) => ({
  title: String(form.title || "").trim(),
  description: String(form.description || "").trim() || null,
  status: form.status,
  priority: form.priority,
  assigneeUserId: form.assigneeUserId ? Number(form.assigneeUserId) : null,
  startDate: form.startDate || null,
  dueDate: form.dueDate || null,
});

export const getProjectTaskStatusLabel = (status) =>
  PROJECT_TASK_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
