import Button from "./components/ActionButton.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import {
  InlineNotice,
  PageHeader,
  PageShell,
  UiSystemProvider,
  AnimatedLoadingState,
  ERPConfirmDialog,
  AppUpdateNotice,
} from "@faako/ui";
import "@faako/ui/twe-feedback.css";
import appSystem from "../appSystem.js";
import WebsiteContent from "./components/WebsiteContent.jsx";
import MediaLibrary from "./components/MediaLibrary.jsx";
import EmailTemplates from "./components/EmailTemplates.jsx";
import IntakeFormEditor from "./components/IntakeFormEditor.jsx";
import SystemAdministration from "./components/SystemAdministration.jsx";
import StaffAccess from "./components/StaffAccess.jsx";
import Enquiries from "./components/Enquiries.jsx";
import { createSessionLoader, checkCurrentSession } from "./lib/session.js";
import Dashboard from "./components/Dashboard.jsx";
import PortalNavigation from './components/PortalNavigation.jsx';
import ActivityView from './components/ActivityView.jsx';
import TutorialWorkspace from "./components/TutorialWorkspace.jsx";
import Activation from "./components/Activation.jsx";
import AccountSettings from "./components/AccountSettings.jsx";
import Invitations from "./components/Invitations.jsx";

// Staff authentication is same-origin in both Vite development and hosted mode.
// Never embed an API origin that bypasses the Access-aware portal server.
const baseUrl = "";
const baseApi = createBrowserApiClient({ baseUrl, credentials: "include" });
const loadSession = createSessionLoader(baseApi);

