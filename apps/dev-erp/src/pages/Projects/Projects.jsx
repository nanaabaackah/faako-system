/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArchive, FiArrowLeft, FiArrowRight, FiEdit2, FiPlus, FiRotateCcw } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatedLoadingState, SelectField } from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { readStoredSessionUser } from "../../utils/authSession";
import ProjectFormModal from "./ProjectFormModal";
import ProjectActivityTimeline from "./ProjectActivityTimeline";
import ProjectTasksSection from "./ProjectTasksSection";
import ProjectTrelloSection from "./ProjectTrelloSection";
import {
  buildProjectForm,
  buildProjectPayload,
  validateProjectForm,
} from "./projectForm";
import {
  getProjectHealthLabel,
  getProjectHealthTone,
  normalizeProjectProgress,
} from "./projectPresentation";
import {
  appendProjectFilterParams,
  createDefaultProjectFilters,
  hasActiveProjectFilters,
} from "./projectFilters";
import "./Projects.css";

const PROJECT_STAGES = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "SCOPING", label: "Scoping" },
  { key: "ACTIVE", label: "Active" },
  { key: "REVIEW", label: "Review" },
  { key: "DONE", label: "Done" },
];

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const formatProjectDate = (value, fallback = "Not set") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDueDate = (value) => formatProjectDate(value, "No due date");

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

const getStageIndex = (stage) => PROJECT_STAGES.findIndex((item) => item.key === stage);

