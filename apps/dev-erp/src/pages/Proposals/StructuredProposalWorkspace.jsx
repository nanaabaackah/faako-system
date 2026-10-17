import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatedLoadingState, ComboboxField, DateField, FormGroup, SelectField } from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import {
  PROPOSAL_STEPS,
  applyProposalRules,
  buildLegacyProposalPayload,
  catalogueItemToProposalItem,
  createStructuredProposalDraft,
  formatProposalMoney,
  itemMatches,
  mergePackageItems,
  proposalSourceFingerprint,
} from "./structuredProposalDraft";
import "./StructuredProposal.css";

const updateItem = (items, key, patch) =>
  items.map((item) => (item.key === key ? { ...item, ...patch } : item));

const parseLines = (value) => String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
const joinLines = (value) => (Array.isArray(value) ? value.join("\n") : "");

function PricingSummary({ commercial, compact = false }) {
  const totals = commercial?.totals || {};
  const currency = commercial?.currency || "GHS";
  const balance = Math.max(Number(totals.oneTimeTotal || 0) - Number(totals.depositAmount || 0), 0);
  return (
    <aside className={`structured-pricing ${compact ? "is-compact" : ""}`} aria-label="Quotation summary">
      <div><span>One-time total</span><strong>{formatProposalMoney(totals.oneTimeTotal, currency)}</strong></div>
      <div><span>Monthly recurring</span><strong>{formatProposalMoney(totals.recurringMonthlyTotal, currency)}</strong></div>
      <div><span>Annual recurring</span><strong>{formatProposalMoney(totals.recurringAnnualTotal, currency)}</strong></div>
      <div><span>Discount</span><strong>−{formatProposalMoney(totals.discount, currency)}</strong></div>
      <div><span>Tax</span><strong>{formatProposalMoney(totals.taxAmount, currency)}</strong></div>
      <div><span>Deposit</span><strong>{formatProposalMoney(totals.depositAmount, currency)}</strong></div>
      <div><span>Remaining balance</span><strong>{formatProposalMoney(balance, currency)}</strong></div>
      <div><span>Paid directly to third parties</span><strong>{formatProposalMoney(totals.clientDirectTotal, currency)}</strong></div>
      <div className="structured-pricing__total"><span>Total payable to Faako</span><strong>{formatProposalMoney(totals.oneTimeTotal, currency)}</strong></div>
    </aside>
  );
}

function ItemEditor({ item, catalogue, onChange, onClose }) {
  const dependencyOptions = catalogue.filter((entry) => entry.id !== item.catalogueItemId);
  const tierOptions = (catalogue.find((entry) => Number(entry.id) === Number(item.catalogueItemId))?.tiers || []).filter((tier) => tier.active !== false);
  return (
    <div className="structured-modal" role="dialog" aria-modal="true" aria-labelledby="proposal-item-editor-title">
      <div className="structured-modal__panel">
        <header><div><p className="eyebrow">Proposal item</p><h2 id="proposal-item-editor-title">Configure {item.name}</h2></div><button className="button button-ghost" type="button" onClick={onClose}>Close</button></header>
        <div className="structured-form-grid">
          <FormGroup label="Name"><input className="input" value={item.name} onChange={(event) => onChange({ name: event.target.value })} /></FormGroup>
          <FormGroup label="Estimated delivery"><input className="input" value={item.estimatedDelivery || ""} onChange={(event) => onChange({ estimatedDelivery: event.target.value })} placeholder="2–3 weeks" /></FormGroup>
          <FormGroup label="Description"><textarea className="input" value={item.description || ""} onChange={(event) => onChange({ description: event.target.value })} /></FormGroup>
          <FormGroup label="Deliverables (one per line)"><textarea className="input" value={joinLines(item.deliverables)} onChange={(event) => onChange({ deliverables: parseLines(event.target.value) })} /></FormGroup>
          <FormGroup label="Quantity"><input className="input" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => onChange({ quantity: event.target.value })} /></FormGroup>
          {tierOptions.length ? <SelectField label="Catalogue tier" value={item.selectedTier?.id || item.selectedTier?.name || ""} onChange={(event) => { const tier = tierOptions.find((entry) => String(entry.id || entry.name) === String(event.target.value)); if (tier) onChange({ selectedTier: { ...tier }, unitPrice: Number(tier.faakoSetupFee || 0), billingFrequency: tier.billingFrequency || "NONE" }); }}><option value="">Choose a tier</option>{tierOptions.map((tier) => <option value={tier.id || tier.name} key={tier.id || tier.name}>{tier.name}</option>)}</SelectField> : null}
          <FormGroup label="Faako fee"><input className="input" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => onChange({ unitPrice: event.target.value })} /></FormGroup>
          {item.selectedTier ? <div className="structured-provider-charge"><strong>Provider charge</strong><span>{item.selectedTier.displayPrice || (item.selectedTier.providerAmount == null ? "Custom quote" : `${item.selectedTier.providerCurrency || ""} ${item.selectedTier.providerAmount}`)}</span><small>Paid directly to the provider; not converted or added to Faako totals.</small>{item.selectedTier.sourceUrl ? <a href={item.selectedTier.sourceUrl} target="_blank" rel="noreferrer">Official pricing source</a> : null}{item.selectedTier.needsReview ? <span className="status-pill is-warning">Pricing needs review</span> : null}</div> : null}
          <SelectField label="Billing type" value={item.billingType} onChange={(event) => onChange({ billingType: event.target.value, billingFrequency: event.target.value === "RECURRING" ? "MONTHLY" : "NONE" })}><option value="ONE_TIME">One-time</option><option value="RECURRING">Recurring</option><option value="USAGE_BASED">Usage-based estimate</option><option value="INCLUDED">Included</option></SelectField>
          <SelectField label="Billing frequency" value={item.billingFrequency} onChange={(event) => onChange({ billingFrequency: event.target.value })} disabled={item.billingType !== "RECURRING"}><option value="NONE">None</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUAL">Annual</option></SelectField>
          <FormGroup label="Line discount"><input className="input" type="number" min="0" step="0.01" value={item.discount} onChange={(event) => onChange({ discount: event.target.value })} /></FormGroup>
          <SelectField label="Cost ownership" value={item.costOwnership} onChange={(event) => onChange({ costOwnership: event.target.value })}><option value="FAAKO_BILLED">Billed by Faako</option><option value="CLIENT_DIRECT">Client pays provider</option><option value="PASS_THROUGH">Pass-through</option><option value="INCLUDED">Included</option></SelectField>
          <SelectField label="Dependencies" multiple value={(item.dependencies || []).map(String)} onChange={(event) => onChange({ dependencies: event.target.value.map(Number) })}>{dependencyOptions.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</SelectField>
          <div className="structured-checks"><label><input type="checkbox" checked={item.required} onChange={(event) => onChange({ required: event.target.checked, clientSelectable: event.target.checked ? false : item.clientSelectable })} /> Required</label><label><input type="checkbox" checked={item.clientSelectable} disabled={item.required} onChange={(event) => onChange({ clientSelectable: event.target.checked })} /> Client can select and adjust quantity</label></div>
          <FormGroup label="Client-visible notes"><textarea className="input" value={item.clientNotes || ""} onChange={(event) => onChange({ clientNotes: event.target.value })} /></FormGroup>
          <FormGroup label="Internal notes"><textarea className="input" value={item.internalNotes || ""} onChange={(event) => onChange({ internalNotes: event.target.value })} /></FormGroup>
        </div>
      </div>
    </div>
  );
}

