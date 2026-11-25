import Button from "./ActionButton.jsx";
import { useEffect, useRef, useState } from "react";
import "../styles/dashboard-navigation.css";
import {
  SelectField,
  TextField,
  StatusPill,
  KpiCard,
  InlineNotice,
  AnimatedLoadingState,
  useToast,
} from "@faako/ui";
import { enquiryAnswerSections, formatEnquiryAnswer, initialEnquiryFields, legacyEnquiryFields, versionedIntakeFields } from "../lib/enquiryView.js";

const statuses = ["new", "contacted", "closed"];
const serviceOptions = [
  ["readiness", "Travel Readiness Session"], ["full_planning", "Full Trip Planning"],
  ["premium", "Premium Concierge"], ["group", "Group Trip Planning"],
];
export default function Enquiries({ api, session, initialStatus = "", initialEnquiryId = null, onRefreshBlockedChange }) {
  const { pushToast } = useToast();
  const [status, setStatus] = useState(statuses.includes(initialStatus) ? initialStatus : "");
  const [category, setCategory] = useState("");
  const [service, setService] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState({ items: [], nextOffset: null });
  const [selectedId, setSelectedId] = useState(initialEnquiryId);
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const [listBusy, setListBusy] = useState(true);
  const [detailBusy, setDetailBusy] = useState(Boolean(initialEnquiryId));
  const [listError, setListError] = useState("");
  const busy = listBusy || detailBusy;
  const detailRef = useRef(null);
  const rowRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    onRefreshBlockedChange?.(busy || saving);
    return () => onRefreshBlockedChange?.(false);
  }, [busy, saving, onRefreshBlockedChange]);
  // Keep the list mounted independently of the selected detail. Changing
  // selection never refetches or resets the current page and filters.
  useEffect(() => {
    let active = true;
    setListBusy(true);
    setListError("");
    const query = new URLSearchParams({
      offset: String(offset),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(service ? { service } : {}),
      ...(packageFilter ? { package: packageFilter } : {}),
      ...(search ? { search } : {}),
    });
    api.get(`/api/agent/inquiries?${query}`, { responseMode: "data" })
      .then(data => { if (active) setResult(data); })
      .catch(() => { if (active) setListError("Enquiries could not load. Try refreshing."); })
      .finally(() => { if (active) setListBusy(false); });
    return () => { active = false; };
  }, [api, offset, status, category, service, packageFilter, search, revision]);
  useEffect(() => {
    let active = true;
    setError("");
    setSelected(null);
    if (!selectedId) { setDetailBusy(false); return; }
    setDetailBusy(true);
    api.get(`/api/agent/inquiries/${selectedId}`, { responseMode: "data" })
      .then(data => { if (active) setSelected(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setDetailBusy(false); });
    return () => { active = false; };
  }, [api, selectedId, revision]);
  const chooseEnquiry = (id, event) => {
    if (saving || id === selectedId) return;
    rowRef.current = event.currentTarget;
    setSelectedId(id);
    requestAnimationFrame(() => {
      if (matchMedia("(max-width: 1199px)").matches) detailRef.current?.focus();
    });
  };
  const closeDetail = () => {
    if (saving) return;
    setSelectedId(null);
    requestAnimationFrame(() => rowRef.current?.focus());
  };
  async function changeStatus(nextStatus) {
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/agent/inquiries/${selected.id}/status`, {
        responseMode: "data",
        json: { status: nextStatus, expectedVersion: selected.version },
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      pushToast({ tone: "success", title: "Enquiry updated", message: `Marked ${nextStatus}. No message was sent to the traveller.` });
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
      <div className="enquiry-workspace-toolbar">
        <h2 id="enquiries-heading">Traveller inbox</h2>
      <Button
        icon="refresh"
        type="button"
        disabled={busy || saving}
        onClick={() => setRevision((value) => value + 1)}
      >
        Refresh
      </Button>
      </div>
      <div className={`enquiry-workspace-split${selectedId ? " has-selection" : ""}`}>
        <div className="enquiry-workspace-detail" ref={detailRef} tabIndex={-1} aria-label="Enquiry details">
      {selectedId ? (
        <>
          <Button
            icon="back"
            type="button"
            disabled={saving}
            onClick={closeDetail}
          >
            Back to enquiries
          </Button>
          {error && <InlineNotice tone="danger" title="Enquiry request unsuccessful" message={error}/>}
          {detailBusy && <AnimatedLoadingState compact title="Loading enquiry"/>}
          {selected?.id === selectedId && (
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
                    {!selected.details?.questionSnapshots && !selected.details?.intakeSnapshot && legacyEnquiryFields(selected.details).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd className="preserve-lines">{formatEnquiryAnswer(value)}</dd></div>)}
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
                </aside>
              </div>
              {selected.details?.intakeSnapshot && <section className="workspace-panel enquiry-answers">
                <h4>Initial enquiry · Version {selected.details.intakeSnapshot.version}</h4>
                <dl className="detail-fields">{versionedIntakeFields(selected.details).map(item => <div key={item.id}><dt>{item.label}</dt><dd className="preserve-lines">{formatEnquiryAnswer(item.value)}</dd></div>)}</dl>
              </section>}
              {!selected.details?.intakeSnapshot && selected.details?.questionSnapshots && initialEnquiryFields(selected.details).length > 0 && <section className="workspace-panel enquiry-answers">
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
                  Status only · No message sent.
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
                        loading={saving}
                        loadingLabel="Saving status…"
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
      ) : <div className="enquiry-empty-detail"><h3>Select an enquiry</h3></div>}
        </div>
        <div className="enquiry-workspace-list">
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
          {listError && <InlineNotice tone="danger" title="Enquiries unavailable" message={listError}/>}
          {listBusy && <AnimatedLoadingState compact title="Loading enquiries"/>}
          {!listBusy && !listError && (
            <div className="workspace-kpis" aria-label="Counts on this page">
              {statuses.map((value) => (
                <button type="button" className="twe-kpi-link" key={value} onClick={() => { setStatus(value); setOffset(0); }} aria-pressed={status === value} aria-label={`Filter ${value} enquiries`}><KpiCard
                  label={value[0].toUpperCase() + value.slice(1)}
                  value={
                    result.items.filter((item) => item.status === value).length
                  }
                  detail="On this page"
                /></button>
              ))}
            </div>
          )}
          {!listBusy && !listError && !result.items.length && (
            <p>No enquiries match these filters.</p>
          )}
          {!listBusy && !listError && (
            <ul className="enquiry-list">
              {result.items.map((item) => (
                <li key={item.id}>
                  <button className="enquiry-row-action" type="button" disabled={saving} aria-current={selectedId === item.id ? "true" : undefined} onClick={event => chooseEnquiry(item.id, event)} aria-label={`Open enquiry from ${item.contact.name || "Traveller"}`}>
                    <strong className="enquiry-row-action__name">{item.demo ? "[STAGING DEMO] " : ""}{item.contact.name || "Traveller"}</strong>
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
                  </button>
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
        </div>
      </div>
      {saving && <AnimatedLoadingState compact title="Saving status"/>}
    </section>
  );
}
