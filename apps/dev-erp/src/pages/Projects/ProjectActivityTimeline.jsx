import React, { useCallback, useEffect, useState } from "react";
import { FiActivity } from "react-icons/fi";
import { AnimatedLoadingState } from "@faako/ui";
import { apiGet } from "../../api/client";

const formatActivityDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatActivityAction = (value) =>
  String(value || "Activity")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

export default function ProjectActivityTimeline({ projectId, refreshKey = 0 }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiGet(`/api/projects/${projectId}/activity`, {
        fallbackMessage: "Unable to load project activity",
      });
      setActivity(Array.isArray(payload?.activity) ? payload.activity : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load project activity");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity, refreshKey]);

  return (
    <article className="panel project-activity-section">
      <div className="project-activity-header">
        <div>
          <p className="eyebrow">History</p>
          <h2>Recent activity</h2>
          <p className="muted">Important project and task changes from Dev ERP.</p>
        </div>
        <FiActivity aria-hidden="true" />
      </div>

      {loading ? <AnimatedLoadingState compact title="Loading project activity" /> : null}
      {error ? <div className="notice is-error" role="alert">{error}</div> : null}
      {!loading && !error && !activity.length ? (
        <div className="project-activity-empty">
          <strong>No activity yet</strong>
          <span className="muted">New project and task changes will appear here.</span>
        </div>
      ) : null}
      {!loading && !error && activity.length ? (
        <ol className="project-activity-list" aria-label="Recent project activity">
          {activity.map((entry) => (
            <li className="project-activity-entry" key={entry.id}>
              <span className="project-activity-marker" aria-hidden="true" />
              <div>
                <div className="project-activity-entry-heading">
                  <strong>{entry.summary || formatActivityAction(entry.action)}</strong>
                  <span>{formatActivityDateTime(entry.createdAt)}</span>
                </div>
                <div className="project-activity-entry-meta">
                  <span>{entry.actor?.label || "System"}</span>
                  {entry.task?.id ? <span>Task #{entry.task.id}</span> : null}
                  <span>{formatActivityAction(entry.action)}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
