import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import { formatProposalMoney } from "./structuredProposalDraft";
import "./StructuredProposal.css";

const readPayload = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load this proposal.");
  return payload;
};

const requestKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export default function InteractiveProposalClient() {
  const { token } = useParams();
  const [payload, setPayload] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [responseKind, setResponseKind] = useState("QUESTION");
  const [responseState, setResponseState] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approverContact, setApproverContact] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(buildApiUrl(`/api/proposals/interactive/${token}`)).then(readPayload),
      fetch(buildApiUrl(`/api/proposals/interactive/${token}/versions`)).then(readPayload),
    ]).then(([proposalPayload, versionPayload]) => {
      if (!active) return;
      setPayload(proposalPayload);
      setVersions(versionPayload.versions || []);
      const saved = Object.fromEntries((proposalPayload.selections || []).map((entry) => [entry.itemId, entry]));
      setSelections(saved);
      setApproverName(proposalPayload.version?.customer?.name || "");
      setApproverContact(proposalPayload.version?.customer?.email || "");
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
    return () => { active = false; };
  }, [token]);

  const version = payload?.version;
  const locked = version?.status === "ACCEPTED";
  const effectiveItems = useMemo(() => (version?.items || []).map((item) => ({
    ...item,
    selected: item.required ? true : selections[item.id]?.selected ?? item.selectedByDefault,
    quantity: selections[item.id]?.quantity ?? item.quantity,
  })), [selections, version]);

  const updateSelection = (item, patch) => {
    setSelections((current) => ({
      ...current,
      [item.id]: {
        itemId: item.id,
        selected: current[item.id]?.selected ?? item.selectedByDefault,
        quantity: current[item.id]?.quantity ?? item.quantity,
        configuration: current[item.id]?.configuration ?? item.configuration,
        ...patch,
      },
    }));
  };

  const saveSelections = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(buildApiUrl(`/api/proposals/interactive/${token}/selections`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: Object.values(selections) }),
      });
      const next = await readPayload(response);
      setPayload((current) => ({ ...current, ...next }));
      setSelections(Object.fromEntries((next.selections || []).map((entry) => [entry.itemId, entry])));
      setResponseState("Your configuration has been saved.");
      return true;
    } catch (requestError) { setError(requestError.message); return false; } finally { setSaving(false); }
  };

  const acceptProposal = async () => {
    if (!consentConfirmed || !approverName.trim() || !approverContact.trim()) return;
    const saved = await saveSelections();
    if (!saved) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(buildApiUrl(`/api/proposals/interactive/${token}/accept`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersionNumber: version.versionNumber,
          approverName: approverName.trim(),
          approverContact: approverContact.trim(),
          consentConfirmed: true,
          requestKey: requestKey(),
        }),
      });
      const accepted = await readPayload(response);
      setPayload((current) => ({
        ...current,
        acceptance: accepted.acceptance,
        billingSchedule: accepted.billingSchedule || current.billingSchedule,
        version: { ...current.version, status: "ACCEPTED" },
      }));
      setResponseState(accepted.duplicate
        ? "This proposal was already accepted. Your original agreement remains unchanged."
        : "Your proposal has been accepted successfully.");
    } catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  };

  const submitMessage = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/proposals/interactive/${token}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: responseKind, message: message.trim(), requestKey: requestKey() }),
      });
      await readPayload(response);
      setMessage("");
      setResponseState(responseKind === "DECLINE" ? "Your decision has been recorded." : "Your message has been sent to the proposal team.");
    } catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  };

  if (loading || (!payload && !error)) return <main className="interactive-proposal-state"><div><p className="eyebrow">Faako</p><h1>Loading your proposal</h1><p>Preparing scope and pricing…</p></div></main>;
  if (!version) return <main className="interactive-proposal-state"><div><p className="eyebrow">Secure proposal</p><h1>This proposal is unavailable</h1><p>{error || "Unable to load this proposal."}</p></div></main>;

  const totals = payload.estimatedTotals || version.totals;
  const schedule = payload.billingSchedule || version.billingSchedule || [];
  const acceptance = payload.acceptance;
  return (
    <main className="interactive-proposal-page">
      <meta name="robots" content="noindex,nofollow,noarchive" />
      <meta name="googlebot" content="noindex,nofollow,noarchive" />
      <header className="interactive-proposal-hero"><div className="interactive-proposal-brand"><span className="interactive-proposal-brand__mark">F</span><span><strong>Faako</strong><small>Digital systems, thoughtfully delivered</small></span></div><div><p className="eyebrow">Proposal · Version {version.versionNumber}</p><h1>{version.title}</h1><p>{version.summary || version.project?.title || "A tailored service proposal for your review."}</p><div className="interactive-proposal-meta"><span>Prepared for {version.customer?.name || "Client"}</span><span>{version.validUntil ? `Valid until ${version.validUntil}` : "Validity confirmed by your proposal team"}</span></div></div></header>
      <div className="interactive-proposal-layout">
        <section className="interactive-proposal-content">
          <section><div className="interactive-section-heading"><p className="eyebrow">Your configuration</p><h2>Services and integrations</h2><p>{locked ? "This accepted configuration is now locked." : "Included items are fixed. Optional items can be added to shape the final scope."}</p></div><div className="interactive-item-list">{effectiveItems.map((item) => <details className={`interactive-item ${item.required ? "is-required" : "is-optional"}`} key={item.id}><summary><span><span className={`structured-item-kind is-${item.required ? "required" : "optional"}`}>{item.required ? "Included" : "Optional"}</span><strong>{item.name}</strong><small>{item.selectedTier?.name ? `${item.selectedTier.name} · ` : ""}{item.description || "Open for deliverables and notes"}</small></span><span className="interactive-item__price">{item.billingType === "INCLUDED" ? "Included" : formatProposalMoney(Number(item.unitPrice) * Number(item.quantity || 1) - Number(item.discount || 0), version.currency)}{item.billingType === "RECURRING" ? <small>/{item.billingFrequency.toLowerCase()}</small> : null}</span></summary><div className="interactive-item__details">{item.selectedTier?.providerCharge ? <p><strong>Provider charge:</strong> {item.selectedTier.providerCharge.displayPrice || [item.selectedTier.providerCharge.currency, item.selectedTier.providerCharge.amount].filter(Boolean).join(" ") || "Custom quote"}. Paid directly to the provider and separate from Faako fees.{item.selectedTier.sourceUrl ? <> <a href={item.selectedTier.sourceUrl} target="_blank" rel="noreferrer">Pricing source</a>.</> : null}</p> : null}{item.deliverables?.length ? <div><h3>Deliverables</h3><ul>{item.deliverables.map((entry, index) => <li key={`${item.id}-${index}`}>{entry}</li>)}</ul></div> : null}{item.clientNotes ? <p>{item.clientNotes}</p> : null}{item.clientSelectable ? <div className="interactive-item__controls"><label><input type="checkbox" checked={Boolean(item.selected)} disabled={locked} onChange={(event) => updateSelection(item, { selected: event.target.checked })} /> Include this option</label><label>Quantity<input className="input" type="number" min="0.01" step="0.01" disabled={locked || !item.selected} value={item.quantity} onChange={(event) => updateSelection(item, { quantity: event.target.value })} /></label></div> : null}</div></details>)}</div><button type="button" className="button" onClick={saveSelections} disabled={saving || locked}>{locked ? "Configuration accepted" : saving ? "Saving…" : "Save my configuration"}</button></section>
          <section className="interactive-scope"><div className="interactive-section-heading"><p className="eyebrow">What is covered</p><h2>Scope and delivery</h2></div>{version.scope ? <p>{version.scope}</p> : null}{version.exclusions?.length ? <details><summary>View exclusions</summary><ul>{version.exclusions.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details> : null}{version.terms?.length ? <details><summary>View payment and delivery terms</summary><ul>{version.terms.map((entry, index) => <li key={index}>{typeof entry === "string" ? entry : JSON.stringify(entry)}</li>)}</ul></details> : null}</section>
          {!locked ? <section className="interactive-contact"><div className="interactive-section-heading"><p className="eyebrow">Questions and revisions</p><h2>Tell us what you need</h2></div><div className="interactive-contact__choices"><button type="button" className={responseKind === "QUESTION" ? "is-active" : ""} onClick={() => setResponseKind("QUESTION")}>Ask a question</button><button type="button" className={responseKind === "REVISION" ? "is-active" : ""} onClick={() => setResponseKind("REVISION")}>Request a revision</button><button type="button" className={responseKind === "DECLINE" ? "is-active" : ""} onClick={() => setResponseKind("DECLINE")}>Decline proposal</button></div><textarea className="input" aria-label="Proposal message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={responseKind === "DECLINE" ? "Please tell us why this proposal is not a fit." : "Write your message here."} /><button type="button" className="button button-ghost" onClick={submitMessage} disabled={saving || !message.trim()}>Send</button>{responseState ? <p className="notice is-success" role="status">{responseState}</p> : null}{error ? <p className="notice is-error" role="alert">{error}</p> : null}</section> : null}
          {versions.length > 1 ? <section className="interactive-version-history"><h2>Proposal history</h2>{versions.map((entry) => <div key={entry.id}><strong>Version {entry.versionNumber}</strong><span>{entry.id === version.id ? "Current" : entry.status}</span><small>{entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString() : ""}</small></div>)}</section> : null}
        </section>
        <aside className="interactive-quote"><p className="eyebrow">Quotation summary</p><div><span>One-time total</span><strong>{formatProposalMoney(totals.oneTimeTotal, version.currency)}</strong></div><div><span>Monthly</span><strong>{formatProposalMoney(totals.recurringMonthlyTotal, version.currency)}</strong></div><div><span>Annual</span><strong>{formatProposalMoney(totals.recurringAnnualTotal, version.currency)}</strong></div><div><span>Deposit</span><strong>{formatProposalMoney(totals.depositAmount, version.currency)}</strong></div>{schedule.map((entry) => <div className="interactive-quote__schedule" key={entry.id || entry.label}><span>{entry.label}</span><strong>{formatProposalMoney(entry.amount, version.currency)}</strong></div>)}{acceptance?.status === "ACCEPTED" ? <div className="interactive-acceptance-confirmation" role="status"><strong>Proposal accepted</strong><p>Reference: proposal version {version.versionNumber}</p><p>Accepted {acceptance.acceptedAt ? new Date(acceptance.acceptedAt).toLocaleString() : "successfully"}. Your proposal team will prepare any invoice that is currently due.</p></div> : <div className="interactive-acceptance"><strong>Accept this proposal</strong><p>Confirm the final configuration, scope, pricing, payment schedule, and commercial terms shown on this page.</p><label>Name<input className="input" value={approverName} onChange={(event) => setApproverName(event.target.value)} /></label><label>Email<input className="input" type="email" value={approverContact} onChange={(event) => setApproverContact(event.target.value)} /></label><label className="interactive-acceptance__consent"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /> I agree to the commercial terms and explicitly accept this proposal.</label>{error ? <p className="notice is-error" role="alert">{error}</p> : null}<button type="button" className="button" disabled={saving || !consentConfirmed || !approverName.trim() || !approverContact.trim()} onClick={acceptProposal}>{saving ? "Confirming…" : "Accept proposal"}</button></div>}<div className="interactive-quote__next"><strong>Next step</strong><p>{acceptance?.status === "ACCEPTED" ? "Acceptance is complete. Invoice readiness is separate and will be confirmed by the proposal team." : "Review your configuration, accept the final terms, or send a question before continuing."}</p></div></aside>
      </div>
    </main>
  );
}
