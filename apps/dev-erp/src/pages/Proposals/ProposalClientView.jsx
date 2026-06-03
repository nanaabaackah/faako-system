import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import { getApiErrorMessage, readJsonResponse } from "../../utils/http";
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_OPTIONS,
  PROPOSAL_TYPE_OPTIONS,
  createProposalDraft,
} from "./proposalSchema";
import ProposalPreview from "./ProposalPreview";
import "./Proposals.css";

const CLIENT_VIEW_STATE_COPY = {
  LOADING: {
    title: "Loading proposal",
    message: "Opening the secure proposal view...",
  },
  INVALID_LINK: {
    title: "Proposal link unavailable",
    message: "This proposal link is invalid or has been removed.",
  },
  UNAVAILABLE: {
    title: "Proposal unavailable",
    message: "This proposal is no longer available through this link.",
  },
  EXPIRED: {
    title: "Proposal link expired",
    message: "This proposal link has expired. Please ask for a refreshed link.",
  },
  NOT_SHARED: {
    title: "Proposal not shared yet",
    message: "This proposal is still private. Please ask the team to share it when it is ready.",
  },
  ERROR: {
    title: "Unable to load proposal",
    message: "We could not load this proposal. Please try again or ask for a refreshed link.",
  },
};

const getProposalTypeLabel = (value) =>
  PROPOSAL_TYPE_OPTIONS.find((option) => option.value === value)?.label || "Proposal";

const getProposalStatusLabel = (value) =>
  PROPOSAL_STATUS_OPTIONS.find((option) => option.value === value)?.label || "Shared";

const publicFetch = async (path, options = {}) => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    const error = new Error(getApiErrorMessage(payload, "Unable to load proposal."));
    error.status = response.status;
    error.code = payload && typeof payload === "object" ? payload.code : null;
    error.expired = Boolean(payload && typeof payload === "object" && payload.expired);
    throw error;
  }

  return payload;
};

const normalizeClientProposalContent = (record) => {
  const fallback = createProposalDraft({
    title: record?.title || "Proposal",
    clientName: record?.clientName || "",
    proposalType: record?.proposalType || "website",
  });
  const content = record?.content && typeof record.content === "object" ? record.content : {};

  return {
    ...fallback,
    ...content,
    title: record?.title || content.title || fallback.title,
    clientName: record?.clientName || content.clientName || fallback.clientName,
    proposalType: record?.proposalType || content.proposalType || fallback.proposalType,
    status: record?.status || content.status || fallback.status,
    branding: {
      ...fallback.branding,
      ...(content.branding || {}),
    },
    personalNotes: {
      ...fallback.personalNotes,
      ...(content.personalNotes || {}),
    },
    blocks: Array.isArray(content.blocks) ? content.blocks : fallback.blocks,
  };
};

function ProposalClientState({ state, message }) {
  const copy = CLIENT_VIEW_STATE_COPY[state] || CLIENT_VIEW_STATE_COPY.ERROR;

  return (
    <main className="proposal-client-main">
      <section className="proposal-client-state" role="status" aria-live="polite">
        <div className="proposal-client-state__card">
          <p className="eyebrow">Secure proposal</p>
          <h1>{copy.title}</h1>
          <p>{message || copy.message}</p>
        </div>
      </section>
    </main>
  );
}

function ProposalClientResponseSummary({ response, status }) {
  if (!response && !status) return null;
  const isApproved = status === PROPOSAL_STATUSES.APPROVED || response?.action === "approved";
  const isChangesRequested =
    status === PROPOSAL_STATUSES.CHANGES_REQUESTED || response?.action === "changes_requested";

  if (!isApproved && !isChangesRequested) return null;

  return (
    <div className={`proposal-client-response-summary is-${isApproved ? "approved" : "changes-requested"}`}>
      <p className="eyebrow">{isApproved ? "Approved" : "Changes requested"}</p>
      <h3>
        {isApproved
          ? "Thank you. This proposal has been approved."
          : "Thank you. Your requested changes were sent."}
      </h3>
      {response?.clientName || response?.clientContact ? (
        <p>
          {response.clientName || "Client"}
          {response.clientContact ? ` · ${response.clientContact}` : ""}
        </p>
      ) : null}
      {response?.message ? <p>{response.message}</p> : null}
    </div>
  );
}