export default function Projects() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const storedUser = useMemo(() => readStoredSessionUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const userOrgId = storedUser?.organizationId ? String(storedUser.organizationId) : "";
  const [projects, setProjects] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(projectId));
  const [detailError, setDetailError] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(isAdmin ? "all" : userOrgId);
  const [filters, setFilters] = useState(createDefaultProjectFilters);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draggedProjectId, setDraggedProjectId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [formState, setFormState] = useState(() =>
    buildProjectForm(null, { organizationId: userOrgId })
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

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
        appendProjectFilterParams(query, { filters, searchQuery });

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
    [filters, isAdmin, searchQuery, selectedOrganizationId]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (projectId) return;
    loadProjects();
  }, [loadProjects, projectId]);

  useEffect(() => {
    if (!projectId) {
      setSelectedProject(null);
      setDetailError("");
      setDetailLoading(false);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError("");
    setSelectedProject(null);
    apiGet(`/api/projects/${projectId}`, { fallbackMessage: "Unable to load project" })
      .then((project) => {
        if (active) setSelectedProject(project);
      })
      .catch((loadError) => {
        if (active) setDetailError(loadError.message || "Unable to load project");
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

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

  const activeFilters = useMemo(
    () => hasActiveProjectFilters({ filters, searchQuery }),
    [filters, searchQuery]
  );

  const visibleProjectStages = useMemo(
    () => (filters.stage === "all"
      ? PROJECT_STAGES
      : PROJECT_STAGES.filter((stage) => stage.key === filters.stage)),
    [filters.stage]
  );

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const clearFilters = () => {
    setFilters(createDefaultProjectFilters());
    setSearchInput("");
    setSearchQuery("");
  };

  const openCreateModal = () => {
    const defaultOrgId =
      selectedOrganizationId && selectedOrganizationId !== "all"
        ? selectedOrganizationId
        : userOrgId;
    setEditingProjectId(null);
    setFormState(
      buildProjectForm(null, { organizationId: defaultOrgId })
    );
    setFormError("");
    setShowForm(true);
  };

  const openEditModal = (project) => {
    setEditingProjectId(project.id);
    setFormState(buildProjectForm(project, { organizationId: userOrgId }));
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

    const validationError = validateProjectForm(formState);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = buildProjectPayload(formState, { includeOrganization: isAdmin });

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
      if (selectedProject?.id === savedProject.id) {
        setSelectedProject(savedProject);
        setActivityRefreshKey((current) => current + 1);
      }
      closeFormModal();
      setNotice(editingProjectId ? "Project updated." : "Project created.");
    } catch (saveError) {
      setFormError(saveError.message || "Unable to save project");
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveProject = async () => {
    if (!selectedProject || isArchiving) return;
    const shouldArchive = !selectedProject.archivedAt;
    if (
      shouldArchive &&
      !window.confirm(`Archive ${selectedProject.title}? It will be hidden from the active projects board.`)
    ) {
      return;
    }

    setIsArchiving(true);
    setDetailError("");
    try {
      const updatedProject = await apiPatch(
        `/api/projects/${selectedProject.id}`,
        { archived: shouldArchive },
        { fallbackMessage: shouldArchive ? "Unable to archive project" : "Unable to restore project" }
      );
      setSelectedProject(updatedProject);
      setNotice(shouldArchive ? "Project archived." : "Project restored to the active board.");
      setActivityRefreshKey((current) => current + 1);
    } catch (archiveError) {
      setDetailError(
        archiveError.message || (shouldArchive ? "Unable to archive project" : "Unable to restore project")
      );
    } finally {
      setIsArchiving(false);
    }
  };

  if (projectId) {
    const detailProgress = normalizeProjectProgress(selectedProject?.progressPercent);
    return (
      <section className="page projects-page project-detail-page">
        <header className="page-header">
          <div>
            <button className="button button-ghost project-detail-back" type="button" onClick={() => navigate("/projects")}>
              <FiArrowLeft aria-hidden="true" />
              <span>Back to projects</span>
            </button>
            <p className="eyebrow">Project overview</p>
            <h1>{selectedProject?.title || "Project"}</h1>
            <p className="muted">{selectedProject?.clientName || "Internal project"}</p>
          </div>
          {selectedProject ? (
            <div className="header-actions">
              {!selectedProject.archivedAt ? (
                <button className="button button-primary" type="button" onClick={() => openEditModal(selectedProject)}>
                  <FiEdit2 aria-hidden="true" />
                  <span>Edit project</span>
                </button>
              ) : null}
              <button
                className="button button-ghost"
                type="button"
                onClick={handleArchiveProject}
                disabled={isArchiving}
              >
                {selectedProject.archivedAt ? <FiRotateCcw aria-hidden="true" /> : <FiArchive aria-hidden="true" />}
                <span>
                  {isArchiving
                    ? selectedProject.archivedAt ? "Restoring..." : "Archiving..."
                    : selectedProject.archivedAt ? "Restore project" : "Archive project"}
                </span>
              </button>
            </div>
          ) : null}
        </header>

        {detailLoading ? <AnimatedLoadingState compact className="panel" title="Loading project" /> : null}
        {detailError ? <div className="notice is-error" role="alert">{detailError}</div> : null}
        {notice ? <div className="notice is-success" role="status">{notice}</div> : null}

        {selectedProject?.archivedAt ? (
          <div className="notice project-archive-notice" role="status">
            <strong>Archived project</strong>
            <span>This project was archived on {formatProjectDate(selectedProject.archivedAt)} and is hidden from the active board.</span>
          </div>
        ) : null}

        {selectedProject && !detailLoading ? (
          <>
            <article className="panel project-detail-summary">
              <div className="project-detail-summary__heading">
                <div>
                  <span className={`project-health is-${getProjectHealthTone(selectedProject.health)}`}>
                    {getProjectHealthLabel(selectedProject.health)}
                  </span>
                  <span className="status-pill">
                    {PROJECT_STAGES.find((stage) => stage.key === selectedProject.stage)?.label || selectedProject.stage}
                  </span>
                </div>
                <strong>{detailProgress}% complete</strong>
              </div>
              <div
                className="project-progress__track"
                role="progressbar"
                aria-label={`${selectedProject.title} progress`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={detailProgress}
              >
                <span style={{ width: `${detailProgress}%` }} />
              </div>
            </article>

            <article className="panel project-detail-grid" aria-label="Project information">
              <div><span>Client</span><strong>{selectedProject.clientName || "Not set"}</strong></div>
              <div><span>Project type</span><strong>{selectedProject.projectType === "EXTERNAL" ? "External" : "Personal"}</strong></div>
              <div><span>Stage</span><strong>{PROJECT_STAGES.find((stage) => stage.key === selectedProject.stage)?.label || selectedProject.stage}</strong></div>
              <div><span>Priority</span><strong>{selectedProject.priority}</strong></div>
              <div><span>Health</span><strong>{getProjectHealthLabel(selectedProject.health)}</strong></div>
              <div><span>Progress</span><strong>{detailProgress}%</strong></div>
              <div><span>Start date</span><strong>{formatProjectDate(selectedProject.startDate)}</strong></div>
              <div><span>Due date</span><strong>{formatDueDate(selectedProject.dueDate)}</strong></div>
              <div><span>Currency</span><strong>{selectedProject.currency || "Not set"}</strong></div>
              <div><span>Budget</span><strong>{formatBudget(selectedProject)}</strong></div>
              <div><span>Created</span><strong>{formatProjectDate(selectedProject.createdAt)}</strong></div>
              <div><span>Updated</span><strong>{formatProjectDate(selectedProject.updatedAt)}</strong></div>
            </article>

            <article className="panel project-detail-description">
              <h2>Description</h2>
              <p>{selectedProject.description || "No description provided."}</p>
            </article>

            <ProjectTasksSection
              projectId={selectedProject.id}
              isProjectArchived={Boolean(selectedProject.archivedAt)}
              onActivityRecorded={() => setActivityRefreshKey((current) => current + 1)}
            />

            <ProjectActivityTimeline
              projectId={selectedProject.id}
              refreshKey={activityRefreshKey}
            />

            <ProjectTrelloSection projectId={selectedProject.id} isAdmin={isAdmin} />
          </>
        ) : null}

        {showForm ? (
          <ProjectFormModal
            isAdmin={isAdmin}
            organizations={organizations}
            formState={formState}
            editingProjectId={editingProjectId}
            formError={formError}
            isSaving={isSaving}
            onFieldChange={updateFormField}
            onSubmit={handleSaveProject}
            onClose={closeFormModal}
            projectStages={PROJECT_STAGES}
          />
        ) : null}
      </section>
    );
  }

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

      <form className="panel projects-filters" onSubmit={handleSearch}>
        <label className="projects-filter-search">
          <span>Search</span>
          <input
            className="input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Project or client"
          />
        </label>
        <div className="projects-filter-field">
          <span>Stage</span>
          <SelectField
            ariaLabel="Filter projects by stage"
            value={filters.stage}
            onChange={(event) => updateFilter("stage", event.target.value)}
          >
            <option value="all">All stages</option>
            {PROJECT_STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
          </SelectField>
        </div>
        <div className="projects-filter-field">
          <span>Priority</span>
          <SelectField
            ariaLabel="Filter projects by priority"
            value={filters.priority}
            onChange={(event) => updateFilter("priority", event.target.value)}
          >
            <option value="all">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </SelectField>
        </div>
        <div className="projects-filter-field">
          <span>Health</span>
          <SelectField
            ariaLabel="Filter projects by health"
            value={filters.health}
            onChange={(event) => updateFilter("health", event.target.value)}
          >
            <option value="all">All health</option>
            <option value="ON_TRACK">On track</option>
            <option value="AT_RISK">At risk</option>
            <option value="BLOCKED">Blocked</option>
          </SelectField>
        </div>
        <div className="projects-filter-field">
          <span>Project type</span>
          <SelectField
            ariaLabel="Filter projects by type"
            value={filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
          >
            <option value="all">All types</option>
            <option value="PERSONAL">Personal</option>
            <option value="EXTERNAL">External</option>
          </SelectField>
        </div>
        <div className="projects-filter-actions">
          <button className="button button-primary" type="submit">Search</button>
          <button
            className="button button-ghost"
            type="button"
            onClick={clearFilters}
            disabled={!activeFilters && !searchInput}
          >
            Clear
          </button>
        </div>
      </form>

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
          <article className={`panel bubble-card projects-summary-card is-${item.tone}`} key={item.label}>
            <span className="kpi-label">{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      {!loading && !projects.length && activeFilters ? (
        <div className="panel projects-filter-empty" role="status">
          <h2>No matching projects</h2>
          <p className="muted">Try changing your search or clearing one of the filters.</p>
          <button className="button button-ghost" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : null}

      {projects.length || !activeFilters ? (
      <section className={`projects-board${visibleProjectStages.length === 1 ? " is-single-stage" : ""}`} aria-label="Projects kanban board">
        {visibleProjectStages.map((stage) => {
          const stageProjects = projectsByStage[stage.key] || [];
          return (
            <article
              className={`glass-card projects-column${dragOverStage === stage.key ? " is-drag-over" : ""}`}
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
              <div className="projects-column__cards ">
                {stageProjects.map((project) => {
                  const stageIndex = getStageIndex(project.stage);
                  const progressPercent = normalizeProjectProgress(project.progressPercent);
                  const healthLabel = getProjectHealthLabel(project.health);
                  const healthTone = getProjectHealthTone(project.health);
                  return (
                    <article
                      className={`bubble-card project-card is-${String(project.priority || "").toLowerCase()}`}
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
                      <Link
                        className="project-card__open-link"
                        to={`/projects/${project.id}`}
                        aria-label={`View ${project.title} project details`}
                        draggable={false}
                      />
                      <div className="project-card__topline">
                        <span className={`status-pill is-${project.projectType === "EXTERNAL" ? "warning" : "info"}`}>
                          {project.projectType === "EXTERNAL" ? "External" : "Personal"}
                        </span>
                        <span className={`project-priority is-${String(project.priority || "").toLowerCase()}`}>
                          {project.priority}
                        </span>
                      </div>
                      <h3>{project.title}</h3>
                      <p className="muted">{project.clientName || project.organization?.name || "Internal"}</p>
                      <div className="project-card__status-line">
                        <span className="status-pill">{stage.label}</span>
                        <span className={`project-health is-${healthTone}`}>{healthLabel}</span>
                      </div>
                      <div className="project-progress">
                        <div className="project-progress__label">
                          <span>Progress</span>
                          <strong>{progressPercent}%</strong>
                        </div>
                        <div
                          className="project-progress__track"
                          role="progressbar"
                          aria-label={`${project.title} progress`}
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={progressPercent}
                        >
                          <span style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                      <div className="project-card__meta">
                        <span><strong>Due:</strong> {formatDueDate(project.dueDate)}</span>
                        <span><strong>Budget:</strong> {formatBudget(project)}</span>
                      </div>
                      <div className="project-card__footer">
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
      ) : null}

      {showForm ? (
        <ProjectFormModal
          isAdmin={isAdmin}
          organizations={organizations}
          formState={formState}
          editingProjectId={editingProjectId}
          formError={formError}
          isSaving={isSaving}
          onFieldChange={updateFormField}
          onSubmit={handleSaveProject}
          onClose={closeFormModal}
          projectStages={PROJECT_STAGES}
        />
      ) : null}
    </section>
  );
}
