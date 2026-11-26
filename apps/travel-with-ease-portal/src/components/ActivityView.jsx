import { useEffect, useState } from "react";
import {
   SelectField,
  DateField,
  InlineNotice,
  AnimatedLoadingState,
} from "@faako/ui";
import Button from "./ActionButton.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
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
    <div className="activity-details">
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
    </div>
  );
  return (
    <div className="activity-results">
      {copyError && (
        <InlineNotice title="Copy unavailable" message={copyError} />
      )}
      <div className="twe-activity-list" role="list" aria-label={title}>
        {items.length ? items.map(row => (
          <details className="twe-admin-disclosure twe-activity-record" role="listitem" key={row.id}>
            <summary>
              <span className="twe-activity-action"><NavigationIcon name="content"/><strong>{label(row.action)}</strong></span>
              <time dateTime={row.created_at}>{date(row.created_at)}</time>
              <NavigationIcon name="arrow"/>
            </summary>
            <div className="twe-admin-disclosure-body">{details(row)}</div>
          </details>
        )) : <div className="activity-empty"><strong>{emptyTitle}</strong>{emptyMessage && <p>{emptyMessage}</p>}</div>}
      </div>
    </div>
  );
}

export default function ActivityView({ api, security = false }) {
  const [filters, setFilters] = useState({ category: "all", from: "", to: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      <div className="twe-admin-toolbar">
        <Button type="button" icon={filtersOpen ? "up" : "down"} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}>
          Filters{Object.keys(query).filter(key => key !== "category" || query.category !== "all").length ? ` (${Object.keys(query).filter(key => key !== "category" || query.category !== "all").length})` : ""}
        </Button>
        <Button icon="refresh" type="button" disabled={loading} onClick={() => setRefresh(v => v + 1)}>Refresh activity</Button>
      </div>
      {filtersOpen && <form
        className="activity-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor("");
          setPages([]);
          setQuery(
            Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
          );
          setFiltersOpen(false);
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
        <Button type="button" variant="ghost" onClick={() => { setFilters({category:"all",from:"",to:""}); setQuery({category:"all"}); setCursor(""); setPages([]); }}>Reset filters</Button>
      </form>}
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
