import Button from "./ActionButton.jsx";
import { useCallback, useEffect, useState } from "react";
import {
  TextField,
  KpiCard,
  StatusPill,
  InlineNotice,
  AnimatedLoadingState,
} from "@faako/ui";
import Invitations from "./Invitations.jsx";
import "./activation.css";

export default function StaffAccess({ api, session }) {
  const [staff, setStaff] = useState([]),
    [subject, setSubject] = useState(""),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const owner = session.user.role === "owner";
  const allowed = owner || session.user.role === "platform_admin";
  const load = useCallback(
    () =>
      api
        .get("/api/agent/administration/staff", { responseMode: "data" })
        .then((data) => setStaff(data.items)),
    [api],
  );
  useEffect(() => {
    let active = true;
    if (allowed) {
      setLoading(true);
      load()
        .catch(() =>
          setMessage("Staff information is unavailable. Check your session."),
        )
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [load, allowed]);
  if (!allowed) return null;
  async function mutate(path, json) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api.post(`/api/agent/administration/${path}`, {
        json,
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      await load();
      setMessage(
        `Action recorded${path === "support-grants" ? `; support grant ${result.id} expires within 15 minutes` : ""}.`,
      );
    } catch {
      setMessage(
        "Action was not completed. Your permission or session may have changed; refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="staff-workspace" aria-labelledby="staff-access-heading">
      <div className="workspace-intro">
        <h2 id="staff-access-heading">Your team, with the right access</h2>
        <p>
          Provision verified identities and review who can use this workspace.
        </p>
      </div>
      {loading ? (
        <AnimatedLoadingState
          compact
          title="Loading staff access"
          message="Retrieving this workspace’s authorised team."
        />
      ) : (
        <div className="workspace-kpis">
          <KpiCard
            label="Staff accounts"
            value={staff.length}
            detail="Accounts returned for this workspace"
          />
          <KpiCard
            label="Active"
            value={staff.filter((user) => user.active).length}
            detail="Currently enabled"
          />
          <KpiCard
            label="Editors"
            value={staff.filter((user) => user.role === "editor").length}
            detail="Business content role"
          />
        </div>
      )}
      <p>
        Use the independently verified Cloudflare subject—not an email address.
        New accounts are Editors. Platform operators stage inactive accounts; an
        Owner activates them. Owner and platform role assignment requires a
        reviewed administrative procedure.
      </p>
      {message && (
        <InlineNotice title="Staff access result" message={message} />
      )}
      {owner && <Invitations api={api} session={session} />}
      {!owner && (
        <form
          className="staff-provision"
          onSubmit={(event) => {
            event.preventDefault();
            mutate("staff", { subject });
          }}
        >
          <TextField
            label="Verified Access subject"
            hint="Use the verified stable identity, not an email address."
            required
            maxLength={255}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <Button icon="plus" variant="primary" type="submit" disabled={busy}>
            {owner ? "Provision Editor" : "Stage Editor for Owner approval"}
          </Button>
        </form>
      )}
      {owner && (
        <TextField
          label="Approved support ticket reference"
          maxLength={120}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="SUP-123"
        />
      )}
      <ul className="staff-list">
        {staff.map((user) => (
          <li key={user.id}>
            <div className="staff-identity">
              <strong>{user.role.replaceAll("_", " ")}</strong>
              <code>{user.id}</code>
            </div>
            <StatusPill tone={user.active ? "success" : "neutral"}>
              {user.active ? "Active" : "Inactive"}
            </StatusPill>
            {user.role === "editor" && (user.active || owner) && (
              <Button
                variant={user.active ? "danger" : "primary"}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `${user.active ? "Revoke" : "Activate"} this Editor? Existing sessions will be revoked.`,
                    )
                  )
                    mutate(`staff/${user.id}/status`, { active: !user.active });
                }}
              >
                {user.active ? "Revoke access" : "Activate"}
              </Button>
            )}
            {(!owner || user.role === "editor") && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Revoke this staff member’s local sessions and support grants?",
                    )
                  )
                    mutate(`staff/${user.id}/revoke-sessions`, {});
                }}
              >
                Revoke sessions
              </Button>
            )}
            {owner && user.role === "platform_admin" && user.active && (
              <Button
                type="button"
                disabled={
                  busy || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(reason)
                }
                onClick={() => {
                  if (
                    window.confirm(
                      "Approve read-only enquiry support for 15 minutes? This permits private client-record access and will be audited.",
                    )
                  )
                    mutate("support-grants", {
                      userId: user.id,
                      reasonReference: reason,
                      minutes: 15,
                    });
                }}
              >
                Approve 15-minute support
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
