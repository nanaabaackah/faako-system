import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatedLoadingState, DateField, ERPModal, ERPTable, SelectField, TextareaField } from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { formatDateTime } from "../../utils/formatters";
import "./FaakoOnboarding.css";

const DEFAULT_FILTERS = {
  status: "",
  package: "",
  company: "",
  modules: [],
  dateFrom: "",
  dateTo: "",
};

const FALLBACK_STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "APPROVED", label: "Approved" },
  { value: "SETUP_IN_PROGRESS", label: "Setup In Progress" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CLOSED", label: "Closed" },
];

const statusTone = {
  NEW: "info",
  REVIEWED: "warning",
  CONTACTED: "warning",
  PROPOSAL_SENT: "info",
  APPROVED: "success",
  SETUP_IN_PROGRESS: "warning",
  CONVERTED: "success",
  CLOSED: "neutral",
};

const buildQuery = (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      return;
    }
    const normalized = String(value || "").trim();
    if (normalized) params.set(key, normalized);
  });
  return params.toString();
};

const normalizeOptions = (options = [], includeAllLabel = "") => {
  const normalized = Array.isArray(options)
    ? options
        .map((option) => ({
          value: String(option.value || "").trim(),
          label: String(option.label || option.value || "").trim(),
        }))
        .filter((option) => option.value && option.label)
    : [];
  return includeAllLabel ? [{ value: "", label: includeAllLabel }, ...normalized] : normalized;
};

const formatList = (items = []) =>
  Array.isArray(items) && items.length ? items.join(", ") : "N/A";

const getSelectValue = (value) => (Array.isArray(value) ? value[0] || "" : value);

