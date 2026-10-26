import { useCallback, useEffect, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import { Button, InlineNotice, PageHeader, PageShell, UiSystemProvider } from "@faako/ui";
import appSystem from "../appSystem.js";
import WebsiteContent from "./WebsiteContent.jsx";
import MediaLibrary from "./MediaLibrary.jsx";
import SystemAdministration from "./SystemAdministration.jsx";
import StaffAccess from "./StaffAccess.jsx";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
const api = createBrowserApiClient({ baseUrl, credentials: "include" });
const modules = ["Enquiries", "Packages", "Travel Journal", "Travel Footprint", "Settings"];

function StaffWorkspace() {
  const [session, setSession] = useState(null);
  const [section, setSection] = useState("overview");
  const [dirty, setDirty] = useState(false);
  const [remember, setRemember] = useState(false);
  const [accountFlow, setAccountFlow] = useState("login");
  const [accountLinks, setAccountLinks] = useState({});
  const [state, setState] = useState({ loading: true, configured: false, error: "" });
  const load = useCallback(async () => {
    let configured=false;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const status = await api.get("/api/auth/status", { responseMode: "data" });
      if (typeof status?.configured !== "boolean") throw new Error("The sign-in service returned an incomplete response.");
      configured=status.configured;
      // Only accept HTTPS provider links; never render executable URL schemes.
      const safeLink = (value) => { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; } };
      setAccountLinks({ recovery: safeLink(status.recoveryUrl), registration: safeLink(status.registrationUrl), mode: status.mode });
      let activeSession = null;
      if (status.configured) {
        try {
          activeSession = await api.get("/api/auth/session", { responseMode: "data" });
          if (!activeSession?.user || typeof activeSession.csrfToken !== "string") throw new Error("The session response was incomplete.");
        } catch (error) {
          if (error.status !== 401) throw error;
          if (status.mode === "cloudflare_access") {
            await api.post("/api/auth/access-session", { responseMode: "data", headers: { "X-TWE-Session-Init": "1" } });
            activeSession = await api.get("/api/auth/session", { responseMode: "data" });
          }
        }
      }
      setSession(activeSession);
      setState({ loading: false, configured: status.configured, error: "" });
    } catch (error) {
      setSession(null);
      setState({ loading: false, configured, error: error.message });
    }
  }, []);
  useEffect(() => {
    sessionStorage.removeItem("twe-agent-token");
    load();
  }, [load]);

  async function logout(all = false) {
    if (dirty && !window.confirm("Discard unsaved changes and sign out?")) return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      await api.post(all ? "/api/auth/logout-all" : "/api/auth/logout", { responseMode: "data", headers: { "X-CSRF-Token": session.csrfToken } });
      setSession(null);
      setState({ loading: false, configured: true, error: "" });
      if (accountLinks.mode === "cloudflare_access") window.location.assign("/cdn-cgi/access/logout");
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  return <div className="portal-shell">
    <aside>
      <div className="portal-brand"><span>TWE</span><div><strong>Travel With Ease</strong><small>Staff workspace</small></div></div>
      <nav aria-label="Staff navigation">
        <button type="button" aria-current={section === "overview" ? "page" : undefined} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) { setDirty(false); setSection("overview"); } }}>Overview</button>
        {session?.user.permissions?.includes("content.read") && <button type="button" aria-current={section === "content" ? "page" : undefined} onClick={() => setSection("content")}>Website Content</button>}
        {session?.user.permissions?.includes("media.read") && <button type="button" aria-current={section === "media" ? "page" : undefined} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) { setDirty(false); setSection("media"); } }}>Media Library</button>}
        {session?.user.role === "platform_admin" && session.user.permissions?.includes("system.read") && <button type="button" aria-current={section === "system" ? "page" : undefined} onClick={() => setSection("system")}>System Administration</button>}
        {session?.user.role === "owner" && <button type="button" aria-current={section === "staff" ? "page" : undefined} onClick={() => setSection("staff")}>Staff access</button>}
        {modules.map((name) => <span key={name} aria-disabled="true">{name}<small>Not yet implemented</small></span>)}
      </nav>
    </aside>
    <PageShell>
      <PageHeader title={session ? "Staff workspace" : "Staff sign-in"} subtitle="Manage Travel With Ease website content." />
      {state.error && <InlineNotice tone="danger" title="Request unsuccessful" message={state.error} />}
      {state.loading ? <p role="status">Checking your session…</p> : session ? <section aria-labelledby="session-heading">
        <h2 id="session-heading">Signed in</h2>
        <p>Access: {session.user.role}. Technical and business permissions are separate. Other modules remain unavailable unless shown in navigation.</p>
        <Button type="button" onClick={() => logout()}>Sign out</Button>
        <Button type="button" onClick={() => { if (window.confirm("Sign out all your Travel With Ease sessions?")) logout(true); }}>Sign out all devices</Button>
      </section> : state.configured && accountLinks.mode === "cloudflare_access" ? <section aria-labelledby="access-signin-heading">
        <h2 id="access-signin-heading">Cloudflare Access sign-in</h2><p>Use your approved staff identity and independent MFA. If your application session expired, reauthenticate with Access. Contact the Owner if your identity is not provisioned.</p>
        <a className="signin-link" href="/cdn-cgi/access/logout">Reauthenticate through Cloudflare Access</a>
      </section> : state.configured ? <section aria-labelledby="signin-heading">
        <h2 id="signin-heading">Use your staff identity</h2>
        <p>Your identity provider handles multi-factor authentication and account recovery. Only provisioned staff can enter.</p>
        <form action={baseUrl + "/api/auth/login"} method="get">
          <label><input type="checkbox" name="remember" value="1" checked={remember} onChange={(event) => setRemember(event.target.checked)} aria-describedby="remember-help" /> Remember me on this device</label>
          <p id="remember-help">Keep your session after closing the browser, for up to one hour. Leave unchecked on shared devices. Browser restore settings may also restore sessions.</p>
          <Button type="submit">Sign in securely</Button>
        </form>
      </section> : <section aria-labelledby="setup-heading">
        <h2 id="setup-heading">Staff sign-in is not configured</h2>
        <p>Faako must configure the identity provider and provision your staff account before this workspace is available.</p>
      </section>}
      {!state.loading && !session && accountLinks.mode !== "cloudflare_access" && <section aria-label="Account help">
        <Button type="button" aria-expanded={accountFlow === "recovery"} onClick={() => setAccountFlow("recovery")}>Forgot password?</Button>
        <Button type="button" aria-expanded={accountFlow === "registration"} onClick={() => setAccountFlow("registration")}>Create account</Button>
        {accountFlow !== "login" && <div role="status">
          <h2>{accountFlow === "recovery" ? "Recover your account" : "Create a staff account"}</h2>
          <p>{accountFlow === "recovery" ? "Your identity provider manages passwords and MFA recovery. Travel With Ease does not collect your password or recovery codes." : "This workspace is for approved Travel With Ease staff. Creating an identity does not grant access: a workspace owner must provision your account and role."}</p>
          {state.configured && accountLinks[accountFlow] ? <a className="signin-link" href={accountLinks[accountFlow]} rel="noreferrer">{accountFlow === "recovery" ? "Continue to password recovery" : "Continue to account creation"}</a> : <p>{accountFlow === "recovery" ? "Recovery is not configured yet. Contact your workspace owner for help recovering your staff identity." : "Account creation is not configured yet. Ask your workspace owner for an invitation. No registration request has been submitted."}</p>}
          <Button type="button" onClick={() => setAccountFlow("login")}>Back to sign-in</Button>
        </div>}
      </section>}
      {!state.loading && session?.user.permissions?.includes("content.read") && section === "content" && <WebsiteContent api={api} session={session} onDirtyChange={setDirty} />}
      {!state.loading && session?.user.permissions?.includes("media.read") && section === "media" && <MediaLibrary api={api} session={session} />}
      {!state.loading && session && section === "system" && <SystemAdministration api={api} session={session} />}
      {!state.loading && session?.user.role === "owner" && section === "staff" && <StaffAccess api={api} session={session} />}
      {!state.loading && !dirty && <Button type="button" onClick={load}>Check connection again</Button>}
    </PageShell>
  </div>;
}

export default function App() {
  return <UiSystemProvider appSystem={appSystem}><StaffWorkspace /></UiSystemProvider>;
}