function StaffWorkspace() {
  const [pendingWrites, setPendingWrites] = useState(0);
  const [editorBusy, setEditorBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const sessionGuard = useRef("active");
  const checkSessionRef = useRef(null);
  const [sessionStatus, setSessionStatus] = useState("active");
  const updateSessionStatus = useCallback(status => {
    // A different identity or CSRF token must never gain access to retained edits.
    if (sessionGuard.current === "changed" && status !== "reset") return;
    const next = status === "reset" ? "active" : status;
    sessionGuard.current = next;
    setSessionStatus(next);
  }, []);
  // Module-specific notices already show precise success and error outcomes.
  const api = useMemo(() => ({
    ...baseApi,
    get: async (...args) => {
      try { return await baseApi.get(...args); }
      catch (error) {
        if (String(args[0]).startsWith("/api/agent/") && error.status === 401) updateSessionStatus("expired");
        throw error;
      }
    },
    post: async (...args) => {
      if (String(args[0]).startsWith("/api/agent/") && sessionGuard.current !== "active") throw new Error("Check your session before saving. Your edits are retained.");
      const options = { ...args[1] };
      delete options.silent;
      setPendingWrites(count => count + 1);
      try { return await baseApi.post(args[0], options); }
      catch (error) {
        if (error.status === 401 && String(args[0]).startsWith("/api/agent/")) updateSessionStatus("expired");
        throw error;
      }
      finally { setPendingWrites(count => count - 1); }
    },
  }), [updateSessionStatus]);
  const [session, setSession] = useState(null);
  const [activation, setActivation] = useState(null);
  const [section, setSection] = useState("overview");
  const [dirty, setDirty] = useState(false);
  const [remember, setRemember] = useState(false);
  const [accountFlow, setAccountFlow] = useState("login");
  const [accountLinks, setAccountLinks] = useState({});
  const [pendingExit, setPendingExit] = useState(null);
  const [state, setState] = useState({
    loading: true,
    configured: false,
    error: "",
  });
  const navigate = (next) => {
    if (!dirty) {
      setDirty(false);
      setSection(next);
      return true;
    }
    setPendingExit({ kind: "navigate", next });
    return false;
  };
  const load = useCallback(async () => {
    let configured = false;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const status = await api.get("/api/auth/status", {
        responseMode: "data",
      });
      if (typeof status?.configured !== "boolean")
        throw new Error("The sign-in service returned an incomplete response.");
      configured = status.configured;
      // Only accept HTTPS provider links; never render executable URL schemes.
      const safeLink = (value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password
            ? url.href
            : null;
        } catch {
          return null;
        }
      };
      setAccountLinks({
        recovery: safeLink(status.recoveryUrl),
        registration: safeLink(status.registrationUrl),
        mode: status.mode,
      });
      let activeSession = null;
      setActivation(null);
      if (status.configured && status.mode === "cloudflare_access") {
        const account = await baseApi.get("/api/auth/activation", {
          responseMode: "data",
        });
        setActivation(account);
        if (account.status !== "active") {
          setActivation(account);
          setSession(null);
          setState({ loading: false, configured: true, error: "" });
          return;
        }
      }
      if (status.configured) {
        activeSession = await loadSession(status.mode);
        if (
          activeSession &&
          (!activeSession.user || typeof activeSession.csrfToken !== "string")
        )
          throw new Error("The session response was incomplete.");
      }
      setSession(activeSession);
      updateSessionStatus("reset");
      setState({ loading: false, configured: status.configured, error: "" });
    } catch (error) {
      setSession(null);
      setState({ loading: false, configured, error: error.message });
    }
  }, [api, updateSessionStatus]);
  useEffect(() => {
    sessionStorage.removeItem("twe-agent-token");
    load();
  }, [load]);

  // Recheck on return without resetting the workspace or discarding edits.
  // No automatic sign-in exchange: explicit logout/revocation remains final.
  useEffect(() => {
    if (!session || accountLinks.mode !== "cloudflare_access") return;
    let disposed = false;
    let pending = false;
    let lastCheck = 0;
    const check = async (manual = false) => {
      if (disposed || pending || sessionGuard.current === "changed" || document.visibilityState !== "visible" || (!manual && Date.now() - lastCheck < 15000)) return;
      pending = true;
      lastCheck = Date.now();
      try {
        const result = await checkCurrentSession(baseApi, session);
        if (!disposed) updateSessionStatus(result.status);
      } finally { pending = false; }
    };
    const foreground = () => { void check(); };
    checkSessionRef.current = () => check(true);
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("pageshow", foreground);
    window.addEventListener("focus", foreground);
    window.addEventListener("online", foreground);
    const interval = window.setInterval(foreground, 60_000);
    return () => {
      disposed = true;
      checkSessionRef.current = null;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("pageshow", foreground);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("online", foreground);
    };
  }, [session, accountLinks.mode, updateSessionStatus]);

  useEffect(() => {
    if (!dirty && !editorBusy && pendingWrites === 0) return;
    const protect = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, editorBusy, pendingWrites]);

  async function logout(all = false, discardConfirmed = false) {
    if (dirty && !discardConfirmed) { setPendingExit({ kind: "logout", all }); return; }
    if (loggingOut || pendingWrites > 0) return;
    setLoggingOut(true);
    setState((current) => ({ ...current, error: "" }));
    try {
      await api.post(all ? "/api/auth/logout-all" : "/api/auth/logout", {
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      setSession(null);
      setDirty(false);
      updateSessionStatus("reset");
      setState({ loading: false, configured: true, error: "" });
      if (accountLinks.mode === "cloudflare_access")
        window.location.assign("/cdn-cgi/access/logout");
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));
    } finally { setLoggingOut(false); }
  }

  const navigation = [
    ["overview", "Overview", true],
    ["settings", "Account", Boolean(session)],
    [
      "enquiries",
      "Enquiries",
      session?.user.permissions?.includes("enquiries.read"),
    ],
    ["content", "Content", session?.user.permissions?.includes("content.read")],
    ["appearance", "Appearance", session?.user.permissions?.includes("content.read")],
    ["media", "Media", session?.user.permissions?.includes("media.read")],
    ["templates", "Templates", session?.user.permissions?.includes("templates.draft")],
    ["forms", "Enquiry forms", session?.user.permissions?.includes("content.write")],
    ["questionnaire", "Detailed questionnaire", session?.user.permissions?.includes("content.write")],
    ["staff", "Staff", session?.user.permissions?.includes("staff.manage")],
    ['activity','Activity',session?.user.permissions?.includes('audit.business.read')],
    [
      "system",
      "System",
      session?.user.role === "platform_admin" &&
        session?.user.permissions?.includes("system.read"),
    ],
  ].filter(([, , visible]) => visible);
  // Media and staff forms contain transient files or invitation details that
  // are not represented by the editorial draft state. Finish there first.
  const transientWorkspace = section === "media" || section === "staff" ||
    (section === "overview" && activation?.canIssueOwner);
  const refreshBlocked = loggingOut || sessionStatus !== "active" || dirty || editorBusy || pendingWrites > 0 || state.loading || Boolean(pendingExit) || transientWorkspace;
  return (
    <div className="portal-shell">
      <PortalNavigation navigation={navigation} section={section} navigate={navigate} session={session}/>
      <PageShell>
        <PageHeader
          title={
            session
              ? section === "overview"
                ? "Dashboard"
                : {
                    settings: "Account settings",
                    enquiries: "Enquiries",
                    content: "Website content",
                    appearance: "Brand & appearance",
                    media: "Media library",
                    templates: "Email templates",
                    forms: "Enquiry forms",
                    questionnaire: "Detailed questionnaire",
                    staff: "Staff access",
                    activity: 'Workspace activity',
                    system: "System administration",
                  }[section]
              : "Staff sign-in"
          }
        />
        {state.error && (
          <InlineNotice
            tone="danger"
            title="Request unsuccessful"
            message={state.error}
          />
        )}
        {session && sessionStatus !== "active" && <div className="session-recovery">
          <InlineNotice tone="warning"
            title={sessionStatus === "changed" ? "Session changed" : sessionStatus === "unavailable" ? "Session check unavailable" : "Session expired"}
            message={sessionStatus === "changed" ? "Reload to use the new session. Unsaved edits cannot be transferred to another session." : "Your work remains in this tab. Check your session before continuing."} />
          {sessionStatus !== "changed" && <Button type="button" variant="ghost" icon="refresh" onClick={() => checkSessionRef.current?.()}>Check session</Button>}
        </div>} 
        {state.loading ? (
          <AnimatedLoadingState
            compact
            title="Signing you in…"
          />
        ) : session ? (
          <div className="session-toolbar" aria-label="Your session">
            <span>
              Signed in as{" "}
              <strong>{session.user.role === "platform_admin" ? "Superadmin" : session.user.role.replaceAll("_", " ")}</strong>
            </span>
            <Button
              icon="logout"
              variant="ghost"
              type="button"
              disabled={loggingOut || pendingWrites > 0}
              onClick={() => logout()}
            >
              Sign out
            </Button>
          </div>
        ) : activation && activation.status !== "active" ? (
          <Activation status={activation} api={baseApi} onActivated={load} />
        ) : state.configured && accountLinks.mode === "cloudflare_access" ? (
          <section
            className="signin-panel"
            aria-labelledby="access-signin-heading"
          >
            <h2 id="access-signin-heading">Welcome to Travel With Ease</h2>
            <p>Sign in with your approved work account.</p>
            {state.error && <Button type="button" icon="refresh" onClick={load}>Retry session</Button>}
            <a className="signin-link" href="/cdn-cgi/access/logout">
              Sign in again securely
            </a>
            <p>Need access? Contact your workspace owner.</p>
          </section>
        ) : state.configured ? (
          <section className="signin-panel" aria-labelledby="signin-heading">
            <h2 id="signin-heading">Use your staff identity</h2>
            <p>Sign in with your work account.</p>
            <form action={baseUrl + "/api/auth/login"} method="get">
              <label>
                <input
                  type="checkbox"
                  name="remember"
                  value="1"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  aria-describedby="remember-help"
                />{" "}
                Remember me on this device
              </label>
              <p id="remember-help">
                Stay signed in on this device for up to one hour. Not for shared devices.
              </p>
              <Button type="submit">Sign in securely</Button>
            </form>
          </section>
        ) : (
          <section className="signin-panel" aria-labelledby="setup-heading">
            <h2 id="setup-heading">Staff sign-in is not configured</h2>
            <p>
              Staff sign-in is unavailable. Contact your administrator.
            </p>
          </section>
        )}
        {!state.loading &&
          !session &&
          accountLinks.mode !== "cloudflare_access" && (
            <section className="signin-panel" aria-label="Account help">
              <Button
                type="button"
                aria-expanded={accountFlow === "recovery"}
                onClick={() => setAccountFlow("recovery")}
              >
                Forgot password?
              </Button>
              <Button
                type="button"
                aria-expanded={accountFlow === "registration"}
                onClick={() => setAccountFlow("registration")}
              >
                Create account
              </Button>
              {accountFlow !== "login" && (
                <div role="status">
                  <h2>
                    {accountFlow === "recovery"
                      ? "Recover your account"
                      : "Create a staff account"}
                  </h2>
                  <p>
                    {accountFlow === "recovery"
                      ? "Recover your account through your work sign-in provider."
                      : "Ask your workspace owner for an invitation."}
                  </p>
                  {state.configured && accountLinks[accountFlow] ? (
                    <a
                      className="signin-link"
                      href={accountLinks[accountFlow]}
                      rel="noreferrer"
                    >
                      {accountFlow === "recovery"
                        ? "Continue to password recovery"
                        : "Continue to account creation"}
                    </a>
                  ) : (
                    <p>
                      {accountFlow === "recovery"
                        ? "Password recovery is unavailable. Contact your workspace owner."
                        : "Account creation is unavailable. Ask your workspace owner for an invitation."}
                    </p>
                  )}
                  <Button type="button" onClick={() => setAccountFlow("login")}>
                    Back to sign-in
                  </Button>
                </div>
              )}
            </section>
          )}
        <div data-tour={section} inert={session && sessionStatus !== "active" ? true : undefined} hidden={sessionStatus === "changed"}>
          {!state.loading &&
            session &&
            activation?.canIssueOwner &&
            section === "overview" && <Invitations api={api} installer />}
          {!state.loading && session && section === "settings" && (
            <AccountSettings
              api={api}
              session={session}
              onLogout={logout}
              onHandoverCompleted={() => {
                setSession(null);
                window.location.assign("/cdn-cgi/access/logout");
              }}
            />
          )}
          {!state.loading &&
            session?.user.permissions?.includes("content.read") &&
            section === "content" && (
              <WebsiteContent
                api={api}
                session={session}
                onDirtyChange={setDirty}
                onRefreshBlockedChange={setEditorBusy}
              />
            )}
          {!state.loading && session?.user.permissions?.includes("content.read") &&
            section === "appearance" && (
              <WebsiteContent
                api={api}
                session={session}
                initialPage="site-appearance"
                onDirtyChange={setDirty}
                onRefreshBlockedChange={setEditorBusy}
              />
            )}
          {!state.loading && session && section === "overview" && (
            <Dashboard
              api={api}
              session={session}
              onNavigate={navigate}
            />
          )}
          {!state.loading &&
            session?.user.permissions?.includes("media.read") &&
            section === "media" && <MediaLibrary api={api} session={session} />}
          {!state.loading &&
            session?.user.permissions?.includes("enquiries.read") &&
            section === "enquiries" && (
              <Enquiries api={api} session={session} />
            )}
          {!state.loading && session?.user.permissions?.includes("templates.draft") && section === "templates" && (
            <EmailTemplates api={api} session={session} onDirtyChange={setDirty} onRefreshBlockedChange={setEditorBusy} />
          )}
          {!state.loading && session?.user.permissions?.includes("content.write") && ["forms", "questionnaire"].includes(section) && (
            <IntakeFormEditor key={section} detailed={section === "questionnaire"} api={api} session={session} onDirtyChange={setDirty} onRefreshBlockedChange={setEditorBusy} />
          )}
          {!state.loading && session && section === "system" && (
            <SystemAdministration api={api} session={session} />
          )}
          {!state.loading&&session?.user.permissions?.includes('audit.business.read')&&section==='activity'&&<ActivityView api={api}/>}
          {!state.loading &&
            session?.user.permissions?.includes("staff.manage") &&
            section === "staff" && <StaffAccess api={api} session={session} />}
        </div>
        {!state.loading && session && sessionStatus === "active" && (
          <TutorialWorkspace
            key={session.user.id}
            api={api}
            session={session}
            navigate={navigate}
            section={section}
          />
        )}
        {!state.loading && !session && !dirty && state.error && (
          <Button icon="refresh" variant="ghost" type="button" onClick={load}>
            Retry connection
          </Button>
        )}
        <ERPConfirmDialog open={Boolean(pendingExit)} title={pendingExit?.kind === "logout" ? "Discard changes and sign out?" : "Discard unsaved changes?"}
          message={pendingExit?.kind === "logout" ? "Your unsaved edits will be lost before this session ends." : "Your unsaved edits will be lost when you leave this workspace."}
          confirmLabel={pendingExit?.kind === "logout" ? "Discard and sign out" : "Discard and continue"}
          onCancel={() => setPendingExit(null)} onConfirm={() => { const action = pendingExit; setPendingExit(null); if (action?.kind === "logout") { void logout(action.all, true); } else if (action?.kind === "navigate") { setDirty(false); setSection(action.next); } }} />
      </PageShell>
      <AppUpdateNotice appName="Travel With Ease CMS" mode="prompt"
        enabled={Boolean(session) && (import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true")}
        checkIntervalMs={60_000} dailyRefreshHourUtc={2} className="twe-app-update-notice"
        refreshBlocked={refreshBlocked}
        refreshBlockedMessage={transientWorkspace ? "Finish your current work and return to Overview or Content to refresh." : "Save your changes and finish the current action before refreshing."} />
    </div>
  );
}

export default function App() {
  return (
    <UiSystemProvider appSystem={appSystem} toastPresentation="twe">
      <StaffWorkspace />
    </UiSystemProvider>
  );
}