function ProposalClientView() {
  const { token } = useParams();
  const [viewState, setViewState] = useState("loading");
  const [proposalRecord, setProposalRecord] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [clientActionMode, setClientActionMode] = useState(null);
  const [clientResponseForm, setClientResponseForm] = useState({
    clientName: "",
    clientContact: "",
    message: "",
  });
  const [clientActionResult, setClientActionResult] = useState(null);
  const [clientActionError, setClientActionError] = useState("");
  const [isSubmittingClientAction, setIsSubmittingClientAction] = useState(false);

  useEffect(() => {
    let isCanceled = false;

    if (!token) {
      setViewState("INVALID_LINK");
      setErrorMessage("");
      return undefined;
    }

    setViewState("loading");
    setErrorMessage("");

    publicFetch(`/api/proposals/view/${encodeURIComponent(token)}`)
      .then((payload) => {
        if (isCanceled) return;
        setProposalRecord(payload?.proposal || null);
        setViewState(payload?.proposal ? "ready" : "UNAVAILABLE");
      })
      .catch((error) => {
        if (isCanceled) return;
        setProposalRecord(null);
        setErrorMessage(error?.message || "");
        setViewState(error?.expired ? "EXPIRED" : error?.code || "ERROR");
      });

    return () => {
      isCanceled = true;
    };
  }, [token]);

  const previewProposal = useMemo(
    () => (proposalRecord ? normalizeClientProposalContent(proposalRecord) : null),
    [proposalRecord]
  );

  const handleDownloadPdf = () => {
    window.print();
  };

  const updateClientResponseForm = (patch) => {
    setClientResponseForm((current) => ({ ...current, ...patch }));
    setClientActionError("");
  };

  const openClientAction = (mode) => {
    setClientActionMode(mode);
    setClientActionError("");
  };

  const closeClientAction = () => {
    if (isSubmittingClientAction) return;
    setClientActionMode(null);
    setClientActionError("");
  };

  const submitClientAction = async (action) => {
    if (!token || isSubmittingClientAction) return;
    if (action === "request-changes" && !clientResponseForm.message.trim()) {
      setClientActionError("Please describe the changes you would like to request.");
      return;
    }

    setIsSubmittingClientAction(true);
    setClientActionError("");

    try {
      const payload = await publicFetch(
        `/api/proposals/view/${encodeURIComponent(token)}/${action}`,
        {
          method: "POST",
          body: {
            clientName: clientResponseForm.clientName,
            clientContact: clientResponseForm.clientContact,
            message: clientResponseForm.message,
          },
        }
      );
      setProposalRecord(payload?.proposal || null);
      setClientActionResult({
        action,
        response: payload?.response || payload?.proposal?.clientResponse || null,
      });
      setClientActionMode(null);
    } catch (error) {
      setClientActionError(error?.message || "Unable to send your response. Please try again.");
    } finally {
      setIsSubmittingClientAction(false);
    }
  };

  const pageTitle = proposalRecord?.title ? `${proposalRecord.title} | Proposal` : "Proposal";
  const clientResponse = clientActionResult?.response || proposalRecord?.clientResponse || null;
  const canRespond = proposalRecord?.status === PROPOSAL_STATUSES.SHARED && !clientResponse;

  return (
    <div className="proposal-client-page">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="googlebot" content="noindex,nofollow,noarchive" />
      </Helmet>

      {viewState === "loading" ? (
        <ProposalClientState state="LOADING" />
      ) : viewState !== "ready" || !previewProposal ? (
        <ProposalClientState state={viewState} message={errorMessage} />
      ) : (
        <>
          <header className="proposal-client-header">
            <div className="proposal-client-header__copy">
              <p className="eyebrow">Secure proposal</p>
              <h1>{proposalRecord.title}</h1>
              <div className="proposal-client-meta" aria-label="Proposal metadata">
                <span>{getProposalTypeLabel(proposalRecord.proposalType)}</span>
                <span>{getProposalStatusLabel(proposalRecord.status)}</span>
              </div>
            </div>
            <div className="proposal-client-actions">
              <button className="button" type="button" onClick={handleDownloadPdf}>
                Download PDF
              </button>
            </div>
          </header>

          <main className="proposal-client-main">
            <ProposalPreview proposal={previewProposal} />
            <section className="proposal-client-approval-panel" aria-labelledby="proposal-client-approval-title">
              <p className="eyebrow">Approval</p>
              <h2 id="proposal-client-approval-title">Review and approval</h2>
              <ProposalClientResponseSummary response={clientResponse} status={proposalRecord.status} />

              {canRespond ? (
                <>
                  <p>
                    You can approve this proposal or request changes. Approval lets the team create
                    an editable invoice draft before anything is sent.
                  </p>
                  <div className="proposal-client-approval-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => openClientAction("approve")}
                    >
                      Approve proposal
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => openClientAction("request-changes")}
                    >
                      Request changes
                    </button>
                  </div>
                </>
              ) : !clientResponse ? (
                <p>
                  This proposal is no longer accepting a new client response through this link.
                </p>
              ) : null}

              {clientActionMode ? (
                <div
                  className="proposal-client-response-form"
                  role="dialog"
                  aria-labelledby="proposal-client-response-title"
                >
                  <h3 id="proposal-client-response-title">
                    {clientActionMode === "approve" ? "Approve proposal" : "Request changes"}
                  </h3>
                  <label>
                    <span>Your name</span>
                    <input
                      className="input"
                      value={clientResponseForm.clientName}
                      onChange={(event) => updateClientResponseForm({ clientName: event.target.value })}
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    <span>Email or phone</span>
                    <input
                      className="input"
                      value={clientResponseForm.clientContact}
                      onChange={(event) => updateClientResponseForm({ clientContact: event.target.value })}
                      placeholder="Optional"
                    />
                  </label>
                  {clientActionMode === "request-changes" ? (
                    <label>
                      <span>Requested changes</span>
                      <textarea
                        className="input"
                        value={clientResponseForm.message}
                        onChange={(event) => updateClientResponseForm({ message: event.target.value })}
                        placeholder="Tell us what you would like adjusted."
                        required
                      />
                    </label>
                  ) : (
                    <p>
                      Confirm that you approve this proposal. Invoice conversion, Paystack
                      payment links, email notifications, and digital signatures will remain off
                      until a later phase.
                    </p>
                  )}
                  {clientActionError ? (
                    <div className="notice proposal-notice is-error" role="alert">
                      {clientActionError}
                    </div>
                  ) : null}
                  <div className="proposal-client-approval-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        submitClientAction(
                          clientActionMode === "approve" ? "approve" : "request-changes"
                        )
                      }
                      disabled={isSubmittingClientAction}
                    >
                      {isSubmittingClientAction
                        ? "Sending..."
                        : clientActionMode === "approve"
                          ? "Confirm approval"
                          : "Send changes"}
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={closeClientAction}
                      disabled={isSubmittingClientAction}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </main>
        </>
      )}
    </div>
  );
}

export default ProposalClientView;
