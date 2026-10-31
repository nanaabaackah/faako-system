import Button from "./ActionButton.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import {
  ErpMobileBottomNavFrame,
  useToast,
  InlineNotice,
  PageHeader,
  PageShell,
  UiSystemProvider,
  AnimatedLoadingState,
} from "@faako/ui";
import "@faako/ui/twe-feedback.css";
import appSystem from "../appSystem.js";
import WebsiteContent from "./WebsiteContent.jsx";
import MediaLibrary from "./MediaLibrary.jsx";
import EmailTemplates from "./EmailTemplates.jsx";
import SystemAdministration from "./SystemAdministration.jsx";
import StaffAccess from "./StaffAccess.jsx";
import Enquiries from "./Enquiries.jsx";
import { createSessionLoader } from "./session.js";
import { createDemoClient, demoEnabled } from "./demo.js";
import Dashboard from "./Dashboard.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
import TutorialWorkspace from "./TutorialWorkspace.jsx";
import Activation from "./Activation.jsx";
import AccountSettings from "./AccountSettings.jsx";
import Invitations from "./Invitations.jsx";
import brandLogo from "../../travel-with-ease-web/public/brand/Primary gold.png";

// Staff authentication is same-origin in both Vite development and hosted mode.
// Never embed an API origin that bypasses the Access-aware portal server.
const baseUrl = "";
const localDemoAllowed =
  import.meta.env.DEV && import.meta.env.TWE_LOCAL_DEMO_ALLOWED === true;
const stagingDemoAllowed =
  import.meta.env.TWE_STAGING_PORTAL_DEMO_ALLOWED === true;
const isDemo = demoEnabled({
  allowed: localDemoAllowed,
  stagingAllowed: stagingDemoAllowed,
  hostname: window.location.hostname,
  pathname: window.location.pathname,
  search: window.location.search,
});
const demoRestartUrl = stagingDemoAllowed ? "/demo" : "/?demo=1";
const baseApi = isDemo
  ? createDemoClient()
  : createBrowserApiClient({ baseUrl, credentials: "include" });
const loadSession = createSessionLoader(baseApi);

