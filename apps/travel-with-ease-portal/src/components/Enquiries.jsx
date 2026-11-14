import Button from "./ActionButton.jsx";
import { useEffect, useState } from "react";
import {
  SelectField,
  TextField,
  StatusPill,
  KpiCard,
  InlineNotice,
  AnimatedLoadingState,
} from "@faako/ui";
import { enquiryAnswerSections, formatEnquiryAnswer, initialEnquiryFields, legacyEnquiryFields } from "../lib/enquiryView.js";

const statuses = ["new", "contacted", "closed"];
const serviceOptions = [
  ["readiness", "Travel Readiness Session"], ["full_planning", "Full Trip Planning"],
  ["premium", "Premium Concierge"], ["group", "Group Trip Planning"],
];
export default function Enquiries({ api, session }) {
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [service, setService] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState({ items: [], nextOffset: null });
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    setSelected(null);
    const query = new URLSearchParams({
      offset: String(offset),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(service ? { service } : {}),
      ...(packageFilter ? { package: packageFilter } : {}),
      ...(search ? { search } : {}),
    });
    const request = selectedId
      ? api.get(`/api/agent/inquiries/${selectedId}`, { responseMode: "data" })
      : api.get(`/api/agent/inquiries?${query}`, { responseMode: "data" });
    request
      .then((data) => {
        if (active) {
          if (selectedId) setSelected(data);
          else setResult(data);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [api, offset, status, category, service, packageFilter, search, selectedId, revision]);
  async function changeStatus(nextStatus) {
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/agent/inquiries/${selected.id}/status`, {
        responseMode: "data",
        json: { status: nextStatus, expectedVersion: selected.version },
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="content-editor enquiries-workspace"
      aria-labelledby="enquiries-heading"
    >
      <div className="workspace-intro">
        <h2 id="enquiries-heading">Traveller inbox</h2>
        <p>Follow up with travellers and keep each conversation moving.</p>
      </div>
      {error && (
        <InlineNotice
          tone="danger"
          title="Enquiry request unsuccessful"
          message={error}
        />
      )}
      <Button
        icon="refresh"
        type="button"
        disabled={busy || saving}
        onClick={() => setRevision((value) => value + 1)}
      >
        Refresh
      </Button>
      {selectedId ? (
        <>
          <Button
            icon="back"
            type="button"
            disabled={saving}
            onClick={() => setSelectedId(null)}
          >
            Back to enquiries
          </Button>
          {selected && (
            <article className="enquiry-detail">
              <header className="enquiry-detail-heading">
                <div>
                  <p className="detail-type">
                    {selected.demo ? "STAGING DEMO · " : ""}
                    {selected.kind.replaceAll("_", " ")} enquiry
                  </p>
                  <h3>{selected.contact.name || "Traveller"}</h3>
                  <p className="detail-reference">Reference: {selected.id}</p>
                </div>
                <StatusPill
                  tone={
                    selected.status === "new"
                      ? "warning"
                      : selected.status === "contacted"
                        ? "info"
                        : "neutral"
                  }
                >
                  {selected.status}
                </StatusPill>
              </header>
              <div className="detail-columns">
                <section className="workspace-panel" aria-label="Trip request">
                  <h4>Trip request</h4>
                  <dl className="detail-fields">
                    <div><dt>Enquiry category</dt><dd>{selected.category}</dd></div>
                    <div><dt>Source page</dt><dd>{selected.details?.sourcePath || selected.details?.source || "Legacy enquiry"}</dd></div>
                    {selected.service && <div><dt>Service</dt><dd>{selected.service}</dd></div>}
                    {selected.package && <div><dt>Package</dt><dd>{selected.package}</dd></div>}
                    {selected.details?.questionnaireVersion && <div><dt>Questionnaire version</dt><dd>{selected.details.questionnaireVersion}</dd></div>}
                    {selected.details?.questionnaireCompletedAt && <div><dt>Detailed questionnaire</dt><dd>Completed · <time dateTime={selected.details.questionnaireCompletedAt}>{new Date(selected.details.questionnaireCompletedAt).toLocaleString("en-GH", { timeZone: "Africa/Accra" })}</time></dd></div>}
                    {!selected.details?.questionSnapshots && legacyEnquiryFields(selected.details).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd className="preserve-lines">{formatEnquiryAnswer(value)}</dd></div>)}
                  </dl>
                </section>
                <aside className="workspace-panel enquiry-contact">
                  <h4>Traveller contact</h4>
                  <dl className="detail-fields">
                    <div>
                      <dt>Email</dt>
                      <dd>{selected.contact.email || "Not supplied"}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{selected.contact.phone || "Not supplied"}</dd>
                    </div>
                    {selected.created_at && (
                      <div>
                        <dt>Received · Accra time</dt>
                        <dd>
                          <time dateTime={selected.created_at}>
                            {new Date(selected.created_at).toLocaleString(
                              "en-GH",
                              { timeZone: "Africa/Accra" },
                            )}
                          </time>
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="workspace-caption">
                    Private contact details. Use only to follow up on this
                    enquiry.
                  </p>
                </aside>
              </div>
              {selected.details?.questionSnapshots && initialEnquiryFields(selected.details).length > 0 && <section className="workspace-panel enquiry-answers">
                <h4>Initial enquiry</h4>
                <dl className="detail-fields">{initialEnquiryFields(selected.details).map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1")}</dt><dd className="preserve-lines">{formatEnquiryAnswer(value)}</dd></div>)}</dl>
              </section>}
              {enquiryAnswerSections(selected.details).map((section) => <section className="workspace-panel enquiry-answers" key={section.title}>
                <h4>{section.title}</h4>
                <dl className="detail-fields">{section.items.map((item) => <div key={item.id}><dt>{item.label}</dt><dd className="preserve-lines">{formatEnquiryAnswer(item.value)}</dd></div>)}</dl>
              </section>)}
              <section className="workspace-panel enquiry-progress">
                <h4>Follow-up status</h4>
                <p className="workspace-caption">
                  Update the record after following up. This does not send a
                  message to the traveller.
                </p>
                {session.user.permissions?.includes("enquiries.write") ? (
                  <div
                    className="editor-actions"
                    aria-label="Update enquiry status"
                  >
                    {statuses.map((value) => (
                      <Button
                        icon="check"
                        key={value}
                        type="button"
                        disabled={busy || saving || selected.status === value}
                        onClick={() => changeStatus(value)}
                      >
                        Mark {value}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p>You have read-only access to this enquiry.</p>
                )}
              </section>
            </article>
          )}
        </>
      ) : (
        <>
          <div className="workspace-filters" data-tour="enquiry-filters">
            <SelectField
              label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Enquiry category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">All categories</option>
              <option value="general">General</option>
              <option value="service">Service</option>
              <option value="package">Package</option>
              <option value="direct">Direct</option>
            </SelectField>
            <SelectField label="Service" value={service} onChange={(event) => { setService(event.target.value); setOffset(0); }}>
              <option value="">All services</option>
              {serviceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectField>
            <TextField label="Package" value={packageFilter} onChange={(event) => { setPackageFilter(event.target.value); setOffset(0); }} placeholder="Package name or ID" />
            <TextField label="Search" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} placeholder="Traveller or reference" />
          </div>
          {!busy && !error && (
            <div className="workspace-kpis">
              {statuses.map((value) => (
                <KpiCard
                  key={value}
                  label={value[0].toUpperCase() + value.slice(1)}
                  value={
                    result.items.filter((item) => item.status === value).length
                  }
                  detail="On this filtered page"
                />
              ))}
            </div>
          )}
          {!busy && !error && !result.items.length && (
            <p>No enquiries match these filters.</p>
          )}
          {!busy && !error && (
            <ul className="enquiry-list">
              {result.items.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setSelectedId(item.id)}>
                    {item.demo ? "[STAGING DEMO] " : ""}
                    {item.contact.name || "Traveller"}
                  </button>
                  <span className="enquiry-summary">{item.package || item.service || item.category}</span>
                  <span className="enquiry-meta">
                    <StatusPill
                      tone={
                        item.status === "new"
                          ? "warning"
                          : item.status === "contacted"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {item.status}
                    </StatusPill>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString("en-GH", {
                        timeZone: "Africa/Accra",
                      })}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="editor-actions">
            <Button
              icon="back"
              type="button"
              disabled={busy || offset === 0}
              onClick={() => setOffset((value) => Math.max(0, value - 25))}
            >
              Previous
            </Button>
            <Button
              type="button"
              disabled={busy || result.nextOffset === null}
              onClick={() => setOffset(result.nextOffset)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      {(busy || saving) && (
        <AnimatedLoadingState
          compact
          title={saving ? "Saving status" : "Loading enquiries"}
          message={
            saving
              ? "Waiting for confirmation. Do not submit again."
              : "Retrieving authorised workspace records."
          }
        />
      )}
    </section>
  );
}
