import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  SYNC_STATES,
  SyncReviewPanel,
  createIndexedDbQueueStorage,
  getQueueActionLabel,
  getQueueItemLastError,
  markQueuedActionResolved,
  useQueuedActionCancel,
  useQueuedActionRetry,
  useSyncQueueSummary,
} from "@faako/offline-sync";
import {
  ERPActionBar,
  ERPActivityFeed,
  AnimatedLoadingState,
  ERPFieldGroup,
  ERPNotice,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ErpPanel,
  ErpPanelGrid,
  ErpPanelHeader,
  StackGroup,
} from "@faako/ui";
import { apiGet, apiPost, ApiError } from "../../api/client";
import { readStoredSessionUser } from "../../utils/authSession";
import { formatDateTime } from "../../utils/formatters";

const DEFAULT_PREFS = {
  email: false,
  slack: false,
  sms: false,
  notifyOffline: true,
  notifyDegraded: true,
  emailRecipients: "",
  slackChannel: "",
  smsRecipients: "",
};

const Settings = () => {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [status, setStatus] = useState({ tone: "", message: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [hasSession, setHasSession] = useState(true);
  const [isSmsAvailable, setIsSmsAvailable] = useState(false);
  const [storageMode, setStorageMode] = useState("memory");
  const [lastEmailSentAt, setLastEmailSentAt] = useState(null);
  const storedUser = useMemo(() => readStoredSessionUser(), []);
  const currentActorId = storedUser?.id || storedUser?.userId || "";
  const currentOrganizationId = storedUser?.organizationId || "";
  const syncReviewStorage = useMemo(() => createIndexedDbQueueStorage(), []);
  const syncReview = useSyncQueueSummary({
    storage: syncReviewStorage,
    sourceApp: "dev-erp",
    organizationId: currentOrganizationId,
    actorId: currentActorId,
    enabled: Boolean(currentOrganizationId && currentActorId),
  });
  const refreshSyncReview = syncReview.refresh;
  const [syncResolvingId, setSyncResolvingId] = useState("");
  const {
    retry: retryQueuedAction,
    retryingId: retryingQueuedActionId,
    error: retryQueuedActionError,
  } = useQueuedActionRetry({
    storage: syncReviewStorage,
    onAfterChange: refreshSyncReview,
  });
  const {
    cancel: cancelQueuedAction,
    cancellingId: cancellingQueuedActionId,
    error: cancelQueuedActionError,
  } = useQueuedActionCancel({
    storage: syncReviewStorage,
    onAfterChange: refreshSyncReview,
  });
  const resolveQueuedAction = useCallback(async (item) => {
    if (!item?.id) return;
    setSyncResolvingId(item.id);
    try {
      await markQueuedActionResolved(syncReviewStorage, item, {
        resolution: "Marked resolved from Dev ERP offline sync review.",
      });
      await refreshSyncReview();
    } finally {
      setSyncResolvingId("");
    }
  }, [refreshSyncReview, syncReviewStorage]);

  const syncActivityItems = useMemo(() => {
    const all = [...(syncReview.items || [])];
    all.sort((a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
    return all.slice(0, 5).map((item) => {
      const status = item.status || "";
      const tone =
        status === SYNC_STATES.SYNCED ? "success" :
        status === SYNC_STATES.FAILED || status === SYNC_STATES.NEEDS_REVIEW ? "error" :
        status === SYNC_STATES.CONFLICT ? "warning" :
        status === SYNC_STATES.CANCELLED || status === SYNC_STATES.RESOLVED ? "neutral" :
        "info";
      const lastErr = getQueueItemLastError(item) || "";
      return {
        id: item.id,
        actionLabel: getQueueActionLabel(item),
        statusLabel: status ? status.replace(/_/g, " ") : "",
        tone,
        detail: lastErr ? lastErr.slice(0, 120) : undefined,
        timestamp: item.updatedAt || item.createdAt,
      };
    });
  }, [syncReview.items]);

  useEffect(() => {
    setHasSession(true);
    const loadPrefs = async () => {
      try {
        const payload = await apiGet("/api/alerts/preferences", {
          fallbackMessage: "Unable to load alert preferences",
        });
        setPrefs((prev) => ({
          ...prev,
          email: Boolean(payload.emailEnabled),
          sms: Boolean(payload.smsEnabled),
          notifyOffline: payload.notifyOffline ?? prev.notifyOffline,
          notifyDegraded: payload.notifyDegraded ?? prev.notifyDegraded,
          emailRecipients: payload.emailRecipients ?? prev.emailRecipients,
          smsRecipients: payload.smsRecipients ?? prev.smsRecipients,
        }));
        setIsSmsAvailable(Boolean(payload.smsAvailable));
        setStorageMode(payload.storageMode === "database" ? "database" : "memory");
        setLastEmailSentAt(payload.lastEmailSentAt ?? null);
        setIsLoaded(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setHasSession(false);
          setStatus({ tone: "error", message: "Sign in again to manage alert settings." });
        } else {
          setStatus({ tone: "error", message: err.message });
        }
      } finally {
        setIsLoadingPrefs(false);
      }
    };
    loadPrefs();
  }, []);

  const togglePref = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updatePref = (key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus({ tone: "", message: "" });
    try {
      const payload = await apiPost(
        "/api/alerts/preferences",
        {
          emailEnabled: prefs.email,
          smsEnabled: prefs.sms,
          notifyOffline: prefs.notifyOffline,
          notifyDegraded: prefs.notifyDegraded,
          emailRecipients: prefs.emailRecipients,
          smsRecipients: prefs.smsRecipients,
        },
        {
          fallbackMessage: "Unable to save alert preferences",
        }
      );
      setPrefs((prev) => ({
        ...prev,
        email: Boolean(payload.emailEnabled),
        sms: Boolean(payload.smsEnabled),
        notifyOffline: payload.notifyOffline ?? prev.notifyOffline,
        notifyDegraded: payload.notifyDegraded ?? prev.notifyDegraded,
        emailRecipients: payload.emailRecipients ?? prev.emailRecipients,
        smsRecipients: payload.smsRecipients ?? prev.smsRecipients,
      }));
      setIsSmsAvailable(Boolean(payload.smsAvailable));
      setStorageMode(payload.storageMode === "database" ? "database" : "memory");
      setLastEmailSentAt(payload.lastEmailSentAt ?? lastEmailSentAt);
      setStatus({ tone: "success", message: "Alert preferences saved." });
      setIsLoaded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setHasSession(false);
        setStatus({ tone: "error", message: "Sign in again to manage alert settings." });
      } else {
        setStatus({ tone: "error", message: err.message });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setStatus({ tone: "", message: "" });
    try {
      const emailRecipients = prefs.emailRecipients.trim();
      const payload = await apiPost("/api/alerts/test-email", emailRecipients ? { emailRecipients } : {}, {
        fallbackMessage: "Unable to send test email",
      });
      setStatus({ tone: "success", message: "Test email sent." });
      setLastEmailSentAt(payload?.sentAt ?? new Date().toISOString());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setHasSession(false);
        setStatus({ tone: "error", message: "Sign in again to manage alert settings." });
      } else {
        setStatus({ tone: "error", message: err.message });
      }
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
          <p className="muted">Control the backend email alert settings from one place.</p>
        </div>
      </header>

      {status.message ? (
        <div className={`notice ${status.tone ? `is-${status.tone}` : ""}`.trim()}>
          {status.message}
        </div>
      ) : null}

      {isLoadingPrefs ? (
        <AnimatedLoadingState compact className="panel" title="Loading settings" />
      ) : null}

      {!isLoadingPrefs ? (
        <>
          <ErpPanelGrid>
            <ErpPanel>
              <ErpPanelHeader
                title="Alert subscriptions"
                description="Choose how you want to be notified."
              />
              <StackGroup>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={prefs.email}
                    onChange={() => togglePref("email")}
                    disabled={isLoadingPrefs || !hasSession}
                  />
                  <span>Email alerts</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={prefs.slack}
                    onChange={() => togglePref("slack")}
                    disabled
                  />
                  <span>Slack alerts (coming soon)</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={prefs.sms}
                    onChange={() => togglePref("sms")}
                    disabled={!isSmsAvailable || isLoadingPrefs || !hasSession}
                  />
                  <span>{isSmsAvailable ? "SMS alerts" : "SMS alerts (disabled for now)"}</span>
                </label>
                <ERPFieldGroup className="form-field" label="Email recipients">
                  <input
                    className="input"
                    type="text"
                    placeholder="ops@company.com"
                    value={prefs.emailRecipients}
                    onChange={(event) => updatePref("emailRecipients", event.target.value)}
                    disabled={isLoadingPrefs || !hasSession}
                  />
                </ERPFieldGroup>
                <ERPFieldGroup className="form-field" label="Slack channel">
                  <input
                    className="input"
                    type="text"
                    placeholder="#ops-alerts"
                    value={prefs.slackChannel}
                    onChange={(event) => updatePref("slackChannel", event.target.value)}
                    disabled
                  />
                </ERPFieldGroup>
                <ERPFieldGroup className="form-field" label="SMS recipients">
                  <input
                    className="input"
                    type="text"
                    placeholder="+15550100, +233241234567"
                    value={prefs.smsRecipients}
                    onChange={(event) => updatePref("smsRecipients", event.target.value)}
                    disabled={!isSmsAvailable || isLoadingPrefs || !hasSession}
                  />
                </ERPFieldGroup>
                <ERPActionBar className="header-actions" align="start">
                  <ERPPrimaryAction
                    className="button button-primary"
                    onClick={handleSave}
                    loading={isSaving}
                    disabled={isLoadingPrefs || !hasSession}
                    loadingLabel="Saving..."
                  >
                    Save preferences
                  </ERPPrimaryAction>
                  <ERPSecondaryAction
                    className="button button-ghost"
                    onClick={handleTestEmail}
                    loading={isTestingEmail}
                    loadingLabel="Sending..."
                    disabled={
                      !prefs.email || !isLoaded || isLoadingPrefs || !hasSession
                    }
                  >
                    Send test email
                  </ERPSecondaryAction>
                </ERPActionBar>
                {!isSmsAvailable ? (
                  <ERPNotice
                    tone="info"
                    message="SMS is disabled for now. Email alerts are the active channel."
                    compact
                  />
                ) : null}
                <p className="muted">
                  Last email sent{" "}
                  {lastEmailSentAt ? formatDateTime(lastEmailSentAt) : "not yet available"}.
                </p>
              </StackGroup>
            </ErpPanel>

            <ErpPanel>
              <ErpPanelHeader
                title="Alert triggers"
                description="Pick which conditions should raise alerts."
              />
              <StackGroup>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={prefs.notifyOffline}
                    onChange={() => togglePref("notifyOffline")}
                    disabled={isLoadingPrefs || !hasSession}
                  />
                  <span>Notify when a service is offline</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={prefs.notifyDegraded}
                    onChange={() => togglePref("notifyDegraded")}
                    disabled={isLoadingPrefs || !hasSession}
                  />
                  <span>Notify when a service is degraded</span>
                </label>
                <ERPNotice
                  tone={storageMode === "database" ? "success" : "warning"}
                  message={
                    storageMode === "database"
                      ? "Saved preferences are persisted in backend storage and survive restarts."
                      : "Saved preferences are using the in-memory fallback. Apply the alert settings migration to persist them across restarts."
                  }
                  compact
                />
              </StackGroup>
            </ErpPanel>
          </ErpPanelGrid>

          <StackGroup>
            <SyncReviewPanel
              title="Offline sync review"
              description="Review local Dev ERP rent payment queue items before retrying or closing them."
              items={syncReview.items}
              summary={syncReview}
              loading={syncReview.loading}
              error={syncReview.error || retryQueuedActionError || cancelQueuedActionError}
              onRefresh={syncReview.refresh}
              onRetry={retryQueuedAction}
              onCancel={cancelQueuedAction}
              onResolve={resolveQueuedAction}
              retryingId={retryingQueuedActionId}
              cancellingId={cancellingQueuedActionId}
              resolvingId={syncResolvingId}
            />
            {syncActivityItems.length > 0 || syncReview.loading ? (
              <ERPActivityFeed
                title="Recent sync activity"
                description="Local rent payment queue events — synced, failed, and pending items."
                items={syncActivityItems}
                loading={syncReview.loading}
                emptyMessage="No sync activity yet."
                compact
              />
            ) : null}
          </StackGroup>
        </>
      ) : null}
    </section>
  );
};

export default Settings;