function StaffWorkspace() {
  const { pushToast, updateToast } = useToast();
  const api = useMemo(
    () => ({
      ...baseApi,
      post: async (...args) => {
        const id = pushToast({
          tone: "loading",
          title: isDemo ? "Updating demo" : "Working",
          message: "Please wait for confirmation.",
        });
        try {
          const result = await baseApi.post(...args);
          updateToast(id, {
            tone: "success",
            title: isDemo ? "Demo updated" : "Request completed",
            message: isDemo
              ? "Only simulated demo data changed in this tab. No server change was made."
              : "The server confirmed the action. Publication requests still require a successful deployment.",
          });
          return result;
        } catch (error) {
          updateToast(id, {
            tone: "error",
            title: "Action not completed",
            message:
              "Check the details shown in the workspace before retrying.",
          });
          throw error;
        }
      },
    }),
    [pushToast, updateToast],
  );
  const [session, setSession] = useState(null);
  const [activation, setActivation] = useState(null);
  const [section, setSection] = useState("overview");
  const [dirty, setDirty] = useState(false);
  const [remember, setRemember] = useState(false);
  const [accountFlow, setAccountFlow] = useState("login");
  const [accountLinks, setAccountLinks] = useState({});
  const [state, setState] = useState({
    loading: true,
    configured: false,
    error: "",
  });
  const navigate = (next) => {
    if (!dirty || window.confirm("Discard unsaved changes?")) {
      setDirty(false);
      setSection(next);
      return true;
    }
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
      if (!isDemo && status.configured && status.mode === "cloudflare_access") {
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
      setState({ loading: false, configured: status.configured, error: "" });
    } catch (error) {
      setSession(null);
      setState({ loading: false, configured, error: error.message });
    }
  }, [api]);
  useEffect(() => {
    sessionStorage.removeItem("twe-agent-token");
    load();
  }, [load]);

  async function logout(all = false) {
    if (dirty && !window.confirm("Discard unsaved changes and sign out?"))
      return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      await api.post(all ? "/api/auth/logout-all" : "/api/auth/logout", {
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      setSession(null);
      setState({ loading: false, configured: true, error: "" });
      if (accountLinks.mode === "cloudflare_access")
        window.location.assign("/cdn-cgi/access/logout");
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));
    }
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
    ["media", "Media", session?.user.permissions?.includes("media.read")],
    ["templates", "Templates", session?.user.permissions?.includes("templates.manage")],
    ["staff", "Staff", session?.user.role === "owner"],
    [
      "system",
      "System",
      session?.user.role === "platform_admin" &&
        session?.user.permissions?.includes("system.read"),
    ],
  ].filter(([, , visible]) => visible);
  // Equal-width groups keep Overview physically centred even when a role has
  // a different number of available modules. DOM and keyboard order agree.
  const mobileModules = navigation.filter(([id]) => id !== "overview");
  const mobileSplit = Math.ceil(mobileModules.length / 2);
  const navButton = ([id, label]) => (
    <button
      key={id}
      type="button"
      className={id === "overview" ? "nav-overview" : ""}
      aria-current={section === id ? "page" : undefined}
      onClick={() => navigate(id)}
    >
      <NavigationIcon name={id} />
      <span>{label}</span>
    </button>
  );
  return (
    <div className="portal-shell">
      <aside>
        <div className="portal-brand">
          <img src={brandLogo} alt="Travel With Ease" width="184" height="72" />
          <small>Staff workspace</small>
        </div>
        <nav aria-label="Staff navigation">{navigation.map(navButton)}</nav>
      </aside>
      <PageShell>
        {isDemo ? (
          <aside
            className="demo-notice"
            aria-label="Synthetic portal demonstration"
          >
            <strong>
              {stagingDemoAllowed ? "Staging portal demo" : "Local portal demo"}{" "}
              — synthetic data only
            </strong>
            <p>
              This is an interactive preview, not a real staff login. The sample
              enquiries and drafts reset on reload; no real customer records,
              database, emails, uploads or published website content are
              changed.
            </p>
            <a href="/">Exit demo and open staff login</a>
          </aside>
        ) : (
          localDemoAllowed &&
          ["localhost", "127.0.0.1", "[::1]"].includes(
            window.location.hostname,
          ) && (
            <aside className="demo-notice">
              <p>Preview the updated staff workspace using synthetic data.</p>
              <a href="/?demo=1">Open local demo workspace</a>
            </aside>
          )
        )}
        <PageHeader
          title={
            session
              ? section === "overview"
                ? "Dashboard"
                : {
                    settings: "Account settings",
                    enquiries: "Enquiries",
                    content: "Website content",
                    media: "Media library",
                    templates: "Email templates",
                    staff: "Staff access",
                    system: "System administration",
                  }[section]
              : "Staff sign-in"
          }
          subtitle={
            session
              ? "Travel With Ease · Staff workspace"
              : "Your next journey starts here."
          }
        />
        {state.error && (
          <InlineNotice
            tone="danger"
            title="Request unsuccessful"
            message={state.error}
          />
        )}
        {state.loading ? (
          <AnimatedLoadingState
            compact
            title="Checking your session"
            message="Verifying workspace access…"
          />
        ) : session ? (
          <div className="session-toolbar" aria-label="Your session">
            <span>
              {isDemo ? "Simulating role " : "Signed in as "}
              <strong>{session.user.role.replaceAll("_", " ")}</strong>
            </span>
            <Button
              icon="logout"
              variant="ghost"
              type="button"
              onClick={() => logout()}
            >
              {isDemo ? "End demo session" : "Sign out"}
            </Button>
            {!isDemo && (
              <Button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Sign out all your Travel With Ease sessions?",
                    )
                  )
                    logout(true);
                }}
              >
                Sign out all devices
              </Button>
            )}
          </div>
        ) : activation && activation.status !== "active" ? (
          <Activation status={activation} api={baseApi} onActivated={load} />
        ) : isDemo ? (
          <section>
            <h2>Demo session ended</h2>
            <p>No real staff session was created.</p>
            <a href={demoRestartUrl}>Restart demo</a>
          </section>
        ) : state.configured && accountLinks.mode === "cloudflare_access" ? (
          <section
            className="signin-panel"
            aria-labelledby="access-signin-heading"
          >
            <h2 id="access-signin-heading">Welcome to Travel With Ease</h2>
            <p>
              Sign in with your approved staff identity through Cloudflare
              Access, including Google where enabled. Your workspace owner must
              grant staff access separately.
            </p>
            <a className="signin-link" href="/cdn-cgi/access/logout">
              Sign in again securely
            </a>
            <p>
              Need access or account recovery? Contact your workspace owner.
              Travel With Ease does not collect your Google password or recovery
              codes.
            </p>
          </section>
        ) : state.configured ? (
          <section className="signin-panel" aria-labelledby="signin-heading">
            <h2 id="signin-heading">Use your staff identity</h2>
            <p>
              Your identity provider handles multi-factor authentication and
              account recovery. Only provisioned staff can enter.
            </p>
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
                Keep your session after closing the browser, for up to one hour.
                Leave unchecked on shared devices. Browser restore settings may
                also restore sessions.
              </p>
              <Button type="submit">Sign in securely</Button>
            </form>
          </section>
        ) : (
          <section className="signin-panel" aria-labelledby="setup-heading">
            <h2 id="setup-heading">Staff sign-in is not configured</h2>
            <p>
              Faako must configure the identity provider and provision your
              staff account before this workspace is available.
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
                      ? "Your identity provider manages passwords and MFA recovery. Travel With Ease does not collect your password or recovery codes."
                      : "This workspace is for approved Travel With Ease staff. Creating an identity does not grant access: a workspace owner must provision your account and role."}
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
                        ? "Recovery is not configured yet. Contact your workspace owner for help recovering your staff identity."
                        : "Account creation is not configured yet. Ask your workspace owner for an invitation. No registration request has been submitted."}
                    </p>
                  )}
                  <Button type="button" onClick={() => setAccountFlow("login")}>
                    Back to sign-in
                  </Button>
                </div>
              )}
            </section>
          )}
        <div data-tour={section}>
          {!state.loading &&
            session &&
            activation?.canIssueOwner &&
            section === "overview" && <Invitations api={baseApi} installer />}
          {!state.loading && session && section === "settings" && (
            <AccountSettings session={session} onLogout={logout} />
          )}
          {!state.loading &&
            session?.user.permissions?.includes("content.read") &&
            section === "content" && (
              <WebsiteContent
                api={api}
                session={session}
                onDirtyChange={setDirty}
              />
            )}
          {!state.loading && session && section === "overview" && (
            <Dashboard
              api={api}
              session={session}
              onNavigate={navigate}
              isDemo={isDemo}
              demoWebsiteUrl={
                stagingDemoAllowed
                  ? "https://staging.travelwitheasegh.com/demo"
                  : "http://127.0.0.1:4328/demo"
              }
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
          {!state.loading && session?.user.permissions?.includes("templates.manage") && section === "templates" && (
            <EmailTemplates api={api} session={session} onDirtyChange={setDirty} />
          )}
          {!state.loading && session && section === "system" && (
            <SystemAdministration api={api} session={session} />
          )}
          {!state.loading &&
            session?.user.role === "owner" &&
            section === "staff" && <StaffAccess api={api} session={session} />}
        </div>
        {!state.loading && session && !isDemo && (
          <TutorialWorkspace
            key={session.user.id}
            api={baseApi}
            session={session}
            navigate={navigate}
            section={section}
          />
        )}
        {!state.loading && !dirty && (
          <Button icon="refresh" variant="ghost" type="button" onClick={load}>
            Check connection again
          </Button>
        )}
      </PageShell>
      {session && (
        <ErpMobileBottomNavFrame className="twe-bottom-nav">
          <div className="twe-bottom-nav__group">
            {mobileModules.slice(0, mobileSplit).map(navButton)}
          </div>
          {navButton(navigation.find(([id]) => id === "overview"))}
          <div className="twe-bottom-nav__group">
            {mobileModules.slice(mobileSplit).map(navButton)}
          </div>
        </ErpMobileBottomNavFrame>
      )}
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
