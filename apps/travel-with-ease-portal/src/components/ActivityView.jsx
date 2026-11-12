import { useEffect, useState } from "react";
import {
  DataTable,
  SelectField,
  DateField,
  InlineNotice,
  AnimatedLoadingState,
} from "@faako/ui";
import Button from "./ActionButton.jsx";
import "../styles/activity.css";

const label = (value) =>
  String(value || "Activity")
    .replaceAll("_", " ")
    .replaceAll(".", " · ");
const date = (value) => (value ? new Date(value).toLocaleString() : "—");
export function ActivityList({
  items,
  title = "Activity history",
  emptyTitle = "No matching activity",
  emptyMessage = "Try a wider date range or another category.",
  renderAction,
}) {
  const [copyError, setCopyError] = useState("");
  const details = (row) => (
    <details className="activity-details">
      <summary>Details</summary>
      <dl>
        <dt>Record</dt>
        <dd>
          <code>{row.record_id || row.id}</code>
        </dd>
        <dt>Actor</dt>
        <dd>
          <code>{row.actor_id || "Not recorded"}</code>
        </dd>
        {row.user_id && (
          <>
            <dt>Affected account</dt>
            <dd>
              <code>{row.user_id}</code>
            </dd>
          </>
        )}
        {row.previous_role && (
          <>
            <dt>Role change</dt>
            <dd>
              {label(row.previous_role)} → {label(row.next_role)}
            </dd>
            <dt>Approval reference</dt>
            <dd>{row.approval_reference}</dd>
          </>
        )}
        {row.request_id && (
          <>
            <dt>Request ID</dt>
            <dd>
              <code>{row.request_id}</code>
              <Button
                icon="copy"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(row.request_id);
                    setCopyError("");
                  } catch {
                    setCopyError(
                      "Copy was unavailable. Select the displayed request ID to copy it manually.",
                    );
                  }
                }}
              >
                Copy request ID
              </Button>
            </dd>
          </>
        )}
      </dl>
      {renderAction?.(row)}
    </details>
  );
  return (
    <div className="activity-results">
      {copyError && (
        <InlineNotice title="Copy unavailable" message={copyError} />
      )}
      <div className="activity-desktop">
        <DataTable
          title={title}
          caption={title}
          rows={items}
          rowKey="id"
          state={items.length ? "ready" : "empty"}
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
          columns={[
            {
              id: "action",
              header: "Activity",
              render: (row) => <strong>{label(row.action)}</strong>,
            },
            {
              id: "date",
              header: "When",
              render: (row) => date(row.created_at),
            },
            { id: "details", header: "Reference", render: details },
          ]}
        />
      </div>
      <div className="activity-mobile" role="list" aria-label={title}>
        {items.length ? (
          items.map((row) => (
            <article role="listitem" key={row.id}>
              <strong>{label(row.action)}</strong>
              <time dateTime={row.created_at}>{date(row.created_at)}</time>
              {details(row)}
            </article>
          ))
        ) : (
          <div className="activity-empty">
            <strong>{emptyTitle}</strong>
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivityView({ api, security = false }) {
  const [filters, setFilters] = useState({ category: "all", from: "", to: "" });
  const [query, setQuery] = useState({ category: "all" }),
    [cursor, setCursor] = useState(""),
    [pages, setPages] = useState([]),
    [result, setResult] = useState({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const parameters = new URLSearchParams({
      ...query,
      ...(cursor ? { cursor } : {}),
    });
    api
      .get(
        `/api/agent/administration/${security ? "security-activity" : "activity"}?${parameters}`,
        { responseMode: "data" },
      )
      .then((data) => {
        if (active) {
          if (!Array.isArray(data?.items))
            throw new Error("Activity response incomplete.");
          setResult(data);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Activity could not be loaded. Check your connection and permissions, then retry.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, security, query, cursor, refresh]);
  const categories = security
    ? ["auth", "staff", "support", "system"]
    : ["content", "media", "publication", "staff", "email_template"];
  return (
    <section
      className="activity-workspace workspace-panel"
      aria-label={security ? "Security activity" : "Workspace activity"}
    >
      <h2>{security ? "Security activity" : "Workspace activity"}</h2>
      <p>
        {security
          ? "Authentication, security and technical administration events."
          : "Changes to this workspace’s content, media, publishing and team access."}
      </p>
      <form
        className="activity-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor("");
          setPages([]);
          setQuery(
            Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
          );
        }}
      >
        <SelectField
          label="Activity category"
          value={filters.category}
          onChange={(event) =>
            setFilters({ ...filters, category: event.target.value })
          }
          options={["all", ...categories].map((value) => ({
            value,
            label: label(value),
          }))}
        />
        <DateField
          label="Activity from"
          value={filters.from}
          onChange={(event) =>
            setFilters({ ...filters, from: event.target.value })
          }
        />
        <DateField
          label="Activity to"
          value={filters.to}
          onChange={(event) =>
            setFilters({ ...filters, to: event.target.value })
          }
        />
        <Button type="submit" icon="filter">
          Apply filters
        </Button>
      </form>
      <Button
        icon="refresh"
        disabled={loading}
        onClick={() => setRefresh((v) => v + 1)}
      >
        Refresh activity
      </Button>
      {loading ? (
        <AnimatedLoadingState
          compact
          title="Loading activity"
          message="Retrieving permitted workspace events."
        />
      ) : error ? (
        <InlineNotice
          tone="danger"
          title="Activity unavailable"
          message={error}
        />
      ) : (
        <>
          <ActivityList items={result.items} />
          <nav className="activity-pagination" aria-label="Activity pages">
            <Button
              icon="back"
              disabled={!pages.length}
              onClick={() => {
                setCursor(pages.at(-1));
                setPages(pages.slice(0, -1));
              }}
            >
              Previous
            </Button>
            <span>Page {pages.length + 1}</span>
            <Button
              disabled={!result.nextCursor}
              onClick={() => {
                setPages([...pages, cursor]);
                setCursor(result.nextCursor);
              }}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
