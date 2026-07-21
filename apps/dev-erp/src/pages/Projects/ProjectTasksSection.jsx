import React, { useCallback, useEffect, useState } from "react";
import { FiArchive, FiEdit2, FiExternalLink, FiGrid, FiList, FiPlus, FiRefreshCw } from "react-icons/fi";
import { AnimatedLoadingState, SelectField } from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import ProjectTaskFormModal from "./ProjectTaskFormModal";
import {
  PROJECT_TASK_STATUS_OPTIONS,
  buildProjectTaskForm,
  buildProjectTaskPayload,
  getProjectTaskStatusLabel,
  validateProjectTaskForm,
} from "./projectTaskForm";

const formatTaskDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function ProjectTasksSection({
  projectId,
  isProjectArchived = false,
  onActivityRecorded = null,
}) {
  const [tasks, setTasks] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [form, setForm] = useState(buildProjectTaskForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [taskView, setTaskView] = useState("list");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [taskPayload, assigneePayload] = await Promise.all([
        apiGet(`/api/projects/${projectId}/tasks`, { fallbackMessage: "Unable to load tasks" }),
        apiGet(`/api/projects/${projectId}/task-assignees`, { fallbackMessage: "Unable to load task assignees" }),
      ]);
      setTasks(Array.isArray(taskPayload?.tasks) ? taskPayload.tasks : []);
      setAssignees(Array.isArray(assigneePayload?.assignees) ? assigneePayload.assignees : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load tasks");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const openCreate = () => {
    setEditingTaskId(null);
    setForm(buildProjectTaskForm());
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (task) => {
    setEditingTaskId(task.id);
    setForm(buildProjectTaskForm(task));
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTaskId(null);
    setFormError("");
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveTask = async (event) => {
    event.preventDefault();
    const validationError = validateProjectTaskForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = buildProjectTaskPayload(form);
      const savedTask = editingTaskId
        ? await apiPatch(`/api/projects/${projectId}/tasks/${editingTaskId}`, payload, { fallbackMessage: "Unable to save task" })
        : await apiPost(`/api/projects/${projectId}/tasks`, payload, { fallbackMessage: "Unable to create task" });
      setTasks((current) => editingTaskId
        ? current.map((task) => task.id === savedTask.id ? savedTask : task)
        : [...current, savedTask]);
      closeForm();
      setNotice(editingTaskId ? "Task updated." : "Task created.");
      onActivityRecorded?.();
    } catch (saveError) {
      setFormError(saveError.message || "Unable to save task");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (task, status) => {
    if (task.status === status) return;
    const previousStatus = task.status;
    setUpdatingTaskId(task.id);
    setError("");
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    try {
      const updatedTask = await apiPatch(
        `/api/projects/${projectId}/tasks/${task.id}/status`,
        { status },
        { fallbackMessage: "Unable to update task status" }
      );
      setTasks((current) => current.map((item) => item.id === task.id ? updatedTask : item));
      setNotice(status === "DONE" ? "Task completed." : "Task status updated.");
      onActivityRecorded?.();
    } catch (updateError) {
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previousStatus } : item));
      const message = updateError.message || "Unable to update task status";
      setError(`${message} ${task.title} returned to ${getProjectTaskStatusLabel(previousStatus)}.`);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const tasksByStatus = PROJECT_TASK_STATUS_OPTIONS.reduce((groups, option) => {
    groups[option.value] = tasks.filter((task) => task.status === option.value);
    return groups;
  }, {});

  const archiveTask = async (task) => {
    if (!window.confirm(`Archive ${task.title}? It will be hidden from this task list.`)) return;
    setUpdatingTaskId(task.id);
    setError("");
    try {
      await apiPatch(
        `/api/projects/${projectId}/tasks/${task.id}/archive`,
        { archived: true },
        { fallbackMessage: "Unable to archive task" }
      );
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setNotice("Task archived.");
      onActivityRecorded?.();
    } catch (archiveError) {
      setError(archiveError.message || "Unable to archive task");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const syncTaskWithTrello = async (task) => {
    setUpdatingTaskId(task.id);
    setError("");
    try {
      const result = await apiPost(`/api/projects/${projectId}/trello/tasks/${task.id}/sync`, {}, {
        fallbackMessage: "Unable to synchronize task with Trello",
      });
      await loadTasks();
      if (result.synced) setNotice("Task synchronized with Trello.");
      else if (result.error) setError(result.error);
      else setNotice("Connect a Trello board before synchronizing this task.");
    } catch (syncError) {
      setError(syncError.message || "Unable to synchronize task with Trello");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <article className="panel project-tasks-section">
      <div className="project-tasks-header">
        <div>
          <p className="eyebrow">Delivery</p>
          <h2>Tasks</h2>
          <p className="muted">Manage the work required to complete this project.</p>
        </div>
        <div className="project-tasks-header-actions">
          <div className="segmented" role="group" aria-label="Task view">
            <button
              className={`segment ${taskView === "list" ? "is-active" : ""}`}
              type="button"
              aria-pressed={taskView === "list"}
              onClick={() => setTaskView("list")}
            >
              <FiList aria-hidden="true" />
              <span>List</span>
            </button>
            <button
              className={`segment ${taskView === "board" ? "is-active" : ""}`}
              type="button"
              aria-pressed={taskView === "board"}
              onClick={() => setTaskView("board")}
            >
              <FiGrid aria-hidden="true" />
              <span>Board</span>
            </button>
          </div>
          {!isProjectArchived ? (
            <button className="button button-primary" type="button" onClick={openCreate}>
              <FiPlus aria-hidden="true" />
              <span>New task</span>
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <AnimatedLoadingState compact title="Loading tasks" /> : null}
      {error ? <div className="notice is-error" role="alert">{error}</div> : null}
      {notice ? <div className="notice is-success" role="status">{notice}</div> : null}

      {!loading && !tasks.length ? (
        <div className="project-tasks-empty">
          <strong>No active tasks</strong>
          <span className="muted">{isProjectArchived ? "This archived project has no active tasks." : "Create the first task for this project."}</span>
        </div>
      ) : null}

      {!loading && tasks.length && taskView === "list" ? (
        <div className="project-task-list" aria-label="Project tasks">
          {tasks.map((task) => (
            <section className={`project-task-row${task.status === "DONE" ? " is-done" : ""}`} key={task.id}>
              <div className="project-task-main">
                <div className="project-task-heading">
                  <h3>{task.title}</h3>
                  <span className={`project-task-priority is-${String(task.priority || "").toLowerCase()}`}>{task.priority}</span>
                </div>
                {task.description ? <p className="muted">{task.description}</p> : null}
                <div className="project-task-meta">
                  <span><strong>Assignee:</strong> {task.assigneeUser?.fullName || "Unassigned"}</span>
                  <span><strong>Start:</strong> {formatTaskDate(task.startDate)}</span>
                  <span><strong>Due:</strong> {formatTaskDate(task.dueDate)}</span>
                  {task.trelloCardUrl ? (
                    <a href={task.trelloCardUrl} target="_blank" rel="noreferrer">
                      Trello card <FiExternalLink aria-hidden="true" />
                    </a>
                  ) : null}
                  {task.trelloSyncStatus === "ERROR" ? <span className="project-task-sync-error">Trello sync failed</span> : null}
                </div>
              </div>
              <div className="project-task-controls">
                <SelectField
                  ariaLabel={`Status for ${task.title}`}
                  value={task.status}
                  onChange={(event) => changeStatus(task, event.target.value)}
                  disabled={isProjectArchived || updatingTaskId === task.id}
                >
                  {PROJECT_TASK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
                <span className="project-task-status-label">{getProjectTaskStatusLabel(task.status)}</span>
                {!isProjectArchived ? (
                  <div className="project-task-actions">
                    <button className="icon-button" type="button" aria-label={`Edit ${task.title}`} onClick={() => openEdit(task)} disabled={updatingTaskId === task.id}>
                      <FiEdit2 aria-hidden="true" />
                    </button>
                    {task.trelloSyncStatus !== "SYNCED" ? (
                      <button className="icon-button" type="button" aria-label={`Sync ${task.title} with Trello`} onClick={() => syncTaskWithTrello(task)} disabled={updatingTaskId === task.id}>
                        <FiRefreshCw aria-hidden="true" />
                      </button>
                    ) : null}
                    <button className="icon-button" type="button" aria-label={`Archive ${task.title}`} onClick={() => archiveTask(task)} disabled={updatingTaskId === task.id}>
                      <FiArchive aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {!loading && tasks.length && taskView === "board" ? (
        <div className="project-task-board" aria-label="Project task board">
          {PROJECT_TASK_STATUS_OPTIONS.map((column) => {
            const columnTasks = tasksByStatus[column.value] || [];
            const headingId = `project-task-column-${projectId}-${column.value.toLowerCase()}`;
            return (
              <section className="project-task-column" aria-labelledby={headingId} key={column.value}>
                <div className="project-task-column-header">
                  <h3 id={headingId}>{column.label}</h3>
                  <span className="status-pill">{columnTasks.length}</span>
                </div>
                <div className="project-task-column-cards">
                  {columnTasks.length ? columnTasks.map((task) => (
                    <article className={`project-task-board-card${task.status === "DONE" ? " is-done" : ""}`} key={task.id}>
                      <div className="project-task-heading">
                        <h4>{task.title}</h4>
                        <span className={`project-task-priority is-${String(task.priority || "").toLowerCase()}`}>{task.priority}</span>
                      </div>
                      {task.description ? <p className="muted">{task.description}</p> : null}
                      <div className="project-task-board-meta">
                        <span><strong>Assignee:</strong> {task.assigneeUser?.fullName || "Unassigned"}</span>
                        <span><strong>Due:</strong> {formatTaskDate(task.dueDate)}</span>
                        {task.trelloCardUrl ? <a href={task.trelloCardUrl} target="_blank" rel="noreferrer">Trello card</a> : null}
                        {task.trelloSyncStatus === "ERROR" ? <span className="project-task-sync-error">Trello sync failed</span> : null}
                      </div>
                      <SelectField
                        ariaLabel={`Move ${task.title}`}
                        value={task.status}
                        onChange={(event) => changeStatus(task, event.target.value)}
                        disabled={isProjectArchived || updatingTaskId === task.id}
                      >
                        {PROJECT_TASK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>Move to {option.label}</option>)}
                      </SelectField>
                      {!isProjectArchived ? (
                        <div className="project-task-actions">
                          <button className="icon-button" type="button" aria-label={`Edit ${task.title}`} onClick={() => openEdit(task)} disabled={updatingTaskId === task.id}>
                            <FiEdit2 aria-hidden="true" />
                          </button>
                          {task.trelloSyncStatus !== "SYNCED" ? (
                            <button className="icon-button" type="button" aria-label={`Sync ${task.title} with Trello`} onClick={() => syncTaskWithTrello(task)} disabled={updatingTaskId === task.id}>
                              <FiRefreshCw aria-hidden="true" />
                            </button>
                          ) : null}
                          <button className="icon-button" type="button" aria-label={`Archive ${task.title}`} onClick={() => archiveTask(task)} disabled={updatingTaskId === task.id}>
                            <FiArchive aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </article>
                  )) : <p className="project-task-column-empty">No tasks</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {showForm ? (
        <ProjectTaskFormModal
          assignees={assignees}
          editingTaskId={editingTaskId}
          form={form}
          error={formError}
          saving={saving}
          onChange={updateForm}
          onClose={closeForm}
          onSubmit={saveTask}
        />
      ) : null}
    </article>
  );
}
