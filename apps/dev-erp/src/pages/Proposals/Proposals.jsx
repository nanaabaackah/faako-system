import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowUp2, ArrowDown2 } from "iconsax-react";
import {
  ErpPanel,
  ErpPanelHeader,
  FormGroup,
  StackGroup,
} from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import {
  PROPOSAL_BLOCK_TYPES,
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_OPTIONS,
  PROPOSAL_THEME_OPTIONS,
  PROPOSAL_TYPES,
  PROPOSAL_TYPE_OPTIONS,
  parseMultilineItems,
  serializeMultilineItems,
} from "./proposalSchema";
import {
  PROPOSAL_TEMPLATE_LIBRARY,
  createProposalFromTemplate,
} from "./proposalTemplates";
import { getProposalExportBlocks } from "./proposalExportConfig";
import ProposalPreview from "./ProposalPreview";
import {
  PROPOSAL_REVIEW_CHECKS,
  createDefaultProposalWorkflow,
  getProposalReadinessSummary,
  getProposalStatusDescription,
  getProposalStatusTone,
} from "./proposalWorkflow";
import "./Proposals.css";

// TODO(proposal-pdf-generation): wire export metadata to a dedicated PDF service later.
// TODO(proposal-client-view): add access logging, expiry controls, and email/share sending after privacy review.
// TODO(proposal-approval-flow): replace client response JSON with server-owned approval records later.
// TODO(proposal-invoice-conversion): map approved proposals to invoices only after finance review.
// TODO(proposal-paystack): connect Paystack only after verified references and webhook handling exist.
// TODO(proposal-client-approval-actions): add digital signatures, comments, and client notifications after access rules exist.
// TODO(proposal-versioning-analytics-ai): add revision history, analytics, and AI wording after privacy review.
// TODO(proposal-template-management): add custom template editing only after permission and audit boundaries exist.

const BLOCKS_WITH_ITEMS = new Set([
  PROPOSAL_BLOCK_TYPES.ABOUT_BUSINESS,
  PROPOSAL_BLOCK_TYPES.GOALS,
  PROPOSAL_BLOCK_TYPES.PROPOSED_SOLUTION,
  PROPOSAL_BLOCK_TYPES.DELIVERABLES,
  PROPOSAL_BLOCK_TYPES.TERMS,
]);

const updateAtIndex = (items, index, updater) =>
  items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));

const moveBlock = (blocks, index, direction) => {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= blocks.length) return blocks;
  const nextBlocks = [...blocks];
  const [block] = nextBlocks.splice(index, 1);
  nextBlocks.splice(nextIndex, 0, block);
  return nextBlocks;
};

const getProposalTypeLabel = (value) =>
  PROPOSAL_TYPE_OPTIONS.find((option) => option.value === value)?.label || "Proposal";

const getProposalStatusLabel = (value) =>
  PROPOSAL_STATUS_OPTIONS.find((option) => option.value === value)?.label || "Draft";

const PROPOSAL_TEMPLATE_FILTERS = Object.freeze([
  { value: "all", label: "All" },
  { value: PROPOSAL_TYPES.WEBSITE, label: "Website" },
  { value: PROPOSAL_TYPES.ERP, label: "ERP" },
  { value: PROPOSAL_TYPES.ONBOARDING, label: "Onboarding" },
  { value: "service", label: "Service" },
  { value: PROPOSAL_TYPES.TRAVEL, label: "Travel later" },
]);

const templateMatchesFilter = (template, filter) => {
  if (filter === "all") return true;
  return template.proposalType === filter || template.categoryTags?.includes(filter);
};