function CatalogueStep({ kind, commercial, catalogue, packages, onChange, onSaveCustom }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [customName, setCustomName] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const choices = catalogue.filter((item) => item.kind === kind);
  const categories = ["all", ...new Set(choices.map((item) => item.category).filter(Boolean))];
  const visible = choices.filter((item) => itemMatches(item, search, category));
  const selected = commercial.items.filter((item) => item.kind === kind);
  const selectedIds = new Set(selected.map((item) => Number(item.catalogueItemId)).filter(Boolean));
  const editing = commercial.items.find((item) => item.key === editingKey);
  const add = (item) => {
    if (item.id && selectedIds.has(Number(item.id))) return;
    if (commercial.items.some((entry) => entry.kind === kind && entry.name.trim().toLowerCase() === item.name.trim().toLowerCase())) return;
    onChange({ items: applyProposalRules([...commercial.items, catalogueItemToProposalItem(item)]) });
  };
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    add({ kind, name, defaultUnitPrice: 0 });
    setCustomName("");
  };
  return (
    <div className="structured-catalogue">
      {kind === "SERVICE" && packages.length ? <div className="structured-package-row"><span>Start from a reusable package:</span>{packages.map((entry) => <button type="button" className="proposal-filter-chip" key={entry.id} onClick={() => onChange({ items: mergePackageItems(commercial.items, entry) })}>{entry.name}</button>)}</div> : null}
      <div className="structured-selector-tools"><input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind === "SERVICE" ? "services" : "integrations"}`} aria-label={`Search ${kind.toLowerCase()} catalogue`} /><SelectField value={category} onChange={(event) => setCategory(event.target.value)} ariaLabel="Filter catalogue category">{categories.map((entry) => <option value={entry} key={entry}>{entry === "all" ? "All categories" : entry}</option>)}</SelectField></div>
      <div className="structured-selector-list">{visible.map((item) => { const selectedItem = selected.find((entry) => (item.id && Number(entry.catalogueItemId) === Number(item.id)) || (!item.id && entry.name.toLowerCase() === item.name.toLowerCase())); const isSelected = Boolean(selectedItem); return <div className={`structured-selector-option${isSelected ? " is-selected" : ""}`} key={`${item.id || "suggestion"}-${item.name}`}><span><strong>{isSelected ? "✓ " : ""}{item.name}</strong><small>{item.category || "General"}{item.tiers?.length ? ` · ${item.tiers.length} tier${item.tiers.length === 1 ? "" : "s"}` : ""}</small></span>{isSelected ? <button type="button" className="button button-ghost" onClick={() => setEditingKey(selectedItem.key)}>Configure</button> : <button type="button" className="button button-ghost" onClick={() => add(item)}>Add</button>}</div>; })}</div>
      <div className="structured-custom-row"><input className="input" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder={`Custom ${kind.toLowerCase()} name`} /><button type="button" className="button button-ghost" onClick={addCustom}>Add custom</button><button type="button" className="button button-ghost" disabled={!customName.trim()} onClick={() => onSaveCustom({ kind, name: customName.trim() })}>Save to catalogue</button></div>
      <div className="structured-selected-list">{selected.map((item) => <div className="structured-selected-item" key={item.key}><button type="button" onClick={() => setEditingKey(item.key)}><span className={`structured-item-kind is-${item.required ? "required" : "optional"}`}>{item.required ? "Required" : "Optional"}</span><strong>{item.name}</strong><small>{item.selectedTier?.name ? `${item.selectedTier.name} · ` : ""}{item.billingType === "RECURRING" ? `${item.billingFrequency.toLowerCase()} · ` : ""}{item.billingType === "INCLUDED" ? "Included" : `Faako ${formatProposalMoney(item.unitPrice, commercial.currency)}`}{item.selectedTier?.displayPrice ? ` · Provider ${item.selectedTier.displayPrice}` : ""}</small></button><button type="button" className="button button-ghost" disabled={item.configuration?.autoIncludedBy === "website-development"} title={item.configuration?.autoIncludedBy ? "Included automatically with Website Development" : undefined} onClick={() => onChange({ items: applyProposalRules(commercial.items.filter((entry) => entry.key !== item.key)) })}>Remove</button></div>)}</div>
      {editing ? <ItemEditor item={editing} catalogue={catalogue} onClose={() => setEditingKey(null)} onChange={(patch) => onChange({ items: updateItem(commercial.items, editing.key, patch), aiGeneration: { ...(commercial.aiGeneration || {}), scope: { ...(commercial.aiGeneration?.scope || {}), manuallyEdited: Boolean(commercial.aiGeneration?.scope) } } })} /> : null}
    </div>
  );
}

function ReviewStep({
  commercial,
  effective,
  version,
  versionHistory,
  access,
  clientRequests,
  record,
  busy,
  onSave,
  onPublish,
  onCreateLink,
  onSend,
  onRevokeLink,
  onWithdraw,
  onResolveRequest,
  onGenerateInvoice,
  onUpdateBillingStatus,
  onCreateProject,
  sendRecipient,
  setSendRecipient,
  sendMessage,
  setSendMessage,
  sendTtlHours,
  setSendTtlHours,
}) {
  return (
    <div className="structured-review">
      <div className="structured-review__intro">
        <p className="eyebrow">Prepared for {commercial.customer.name || "Client"}</p>
        <h2>{commercial.title}</h2>
        <p>{commercial.project.summary || "Add a project summary before publishing."}</p>
      </div>
      <div className="structured-review__items">
        {commercial.items.map((item) => (
          <article key={item.key}>
            <div>
              <span className={`structured-item-kind is-${item.required ? "required" : "optional"}`}>{item.required ? "Included" : "Optional"}</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </div>
            <strong>{item.billingType === "INCLUDED" ? "Included" : formatProposalMoney(item.unitPrice, commercial.currency)}</strong>
          </article>
        ))}
      </div>
      <PricingSummary commercial={effective} />
      <div className="structured-publish-actions">
        <button type="button" className="button button-ghost" onClick={onSave} disabled={busy || version?.status === "ACCEPTED"}>Save & validate</button>
        <button type="button" className="button" onClick={onPublish} disabled={busy || ["PUBLISHED", "ACCEPTED"].includes(version?.status)}>{version?.status === "ACCEPTED" ? "Accepted" : version?.status === "PUBLISHED" ? "Published" : "Publish immutable version"}</button>
        <button type="button" className="button button-ghost" onClick={onCreateLink} disabled={busy || version?.status !== "PUBLISHED"}>Generate secure link</button>
        {version?.status === "PUBLISHED" ? <button type="button" className="button button-ghost" onClick={onWithdraw} disabled={busy}>Withdraw version</button> : null}
      </div>
      {access ? (
        <div className="structured-share">
          <code>{`${window.location.origin}${access.path}`}</code>
          <button type="button" className="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${access.path}`)}>Copy link</button>
          <button type="button" className="button button-ghost" onClick={onRevokeLink}>Revoke link</button>
        </div>
      ) : null}
      {version?.status === "PUBLISHED" ? (
        <section className="structured-send-panel" aria-labelledby="proposal-send-title">
          <div>
            <p className="eyebrow">Client delivery</p>
            <h3 id="proposal-send-title">{version.delivery?.lastSentAt ? "Resend proposal" : "Send proposal"}</h3>
            <p>Email a fresh secure proposal link. A successful resend revokes older links for this version.</p>
          </div>
          <div className="structured-send-panel__fields">
            <FormGroup label="Client email"><input className="input" type="email" value={sendRecipient} onChange={(event) => setSendRecipient(event.target.value)} placeholder="client@example.com" /></FormGroup>
            <SelectField label="Link expiry" value={String(sendTtlHours)} onChange={(event) => setSendTtlHours(Number(event.target.value))}><option value="24">1 day</option><option value="168">7 days</option><option value="336">14 days</option><option value="720">30 days</option><option value="2160">90 days</option></SelectField>
            <FormGroup label="Optional personal message"><textarea className="input" maxLength={1000} value={sendMessage} onChange={(event) => setSendMessage(event.target.value)} placeholder="Add a short note for the client." /></FormGroup>
          </div>
          {version.delivery?.lastSentAt ? <p className="structured-send-panel__status">Last sent to <strong>{version.delivery.sentTo}</strong> on {new Date(version.delivery.lastSentAt).toLocaleString()}.</p> : null}
          <button type="button" className="button" disabled={busy || !sendRecipient.trim()} onClick={onSend}>{busy ? "Sending…" : version.delivery?.lastSentAt ? "Resend proposal" : "Send proposal"}</button>
        </section>
      ) : null}
      {version?.status === "ACCEPTED" ? (
        <section className="structured-billing-dashboard">
          <div><h3>Accepted billing</h3><p>Invoices remain drafts until reviewed in Invoicing. Payments and balances continue to be owned by the Invoice and Accounting modules.</p></div>
          {(version.billingSchedule || []).map((entry) => {
            const invoices = version.billingProgress?.invoices?.filter((invoice) => invoice.billingScheduleItemId === entry.id) || [];
            const paid = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
            const billed = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
            return (
              <article key={entry.id}>
                <div><strong>{entry.label}</strong><small>{entry.type} · {entry.status}</small><span>{formatProposalMoney(entry.amount, version.currency)}{entry.type === "RECURRING" ? ` / ${entry.billingFrequency.toLowerCase()}` : ""}</span></div>
                <div><span>Billed {formatProposalMoney(billed, version.currency)}</span><span>Paid {formatProposalMoney(paid, version.currency)}</span>{entry.nextBillingDate ? <small>Next {entry.nextBillingDate}</small> : null}</div>
                <div>
                  {!invoices.length || entry.type === "RECURRING" ? <button type="button" className="button button-ghost" disabled={busy || ["PAUSED", "CANCELLED", "COMPLETED"].includes(entry.status)} onClick={() => onGenerateInvoice(entry)}>Generate draft invoice</button> : null}
                  {entry.type === "RECURRING" && entry.status === "ACTIVE" ? <button type="button" className="button button-ghost" onClick={() => onUpdateBillingStatus(entry, "PAUSED")}>Pause</button> : null}
                  {entry.type === "RECURRING" && entry.status === "PAUSED" ? <button type="button" className="button button-ghost" onClick={() => onUpdateBillingStatus(entry, "ACTIVE")}>Resume</button> : null}
                  {entry.type === "RECURRING" && !["CANCELLED", "COMPLETED"].includes(entry.status) ? <button type="button" className="button button-ghost" onClick={() => onUpdateBillingStatus(entry, "CANCELLED")}>Cancel</button> : null}
                </div>
              </article>
            );
          })}
          <div className="structured-project-handoff">
            <strong>{record?.projectId ? `Linked project: ${record.project?.title || record.projectId}` : "No linked delivery project"}</strong>
            {!record?.projectId ? <button type="button" className="button button-ghost" disabled={busy} onClick={onCreateProject}>Create project and import deliverables</button> : null}
          </div>
        </section>
      ) : null}
      {versionHistory.length ? <section className="structured-version-timeline"><h3>Activity and version history</h3>{versionHistory.map((entry) => <div key={entry.id}><strong>Version {entry.versionNumber}</strong><span>{entry.status}</span><small>{entry.publishedAt ? `Published ${new Date(entry.publishedAt).toLocaleDateString()}` : `Draft updated ${new Date(entry.updatedAt).toLocaleDateString()}`}</small></div>)}</section> : null}
      {clientRequests.length ? <section className="structured-client-requests"><h3>Client questions and requests</h3>{clientRequests.map((entry) => <article key={entry.id}><div><strong>{entry.kind}</strong><span className={`status-pill is-${entry.status === "OPEN" ? "info" : "success"}`}>{entry.status}</span><p>{entry.message}</p></div>{entry.status === "OPEN" ? <div><button type="button" className="button button-ghost" onClick={() => onResolveRequest(entry.id, "RESOLVED")}>Resolve</button><button type="button" className="button button-ghost" onClick={() => onResolveRequest(entry.id, "REJECTED")}>Reject</button></div> : null}</article>)}</section> : null}
      <p className="muted">Publishing and acceptance do not record payment. Generate only currently due draft invoices, then use existing Invoicing payment reconciliation.</p>
    </div>
  );
}

