import React, { useMemo } from "react";
import {
  PROPOSAL_BLOCK_TYPES,
  PROPOSAL_TYPE_OPTIONS,
} from "./proposalSchema";
import {
  getProposalExportBlocks,
  getProposalExportMetadata,
  getProposalExportSectionConfig,
} from "./proposalExportConfig";

const getProposalTypeLabel = (value) =>
  PROPOSAL_TYPE_OPTIONS.find((option) => option.value === value)?.label || "Proposal";

function ProposalExportSection({ block, children, className = "proposal-preview-section" }) {
  const sectionConfig = getProposalExportSectionConfig(block.type);

  return (
    <section
      className={`${className} proposal-export-section proposal-export-section--${sectionConfig.role}`}
      data-export-section={block.type}
      data-export-role={sectionConfig.role}
      data-export-page-mode={sectionConfig.pageMode}
      data-export-break-before={sectionConfig.printBreakBefore ? "true" : "false"}
      data-export-break-inside={sectionConfig.printBreakInside}
    >
      {children}
    </section>
  );
}

function ProposalPreviewBlock({ block }) {
  if (block.type === PROPOSAL_BLOCK_TYPES.COVER) {
    return (
      <ProposalExportSection block={block} className="proposal-preview-cover">
        {block.kicker ? <p className="eyebrow">{block.kicker}</p> : null}
        <h2>{block.title}</h2>
        <p>{block.body}</p>
      </ProposalExportSection>
    );
  }

  if (block.type === PROPOSAL_BLOCK_TYPES.PRICING) {
    return (
      <ProposalExportSection block={block}>
        <h3>{block.title}</h3>
        {block.body ? <p>{block.body}</p> : null}
        <div className="proposal-pricing-table">
          {(block.pricingItems || []).map((item, index) => (
            <div className="proposal-pricing-table__row" key={`${block.id}-pricing-preview-${index}`}>
              <span>{item.label}</span>
              <strong>{item.amount}</strong>
              {item.note ? <small>{item.note}</small> : null}
            </div>
          ))}
        </div>
      </ProposalExportSection>
    );
  }

  if (block.type === PROPOSAL_BLOCK_TYPES.TIMELINE) {
    return (
      <ProposalExportSection block={block}>
        <h3>{block.title}</h3>
        {block.body ? <p>{block.body}</p> : null}
        <div className="proposal-phase-list">
          {(block.timelineItems || []).map((item, index) => (
            <article className="proposal-phase" key={`${block.id}-timeline-preview-${index}`}>
              <span>{item.duration}</span>
              <strong>{item.label}</strong>
              {item.note ? <p>{item.note}</p> : null}
            </article>
          ))}
        </div>
      </ProposalExportSection>
    );
  }

  return (
    <ProposalExportSection block={block}>
      <h3>{block.title}</h3>
      {block.body ? <p>{block.body}</p> : null}
      {block.items?.length ? (
        <ul>
          {block.items.map((item, index) => (
            <li key={`${block.id}-item-${index}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </ProposalExportSection>
  );
}

function ProposalPersonalNote({ proposal }) {
  const introduction = proposal.personalNotes.introduction?.trim();
  const founderMessage = proposal.personalNotes.founderMessage?.trim();
  const closing = proposal.personalNotes.closing?.trim();
  const hasNoteContent = Boolean(introduction || founderMessage || closing);

  return (
    <section
      className="proposal-preview-note proposal-export-section proposal-export-section--note"
      data-export-section="personal_note"
      data-export-role="note"
      data-export-page-mode="feature"
      data-export-break-before="false"
      data-export-break-inside="avoid"
    >
      <h2>Personal note</h2>
      {introduction ? <p>{introduction}</p> : null}
      {founderMessage ? <blockquote>{founderMessage}</blockquote> : null}
      {closing ? <p>{closing}</p> : null}
      {!hasNoteContent ? <p>Add a short personal note when the proposal voice is ready.</p> : null}
    </section>
  );
}

function ProposalPreview({ proposal }) {
  const enabledBlocks = getProposalExportBlocks(proposal);
  const exportMetadata = useMemo(() => getProposalExportMetadata(proposal), [proposal]);

  return (
    <article
      className={`proposal-preview proposal-preview--theme-${proposal.branding.theme}`}
      aria-label={`${proposal.title} preview`}
      data-export-target={exportMetadata.target}
      data-export-template-version="foundation"
      data-export-section-count={exportMetadata.sections.length}
    >
      <header className="proposal-preview__masthead" data-export-region="masthead">
        <span>{proposal.branding.businessName}</span>
        <span>{getProposalTypeLabel(proposal.proposalType)}</span>
      </header>
      <div className="proposal-preview__client" data-export-region="client-summary">
        <p className="eyebrow">Prepared for</p>
        <h1>{proposal.clientName || "Client name"}</h1>
        <p>{proposal.title}</p>
      </div>
      <ProposalPersonalNote proposal={proposal} />
      {enabledBlocks.map((block) => (
        <ProposalPreviewBlock key={block.id} block={block} />
      ))}
      <footer className="proposal-preview__footer" data-export-region="footer">
        <span>Prepared by {proposal.preparedBy}</span>
        <span>{proposal.preparedDate}</span>
      </footer>
    </article>
  );
}

export default ProposalPreview;
