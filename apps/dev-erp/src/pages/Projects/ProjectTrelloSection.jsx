import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiExternalLink, FiRefreshCw } from "react-icons/fi";
import { AnimatedLoadingState, SelectField } from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { PROJECT_TASK_STATUS_OPTIONS } from "./projectTaskForm";

const emptyMappings = () => Object.fromEntries(
  PROJECT_TASK_STATUS_OPTIONS.map((option) => [option.value, ""])
);

export default function ProjectTrelloSection({ projectId, isAdmin }) {
  const [payload, setPayload] = useState({ connection: null, recentErrors: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryingTaskId, setRetryingTaskId] = useState(null);
  const [lists, setLists] = useState([]);
  const [form, setForm] = useState({
    apiKey: "",
    apiToken: "",
    appSecret: "",
    boardId: "",
    statusMappings: emptyMappings(),
  });

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const result = await apiGet(`/api/projects/${projectId}/trello`, {
        fallbackMessage: "Unable to load Trello integration",
      });
      setPayload({
        connection: result?.connection || null,
        recentErrors: Array.isArray(result?.recentErrors) ? result.recentErrors : [],
      });
    } catch (loadError) {
      setError(loadError.message || "Unable to load Trello integration");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, projectId]);

  useEffect(() => { load(); }, [load]);

  const openForm = () => {
    const connection = payload.connection;
    const mappings = emptyMappings();
    PROJECT_TASK_STATUS_OPTIONS.forEach((option) => {
      mappings[option.value] = connection?.statusMappings?.[option.value]?.listId
        || connection?.statusMappings?.[option.value]
        || "";
    });
    setLists(Object.values(connection?.statusMappings || {}).map((entry) => ({
      id: entry?.listId || entry,
      name: entry?.listName || entry?.listId || entry,
    })).filter((entry, index, items) => entry.id && items.findIndex((item) => item.id === entry.id) === index));
    setForm({
      apiKey: "",
      apiToken: "",
      appSecret: "",
      boardId: connection?.boardId || "",
      statusMappings: mappings,
    });
    setError("");
    setNotice("");
    setShowForm(true);
  };

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateMapping = (status, listId) => setForm((current) => ({
    ...current,
    statusMappings: { ...current.statusMappings, [status]: listId },
  }));

  const credentialPayload = () => ({
    ...(form.apiKey ? { apiKey: form.apiKey } : {}),
    ...(form.apiToken ? { apiToken: form.apiToken } : {}),
    ...(form.appSecret ? { appSecret: form.appSecret } : {}),
    boardId: form.boardId,
  });

  const discover = async () => {
    setDiscovering(true);
    setError("");
    try {
      const result = await apiPost(`/api/projects/${projectId}/trello/discover`, credentialPayload(), {
        fallbackMessage: "Unable to load Trello board",
      });
      setLists(Array.isArray(result?.lists) ? result.lists : []);
      setNotice(`Loaded ${result?.board?.name || "Trello board"}. Map every task status, then save.`);
    } catch (discoverError) {
      setError(discoverError.message || "Unable to load Trello board");
    } finally {
      setDiscovering(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const statusMappings = Object.fromEntries(PROJECT_TASK_STATUS_OPTIONS.map((option) => {
        const listId = form.statusMappings[option.value];
        const list = lists.find((item) => item.id === listId);
        return [option.value, { listId, listName: list?.name || null }];
      }));
      const result = await apiPatch(`/api/projects/${projectId}/trello/connection`, {
        ...credentialPayload(),
        statusMappings,
      }, { fallbackMessage: "Unable to save Trello connection" });
      setPayload((current) => ({ ...current, connection: result.connection }));
      setShowForm(false);
      setNotice(result.webhookError
        ? `Connection saved. ${result.webhookError}`
        : "Trello connection and webhook saved.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "Unable to save Trello connection");
    } finally {
      setSaving(false);
    }
  };

  const retryTask = async (taskId) => {
    setRetryingTaskId(taskId);
    setError("");
    try {
      const result = await apiPost(`/api/projects/${projectId}/trello/tasks/${taskId}/sync`, {}, {
        fallbackMessage: "Unable to retry Trello sync",
      });
      setNotice(result.synced ? "Task synchronized with Trello." : result.error || "Task was not synchronized.");
      await load();
    } catch (retryError) {
      setError(retryError.message || "Unable to retry Trello sync");
    } finally {
      setRetryingTaskId(null);
    }
  };

  const allMapped = useMemo(
    () => PROJECT_TASK_STATUS_OPTIONS.every((option) => form.statusMappings[option.value]),
    [form.statusMappings]
  );

  if (!isAdmin) return null;
  const connection = payload.connection;

  return (
    <article className="panel project-trello-section">
      <div className="project-trello-header">
        <div>
          <p className="eyebrow">Integration</p>
          <h2>Trello</h2>
          <p className="muted">Dev ERP remains the source of truth for project tasks.</p>
        </div>
        {!loading ? (
          <button className="button button-ghost" type="button" onClick={openForm}>
            {connection ? "Edit connection" : "Connect Trello"}
          </button>
        ) : null}
      </div>

      {loading ? <AnimatedLoadingState compact title="Loading Trello integration" /> : null}
      {error ? <div className="notice is-error" role="alert">{error}</div> : null}
      {notice ? <div className="notice is-success" role="status">{notice}</div> : null}

      {!loading && connection ? (
        <div className="project-trello-summary">
          <div>
            <span>Board</span>
            {connection.boardUrl ? (
              <a href={connection.boardUrl} target="_blank" rel="noreferrer">
                {connection.boardName || connection.boardId} <FiExternalLink aria-hidden="true" />
              </a>
            ) : <strong>{connection.boardName || connection.boardId}</strong>}
          </div>
          <div><span>Outbound sync</span><strong>{connection.status === "ACTIVE" ? "Active" : connection.status}</strong></div>
          <div><span>Inbound webhook</span><strong>{connection.webhookConfigured ? "Connected" : "Not configured"}</strong></div>
          <div><span>Last sync</span><strong>{connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString("en-US") : "Not yet"}</strong></div>
        </div>
      ) : null}
      {!loading && connection?.lastError ? <div className="notice is-error" role="alert">{connection.lastError}</div> : null}
      {!loading && !connection && !showForm ? <p className="muted">No Trello board is connected for this organization.</p> : null}

      {showForm ? (
        <form className="project-trello-form" onSubmit={save}>
          <div className="project-trello-credentials">
            <label className="form-field"><span>API key</span><input className="input" value={form.apiKey} onChange={(event) => updateField("apiKey", event.target.value)} placeholder={connection ? "Leave blank to keep saved key" : "Trello API key"} /></label>
            <label className="form-field"><span>API token</span><input className="input" type="password" value={form.apiToken} onChange={(event) => updateField("apiToken", event.target.value)} placeholder={connection ? "Leave blank to keep saved token" : "Trello API token"} /></label>
            <label className="form-field"><span>Application secret</span><input className="input" type="password" value={form.appSecret} onChange={(event) => updateField("appSecret", event.target.value)} placeholder={connection ? "Leave blank to keep saved secret" : "Webhook signing secret"} /></label>
            <label className="form-field"><span>Board ID</span><input className="input" value={form.boardId} onChange={(event) => updateField("boardId", event.target.value)} required /></label>
          </div>
          <button className="button button-ghost" type="button" onClick={discover} disabled={discovering || !form.boardId}>
            <FiRefreshCw aria-hidden="true" /> {discovering ? "Loading board..." : "Load board lists"}
          </button>
          {lists.length ? (
            <div className="project-trello-mappings" aria-label="Trello status mappings">
              {PROJECT_TASK_STATUS_OPTIONS.map((option) => (
                <SelectField key={option.value} label={option.label} value={form.statusMappings[option.value]} onChange={(event) => updateMapping(option.value, event.target.value)}>
                  <option value="">Choose Trello list</option>
                  {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </SelectField>
              ))}
            </div>
          ) : null}
          <div className="header-actions">
            <button className="button button-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={saving || !allMapped}>{saving ? "Saving..." : "Save connection"}</button>
          </div>
        </form>
      ) : null}

      {payload.recentErrors.length ? (
        <div className="project-trello-errors">
          <h3>Sync errors</h3>
          {payload.recentErrors.map((task) => (
            <div key={task.id}>
              <span><strong>{task.title}</strong><small>{task.trelloLastError}</small></span>
              <button className="button button-ghost" type="button" onClick={() => retryTask(task.id)} disabled={retryingTaskId === task.id}>
                {retryingTaskId === task.id ? "Retrying..." : "Retry"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
