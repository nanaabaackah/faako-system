/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiEdit2, FiPlus } from "react-icons/fi";
import { AnimatedLoadingState, DateField, SelectField } from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { readStoredSessionUser } from "../../utils/authSession";
import "./Projects.css";

const PROJECT_STAGES = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "SCOPING", label: "Scoping" },
  { key: "ACTIVE", label: "Active" },
  { key: "REVIEW", label: "Review" },
  { key: "DONE", label: "Done" },
];

const PROJECT_TYPE_OPTIONS = [
  { value: "PERSONAL", label: "Personal" },
  { value: "EXTERNAL", label: "External" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const CURRENCY_OPTIONS = ["CAD", "GHS"];

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatDueDate = (value) => {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatBudget = (project) => {
  const amount = Number(project?.budgetAmount);
  const currency = project?.currency || "CAD";
  if (!Number.isFinite(amount)) return "No budget";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
};

const buildProjectForm = (project = null, organizationId = "") => ({
  title: project?.title || "",
  projectType: project?.projectType || "PERSONAL",
  stage: project?.stage || "BACKLOG",
  priority: project?.priority || "MEDIUM",
  clientName: project?.clientName || "",
  budgetAmount: project?.budgetAmount !== undefined && project?.budgetAmount !== null
    ? String(project.budgetAmount)
    : "",
  currency: project?.currency || "CAD",
  dueDate: toDateInput(project?.dueDate) || "",
  description: project?.description || "",
  externalRef: project?.externalRef || "",
  organizationId: project?.organization?.id ? String(project.organization.id) : organizationId,
});

const getStageIndex = (stage) => PROJECT_STAGES.findIndex((item) => item.key === stage);

export default function Projects() {
  const storedUser = useMemo(() => readStoredSessionUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const userOrgId = storedUser?.organizationId ? String(storedUser.organizationId) : "";
  const [projects, setProjects] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(isAdmin ? "all" : userOrgId);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draggedProjectId, setDraggedProjectId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [formState, setFormState] = useState(() => buildProjectForm(null, userOrgId));
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadOrganizations = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const payload = await apiGet("/api/organizations", {
        fallbackMessage: "Unable to load organizations",
      });
      setOrganizations(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load organizations");
    }
  }, [isAdmin]);

  const loadProjects = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const query = new URLSearchParams();
        if (selectedOrganizationId) {
          if (isAdmin && selectedOrganizationId === "all") {
            query.set("organizationId", "all");
          } else if (selectedOrganizationId !== "all") {
            query.set("organizationId", selectedOrganizationId);
          }
        }

        const payload = await apiGet(`/api/projects?${query.toString()}`, {
          fallbackMessage: "Unable to load projects",
        });
        setProjects(Array.isArray(payload?.projects) ? payload.projects : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load projects");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAdmin, selectedOrganizationId]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!showForm) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showForm]);

  const projectsByStage = useMemo(() => {
    const grouped = Object.fromEntries(PROJECT_STAGES.map((stage) => [stage.key, []]));
    projects.forEach((project) => {
      const bucket = grouped[project.stage] || grouped.BACKLOG;
      bucket.push(project);
    });
    Object.values(grouped).forEach((items) => {
      items.sort((left, right) => {
        const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) return leftDue - rightDue;
        return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
      });
    });
    return grouped;
  }, [projects]);

  const summary = useMemo(() => {
    const activeProjects = projects.filter((project) => !["DONE"].includes(project.stage));
    const external = projects.filter((project) => project.projectType === "EXTERNAL").length;
    const today = new Date(buildTodayDate());
    const dueSoon = projects.filter((project) => {
      if (!project.dueDate || project.stage === "DONE") return false;
      const dueDate = new Date(project.dueDate);
      const days = (dueDate - today) / (24 * 60 * 60 * 1000);
      return days >= 0 && days <= 7;
    }).length;

    return {
      total: projects.length,
      active: activeProjects.length,
      personal: projects.length - external,
      external,
      dueSoon,
    };
  }, [projects]);

  const openCreateModal = () => {
    const defaultOrgId =
      selectedOrganizationId && selectedOrganizationId !== "all"
        ? selectedOrganizationId
        : userOrgId;
    setEditingProjectId(null);
    setFormState(buildProjectForm(null, defaultOrgId));
    setFormError("");
    setShowForm(true);
  };

  const openEditModal = (project) => {
    setEditingProjectId(project.id);
    setFormState(buildProjectForm(project, userOrgId));
    setFormError("");
    setShowForm(true);
  };

  const closeFormModal = () => {
    setShowForm(false);
    setEditingProjectId(null);
    setFormError("");
  };

  const updateFormField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const patchProject = async (projectId, payload, { optimisticStage = "" } = {}) => {
    const previousProjects = projects;
    if (optimisticStage) {
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, stage: optimisticStage } : project
        )
      );
    }

    try {
      const updatedProject = await apiPatch(`/api/projects/${projectId}`, payload, {
        fallbackMessage: "Unable to update project",
      });
      setProjects((current) =>
        current.map((project) => (project.id === projectId ? updatedProject : project))
      );
      setNotice(`Project moved to ${PROJECT_STAGES.find((stage) => stage.key === updatedProject.stage)?.label || updatedProject.stage}.`);
    } catch (patchError) {
      setProjects(previousProjects);
      setError(patchError.message || "Unable to update project");
    }
  };

  const handleDrop = async (stageKey) => {
    const projectId = Number(draggedProjectId);
    const project = projects.find((item) => item.id === projectId);
    setDraggedProjectId(null);
    setDragOverStage("");
    if (!project || project.stage === stageKey) return;
    await patchProject(project.id, { stage: stageKey }, { optimisticStage: stageKey });
  };

  const moveProjectByStep = async (project, step) => {
    const currentIndex = getStageIndex(project.stage);
    const nextStage = PROJECT_STAGES[currentIndex + step];
    if (!nextStage) return;
    await patchProject(project.id, { stage: nextStage.key }, { optimisticStage: nextStage.key });
  };

  const handleSaveProject = async (event) => {
    event.preventDefault();
    setFormError("");

    const title = formState.title.trim();
    if (!title) {
      setFormError("Project title is required.");
      return;
    }

    const budgetAmount = formState.budgetAmount.trim();
    if (budgetAmount && Number(budgetAmount) < 0) {
      setFormError("Budget must be 0 or greater.");
      return;
    }

    const payload = {
      title,
      projectType: formState.projectType,
      stage: formState.stage,
      priority: formState.priority,
      clientName: formState.clientName.trim() || null,
      budgetAmount: budgetAmount || null,
      currency: budgetAmount ? formState.currency : null,
      dueDate: formState.dueDate || null,
      description: formState.description.trim() || null,
      externalRef: formState.externalRef.trim() || null,
      organizationId:
        isAdmin && formState.organizationId ? Number(formState.organizationId) : undefined,
    };

    setIsSaving(true);
    try {
      const savedProject = editingProjectId
        ? await apiPatch(`/api/projects/${editingProjectId}`, payload, {
            fallbackMessage: "Unable to save project",
          })
        : await apiPost("/api/projects", payload, {
            fallbackMessage: "Unable to create project",
          });

      setProjects((current) => {
        if (editingProjectId) {
          return current.map((project) => (project.id === savedProject.id ? savedProject : project));
        }
        return [savedProject, ...current];
      });
      closeFormModal();
      setNotice(editingProjectId ? "Project updated." : "Project created.");
    } catch (saveError) {
      setFormError(saveError.message || "Unable to save project");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page projects-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Projects</h1>
          <p className="muted">Manage personal and external work from one delivery board.</p>
        </div>
        <div className="header-actions">
          {organizations.length ? (
            <div className="projects-org-filter">
              <SelectField
                ariaLabel="Organization"
                value={selectedOrganizationId}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
              >
                {isAdmin ? <option value="all">All organizations</option> : null}
                {organizations.map((organization) => (
                  <option key={organization.id} value={String(organization.id)}>
                    {organization.name}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadProjects({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="button button-primary" type="button" onClick={openCreateModal}>
            <FiPlus aria-hidden="true" />
            <span>New project</span>
          </button>
        </div>
      </header>

      {loading ? (
        <AnimatedLoadingState compact className="panel" title="Loading projects" />
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="notice is-success" role="status">
          {notice}
        </div>
      ) : null}

      <div className="projects-summary-grid">
        {[
          { label: "Total projects", value: summary.total, tone: "info" },
          { label: "Active work", value: summary.active, tone: "success" },
          { label: "External", value: summary.external, tone: "warning" },
          { label: "Due soon", value: summary.dueSoon, tone: summary.dueSoon ? "warning" : "success" },
        ].map((item) => (
          <article className={`bubble-card panel projects-summary-card is-${item.tone}`} key={item.label}>
            <span className="kpi-label">{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <section className="projects-board" aria-label="Projects kanban board">
        {PROJECT_STAGES.map((stage) => {
          const stageProjects = projectsByStage[stage.key] || [];
          return (
            <article
              className={`projects-column glass-card ${dragOverStage === stage.key ? " is-drag-over" : ""}`}
              key={stage.key}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverStage(stage.key);
              }}
              onDragLeave={() => setDragOverStage("")}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(stage.key);
              }}
            >
              <div className="projects-column__header">
                <h2>{stage.label}</h2>
                <span className="status-pill">{stageProjects.length}</span>
              </div>
              <div className="projects-column__cards">
                {stageProjects.map((project) => {
                  const stageIndex = getStageIndex(project.stage);
                  return (
                    <article
                      className={`project-card is-${String(project.priority || "").toLowerCase()}`}
                      draggable
                      key={project.id}
                      onDragStart={(event) => {
                        setDraggedProjectId(project.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(project.id));
                      }}
                      onDragEnd={() => {
                        setDraggedProjectId(null);
                        setDragOverStage("");
                      }}
                    >
                      <div className="project-card__topline">
                        <span className={`status-pill is-${project.projectType === "EXTERNAL" ? "warning" : "info"}`}>
                          {project.projectType === "EXTERNAL" ? "External" : "Personal"}
                        </span>
                        <span className={`project-priority is-${String(project.priority || "").toLowerCase()}`}>
                          {project.priority}
                        </span>
                      </div>
                      <h3>{project.title}</h3>
                      <p className="muted">{project.description || project.clientName || "No description"}</p>
                      <div className="project-card__meta">
                        <span>{project.clientName || project.organization?.name || "Internal"}</span>
                        <span>{formatDueDate(project.dueDate)}</span>
                        <span>{formatBudget(project)}</span>
                      </div>
                      <div className="project-card__footer">
                        <span className="muted">
                          {project.ownerUser?.fullName || project.ownerUser?.email || "Unassigned"}
                        </span>
                        <div className="project-card__actions">
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Move ${project.title} backward`}
                            onClick={() => moveProjectByStep(project, -1)}
                            disabled={stageIndex <= 0}
                          >
                            <FiArrowLeft aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Edit ${project.title}`}
                            onClick={() => openEditModal(project)}
                          >
                            <FiEdit2 aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Move ${project.title} forward`}
                            onClick={() => moveProjectByStep(project, 1)}
                            disabled={stageIndex >= PROJECT_STAGES.length - 1}
                          >
                            <FiArrowRight aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!stageProjects.length ? (
                  <div className="project-card project-card--empty">
                    <span className="muted">No projects</span>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {showForm ? (
        <div className="modal-backdrop" role="presentation">
          <button
            className="modal-dismiss"
            type="button"
            aria-label="Close project form"
            onClick={closeFormModal}
          />
          <article className="modal-card projects-modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Projects</p>
                <h3 id="project-form-title">{editingProjectId ? "Edit project" : "New project"}</h3>
                <p className="muted">Set the ownership, stage, and delivery details.</p>
              </div>
              <button className="button button-ghost" type="button" onClick={closeFormModal}>
                Close
              </button>
            </div>

            {formError ? (
              <div className="notice is-error" role="alert">
                {formError}
              </div>
            ) : null}

            <form className="stack" onSubmit={handleSaveProject}>
              <div className="project-form-grid">
                {isAdmin && organizations.length ? (
                  <SelectField
                    fieldClassName="form-field"
                    label="Organization"
                    value={formState.organizationId}
                    onChange={(event) => updateFormField("organizationId", event.target.value)}
                    required
                  >
                    <option value="">Select organization</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={String(organization.id)}>
                        {organization.name}
                      </option>
                    ))}
                  </SelectField>
                ) : null}
                <label className="form-field">
                  <span>Title</span>
                  <input
                    className="input"
                    type="text"
                    value={formState.title}
                    onChange={(event) => updateFormField("title", event.target.value)}
                    required
                  />
                </label>
                <SelectField
                  fieldClassName="form-field"
                  label="Type"
                  value={formState.projectType}
                  onChange={(event) => updateFormField("projectType", event.target.value)}
                >
                  {PROJECT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  fieldClassName="form-field"
                  label="Stage"
                  value={formState.stage}
                  onChange={(event) => updateFormField("stage", event.target.value)}
                >
                  {PROJECT_STAGES.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  fieldClassName="form-field"
                  label="Priority"
                  value={formState.priority}
                  onChange={(event) => updateFormField("priority", event.target.value)}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <label className="form-field">
                  <span>Client or context</span>
                  <input
                    className="input"
                    type="text"
                    value={formState.clientName}
                    onChange={(event) => updateFormField("clientName", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Budget</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.budgetAmount}
                    onChange={(event) => updateFormField("budgetAmount", event.target.value)}
                  />
                </label>
                <SelectField
                  fieldClassName="form-field"
                  label="Currency"
                  value={formState.currency}
                  onChange={(event) => updateFormField("currency", event.target.value)}
                >
                  {CURRENCY_OPTIONS.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </SelectField>
                <DateField
                  fieldClassName="form-field"
                  label="Due date"
                  value={formState.dueDate}
                  onChange={(event) => updateFormField("dueDate", event.target.value)}
                />
                <label className="form-field">
                  <span>External reference</span>
                  <input
                    className="input"
                    type="text"
                    value={formState.externalRef}
                    onChange={(event) => updateFormField("externalRef", event.target.value)}
                  />
                </label>
              </div>

              <label className="form-field">
                <span>Description</span>
                <textarea
                  className="input"
                  value={formState.description}
                  onChange={(event) => updateFormField("description", event.target.value)}
                />
              </label>

              <div className="header-actions">
                <button className="button button-ghost" type="button" onClick={closeFormModal}>
                  Cancel
                </button>
                <button className="button button-primary" type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingProjectId ? "Save project" : "Create project"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}
    </section>
  );
}