const templateMatchesSearch = (template, searchValue) => {
  const search = searchValue.trim().toLowerCase();
  if (!search) return true;
  return [
    template.name,
    template.title,
    template.description,
    template.styleReference,
    template.proposalType,
    template.isBlank ? "blank proposal start from scratch custom" : "",
    ...(template.categoryTags || []),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
};

const getProposalTemplateById = (templateId) =>
  PROPOSAL_TEMPLATE_LIBRARY.find((template) => template.id === templateId || template.key === templateId) ||
  PROPOSAL_TEMPLATE_LIBRARY[0];

const getTemplateCardLabel = (template) =>
  template.isBlank ? "Blank proposal" : getProposalTypeLabel(template.proposalType);

const formatProposalTimestamp = (value) => {
  if (!value) return "Not saved yet";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const mapProposalRecordToDraft = (record) => ({
  ...(record?.content && typeof record.content === "object" ? record.content : {}),
  savedId: record.id,
  status: record.status || "draft",
  proposalType: record.proposalType || record?.content?.proposalType || "website",
  title: record.title || record?.content?.title || "Untitled proposal",
  clientName: record.clientName || record?.content?.clientName || "",
  version: record.version || 1,
  metadata: record.metadata || record?.content?.metadata || null,
  organizationId: record.organizationId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  createdBy: record.createdBy || null,
  lastEditedBy: record.lastEditedBy || null,
  hasShareToken: Boolean(record.hasShareToken),
  shareTokenCreatedAt: record.shareTokenCreatedAt || null,
  shareTokenExpiresAt: record.shareTokenExpiresAt || null,
  shareLink: record.shareLink || null,
  workflow: createDefaultProposalWorkflow(record?.content?.workflow),
});

const buildProposalSavePayload = (proposal) => {
  const content = { ...proposal };
  [
    "savedId",
    "organizationId",
    "createdAt",
    "updatedAt",
    "createdBy",
    "lastEditedBy",
    "hasShareToken",
    "shareTokenCreatedAt",
    "shareTokenExpiresAt",
    "shareLink",
    "metadata",
  ].forEach((key) => {
    delete content[key];
  });

  return {
    title: proposal.title,
    clientName: proposal.clientName,
    proposalType: proposal.proposalType,
    status: proposal.status || "draft",
    metadata: proposal.metadata || null,
    content,
  };
};

const upsertProposalRecord = (records, nextRecord) => {
  const existingIndex = records.findIndex((record) => record.id === nextRecord.id);
  if (existingIndex === -1) return [nextRecord, ...records];
  return records.map((record) => (record.id === nextRecord.id ? nextRecord : record));
};

function PricingEditor({ block, onChange }) {
  const updatePricingItem = (index, field, value) => {
    onChange({
      pricingItems: updateAtIndex(block.pricingItems || [], index, (item) => ({
        ...item,
        [field]: value,
      })),
    });
  };

  const addPricingItem = () => {
    onChange({
      pricingItems: [
        ...(block.pricingItems || []),
        { label: "Additional item", amount: "TBD", note: "" },
      ],
    });
  };

  return (
    <div className="proposal-editor-list">
      {(block.pricingItems || []).map((item, index) => (
        <div className="proposal-editor-list__row" key={`${block.id}-pricing-${index}`}>
          <input
            className="input"
            value={item.label}
            onChange={(event) => updatePricingItem(index, "label", event.target.value)}
            aria-label={`Pricing item ${index + 1} label`}
          />
          <input
            className="input"
            value={item.amount}
            onChange={(event) => updatePricingItem(index, "amount", event.target.value)}
            aria-label={`Pricing item ${index + 1} amount`}
          />
          <input
            className="input"
            value={item.note}
            onChange={(event) => updatePricingItem(index, "note", event.target.value)}
            aria-label={`Pricing item ${index + 1} note`}
          />
        </div>
      ))}
      <button type="button" className="button button-ghost" onClick={addPricingItem}>
        Add pricing row
      </button>
    </div>
  );
}

function TimelineEditor({ block, onChange }) {
  const updateTimelineItem = (index, field, value) => {
    onChange({
      timelineItems: updateAtIndex(block.timelineItems || [], index, (item) => ({
        ...item,
        [field]: value,
      })),
    });
  };

  const addTimelineItem = () => {
    onChange({
      timelineItems: [
        ...(block.timelineItems || []),
        { label: "New phase", duration: "TBD", note: "" },
      ],
    });
  };

  return (
    <div className="proposal-editor-list">
      {(block.timelineItems || []).map((item, index) => (
        <div className="proposal-editor-list__row" key={`${block.id}-timeline-${index}`}>
          <input
            className="input"
            value={item.label}
            onChange={(event) => updateTimelineItem(index, "label", event.target.value)}
            aria-label={`Timeline item ${index + 1} label`}
          />
          <input
            className="input"
            value={item.duration}
            onChange={(event) => updateTimelineItem(index, "duration", event.target.value)}
            aria-label={`Timeline item ${index + 1} duration`}
          />
          <input
            className="input"
            value={item.note}
            onChange={(event) => updateTimelineItem(index, "note", event.target.value)}
            aria-label={`Timeline item ${index + 1} note`}
          />
        </div>
      ))}
      <button type="button" className="button button-ghost" onClick={addTimelineItem}>
        Add phase
      </button>
    </div>
  );
}

function ProposalBlockEditor({ block, index, blockCount, onChange, onMove }) {
  return (
    <ErpPanel className="proposal-block-editor">
      <ErpPanelHeader
        title={block.label}
        description={block.required ? "Required section" : "Optional reusable block"}
        actions={(
          <>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              aria-label="Move up"
              title="Move up"
            >
              <ArrowUp2 size={18} variant="Bold" />
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => onMove(index, 1)}
              disabled={index === blockCount - 1}
              aria-label="Move down"
              title="Move down"
            >
              <ArrowDown2 size={18} variant="Bold" />
            </button>
          </>
        )}
      />
      <StackGroup>
        {!block.required ? (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(block.enabled)}
              onChange={(event) => onChange({ enabled: event.target.checked })}
            />
            Show in preview
          </label>
        ) : null}
        <FormGroup label="Section title">
          <input
            className="input"
            value={block.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </FormGroup>
        {block.type === PROPOSAL_BLOCK_TYPES.COVER ? (
          <FormGroup label="Cover kicker">
            <input
              className="input"
              value={block.kicker}
              onChange={(event) => onChange({ kicker: event.target.value })}
            />
          </FormGroup>
        ) : null}
        <FormGroup label="Body copy">
          <textarea
            className="input"
            value={block.body}
            onChange={(event) => onChange({ body: event.target.value })}
          />
        </FormGroup>
        {BLOCKS_WITH_ITEMS.has(block.type) ? (
          <FormGroup label="Bullet items">
            <textarea
              className="input"
              value={serializeMultilineItems(block.items)}
              onChange={(event) => onChange({ items: parseMultilineItems(event.target.value) })}
              placeholder="One item per line"
            />
          </FormGroup>
        ) : null}
        {block.type === PROPOSAL_BLOCK_TYPES.PRICING ? (
          <PricingEditor block={block} onChange={onChange} />
        ) : null}
        {block.type === PROPOSAL_BLOCK_TYPES.TIMELINE ? (
          <TimelineEditor block={block} onChange={onChange} />
        ) : null}
      </StackGroup>
    </ErpPanel>
  );
}

function ProposalWorkflowPanel({
  proposal,
  onStatusChange,
  onWorkflowChange,
  onReadinessChange,
}) {
  const workflow = createDefaultProposalWorkflow(proposal.workflow);
  const readinessSummary = getProposalReadinessSummary(workflow);
  const statusTone = getProposalStatusTone(proposal.status);
  const clientResponse = workflow.clientResponse;
  const clientResponseLabel =
    clientResponse?.action === PROPOSAL_STATUSES.APPROVED
      ? "Client approved"
      : clientResponse?.action === PROPOSAL_STATUSES.CHANGES_REQUESTED
        ? "Client requested changes"
        : "";

  return (
    <ErpPanel className="proposal-workflow-panel">
      <ErpPanelHeader
        title="Review workflow"
        description="Internal readiness plus client response state from secure proposal links."
        actions={(
          <>
            <span className={`status-pill is-${statusTone}`}>
              {getProposalStatusLabel(proposal.status)}
            </span>
            <span className={readinessSummary.isReady ? "status-pill is-success" : "status-pill is-warning"}>
              {readinessSummary.completed}/{readinessSummary.total} ready
            </span>
          </>
        )}
      />
      <StackGroup>
        <div className="proposal-workflow-state">
          <FormGroup label="Workflow status">
            <select
              className="input"
              value={proposal.status || PROPOSAL_STATUSES.DRAFT}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {PROPOSAL_STATUS_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </FormGroup>
          <div className="proposal-workflow-state__note" role="note">
            {getProposalStatusDescription(proposal.status)}
          </div>
        </div>

        <div className="proposal-readiness-grid" aria-label="Approval readiness checks">
          {PROPOSAL_REVIEW_CHECKS.map((check) => (
            <label className="proposal-readiness-item" key={check.key}>
              <input
                type="checkbox"
                aria-label={check.label}
                checked={Boolean(workflow.readiness?.[check.key])}
                onChange={(event) => onReadinessChange(check.key, event.target.checked)}
              />
              <span className="proposal-readiness-item__content">
                <strong>{check.label}</strong>
                <small>{check.description}</small>
              </span>
            </label>
          ))}
        </div>

        <FormGroup label="Internal review notes">
          <textarea
            className="input"
            value={workflow.reviewNotes}
            onChange={(event) => onWorkflowChange({ reviewNotes: event.target.value })}
            placeholder="Reviewer notes, readiness concerns, or approval blockers."
          />
        </FormGroup>
        <FormGroup label="Internal comments">
          <textarea
            className="input"
            value={workflow.internalComments}
            onChange={(event) => onWorkflowChange({ internalComments: event.target.value })}
            placeholder="Lightweight internal comments only. Not a client-facing comment system."
          />
        </FormGroup>
        <FormGroup label="Change request notes">
          <textarea
            className="input"
            value={workflow.clientChangeRequestNotes}
            onChange={(event) => onWorkflowChange({ clientChangeRequestNotes: event.target.value })}
            placeholder="Client revision request notes or internal follow-up context."
          />
        </FormGroup>

        {clientResponse ? (
          <div
            className={`proposal-client-response is-${clientResponse.action}`}
            role="note"
            aria-label="Client proposal response"
          >
            <span className={`status-pill is-${getProposalStatusTone(clientResponse.action)}`}>
              {clientResponseLabel}
            </span>
            <strong>
              {clientResponse.clientName || "Client"} responded{" "}
              {formatProposalTimestamp(clientResponse.respondedAt)}
            </strong>
            {clientResponse.clientContact ? <small>{clientResponse.clientContact}</small> : null}
            {clientResponse.message ? <p>{clientResponse.message}</p> : null}
          </div>
        ) : (
          <div className="proposal-future-actions" aria-label="Client approval actions">
            <span>Client actions available on secure shared links</span>
            <span>Approve proposal</span>
            <span>Request changes</span>
          </div>
        )}

        {workflow.statusHistory.length ? (
          <div className="proposal-status-history" aria-label="Status history">
            {workflow.statusHistory.slice(-4).map((entry, index) => (
              <span key={`${entry.status}-${entry.at}-${index}`}>
                {getProposalStatusLabel(entry.status)} · {formatProposalTimestamp(entry.at)}
              </span>
            ))}
          </div>
        ) : null}
      </StackGroup>
    </ErpPanel>
  );
}

function Proposals() {
  const navigate = useNavigate();
  const { proposalId } = useParams();
  const [selectedTemplateId, setSelectedTemplateId] = useState(PROPOSAL_TEMPLATE_LIBRARY[0].id);
  const [proposal, setProposal] = useState(() => createProposalFromTemplate(PROPOSAL_TEMPLATE_LIBRARY[0].id));
  const [savedProposals, setSavedProposals] = useState([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [isLoadingProposal, setIsLoadingProposal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingShareLink, setIsPreparingShareLink] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [notice, setNotice] = useState({
    tone: "info",
    message:
      "Saved proposals stay private to authenticated Dev ERP users. Client-facing proposal viewing is not active yet.",
  });

  const enabledBlockCount = useMemo(() => getProposalExportBlocks(proposal).length, [proposal]);
  const visibleTemplates = useMemo(
    () =>
      PROPOSAL_TEMPLATE_LIBRARY.filter(
        (template) =>
          templateMatchesFilter(template, templateFilter) &&
          templateMatchesSearch(template, templateSearch)
      ),
    [templateFilter, templateSearch]
  );
  const recentProposals = savedProposals;

  const loadProposalList = useCallback(async () => {
    setIsLoadingProposals(true);
    try {
      const payload = await apiGet("/api/proposals", {
        fallbackMessage: "Unable to load proposals",
      });
      setSavedProposals(Array.isArray(payload?.proposals) ? payload.proposals : []);
    } catch (error) {
      setNotice({
        tone: "warning",
        message: error?.message || "Unable to load saved proposals. You can still edit locally.",
      });
    } finally {
      setIsLoadingProposals(false);
    }
  }, []);

  const loadProposalById = useCallback(async (id) => {
    if (!id) return;
    setIsLoadingProposal(true);
    try {
      const payload = await apiGet(`/api/proposals/${id}`, {
        fallbackMessage: "Unable to load proposal",
      });
      if (payload?.proposal) {
        setProposal(mapProposalRecordToDraft(payload.proposal));
        setSelectedTemplateId("");
        setHasUnsavedChanges(false);
        setNotice({
          tone: "success",
          message: "Saved proposal loaded for internal editing and preview.",
        });
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error?.message || "Unable to load that proposal.",
      });
    } finally {
      setIsLoadingProposal(false);
    }
  }, []);

  useEffect(() => {
    loadProposalList();
  }, [loadProposalList]);

  useEffect(() => {
    if (proposalId) {
      loadProposalById(proposalId);
    }
  }, [loadProposalById, proposalId]);

  const loadTemplate = (templateId) => {
    const template = getProposalTemplateById(templateId);
    setSelectedTemplateId(templateId);
    setProposal(createProposalFromTemplate(templateId));
    setHasUnsavedChanges(true);
    setIsPreviewOpen(false);
    setNotice({
      tone: "info",
      message: template.isBlank
        ? "Blank proposal started. Turn on the sections you need, edit the copy, then save the draft."
        : `${template.name} draft started. Save it before preparing a secure link.`,
    });
    if (proposalId) {
      navigate("/proposals");
    }
  };

  const updateProposal = (patch) => {
    setProposal((current) => ({ ...current, ...patch }));
    setHasUnsavedChanges(true);
  };

  const updateBranding = (patch) => {
    setProposal((current) => ({
      ...current,
      branding: { ...current.branding, ...patch },
    }));
    setHasUnsavedChanges(true);
  };

  const updatePersonalNotes = (patch) => {
    setProposal((current) => ({
      ...current,
      personalNotes: { ...current.personalNotes, ...patch },
    }));
    setHasUnsavedChanges(true);
  };

  const updateProposalStatus = (status) => {
    setProposal((current) => ({
      ...current,
      status,
      workflow: createDefaultProposalWorkflow(current.workflow),
    }));
    setHasUnsavedChanges(true);
  };

  const updateWorkflow = (patch) => {
    setProposal((current) => ({
      ...current,
      workflow: {
        ...createDefaultProposalWorkflow(current.workflow),
        ...patch,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const updateWorkflowReadiness = (key, value) => {
    setProposal((current) => {
      const workflow = createDefaultProposalWorkflow(current.workflow);
      return {
        ...current,
        workflow: {
          ...workflow,
          readiness: {
            ...workflow.readiness,
            [key]: value,
          },
        },
      };
    });
    setHasUnsavedChanges(true);
  };

  const updateBlock = (blockId, patch) => {
    setProposal((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
    }));
    setHasUnsavedChanges(true);
  };

  const moveProposalBlock = (index, direction) => {
    setProposal((current) => ({
      ...current,
      blocks: moveBlock(current.blocks, index, direction),
    }));
    setHasUnsavedChanges(true);
  };

  const saveProposal = async () => {
    setIsSaving(true);
    try {
      const payload = buildProposalSavePayload(proposal);
      const response = proposal.savedId
        ? await apiPatch(`/api/proposals/${proposal.savedId}`, payload, {
            fallbackMessage: "Unable to update proposal",
          })
        : await apiPost("/api/proposals", payload, {
            fallbackMessage: "Unable to save proposal",
          });
      const savedRecord = response?.proposal;
      if (savedRecord) {
        setProposal(mapProposalRecordToDraft(savedRecord));
        setSavedProposals((records) => upsertProposalRecord(records, savedRecord));
        setHasUnsavedChanges(false);
        setSelectedTemplateId("");
        setNotice({
          tone: "success",
          message: `Proposal saved as version ${savedRecord.version}.`,
        });
        if (!proposal.savedId) {
          navigate(`/proposals/${savedRecord.id}/preview`, { replace: true });
        }
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error?.message || "Unable to save proposal.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const prepareShareLink = async () => {
    if (!proposal.savedId || hasUnsavedChanges) return;
    setIsPreparingShareLink(true);
    try {
      const response = await apiPost(`/api/proposals/${proposal.savedId}/share-token`, undefined, {
        fallbackMessage: "Unable to prepare secure proposal link",
      });
      const savedRecord = response?.proposal;
      if (savedRecord) {
        setProposal(mapProposalRecordToDraft(savedRecord));
        setSavedProposals((records) => upsertProposalRecord(records, savedRecord));
        setNotice({
          tone: "success",
          message:
            "Secure token prepared. Client view opens only after the proposal is shared or approved.",
        });
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error?.message || "Unable to prepare secure link.",
      });
    } finally {
      setIsPreparingShareLink(false);
    }
  };

  return (
    <main className="page proposal-page">
      <section className="proposal-hero" aria-label="Proposal generator overview">
        <div className="proposal-hero__copy">
          <h1>Proposals</h1>
          <p>
            Choose a focused starter, preview the structure, or start with a blank proposal and build the sections manually.
          </p>
        </div>

        <div className="proposal-search-card" role="search">
          <label className="proposal-search-card__label" htmlFor="proposal-template-search">
            Search templates
          </label>
          <input
            id="proposal-template-search"
            className="input proposal-search-input"
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
            placeholder="Blank, website, ERP, portal, POS..."
          />
          <div className="proposal-filter-chips" aria-label="Proposal template filters">
            {PROPOSAL_TEMPLATE_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={`proposal-filter-chip ${templateFilter === filter.value ? "is-active" : ""}`}
                onClick={() => setTemplateFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className={`notice proposal-notice is-${notice.tone}`} role="status">
        {notice.message}
      </div>

      <section className="proposal-gallery-section" id="proposal-templates" aria-label="Proposal templates">
        <div className="proposal-section-heading">
          <div>
            <p className="eyebrow">Template gallery</p>
            <h2>Choose a Template</h2>
          </div>
          <span className="status-pill is-info">
            {visibleTemplates.length}/{PROPOSAL_TEMPLATE_LIBRARY.length} templates
          </span>
        </div>
        <div className="proposal-template-grid">
          {visibleTemplates.map((template) => (
            <button
              type="button"
              key={template.id}
              className={`proposal-template-card bubble-card ${
                selectedTemplateId === template.id ? "is-active" : ""
              }`}
              aria-label={`${template.isBlank ? "Start" : "Use"} ${template.name}`}
              onClick={() => loadTemplate(template.id)}
            >
              <div
                className={`proposal-template-card__thumbnail ${
                  template.isBlank ? "is-blank" : `is-${template.proposalType}`
                }`}
                aria-hidden="true"
              >
                <span className="proposal-template-card__type">
                  {getTemplateCardLabel(template)}
                </span>
                {template.isBlank ? <span className="proposal-template-card__blank-mark">+</span> : null}
              </div>
              <div className="proposal-template-card__body">
                <strong>{template.name}</strong>
              </div>
            </button>
          ))}
          {!visibleTemplates.length ? (
            <div className="proposal-empty-state">
              <strong>No templates found</strong>
              <span className="muted">Try another search or filter.</span>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  setTemplateSearch("");
                  setTemplateFilter("all");
                }}
              >
                Show all templates
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="proposal-recent-section" aria-label="Recent proposals">
        <div className="proposal-section-heading">
          <div>
            <p className="eyebrow">Recent proposals</p>
            <h2>Continue work</h2>
          </div>
          <span className="status-pill is-info">{savedProposals.length} saved</span>
        </div>
        <div className="proposal-saved-list">
          {isLoadingProposals ? <p className="muted">Loading saved proposals...</p> : null}
          {!isLoadingProposals && !savedProposals.length ? (
            <div className="proposal-empty-state">
              <strong>No saved proposals yet</strong>
              <span className="muted">Choose a template above to start a private draft.</span>
            </div>
          ) : null}
          {recentProposals.map((savedProposal) => (
            <button
              type="button"
              className={`proposal-saved-card bubble-card ${
                proposal.savedId === savedProposal.id ? "is-active" : ""
              }`}
              key={savedProposal.id}
              onClick={() => navigate(`/proposals/${savedProposal.id}/preview`)}
            >
              <div>
                <span className={`status-pill is-${getProposalStatusTone(savedProposal.status)}`}>
                  {getProposalStatusLabel(savedProposal.status)}
                </span>
                <strong>{savedProposal.title}</strong>
                <span className="muted">
                  {savedProposal.clientName || "No client"} · v{savedProposal.version} ·{" "}
                  {formatProposalTimestamp(savedProposal.updatedAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="proposal-editor-layout" aria-label="Proposal editor and preview">
        <section className="proposal-editor-shell" aria-label="Proposal editor shell">
          <ErpPanel>
            <ErpPanelHeader
              title="Proposal details"
              description="Save private proposal drafts before preparing secure client-view links."
              actions={(
                <>
                  <button
                    type="button"
                    className="button"
                    onClick={saveProposal}
                    disabled={isSaving || isLoadingProposal}
                  >
                    {isSaving ? "Saving..." : proposal.savedId ? "Save version" : "Save draft"}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={prepareShareLink}
                    disabled={
                      isPreparingShareLink ||
                      isSaving ||
                      !proposal.savedId ||
                      hasUnsavedChanges ||
                      proposal.status === "archived"
                    }
                  >
                    {isPreparingShareLink ? "Preparing..." : "Prepare secure link"}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost proposal-preview-toggle"
                    onClick={() => setIsPreviewOpen((current) => !current)}
                  >
                    {isPreviewOpen ? "Hide preview" : "Show preview"}
                  </button>
                </>
              )}
            />
            <div className="proposal-editor-grid">
              <FormGroup label="Proposal title">
                <input
                  className="input"
                  value={proposal.title}
                  onChange={(event) => updateProposal({ title: event.target.value })}
                />
              </FormGroup>
              <FormGroup label="Client name">
                <input
                  className="input"
                  value={proposal.clientName}
                  onChange={(event) => updateProposal({ clientName: event.target.value })}
                />
              </FormGroup>
              <FormGroup label="Prepared by">
                <input
                  className="input"
                  value={proposal.preparedBy}
                  onChange={(event) => updateProposal({ preparedBy: event.target.value })}
                />
              </FormGroup>
              <FormGroup label="Proposal type">
                <select
                  className="input"
                  value={proposal.proposalType}
                  onChange={(event) => updateProposal({ proposalType: event.target.value })}
                >
                  {PROPOSAL_TYPE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Preview theme">
                <select
                  className="input"
                  value={proposal.branding.theme}
                  onChange={(event) => updateBranding({ theme: event.target.value })}
                >
                  {PROPOSAL_THEME_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Proposal brand label">
                <input
                  className="input"
                  value={proposal.branding.businessName}
                  onChange={(event) => updateBranding({ businessName: event.target.value })}
                />
              </FormGroup>
            </div>
            <div className="proposal-record-meta" aria-label="Proposal record metadata">
              <span>{enabledBlockCount} preview sections</span>
              <span>Template: {proposal.template?.name || proposal.metadata?.templateName || "Custom draft"}</span>
              <span>Updated {formatProposalTimestamp(proposal.updatedAt)}</span>
              <span>
                Last editor: {proposal.lastEditedBy?.fullName || proposal.lastEditedBy?.email || "Not saved"}
              </span>
              {proposal.hasShareToken ? (
                <span>Secure token expires {formatProposalTimestamp(proposal.shareTokenExpiresAt)}</span>
              ) : (
                <span>No secure token prepared</span>
              )}
            </div>
            {proposal.shareLink ? (
              <div className="proposal-share-foundation" role="note">
                <strong>
                  {proposal.shareLink.active ? "Client view available" : "Client view prepared"}
                </strong>
                <span>{proposal.shareLink.clientViewPath}</span>
                <small>
                  {proposal.shareLink.note ||
                    "Only shared or approved proposals can be viewed through this secure token."}
                </small>
                {proposal.shareLink.active ? (
                  <a
                    className="button button-ghost proposal-share-foundation__link"
                    href={proposal.shareLink.clientViewPath}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open client view
                  </a>
                ) : null}
              </div>
            ) : null}
          </ErpPanel>

          <ProposalWorkflowPanel
            proposal={proposal}
            onStatusChange={updateProposalStatus}
            onWorkflowChange={updateWorkflow}
            onReadinessChange={updateWorkflowReadiness}
          />

          <ErpPanel>
            <ErpPanelHeader
              title="Personal note"
              description="Founder/consultant messaging that can be reused across proposal types."
            />
            <StackGroup>
              <FormGroup label="Introduction note">
                <textarea
                  className="input"
                  value={proposal.personalNotes.introduction}
                  onChange={(event) => updatePersonalNotes({ introduction: event.target.value })}
                />
              </FormGroup>
              <FormGroup label="Founder or consultant message">
                <textarea
                  className="input"
                  value={proposal.personalNotes.founderMessage}
                  onChange={(event) => updatePersonalNotes({ founderMessage: event.target.value })}
                />
              </FormGroup>
              <FormGroup label="Optional closing note">
                <textarea
                  className="input"
                  value={proposal.personalNotes.closing}
                  onChange={(event) => updatePersonalNotes({ closing: event.target.value })}
                />
              </FormGroup>
            </StackGroup>
          </ErpPanel>

          <div className="proposal-block-stack">
            {proposal.blocks.map((block, index) => (
              <ProposalBlockEditor
                key={block.id}
                block={block}
                index={index}
                blockCount={proposal.blocks.length}
                onChange={(patch) => updateBlock(block.id, patch)}
                onMove={moveProposalBlock}
              />
            ))}
          </div>
        </section>

        <aside
          className={`proposal-preview-shell ${isPreviewOpen ? "is-open" : ""}`}
          aria-label="Proposal preview shell"
        >
          <ErpPanel className="proposal-preview-panel">
            <ErpPanelHeader
              title="Live preview"
              description="Internal authenticated preview remains the source of truth for future PDF export."
              actions={
                proposal.savedId ? (
                  <>
                    <span className="status-pill is-warning">PDF export planned</span>
                    <Link className="button button-ghost" to={`/proposals/${proposal.savedId}/preview`}>
                      Internal preview route
                    </Link>
                  </>
                ) : null
              }
            />
            <ProposalPreview proposal={proposal} />
          </ErpPanel>
        </aside>
      </section>
    </main>
  );
}

export default Proposals;