function StructuredBuilder() {
  const navigate = useNavigate();
  const { proposalId } = useParams();
  const [step, setStep] = useState(0);
  const [record, setRecord] = useState(null);
  const [version, setVersion] = useState(null);
  const [commercial, setCommercial] = useState(createStructuredProposalDraft);
  const [serverCommercial, setServerCommercial] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [packages, setPackages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState(null);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendTtlHours, setSendTtlHours] = useState(336);
  const [clientRequests, setClientRequests] = useState([]);
  const [packageName, setPackageName] = useState("");
  const [versionHistory, setVersionHistory] = useState([]);
  const [clientQuery, setClientQuery] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [clientOptionsLoading, setClientOptionsLoading] = useState(false);
  const [clientFormContext, setClientFormContext] = useState("");
  const [summaryPreview, setSummaryPreview] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const scopeAttempts = useRef(new Set());

  const reconcile = useCallback(async (nextCommercial) => {
    if (!nextCommercial.items.length) return;
    try {
      const payload = await apiPost("/api/proposals/pricing-preview", { commercial: nextCommercial });
      setServerCommercial(payload.commercial);
    } catch {
      setServerCommercial(null);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reconcile(commercial); }, 350);
    return () => window.clearTimeout(timer);
  }, [commercial, reconcile]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet("/api/proposals/catalogue"),
      apiGet("/api/proposals/packages"),
      apiGet("/api/projects"),
      apiGet("/api/access/users"),
    ]).then(([cataloguePayload, packagePayload, projectPayload, userPayload]) => {
      if (!active) return;
      setCatalogue([...(cataloguePayload.items || []), ...(cataloguePayload.suggestions || [])]);
      setPackages(packagePayload.packages || []);
      setProjects(projectPayload.projects || []);
      setUsers(userPayload.users || []);
    }).catch((error) => setNotice(error.message));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setClientOptionsLoading(true);
      const params = new URLSearchParams({ search: clientQuery.trim(), limit: "30" });
      apiGet(`/api/proposals/client-options?${params}`).then((payload) => {
        if (active) setClientOptions(payload.options || []);
      }).catch((error) => {
        if (active) { setClientOptions([]); setNotice(error.message); }
      }).finally(() => { if (active) setClientOptionsLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientQuery]);

  useEffect(() => {
    if (!proposalId) return;
    let active = true;
    Promise.all([apiGet(`/api/proposals/${proposalId}`), apiGet(`/api/proposals/${proposalId}/versions`)]).then(([proposalPayload, versionPayload]) => {
      if (!active) return;
      const proposal = proposalPayload.proposal;
      const latest = (versionPayload.versions || [])[0] || null;
      setRecord(proposal);
      setVersion(latest);
      setVersionHistory(versionPayload.versions || []);
      setCommercial(latest?.commercial || proposal?.content?.commercial || createStructuredProposalDraft());
      setServerCommercial(latest?.commercial || null);
      setSendRecipient(latest?.customer?.email || "");
    }).catch((error) => setNotice(error.message));
    return () => { active = false; };
  }, [proposalId]);

  useEffect(() => {
    if (!record?.id || !version?.id) {
      setClientRequests([]);
      return;
    }
    let active = true;
    apiGet(`/api/proposals/${record.id}/versions/${version.id}/revision-requests`)
      .then((payload) => { if (active) setClientRequests(payload.requests || []); })
      .catch(() => { if (active) setClientRequests([]); });
    return () => { active = false; };
  }, [record?.id, version?.id]);

  const patchCommercial = (patch) => setCommercial((current) => ({ ...current, ...patch }));

  const requestAi = useCallback(async (task, source) => {
    const sourceFingerprint = proposalSourceFingerprint(source);
    const payload = await apiPost("/api/proposals/ai/generate", {
      task,
      requestKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      sourceFingerprint,
      context: {
        customerName: source.customer?.name,
        projectTitle: source.project?.title,
        summary: source.project?.summary,
        formContext: clientFormContext,
        items: source.items,
      },
    });
    setAiUsage(payload.usage);
    return payload;
  }, [clientFormContext]);

  const refineSummary = async () => {
    setAiBusy(true);
    try {
      const response = await requestAi("REFINE_SUMMARY", commercial);
      setSummaryPreview(response.content.summary);
    } catch (error) { setNotice(error.message); } finally { setAiBusy(false); }
  };

  const generateScope = useCallback(async ({ explicit = false } = {}) => {
    const previous = commercial.aiGeneration?.scope;
    if (explicit && previous?.manuallyEdited && !window.confirm("Regenerating will replace the AI-generated fields you edited. Continue?")) return;
    setAiBusy(true);
    try {
      const response = await requestAi("GENERATE_SCOPE_DELIVERY", commercial);
      const detailsByKey = new Map((response.content.deliverables || []).map((entry) => [entry.itemKey, entry.details]));
      setCommercial((current) => ({
        ...current,
        scope: response.content.scope,
        exclusions: response.content.exclusions || [],
        terms: response.content.deliveryTerms || [],
        delivery: { ...(current.delivery || {}), estimatedDelivery: response.content.estimatedDelivery || "" },
        items: current.items.map((item) => detailsByKey.has(item.key) ? { ...item, deliverables: detailsByKey.get(item.key) } : item),
        aiGeneration: { ...(current.aiGeneration || {}), scope: { sourceFingerprint: response.sourceFingerprint, generatedAt: response.generatedAt, manuallyEdited: false } },
      }));
      setNotice("Scope & Delivery draft generated. Review and edit it before publishing.");
    } catch (error) { setNotice(error.message); } finally { setAiBusy(false); }
  }, [commercial, requestAi]);

  useEffect(() => {
    if (step !== 4 || aiBusy || !commercial.customer?.name || !commercial.project?.summary || !commercial.items.length) return;
    if (commercial.scope || commercial.exclusions?.length || commercial.terms?.length) return;
    const fingerprint = proposalSourceFingerprint(commercial);
    if (scopeAttempts.current.has(fingerprint)) return;
    scopeAttempts.current.add(fingerprint);
    void generateScope({ explicit: false });
  }, [aiBusy, commercial, generateScope, step]);
  const saveDraft = async () => {
    if (!commercial.items.length) { setNotice("Add at least one service or integration before saving."); return null; }
    setBusy(true);
    try {
      let savedRecord = record;
      if (!savedRecord) {
        const response = await apiPost("/api/proposals", buildLegacyProposalPayload(commercial));
        savedRecord = response.proposal;
        setRecord(savedRecord);
      } else {
        const response = await apiPatch(`/api/proposals/${savedRecord.id}`, buildLegacyProposalPayload(commercial, savedRecord));
        savedRecord = response.proposal;
        setRecord(savedRecord);
      }
      let savedVersion;
      if (version?.status === "DRAFT") {
        const response = await apiPatch(`/api/proposals/${savedRecord.id}/versions/${version.id}`, { commercial });
        savedVersion = response.version;
      } else {
        const response = await apiPost(`/api/proposals/${savedRecord.id}/versions`, { commercial });
        savedVersion = response.version;
      }
      setVersion(savedVersion);
      setVersionHistory((current) => [savedVersion, ...current.filter((entry) => entry.id !== savedVersion.id)]);
      setCommercial(savedVersion.commercial || commercial);
      setServerCommercial(savedVersion.commercial || commercial);
      setNotice(`Draft version ${savedVersion.versionNumber} saved and reconciled.`);
      if (!proposalId) navigate(`/proposals/${savedRecord.id}/edit`, { replace: true });
      return { record: savedRecord, version: savedVersion };
    } catch (error) { setNotice(error.message); return null; } finally { setBusy(false); }
  };

  const publish = async () => {
    const saved = await saveDraft();
    if (!saved) return;
    setBusy(true);
    try {
      const response = await apiPost(`/api/proposals/${saved.record.id}/versions/${saved.version.id}/publish`, {});
      setVersion(response.version);
      setVersionHistory((current) => current.map((entry) => entry.id === response.version.id ? response.version : entry));
      setNotice(`Version ${response.version.versionNumber} published. Published terms are now immutable.`);
      setSendRecipient(response.version.customer?.email || commercial.customer?.email || "");
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const createLink = async () => {
    if (version?.status !== "PUBLISHED") return;
    setBusy(true);
    try {
      const response = await apiPost(`/api/proposals/${record.id}/versions/${version.id}/access-links`, { ttlHours: 336 });
      setAccess(response.access);
      setNotice("Secure link created. The raw token is shown only in this response.");
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const revokeLink = async () => {
    if (!access?.id || !record?.id || !version?.id) return;
    setBusy(true);
    try {
      await apiPatch(`/api/proposals/${record.id}/versions/${version.id}/access-links/${access.id}/revoke`, {});
      setAccess(null);
      setNotice("The secure proposal link has been revoked.");
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const sendProposal = async () => {
    if (!record?.id || !version?.id || version.status !== "PUBLISHED") return;
    setBusy(true);
    try {
      const response = await apiPost(
        `/api/proposals/${record.id}/versions/${version.id}/send`,
        { recipient: sendRecipient.trim(), personalMessage: sendMessage.trim(), ttlHours: sendTtlHours },
        {
          headers: { "Idempotency-Key": globalThis.crypto?.randomUUID?.() || `proposal-send-${Date.now()}-${Math.random()}` },
          fallbackMessage: "Unable to send proposal",
        }
      );
      if (response.access) setAccess(response.access);
      setVersion((current) => ({ ...current, delivery: { ...response.delivery, lastSentAt: response.delivery.sentAt } }));
      setSendMessage("");
      setNotice(`Proposal sent to ${response.delivery.sentTo}. Older links were revoked.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const withdrawVersion = async () => {
    if (!record?.id || !version?.id || version.status !== "PUBLISHED") return;
    setBusy(true);
    try {
      const response = await apiPost(`/api/proposals/${record.id}/versions/${version.id}/withdraw`, {});
      setVersion(response.version);
      setVersionHistory((current) => current.map((entry) => entry.id === response.version.id ? response.version : entry));
      setAccess(null);
      setNotice(`Version ${response.version.versionNumber} was withdrawn and its client links were revoked.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const savePackage = async () => {
    const name = packageName.trim();
    const items = commercial.items.filter((item) => item.catalogueItemId);
    if (!name) { setNotice("Enter a package name first."); return; }
    if (!items.length) { setNotice("A reusable package needs at least one catalogue-backed item."); return; }
    setBusy(true);
    try {
      const response = await apiPost("/api/proposals/packages", {
        name,
        items: items.map((item) => ({
          catalogueItemId: item.catalogueItemId,
          configuration: {
            required: item.required,
            clientSelectable: item.clientSelectable,
            quantity: item.quantity,
          },
        })),
      });
      setPackages((current) => [...current, response.package].sort((left, right) => left.name.localeCompare(right.name)));
      setPackageName("");
      setNotice(`${name} saved as a reusable package.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const resolveClientRequest = async (requestId, status) => {
    if (!record?.id || !version?.id) return;
    try {
      const response = await apiPatch(`/api/proposals/${record.id}/versions/${version.id}/revision-requests/${requestId}`, { status });
      setClientRequests((current) => current.map((entry) => entry.id === requestId ? { ...entry, ...response.request } : entry));
      setNotice(`Client request marked ${status.toLowerCase()}.`);
    } catch (error) { setNotice(error.message); }
  };

  const reloadVersions = async () => {
    if (!record?.id) return;
    const payload = await apiGet(`/api/proposals/${record.id}/versions`);
    const versions = payload.versions || [];
    setVersionHistory(versions);
    if (versions[0]) {
      setVersion(versions[0]);
      setServerCommercial(versions[0].commercial || null);
    }
  };

  const generateInvoice = async (billingItem) => {
    setBusy(true);
    try {
      const response = await apiPost(`/api/proposals/${record.id}/versions/${version.id}/billing/${billingItem.id}/invoice`, {
        triggerConfirmed: billingItem.generationRule === "MANUAL",
        billingDate: billingItem.type === "RECURRING" ? billingItem.nextBillingDate : undefined,
      });
      await reloadVersions();
      setNotice(`${response.created ? "Created" : "Found existing"} draft invoice ${response.invoice.invoiceNumber}. Review it in Invoicing before sending.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const updateBillingStatus = async (billingItem, status) => {
    setBusy(true);
    try {
      await apiPatch(`/api/proposals/${record.id}/versions/${version.id}/billing/${billingItem.id}`, { status });
      await reloadVersions();
      setNotice(`${billingItem.label} billing is now ${status.toLowerCase()}.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const createAcceptedProject = async () => {
    setBusy(true);
    try {
      const response = await apiPost(`/api/proposals/${record.id}/versions/${version.id}/project`, {
        importDeliverables: true,
        ownerUserId: commercial.internalOwnerUserId,
      });
      setRecord((current) => ({ ...current, projectId: response.project.id, project: response.project }));
      setNotice(`Linked project ${response.project.title} and imported accepted deliverables.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const saveCustom = async (input) => {
    if (!input.name) return;
    try {
      const response = await apiPost("/api/proposals/catalogue", input);
      setCatalogue((current) => [response.item, ...current.filter((entry) => entry.name.toLowerCase() !== input.name.toLowerCase())]);
      setNotice(`${input.name} saved to the reusable catalogue.`);
    } catch (error) { setNotice(error.message); }
  };

  const effective = serverCommercial || commercial;
  return (
    <main className="page structured-proposal-page">
      <header className="structured-page-header"><div><h1>{record ? commercial.title : "Create proposal"}</h1><p>Configure services, commercial terms, and a client-ready quotation.</p></div><div><button type="button" className="button button-ghost" onClick={() => navigate("/proposals")}>Back to proposals</button><button type="button" className="button" onClick={saveDraft} disabled={busy}>{busy ? "Working…" : version?.status === "ACCEPTED" ? "Create amendment draft" : "Save draft"}</button></div></header>
      {notice ? <div className="notice is-info" role="status">{notice}</div> : null}
      <nav className="structured-stepper" aria-label="Proposal builder steps">{PROPOSAL_STEPS.map((label, index) => <button type="button" aria-current={step === index ? "step" : undefined} className={step === index ? "is-active" : ""} onClick={() => setStep(index)} key={label}><span>{index + 1}</span>{label}</button>)}</nav>
      <div className="structured-builder-layout">
        <section className="structured-builder-panel">
          {step === 0 ? <div className="structured-form-grid">
            <FormGroup label="Proposal title"><input className="input" value={commercial.title} onChange={(event) => patchCommercial({ title: event.target.value })} /></FormGroup>
            <SelectField label="Currency" value={commercial.currency} onChange={(event) => patchCommercial({ currency: event.target.value })}><option value="GHS">GHS — Ghana cedi</option><option value="CAD">CAD — Canadian dollar</option></SelectField>
            <ComboboxField label="Client" value={clientQuery || commercial.customer.name || ""} options={clientOptions.map((option) => ({ value: option.reference, label: option.companyName || option.contactName || option.email, description: [option.contactName, option.email, option.formType].filter(Boolean).join(" · "), data: option }))} loading={clientOptionsLoading} onInputChange={(value) => { setClientQuery(value); patchCommercial({ customer: { ...commercial.customer, reference: "", name: value } }); }} onSelect={(entry) => { const option = entry.data; const context = Object.values(option.projectContext || {}).filter(Boolean).join("\n"); setClientQuery(option.companyName || option.contactName || ""); setClientFormContext(context); patchCommercial({ customer: { ...commercial.customer, reference: `faako-form:${option.reference}`, name: option.companyName || option.contactName || "", email: option.email || "" } }); }} onCreate={(name) => { setClientQuery(name); setClientFormContext(""); patchCommercial({ customer: { reference: "", name, email: commercial.customer.email || "", address: commercial.customer.address || "" } }); setNotice(`${name} will be saved only as this proposal's customer snapshot.`); }} />
            <FormGroup label="Customer email"><input className="input" type="email" value={commercial.customer.email || ""} onChange={(event) => patchCommercial({ customer: { ...commercial.customer, email: event.target.value } })} /></FormGroup>
            <SelectField label="Existing project" value={commercial.project.id || ""} onChange={(event) => { const project = projects.find((entry) => String(entry.id) === event.target.value); patchCommercial({ project: { ...commercial.project, id: project?.id || null, title: project?.title || commercial.project.title, summary: project?.description || commercial.project.summary } }); }}><option value="">No linked project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</SelectField>
            <FormGroup label="Project name"><input className="input" value={commercial.project.title || ""} onChange={(event) => patchCommercial({ project: { ...commercial.project, title: event.target.value } })} /></FormGroup>
            <div className="structured-summary-field"><FormGroup label="Project summary"><textarea className="input" value={commercial.project.summary || ""} onChange={(event) => { setSummaryPreview(null); patchCommercial({ project: { ...commercial.project, summary: event.target.value } }); }} placeholder="Write at least one sentence about the project." /></FormGroup><button type="button" className="button button-ghost" disabled={aiBusy || String(commercial.project.summary || "").trim().split(/\s+/).length < 4 || !/[.!?]\s*$/.test(String(commercial.project.summary || ""))} onClick={refineSummary}>{aiBusy ? "Generating…" : "Refine with AI"}</button>{summaryPreview ? <div className="structured-ai-preview"><strong>Refined preview</strong><p>{summaryPreview}</p><div><button type="button" className="button" onClick={() => { patchCommercial({ project: { ...commercial.project, summary: summaryPreview } }); setSummaryPreview(null); }}>Use refined summary</button><button type="button" className="button button-ghost" onClick={() => setSummaryPreview(null)}>Keep original</button></div></div> : null}</div>
            <SelectField label="Internal owner" value={commercial.internalOwnerUserId || ""} onChange={(event) => patchCommercial({ internalOwnerUserId: Number(event.target.value) || null })}><option value="">Unassigned</option>{users.map((user) => <option value={user.id} key={user.id}>{user.fullName || user.email}</option>)}</SelectField>
            <DateField label="Valid until" value={commercial.validUntil || ""} onChange={(event) => patchCommercial({ validUntil: event.target.value })} />
            {aiUsage ? <p className="structured-ai-usage">Proposal AI: {aiUsage.remaining} of {aiUsage.dailyLimit} requests remaining today.</p> : null}
          </div> : null}
          {step === 1 ? <><CatalogueStep kind="SERVICE" commercial={commercial} catalogue={catalogue} packages={packages} onChange={patchCommercial} onSaveCustom={saveCustom} /><div className="structured-package-create"><input className="input" value={packageName} onChange={(event) => setPackageName(event.target.value)} placeholder="Reusable package name" /><button type="button" className="button button-ghost" disabled={busy || !packageName.trim()} onClick={savePackage}>Save current catalogue items as package</button></div></> : null}
          {step === 2 ? <CatalogueStep kind="INTEGRATION" commercial={commercial} catalogue={catalogue} packages={[]} onChange={patchCommercial} onSaveCustom={saveCustom} /> : null}
          {step === 3 ? <div className="structured-form-grid"><FormGroup label="Tax rate (%)"><input className="input" type="number" min="0" max="100" step="0.01" value={commercial.taxRate} onChange={(event) => patchCommercial({ taxRate: event.target.value })} /></FormGroup><FormGroup label="Proposal discount"><input className="input" type="number" min="0" step="0.01" value={commercial.discount} onChange={(event) => patchCommercial({ discount: event.target.value })} /></FormGroup><SelectField label="Deposit method" value={commercial.depositType || "PERCENTAGE"} onChange={(event) => patchCommercial({ depositType: event.target.value })}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></SelectField>{commercial.depositType === "FIXED" ? <FormGroup label="Fixed deposit amount"><input className="input" type="number" min="0" step="0.01" value={commercial.fixedDepositAmount || 0} onChange={(event) => patchCommercial({ fixedDepositAmount: event.target.value })} /></FormGroup> : <FormGroup label="Deposit (%)"><input className="input" type="number" min="0" max="100" step="0.01" value={commercial.depositPercent} onChange={(event) => patchCommercial({ depositPercent: event.target.value })} /></FormGroup>}<FormGroup label="Payment milestones (label | percent | due rule)"><textarea className="input" value={(commercial.paymentMilestones || []).map((entry) => `${entry.label} | ${entry.percentage} | ${entry.dueRule || ""}`).join("\n")} onChange={(event) => patchCommercial({ paymentMilestones: parseLines(event.target.value).map((line) => { const [label, percentage, dueRule] = line.split("|").map((part) => part.trim()); return { label, percentage: Number(percentage), dueRule }; }) })} placeholder="Design approval | 25 | On approval" /></FormGroup><PricingSummary commercial={effective} compact /></div> : null}
          {step === 4 ? <div className="structured-scope-step">
            <div className="structured-ai-toolbar"><div><strong>AI-assisted Scope & Delivery</strong><span>{commercial.aiGeneration?.scope?.sourceFingerprint && commercial.aiGeneration.scope.sourceFingerprint !== proposalSourceFingerprint(commercial) ? "Inputs changed — generated content is stale." : "Generated content stays editable and is never replaced automatically."}</span></div><button type="button" className="button button-ghost" disabled={aiBusy || !commercial.items.length} onClick={() => generateScope({ explicit: true })}>{aiBusy ? "Generating…" : commercial.aiGeneration?.scope ? "Regenerate" : "Generate"}</button></div>
            <div className="structured-form-grid"><FormGroup label="Scope"><textarea className="input structured-textarea-lg" value={commercial.scope || ""} onChange={(event) => patchCommercial({ scope: event.target.value, aiGeneration: { ...(commercial.aiGeneration || {}), scope: { ...(commercial.aiGeneration?.scope || {}), manuallyEdited: true } } })} /></FormGroup><FormGroup label="Estimated delivery"><input className="input" value={commercial.delivery?.estimatedDelivery || ""} onChange={(event) => patchCommercial({ delivery: { ...(commercial.delivery || {}), estimatedDelivery: event.target.value }, aiGeneration: { ...(commercial.aiGeneration || {}), scope: { ...(commercial.aiGeneration?.scope || {}), manuallyEdited: true } } })} /></FormGroup><FormGroup label="Exclusions (one per line)"><textarea className="input" value={joinLines(commercial.exclusions)} onChange={(event) => patchCommercial({ exclusions: parseLines(event.target.value), aiGeneration: { ...(commercial.aiGeneration || {}), scope: { ...(commercial.aiGeneration?.scope || {}), manuallyEdited: true } } })} /></FormGroup><FormGroup label="Payment and delivery terms (one per line)"><textarea className="input" value={joinLines(commercial.terms)} onChange={(event) => patchCommercial({ terms: parseLines(event.target.value), aiGeneration: { ...(commercial.aiGeneration || {}), scope: { ...(commercial.aiGeneration?.scope || {}), manuallyEdited: true } } })} /></FormGroup></div>
            {aiUsage ? <p className="structured-ai-usage">Proposal AI: {aiUsage.remaining} of {aiUsage.dailyLimit} requests remaining today.</p> : null}
          </div> : null}
          {step === 5 ? <ReviewStep commercial={commercial} effective={effective} version={version} versionHistory={versionHistory} access={access} clientRequests={clientRequests} record={record} busy={busy} onSave={saveDraft} onPublish={publish} onCreateLink={createLink} onSend={sendProposal} onRevokeLink={revokeLink} onWithdraw={withdrawVersion} onResolveRequest={resolveClientRequest} onGenerateInvoice={generateInvoice} onUpdateBillingStatus={updateBillingStatus} onCreateProject={createAcceptedProject} sendRecipient={sendRecipient} setSendRecipient={setSendRecipient} sendMessage={sendMessage} setSendMessage={setSendMessage} sendTtlHours={sendTtlHours} setSendTtlHours={setSendTtlHours} /> : null}
          <footer className="structured-step-actions"><button type="button" className="button button-ghost" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>Previous</button><span>Step {step + 1} of {PROPOSAL_STEPS.length}</span><button type="button" className="button" disabled={step === PROPOSAL_STEPS.length - 1} onClick={() => setStep((current) => Math.min(current + 1, PROPOSAL_STEPS.length - 1))}>Continue</button></footer>
        </section>
        <PricingSummary commercial={effective} />
      </div>
    </main>
  );
}

function CatalogueManagement() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { const payload = await apiGet("/api/proposals/catalogue"); setItems(payload.items || []); setSuggestions(payload.suggestions || []); }
    catch (error) { setNotice(error.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    try {
      const payload = editing.id ? await apiPatch(`/api/proposals/catalogue/${editing.id}`, editing) : await apiPost("/api/proposals/catalogue", editing);
      setEditing(null); setNotice(`${payload.item.name} catalogue pricing saved.`); await load();
    } catch (error) { setNotice(error.message); }
  };
  const patchTier = (index, patch) => setEditing((current) => ({ ...current, tiers: (current.tiers || []).map((tier, tierIndex) => tierIndex === index ? { ...tier, ...patch } : tier) }));
  return <main className="page structured-proposal-page"><header className="structured-page-header"><div><p className="eyebrow">Commercial settings</p><h1>Service & integration catalogue</h1><p>Configure Faako fees separately from provider-native charges. Changes never rewrite published proposals.</p></div><button type="button" className="button button-ghost" onClick={() => navigate("/proposals")}>Back to proposals</button></header>{notice ? <div className="notice is-info" role="status">{notice}</div> : null}<section className="structured-catalogue-admin"><h2>Configured items</h2>{items.map((item) => <article key={item.id}><div><span className="structured-item-kind is-required">{item.kind}</span><strong>{item.name}</strong><small>{item.tiers?.length || 0} tier(s) · Faako default {formatProposalMoney(item.defaultUnitPrice || 0)}</small></div><button type="button" className="button button-ghost" onClick={() => setEditing({ ...item, tiers: (item.tiers || []).map((tier) => ({ ...tier })) })}>Configure</button></article>)}<h2>Curated catalogue</h2>{suggestions.map((item) => <article key={`${item.kind}-${item.name}`}><div><span className="structured-item-kind is-optional">{item.kind}</span><strong>{item.name}</strong><small>{item.tiers?.length || 0} curated tier(s){item.sourceUrl ? " · Official source linked" : ""}</small></div><button type="button" className="button button-ghost" onClick={() => setEditing({ ...item, defaultUnitPrice: item.tiers?.find((tier) => tier.isDefault)?.faakoSetupFee || 0, defaultBillingType: "ONE_TIME", defaultBillingFrequency: "NONE", defaultCostOwnership: "FAAKO_BILLED", active: true })}>Add & configure</button></article>)}</section>{editing ? <div className="structured-modal" role="dialog" aria-modal="true" aria-labelledby="catalogue-editor-title"><div className="structured-modal__panel"><header><div><p className="eyebrow">Catalogue item</p><h2 id="catalogue-editor-title">Configure {editing.name}</h2></div><button type="button" className="button button-ghost" onClick={() => setEditing(null)}>Close</button></header><div className="structured-form-grid"><FormGroup label="Name"><input className="input" value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} /></FormGroup><SelectField label="Availability" value={editing.active === false ? "inactive" : "active"} onChange={(event) => setEditing((current) => ({ ...current, active: event.target.value === "active" }))}><option value="active">Available</option><option value="inactive">Unavailable</option></SelectField><FormGroup label="Category"><input className="input" value={editing.category || ""} onChange={(event) => setEditing((current) => ({ ...current, category: event.target.value }))} /></FormGroup><FormGroup label="Default Faako fee"><input className="input" type="number" min="0" value={editing.defaultUnitPrice || 0} onChange={(event) => setEditing((current) => ({ ...current, defaultUnitPrice: event.target.value }))} /></FormGroup><FormGroup label="Official pricing source"><input className="input" type="url" value={editing.sourceUrl || ""} onChange={(event) => setEditing((current) => ({ ...current, sourceUrl: event.target.value }))} /></FormGroup></div><div className="structured-tier-list"><div className="structured-tier-heading"><h3>Tiers</h3><button type="button" className="button button-ghost" onClick={() => setEditing((current) => ({ ...current, tiers: [...(current.tiers || []), { name: "New tier", priceModel: "CUSTOM_QUOTE", providerAmount: null, providerCurrency: "", displayPrice: "Custom quote", faakoSetupFee: 0, billingFrequency: "NONE", sourceUrl: current.sourceUrl || "", lastVerifiedAt: "", includedFeatures: [], active: true, isDefault: !(current.tiers || []).length }] }))}>Add tier</button></div>{(editing.tiers || []).map((tier, index) => <article key={`${index}-${tier.name}`}><FormGroup label="Tier name"><input className="input" value={tier.name} onChange={(event) => patchTier(index, { name: event.target.value })} /></FormGroup><SelectField label="Provider price model" value={tier.priceModel || "CUSTOM_QUOTE"} onChange={(event) => patchTier(index, { priceModel: event.target.value })}><option value="FIXED">Fixed</option><option value="PERCENTAGE">Percentage</option><option value="USAGE">Usage-based</option><option value="CUSTOM_QUOTE">Custom quote</option></SelectField><FormGroup label="Provider display price"><input className="input" value={tier.displayPrice || ""} onChange={(event) => patchTier(index, { displayPrice: event.target.value })} /></FormGroup><FormGroup label="Provider currency"><input className="input" value={tier.providerCurrency || ""} onChange={(event) => patchTier(index, { providerCurrency: event.target.value })} /></FormGroup><FormGroup label="Provider amount"><input className="input" type="number" min="0" value={tier.providerAmount ?? ""} onChange={(event) => patchTier(index, { providerAmount: event.target.value })} /></FormGroup><FormGroup label="Faako setup fee"><input className="input" type="number" min="0" value={tier.faakoSetupFee || 0} onChange={(event) => patchTier(index, { faakoSetupFee: event.target.value })} /></FormGroup><SelectField label="Billing cadence" value={tier.billingFrequency || "NONE"} onChange={(event) => patchTier(index, { billingFrequency: event.target.value })}><option value="NONE">One-time / none</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUAL">Annual</option></SelectField><DateField label="Last verified" value={tier.lastVerifiedAt || ""} onChange={(event) => patchTier(index, { lastVerifiedAt: event.target.value })} /><FormGroup label="Source URL"><input className="input" type="url" value={tier.sourceUrl || ""} onChange={(event) => patchTier(index, { sourceUrl: event.target.value })} /></FormGroup><label className="structured-inline-check"><input type="radio" name="default-tier" checked={tier.isDefault === true} onChange={() => setEditing((current) => ({ ...current, tiers: current.tiers.map((entry, tierIndex) => ({ ...entry, isDefault: tierIndex === index })) }))} /> Default tier</label><button type="button" className="button button-ghost" onClick={() => setEditing((current) => ({ ...current, tiers: current.tiers.filter((_, tierIndex) => tierIndex !== index) }))}>Remove tier</button>{tier.needsReview ? <span className="status-pill is-warning">Older than 90 days — review</span> : null}</article>)}</div><footer className="structured-step-actions"><span>Provider charges are never currency-converted.</span><button type="button" className="button" onClick={save}>Save catalogue item</button></footer></div></div> : null}</main>;
}

function ProposalManagement() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [users, setUsers] = useState([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const [payload, userPayload] = await Promise.all([
        apiGet(`/api/proposals/structured${params.size ? `?${params}` : ""}`),
        apiGet("/api/access/users"),
      ]);
      setProposals(payload.proposals || []);
      setUsers(userPayload.users || []);
    } catch (error) { setNotice(error.message); } finally { setLoading(false); }
  }, [search, status]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 250); return () => window.clearTimeout(timer); }, [load]);
  const duplicate = async (proposal) => {
    const source = proposal.currentVersion?.commercial;
    if (!source) { setNotice("Open this legacy proposal in the previous editor before duplicating it."); return; }
    try {
      const commercial = { ...source, title: `${source.title} (Copy)` };
      const created = await apiPost("/api/proposals", buildLegacyProposalPayload(commercial));
      await apiPost(`/api/proposals/${created.proposal.id}/versions`, { commercial });
      navigate(`/proposals/${created.proposal.id}/edit`);
    } catch (error) { setNotice(error.message); }
  };
  const userById = new Map(users.map((user) => [Number(user.id), user]));
  return <main className="page structured-proposal-page"><header className="structured-page-header"><div><p className="eyebrow">Commercial workspace</p><h1>Proposals</h1><p>Create configurable quotations, publish immutable versions, and review client requests.</p></div><div><button className="button button-ghost" type="button" onClick={() => navigate("/proposals/catalogue")}>Catalogue pricing</button><button className="button" type="button" onClick={() => navigate("/proposals/new")}>New proposal</button></div></header>{notice ? <div className="notice is-warning" role="status">{notice}</div> : null}<div className="structured-management-tools"><input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or proposal" aria-label="Search proposals" /><SelectField value={status} onChange={(event) => setStatus(event.target.value)} ariaLabel="Filter proposal status"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="SENT">Sent</option><option value="VIEWED">Viewed</option><option value="CHANGES_REQUESTED">Changes requested</option><option value="ACCEPTED">Accepted</option><option value="DECLINED">Declined</option><option value="EXPIRED">Expired</option><option value="SUPERSEDED">Superseded</option><option value="WITHDRAWN">Withdrawn</option></SelectField></div>{loading ? <AnimatedLoadingState title="Loading proposals" message="Preparing the commercial workspace." /> : <div className="structured-proposal-table" role="table" aria-label="Proposals"><div className="structured-proposal-table__head" role="row"><span>Proposal</span><span>Customer / project</span><span>Status</span><span>Value / expiry</span><span>Activity</span><span>Actions</span></div>{proposals.map((proposal) => { const current = proposal.currentVersion; const owner = userById.get(Number(current?.commercial?.internalOwnerUserId)); const invoices = current?.billingProgress?.invoices || []; const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0); const displayStatus = current?.lifecycleStatus || current?.status || proposal.legacyStatus; return <div className="structured-proposal-table__row" role="row" key={proposal.id}><div><strong>{proposal.title}</strong><small>Version {current?.versionNumber || "Legacy"}</small></div><div><span>{current?.customer?.name || proposal.clientName || "No customer"}</span><small>{current?.deliveryProject?.title || current?.project?.title || proposal.project?.title || "No project"}</small></div><div><span className={`status-pill is-${["PUBLISHED", "SENT", "VIEWED", "ACCEPTED"].includes(displayStatus) ? "success" : "info"}`}>{displayStatus}</span></div><div><strong>{formatProposalMoney(current?.totals?.oneTimeTotal, current?.currency || "GHS")}</strong><small>{current?.validUntil ? `Expires ${current.validUntil}` : "No expiry"}</small></div><div><span>{proposal.openRequests?.length || 0} open requests</span><small>Owner: {owner?.fullName || owner?.email || "Unassigned"}</small>{invoices.length ? <small>{invoices.length} invoice(s) · {formatProposalMoney(outstanding, current.currency)} outstanding</small> : null}{proposal.relatedInvoice ? <small>Legacy invoice {proposal.relatedInvoice.number || proposal.relatedInvoice.id}</small> : null}</div><div className="structured-row-actions"><button className="button button-ghost" type="button" onClick={() => navigate(`/proposals/${proposal.id}/edit`)}>Open</button><button className="button button-ghost" type="button" onClick={() => duplicate(proposal)}>Duplicate</button>{!current ? <button className="button button-ghost" type="button" onClick={() => navigate(`/proposals/${proposal.id}/preview`)}>Legacy editor</button> : null}</div></div>; })}{!proposals.length ? <div className="structured-empty"><strong>No proposals match this view.</strong><span>Start a structured proposal or adjust the filters.</span></div> : null}</div>}</main>;
}

export default function StructuredProposalWorkspace() {
  const location = useLocation();
  if (location.pathname === "/proposals/catalogue") return <CatalogueManagement />;
  return location.pathname === "/proposals" ? <ProposalManagement /> : <StructuredBuilder />;
}
