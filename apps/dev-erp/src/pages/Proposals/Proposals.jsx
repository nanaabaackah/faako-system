import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowUp2, ArrowDown2 } from "iconsax-react";
import {
  AnimatedLoadingState,
  DateField,
  ErpPanel,
  ErpPanelHeader,
  FormGroup,
  SelectField,
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
  applyProposalTemplate,
  createProposalFromTemplate,
  getProposalTemplateSectionSummary,
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

const mapProposalRecordToDraft = (record) => {
  const content = record?.content && typeof record.content === "object" ? record.content : {};
  const fallback = createProposalFromTemplate(
    content.template?.key ||
      content.metadata?.templateKey ||
      record?.metadata?.templateKey ||
      PROPOSAL_TEMPLATE_LIBRARY[0].id
  );

  return {
    ...fallback,
    ...content,
    savedId: record.id,
    status: record.status || content.status || "draft",
    proposalType: record.proposalType || content.proposalType || "website",
    title: record.title || content.title || "Untitled proposal",
    clientName: record.clientName || content.clientName || "",
    version: record.version || 1,
    metadata: record.metadata || content.metadata || fallback.metadata,
    organizationId: record.organizationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy || null,
    lastEditedBy: record.lastEditedBy || null,
    hasShareToken: Boolean(record.hasShareToken),
    shareTokenCreatedAt: record.shareTokenCreatedAt || null,
    shareTokenExpiresAt: record.shareTokenExpiresAt || null,
    shareLink: record.shareLink || null,
    branding: {
      ...fallback.branding,
      ...(content.branding || {}),
    },
    personalNotes: {
      ...fallback.personalNotes,
      ...(content.personalNotes || {}),
    },
    blocks: Array.isArray(content.blocks) ? content.blocks : fallback.blocks,
    workflow: createDefaultProposalWorkflow(content.workflow),
  };
};

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

const moveVisibleBlock = (blocks, blockId, direction) => {
  const visibleBlocks = blocks.filter((block) => block.type !== PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE);
  const currentIndex = visibleBlocks.findIndex((block) => block.id === blockId);
  if (currentIndex === -1) return blocks;
  const movedBlocks = moveBlock(visibleBlocks, currentIndex, direction);
  if (movedBlocks === visibleBlocks) return blocks;

  let visibleIndex = 0;
  return blocks.map((block) =>
    block.type === PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE ? block : movedBlocks[visibleIndex++]
  );
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

  const removePricingItem = (index) => {
    onChange({
      pricingItems: (block.pricingItems || []).filter((_, itemIndex) => itemIndex !== index),
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
          <button
            type="button"
            className="button button-ghost proposal-row-remove"
            onClick={() => removePricingItem(index)}
            aria-label={`Remove pricing item ${index + 1}`}
          >
            Remove
          </button>
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

  const removeTimelineItem = (index) => {
    onChange({
      timelineItems: (block.timelineItems || []).filter((_, itemIndex) => itemIndex !== index),
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
          <button
            type="button"
            className="button button-ghost proposal-row-remove"
            onClick={() => removeTimelineItem(index)}
            aria-label={`Remove timeline item ${index + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="button button-ghost" onClick={addTimelineItem}>
        Add phase
      </button>
    </div>
  );
}

function ProposalBlockEditor({ block, index, blockCount, onChange, onMove }) {
  const isVisible = block.required || block.enabled;

  return (
    <section
      className={`proposal-document-block ${isVisible ? "" : "is-disabled"}`}
      data-proposal-block={block.type}
    >
      <div className="proposal-document-block__header">
        <div>
          <span className="proposal-document-block__type">
            {block.required ? "Required" : "Optional"}
          </span>
          <strong>{block.label}</strong>
        </div>
        <div className="proposal-document-block__actions">
          {!block.required ? (
            <label className="proposal-document-toggle">
              <input
                type="checkbox"
                checked={Boolean(block.enabled)}
                onChange={(event) => onChange({ enabled: event.target.checked })}
              />
              <span>{block.enabled ? "Included" : "Add section"}</span>
            </label>
          ) : null}
          {isVisible ? (
            <>
              <button
                type="button"
                className="button button-ghost proposal-document-icon-button"
                onClick={() => onMove(block.id, -1)}
                disabled={index === 0}
                aria-label={`Move ${block.label} up`}
                title="Move up"
              >
                <ArrowUp2 size={16} variant="Bold" />
              </button>
              <button
                type="button"
                className="button button-ghost proposal-document-icon-button"
                onClick={() => onMove(block.id, 1)}
                disabled={index === blockCount - 1}
                aria-label={`Move ${block.label} down`}
                title="Move down"
              >
                <ArrowDown2 size={16} variant="Bold" />
              </button>
            </>
          ) : null}
        </div>
      </div>
      {isVisible ? (
        <StackGroup className="proposal-document-block__fields">
          {block.type === PROPOSAL_BLOCK_TYPES.COVER ? (
            <FormGroup label="Cover label">
              <input
                className="input proposal-document-input"
                value={block.kicker}
                onChange={(event) => onChange({ kicker: event.target.value })}
              />
            </FormGroup>
          ) : null}
          <FormGroup label="Section heading">
            <input
              className="input proposal-document-input proposal-document-input--heading"
              value={block.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </FormGroup>
          <FormGroup label="Body copy">
            <textarea
              className="input proposal-document-input"
              value={block.body}
              onChange={(event) => onChange({ body: event.target.value })}
            />
          </FormGroup>
          {BLOCKS_WITH_ITEMS.has(block.type) ? (
            <FormGroup label="Bullet items">
              <textarea
                className="input proposal-document-input"
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
      ) : (
        <p className="muted proposal-document-block__disabled-copy">
          This reusable section is hidden from the generated proposal.
        </p>
      )}
    </section>
  );
}

function ProposalDocumentEditor({
  proposal,
  onProposalChange,
  onPersonalNotesChange,
  onBlockChange,
  onMoveBlock,
}) {
  const visibleBlocks = proposal.blocks.filter(
    (block) => block.type !== PROPOSAL_BLOCK_TYPES.PERSONAL_NOTE
  );

  return (
    <article
      className={`proposal-document-editor proposal-preview--theme-${proposal.branding.theme}`}
      aria-label="Editable proposal document"
    >
      <header className="proposal-document-editor__masthead">
        <span>{proposal.branding.businessName}</span>
        <span>{getProposalTypeLabel(proposal.proposalType)}</span>
      </header>

      <section className="proposal-document-editor__client">
        <p className="eyebrow">Prepared for</p>
        <input
          className="input proposal-document-input proposal-document-input--client"
          value={proposal.clientName}
          onChange={(event) => onProposalChange({ clientName: event.target.value })}
          placeholder="Client name"
          aria-label="Client name"
        />
        <input
          className="input proposal-document-input proposal-document-input--title"
          value={proposal.title}
          onChange={(event) => onProposalChange({ title: event.target.value })}
          placeholder="Proposal title"
          aria-label="Proposal title"
        />
      </section>

      <section className="proposal-document-note">
        <div className="proposal-document-block__header">
          <div>
            <span className="proposal-document-block__type">Reusable</span>
            <strong>Personal note</strong>
          </div>
        </div>
        <StackGroup className="proposal-document-block__fields">
          <FormGroup label="Introduction note">
            <textarea
              className="input proposal-document-input"
              value={proposal.personalNotes.introduction}
              onChange={(event) => onPersonalNotesChange({ introduction: event.target.value })}
              placeholder="Introduce the proposal in your own voice."
            />
          </FormGroup>
          <FormGroup label="Founder or consultant message">
            <textarea
              className="input proposal-document-input"
              value={proposal.personalNotes.founderMessage}
              onChange={(event) => onPersonalNotesChange({ founderMessage: event.target.value })}
              placeholder="Optional personal message."
            />
          </FormGroup>
          <FormGroup label="Closing note">
            <textarea
              className="input proposal-document-input"
              value={proposal.personalNotes.closing}
              onChange={(event) => onPersonalNotesChange({ closing: event.target.value })}
              placeholder="Optional closing note."
            />
          </FormGroup>
        </StackGroup>
      </section>

      <div className="proposal-document-editor__sections">
        {visibleBlocks.map((block, index) => (
          <ProposalBlockEditor
            key={block.id}
            block={block}
            index={index}
            blockCount={visibleBlocks.length}
            onChange={(patch) => onBlockChange(block.id, patch)}
            onMove={onMoveBlock}
          />
        ))}
      </div>

      <footer className="proposal-document-editor__footer">
        <span>Prepared by {proposal.preparedBy || "Your name"}</span>
        <span>{proposal.preparedDate}</span>
      </footer>
    </article>
  );
}

function ProposalSetupPanel({
  proposal,
  selectedTemplateId,
  enabledBlockCount,
  isSaving,
  isPreparingShareLink,
  hasUnsavedChanges,
  onApplyTemplate,
  onProposalChange,
  onBrandingChange,
  onSave,
  onPrepareShareLink,
  onCopyShareLink,
  onPrint,
  onStartNewDraft,
}) {
  return (
    <ErpPanel className="proposal-setup-panel">
      <ErpPanelHeader
        title="Proposal setup"
        description="Adjust the document, save versions, and prepare a secure client link."
        actions={(
          <>
            <button
              type="button"
              className="button"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : proposal.savedId ? "Save version" : "Save draft"}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={onStartNewDraft}
            >
              New draft
            </button>
          </>
        )}
      />
      <StackGroup>
        <div className="proposal-setup-panel__save-state" role="status">
          <span className={hasUnsavedChanges ? "status-pill is-warning" : "status-pill is-success"}>
            {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
          </span>
          <span className="muted">{enabledBlockCount} generated sections</span>
        </div>
        <SelectField
            fieldClassName="form-field"
            label="Template"
            value={selectedTemplateId}
            onChange={(event) => onApplyTemplate(event.target.value)}
          >
            {PROPOSAL_TEMPLATE_LIBRARY.map((template) => (
              <option value={template.id} key={template.id}>{template.name}</option>
            ))}
        </SelectField>
        <p className="muted proposal-template-preservation-note">
          Switching templates keeps client details and any compatible sections you have edited.
        </p>
        <div className="proposal-editor-grid">
          <FormGroup label="Prepared by">
            <input
              className="input"
              value={proposal.preparedBy}
              onChange={(event) => onProposalChange({ preparedBy: event.target.value })}
            />
          </FormGroup>
          <DateField
              fieldClassName="form-field"
              label="Prepared date"
              value={proposal.preparedDate}
              onChange={(event) => onProposalChange({ preparedDate: event.target.value })}
          />
          <SelectField
              fieldClassName="form-field"
              label="Proposal type"
              value={proposal.proposalType}
              onChange={(event) => onProposalChange({ proposalType: event.target.value })}
            >
              {PROPOSAL_TYPE_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
          </SelectField>
          <SelectField
              fieldClassName="form-field"
              label="Document theme"
              value={proposal.branding.theme}
              onChange={(event) => onBrandingChange({ theme: event.target.value })}
            >
              {PROPOSAL_THEME_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
          </SelectField>
        </div>
        <FormGroup label="Proposal brand label">
          <input
            className="input"
            value={proposal.branding.businessName}
            onChange={(event) => onBrandingChange({ businessName: event.target.value })}
          />
        </FormGroup>
        <div className="proposal-setup-actions">
          <button type="button" className="button button-ghost" onClick={onPrint}>
            Export PDF
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={onPrepareShareLink}
            disabled={
              isPreparingShareLink ||
              isSaving ||
              !proposal.savedId ||
              hasUnsavedChanges ||
              proposal.status === PROPOSAL_STATUSES.ARCHIVED
            }
          >
            {isPreparingShareLink ? "Preparing..." : "Prepare secure link"}
          </button>
        </div>
        <div className="proposal-record-meta" aria-label="Proposal record metadata">
          <span>Template: {proposal.template?.name || proposal.metadata?.templateName || "Custom draft"}</span>
          <span>Updated {formatProposalTimestamp(proposal.updatedAt)}</span>
          <span>Version {proposal.version || 1}</span>
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
            <strong>{proposal.shareLink.active ? "Client view available" : "Client view prepared"}</strong>
            <span>{proposal.shareLink.clientViewPath}</span>
            <small>{proposal.shareLink.note}</small>
            <div className="proposal-share-foundation__actions">
              <button type="button" className="button button-ghost" onClick={onCopyShareLink}>
                Copy link
              </button>
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
          </div>
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
          <SelectField
              fieldClassName="form-field"
              label="Workflow status"
              value={proposal.status || PROPOSAL_STATUSES.DRAFT}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {PROPOSAL_STATUS_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
          </SelectField>
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
  const [notice, setNotice] = useState({
    tone: "info",
    message:
      "Build the proposal directly on the document. Saved drafts stay private until you share a secure client link.",
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
        const draft = mapProposalRecordToDraft(payload.proposal);
        setProposal(draft);
        setSelectedTemplateId(
          draft.template?.key || draft.metadata?.templateKey || PROPOSAL_TEMPLATE_LIBRARY[0].id
        );
        setHasUnsavedChanges(false);
        setNotice({
          tone: "success",
          message: "Saved proposal loaded for editing.",
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

  const applyTemplate = (templateId) => {
    const template = getProposalTemplateById(templateId);
    setSelectedTemplateId(templateId);
    setProposal((current) => applyProposalTemplate(current, templateId));
    setHasUnsavedChanges(true);
    setNotice({
      tone: "info",
      message: `${template.name} applied. Compatible details and your edited sections were kept.`,
    });
  };

  const startNewDraft = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Start a new draft and discard the unsaved changes in this proposal?")
    ) {
      return;
    }

    setProposal(createProposalFromTemplate(selectedTemplateId));
    setHasUnsavedChanges(true);
    setNotice({
      tone: "info",
      message: "New private draft started. Edit the document, then save when it is ready.",
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

  const moveProposalBlock = (blockId, direction) => {
    setProposal((current) => ({
      ...current,
      blocks: moveVisibleBlock(current.blocks, blockId, direction),
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
        const draft = mapProposalRecordToDraft(savedRecord);
        setProposal(draft);
        setSavedProposals((records) => upsertProposalRecord(records, savedRecord));
        setHasUnsavedChanges(false);
        setSelectedTemplateId(
          draft.template?.key || draft.metadata?.templateKey || PROPOSAL_TEMPLATE_LIBRARY[0].id
        );
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
        const draft = mapProposalRecordToDraft(savedRecord);
        setProposal(draft);
        setSelectedTemplateId(
          draft.template?.key || draft.metadata?.templateKey || PROPOSAL_TEMPLATE_LIBRARY[0].id
        );
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

  const copyShareLink = async () => {
    const shareUrl = proposal.shareLink?.clientViewUrl || proposal.shareLink?.clientViewPath;
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice({
        tone: "success",
        message: "Secure client link copied.",
      });
    } catch {
      setNotice({
        tone: "warning",
        message: `Copy was blocked by the browser. Use this secure path: ${shareUrl}`,
      });
    }
  };

  const printProposal = () => {
    window.print();
  };

  return (
    <main className="page proposal-page">
      <section className="proposal-hero" aria-label="Proposal generator overview">
        <div className="proposal-hero__copy">
          <h1>Proposals</h1>
          <p>
            Build polished proposals directly on the document, reuse a focused template, and
            share a secure client review link when the draft is ready.
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
              aria-label={`Apply ${template.name}`}
              onClick={() => applyTemplate(template.id)}
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
                <span>{getProposalTemplateSectionSummary(template)}</span>
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
          {isLoadingProposals ? (
            <AnimatedLoadingState
              compact
              title="Loading saved proposals"
              message="Checking your recent drafts."
            />
          ) : null}
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

      <section className="proposal-builder-section" aria-label="Proposal builder">
        <div className="proposal-section-heading">
          <div>
            <p className="eyebrow">Document builder</p>
            <h2>Edit the proposal</h2>
          </div>
          <div className="proposal-builder-actions">
            <span className={`status-pill ${hasUnsavedChanges ? "is-warning" : "is-success"}`}>
              {hasUnsavedChanges ? "Unsaved changes" : "Saved draft"}
            </span>
            <button
              type="button"
              className="button"
              onClick={saveProposal}
              disabled={isSaving || isLoadingProposal}
            >
              {isSaving ? "Saving..." : proposal.savedId ? "Save version" : "Save draft"}
            </button>
            <button type="button" className="button button-ghost" onClick={printProposal}>
              Export PDF
            </button>
          </div>
        </div>

        {isLoadingProposal ? (
          <AnimatedLoadingState
            page
            title="Loading proposal"
            message="Preparing the editable document."
          />
        ) : (
          <>
            <section className="proposal-editor-layout" aria-label="Editable proposal and controls">
              <section className="proposal-editor-shell" aria-label="Editable proposal document">
                <ProposalDocumentEditor
                  proposal={proposal}
                  onProposalChange={updateProposal}
                  onPersonalNotesChange={updatePersonalNotes}
                  onBlockChange={updateBlock}
                  onMoveBlock={moveProposalBlock}
                />
              </section>

              <aside className="proposal-control-rail" aria-label="Proposal controls">
                <ProposalSetupPanel
                  proposal={proposal}
                  selectedTemplateId={selectedTemplateId}
                  enabledBlockCount={enabledBlockCount}
                  isSaving={isSaving}
                  isPreparingShareLink={isPreparingShareLink}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onApplyTemplate={applyTemplate}
                  onProposalChange={updateProposal}
                  onBrandingChange={updateBranding}
                  onSave={saveProposal}
                  onPrepareShareLink={prepareShareLink}
                  onCopyShareLink={copyShareLink}
                  onPrint={printProposal}
                  onStartNewDraft={startNewDraft}
                />
                <ProposalWorkflowPanel
                  proposal={proposal}
                  onStatusChange={updateProposalStatus}
                  onWorkflowChange={updateWorkflow}
                  onReadinessChange={updateWorkflowReadiness}
                />
              </aside>
            </section>
            <div className="proposal-print-preview" aria-hidden="true">
              <ProposalPreview proposal={proposal} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default Proposals;