const getEmailDeliveryLabel = (emailDelivery) => {
  const status = String(emailDelivery?.status || "").trim();
  if (!status) return "Not recorded";
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getSubmittedDate = (submission) =>
  submission?.createdAt ? formatDateTime(submission.createdAt) : "N/A";

function StatusPill({ status }) {
  const value = status?.value || "NEW";
  const label = status?.label || "New";
  return <span className={`status-pill is-${statusTone[value] || "info"}`}>{label}</span>;
}

function SummaryCard({ label, value, note }) {
  return (
    <article className="panel bubble-card faako-onboarding-summary-card">
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
      <span className="kpi-delta">{note}</span>
    </article>
  );
}

function SubmissionTable({ submissions, selectedId, loading, archivingId, onSelect, onArchive }) {
  const columns = useMemo(
    () => [
      {
        id: "company",
        header: "Company",
        mobileLabel: "Company",
        render: (submission) => (
          <div className="table-cell-stack faako-table-company">
            <span className="table-strong">{submission.companyName}</span>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact Name",
        mobileLabel: "Contact Name",
        render: (submission) => (
          <div className="table-cell-stack">
            <span className="table-strong">{submission.contactName}</span>
          </div>
        ),
      },
      {
        id: "email",
        header: "Email",
        mobileLabel: "Email",
        render: (submission) => (
          <div className="table-cell-stack">
            <span className="table-strong">{submission.email}</span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        mobileLabel: "Status",
        width: "9rem",
        render: (submission) => <StatusPill status={submission.status} />,
      },
      {
        id: "package",
        header: "Package",
        mobileLabel: "Package",
        render: (submission) => (
          <div className="table-cell-stack">
            <span className="table-strong">{submission.packageTier}</span>
          </div>
        ),
      },
      {
        id: "form_source",
        header: "Form Source",
        mobileLabel: "Form Source",
        render: (submission) => (
            <span className="muted">{submission.formLabel}</span>
        ),
      },
      {
        id: "submitted",
        header: "Submitted",
        mobileLabel: "Submitted",
        render: (submission) => (
          <div className="table-cell-stack">
            <span className="table-strong">{getSubmittedDate(submission)}</span>
          </div>
        ),
      },
      {
        id: "delivery",
        header: "Email",
        mobileLabel: "Email",
        render: (submission) => getEmailDeliveryLabel(submission.emailDelivery),
      },
      {
        id: "actions",
        header: "Actions",
        mobileLabel: "Actions",
        width: "8rem",
        render: (submission) => (
          <div className="faako-table-actions">
            <button
              className="button button-ghost faako-archive-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onArchive(submission);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              disabled={archivingId === submission.id}
            >
              {archivingId === submission.id ? "Archiving..." : "Archive"}
            </button>
          </div>
        ),
      },
    ],
    [archivingId, onArchive]
  );

  return (
    <ERPTable
      className="faako-onboarding-table"
      dense
      mobileMode="cards"
      columns={columns}
      rows={submissions}
      rowKey="id"
      state={loading ? "loading" : "ready"}
      loadingMessage="Loading Faako submissions..."
      emptyTitle="No submissions found"
      emptyMessage="Adjust the filters or wait for a new Faako website submission."
      getRowProps={(submission) => ({
        className: selectedId === submission.id ? "is-active" : "",
        role: "button",
        "aria-label": `Open submission for ${submission.companyName}`,
        tabIndex: 0,
        onClick: () => onSelect(submission.id),
        onKeyDown: (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect(submission.id);
        },
      })}
    />
  );
}

function ResponseSections({ sections = [] }) {
  const visibleSections = sections
    .map((section) => ({
      ...section,
      fields: (Array.isArray(section.fields) ? section.fields : []).filter((field) => {
        const value = String(field?.value || "").trim();
        return value && value !== "N/A";
      }),
    }))
    .filter((section) => section.fields.length);

  if (!visibleSections.length) {
    return (
      <article className="panel faako-response-empty">
        <h3>Submitted answers</h3>
        <p className="muted">No detailed wizard answers were stored for this submission.</p>
      </article>
    );
  }

  return (
    <article className="panel faako-response-panel">
      <div className="panel-header">
        <div>
          <h3>Submitted answers</h3>
          <p className="muted">Only completed or relevant fields are shown.</p>
        </div>
      </div>
      <div className="faako-response-sections">
        {visibleSections.map((section) => (
          <section className="faako-response-section" key={section.key}>
            <h4>{section.title}</h4>
            <dl className="faako-response-list">
            {section.fields.map((field) => (
              <div className="faako-response-field" key={field.key}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}

function DeliveryPanel({ submission }) {
  const delivery = submission?.emailDelivery || null;
  const attempts = Array.isArray(delivery?.attempts) ? delivery.attempts : [];
  const pdf = submission?.pdfSummary || {};

  return (
    <div className="faako-onboarding-side-panels">
      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Email delivery</h3>
            <p className="muted">{getEmailDeliveryLabel(delivery)}</p>
          </div>
        </div>
        {attempts.length ? (
          <div className="faako-delivery-list">
            {attempts.map((attempt, index) => (
              <div className="faako-delivery-item" key={`${attempt.type}-${index}`}>
                <strong>{attempt.type?.replace(/_/g, " ") || "Email copy"}</strong>
                <span>{attempt.status || "unknown"}</span>
                <small>
                  Sent to {attempt.deliveryRecipient || "N/A"}
                  {attempt.wasRerouted ? " (local redirect)" : ""}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No delivery metadata has been recorded for this submission.</p>
        )}
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>PDF summary</h3>
            <p className="muted">{pdf.fileName || "Not stored"}</p>
          </div>
        </div>
        {pdf.stored && pdf.downloadPath ? (
          <a className="button button-primary" href={pdf.downloadPath} target="_blank" rel="noreferrer">
            View PDF
          </a>
        ) : (
          <p className="muted">
            {pdf.note || "PDF summaries are emailed as attachments. No stored download is available yet."}
          </p>
        )}
      </article>
    </div>
  );
}

function Timeline({ entries = [] }) {
  return (
    <article className="panel faako-timeline-panel">
      <div className="panel-header">
        <div>
          <h3>Activity timeline</h3>
          <p className="muted">Submission, email, status, owner, and notes activity.</p>
        </div>
      </div>
      <div className="faako-timeline">
        {entries.length ? (
          entries.map((entry, index) => (
            <div className="faako-timeline-item" key={`${entry.type}-${entry.at}-${index}`}>
              <span className="faako-timeline-dot" aria-hidden="true" />
              <div>
                <strong>{entry.label}</strong>
                <span>{formatDateTime(entry.at)} · {entry.by || "System"}</span>
                {entry.from || entry.to ? (
                  <small>
                    {[entry.from, entry.to].filter(Boolean).join(" → ")}
                  </small>
                ) : null}
                {entry.note ? <small>{entry.note}</small> : null}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No activity has been recorded yet.</p>
        )}
      </div>
    </article>
  );
}

function DetailPanel({
  submission,
  statusOptions,
  onSave,
  onArchive,
  saving,
  archiving,
}) {
  const [draft, setDraft] = useState({
    status: "",
    assignedOwner: "",
    internalNotes: "",
  });

  useEffect(() => {
    setDraft({
      status: submission?.status?.value || "NEW",
      assignedOwner: submission?.assignedOwner || "",
      internalNotes: submission?.internalNotes || "",
    });
  }, [submission]);

  if (!submission) {
    return (
      <div className="panel faako-onboarding-empty">
        <strong>Submission details unavailable</strong>
        <p className="muted">Close this view and reopen the submission from the table.</p>
      </div>
    );
  }

  const handleSave = (event) => {
    event.preventDefault();
    onSave(submission.id, draft);
  };

  return (
    <div className="faako-onboarding-detail">
      <section className="panel faako-onboarding-detail-hero">
        <div>
          <span className="eyebrow">{submission.formLabel}</span>
          <h2>{submission.companyName}</h2>
          <p className="muted">
            {submission.contactName} · {submission.email} · submitted {getSubmittedDate(submission)}
          </p>
        </div>
        <StatusPill status={submission.status} />
      </section>

      <section className="faako-onboarding-detail-grid">
        <article className="panel">
          <h3>Submission snapshot</h3>
          <div className="faako-key-grid">
            <span>Phone</span><strong>{submission.phone}</strong>
            <span>Package</span><strong>{submission.packageTier}</strong>
            <span>Modules</span><strong>{formatList(submission.requestedModules)}</strong>
            <span>Checklist</span><strong>{formatList(submission.setupChecklist)}</strong>
            <span>Timeline</span><strong>{submission.timelinePreference}</strong>
            <span>Website</span><strong>{submission.websiteUrl}</strong>
          </div>
        </article>

        <form className="panel faako-management-panel" onSubmit={handleSave}>
          <h3>Management</h3>
          <SelectField
            label="Status"
            value={draft.status}
            options={statusOptions}
            onChangeValue={(value) => setDraft((current) => ({ ...current, status: getSelectValue(value) }))}
          />
          <TextareaField
            label="Internal notes"
            rows={5}
            value={draft.internalNotes}
            onChange={(event) => setDraft((current) => ({ ...current, internalNotes: event.target.value }))}
            placeholder="Add handoff notes, follow-up decisions, or proposal next steps."
          />
          <div className="faako-management-actions">
            <button className="button button-primary" type="submit" disabled={saving || archiving}>
              {saving ? "Saving..." : "Save updates"}
            </button>
            <button
              className="button button-ghost faako-archive-button"
              type="button"
              onClick={() => onArchive(submission)}
              disabled={saving || archiving}
            >
              {archiving ? "Archiving..." : "Archive submission"}
            </button>
          </div>
        </form>
      </section>

      <section className="faako-onboarding-detail-grid">
        <DeliveryPanel submission={submission} />
        <Timeline entries={submission.activityTimeline} />
      </section>

      <ResponseSections sections={submission.wizardSections} />
    </div>
  );
}

export default function FaakoOnboarding() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, byStatus: {} });
  const [filterOptions, setFilterOptions] = useState({
    statuses: FALLBACK_STATUS_OPTIONS,
    packages: [],
    modules: [],
  });
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const statusOptions = useMemo(
    () => normalizeOptions(filterOptions.statuses?.length ? filterOptions.statuses : FALLBACK_STATUS_OPTIONS),
    [filterOptions.statuses]
  );
  const statusFilterOptions = useMemo(
    () => normalizeOptions(filterOptions.statuses?.length ? filterOptions.statuses : FALLBACK_STATUS_OPTIONS, "All statuses"),
    [filterOptions.statuses]
  );
  const packageOptions = useMemo(
    () => normalizeOptions(filterOptions.packages, "All packages"),
    [filterOptions.packages]
  );
  const moduleOptions = useMemo(
    () => normalizeOptions(filterOptions.modules),
    [filterOptions.modules]
  );

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const payload = await apiGet(`/api/faako-onboarding/${encodeURIComponent(id)}`, {
        fallbackMessage: "Unable to load Faako onboarding submission.",
      });
      setSelectedSubmission(payload?.submission || null);
      if (Array.isArray(payload?.ownerOptions)) setOwnerOptions(payload.ownerOptions);
    } catch (loadError) {
      setError(loadError.message || "Unable to load Faako onboarding submission.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQuery(appliedFilters);
      const payload = await apiGet(`/api/faako-onboarding${query ? `?${query}` : ""}`, {
        fallbackMessage: "Unable to load Faako onboarding submissions.",
      });
      const nextSubmissions = Array.isArray(payload?.submissions) ? payload.submissions : [];
      setSubmissions(nextSubmissions);
      setSummary(payload?.summary || { total: 0, byStatus: {} });
      setFilterOptions(payload?.filters || { statuses: FALLBACK_STATUS_OPTIONS, packages: [], modules: [] });
      if (Array.isArray(payload?.ownerOptions)) setOwnerOptions(payload.ownerOptions);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load Faako onboarding submissions.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleFilterChange = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  };

  const handleSelectSubmission = (id) => {
    setSelectedId(id);
    setSelectedSubmission(null);
    setIsDetailOpen(true);
    loadDetail(id);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedId("");
    setSelectedSubmission(null);
    setDetailLoading(false);
  };

  const handleSave = async (id, draft) => {
    setSaving(true);
    try {
      const payload = await apiPatch(`/api/faako-onboarding/${encodeURIComponent(id)}`, draft, {
        fallbackMessage: "Unable to update Faako onboarding submission.",
      });
      const submission = payload?.submission || null;
      if (submission) {
        setSelectedSubmission(submission);
        setSubmissions((current) =>
          current.map((item) => (item.id === submission.id ? { ...item, ...submission } : item))
        );
      }
<<<<<<< HEAD
      if (payload?.project?.created) {
        setNotice("Faako onboarding submission updated. A project was created for the converted submission.");
      } else if (payload?.project?.error) {
        setNotice("Faako onboarding submission updated, but the converted project could not be created.");
      } else {
        setNotice("Faako onboarding submission updated.");
      }
      setError("");
      await loadSubmissions();
=======
      setError("");
      await loadSubmissions();
      const project = payload?.project || null;
      if (project) {
        setNotice(
          payload?.projectCreated
            ? `Faako onboarding submission updated. Project "${project.title}" was created.`
            : `Faako onboarding submission updated. Linked to project "${project.title}".`
        );
      } else {
        setNotice("Faako onboarding submission updated.");
      }
>>>>>>> origin/main
    } catch (saveError) {
      setError(saveError.message || "Unable to update Faako onboarding submission.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveSubmission = useCallback(async (submission) => {
    const id = submission?.id;
    if (!id) return;
    const submissionLabel = submission.companyName || "this submission";
    const shouldArchive = window.confirm(
      `Archive ${submissionLabel}? It will be hidden from the active submissions list.`
    );
    if (!shouldArchive) return;

    setArchivingId(id);
    setError("");
    setNotice("");
    try {
      await apiPost(`/api/faako-onboarding/${encodeURIComponent(id)}/archive`, {}, {
        fallbackMessage: "Unable to archive Faako onboarding submission.",
      });
      setSubmissions((current) => current.filter((item) => item.id !== id));
      if (selectedId === id) {
        setIsDetailOpen(false);
        setSelectedId("");
        setSelectedSubmission(null);
        setDetailLoading(false);
      }
      await loadSubmissions();
      setNotice("Faako onboarding submission archived.");
    } catch (archiveError) {
      setError(archiveError.message || "Unable to archive Faako onboarding submission.");
    } finally {
      setArchivingId("");
    }
  }, [loadSubmissions, selectedId]);

  const reviewedCount = Number(summary.byStatus?.REVIEWED || 0) + Number(summary.byStatus?.CONTACTED || 0);
  const convertedCount = Number(summary.byStatus?.CONVERTED || 0);

  return (
    <section className="page faako-onboarding-page">
      <header className="page-header">
        <div>
          <h1>Form Submissions</h1>
          <p className="muted">
            Review website onboarding and client setup submissions from the Faako public forms.
          </p>
        </div>
        <div className="header-actions">
          <button className="button button-ghost" type="button" onClick={loadSubmissions} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <div className="notice is-error" role="alert">{error}</div> : null}
      {notice ? <div className="notice is-success" role="status">{notice}</div> : null}

      <section className="kpi-grid" aria-label="Faako onboarding summary">
        <SummaryCard label="Submissions" value={summary.total || 0} note="All Faako intake records" />
        <SummaryCard label="New" value={summary.byStatus?.NEW || 0} note="Waiting for first review" />
        <SummaryCard label="Reviewed / Contacted" value={reviewedCount} note="Active follow-up queue" />
        <SummaryCard label="Converted" value={convertedCount} note="Ready for client setup handoff" />
      </section>

      <section className="panel faako-onboarding-filters">
        <form className="faako-onboarding-filter-grid" onSubmit={handleApplyFilters}>
          <SelectField
            label="Status"
            value={filters.status}
            options={statusFilterOptions}
            onChangeValue={(value) => handleFilterChange("status", getSelectValue(value))}
          />
          <SelectField
            label="Package"
            value={filters.package}
            options={packageOptions}
            onChangeValue={(value) => handleFilterChange("package", getSelectValue(value))}
          />
          <SelectField
            label="Selected modules"
            multiple
            value={filters.modules}
            options={moduleOptions}
            placeholder="Any module"
            onChangeValue={(value) => handleFilterChange("modules", Array.isArray(value) ? value : [value].filter(Boolean))}
          />
          <DateField
            fieldClassName="field"
            label="From"
            value={filters.dateFrom}
            onChange={(event) => handleFilterChange("dateFrom", event.target.value)}
          />
          <DateField
            fieldClassName="field"
            label="To"
            value={filters.dateTo}
            min={filters.dateFrom}
            onChange={(event) => handleFilterChange("dateTo", event.target.value)}
          />
          <div className="faako-filter-actions">
            <button className="button button-primary" type="submit">Apply</button>
            <button
              className="button button-ghost"
              type="button"
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setAppliedFilters(DEFAULT_FILTERS);
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="faako-onboarding-table-region">
        <SubmissionTable
          submissions={submissions}
          selectedId={selectedId}
          loading={loading}
          archivingId={archivingId}
          onSelect={handleSelectSubmission}
          onArchive={handleArchiveSubmission}
        />
      </section>

      <ERPModal
        open={isDetailOpen}
        size="xl"
        className="faako-onboarding-lightbox"
        title={selectedSubmission?.companyName || "Submission detail"}
        description={
          selectedSubmission
            ? `${selectedSubmission.formLabel} · submitted ${getSubmittedDate(selectedSubmission)}`
            : "Loading the selected Faako submission."
        }
        onClose={handleCloseDetail}
        closeOnBackdrop
        closeLabel="Close submission detail"
      >
        {detailLoading ? (
          <AnimatedLoadingState compact title="Loading submission detail" />
        ) : (
          <DetailPanel
            submission={selectedSubmission}
            statusOptions={statusOptions}
            ownerOptions={ownerOptions}
            onSave={handleSave}
            onArchive={handleArchiveSubmission}
            saving={saving}
            archiving={archivingId === selectedSubmission?.id}
          />
        )}
      </ERPModal>
    </section>
  );
}
