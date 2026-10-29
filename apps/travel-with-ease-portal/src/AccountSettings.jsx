import Button from "./ActionButton.jsx";

export default function AccountSettings({ session, onLogout }) {
  return (
    <section
      className="content-editor"
      aria-labelledby="account-settings-heading"
      data-tour="account-settings"
    >
      <h2 id="account-settings-heading">Account and workspace settings</h2>
      <p>
        Your identity provider manages your Google account, password recovery
        and MFA. Workspace roles are managed separately by authorised staff.
      </p>
      <dl className="account-details">
        <dt>Your role</dt>
        <dd>{session.user.role.replaceAll("_", " ")}</dd>
        <dt>Workspace reference</dt>
        <dd>{session.user.organisationId}</dd>
        <dt>Session expires</dt>
        <dd>
          {session.expiresAt
            ? new Date(session.expiresAt).toLocaleString()
            : "Check your session status"}
        </dd>
      </dl>
      <p>
        Use Tutorial Mode in the footer to save your guidance preference. These
        preferences apply only to your account.
      </p>
      <Button
        type="button"
        onClick={() => {
          if (window.confirm("Sign out all your Travel With Ease sessions?"))
            onLogout(true);
        }}
      >
        Sign out all devices
      </Button>
      <p>
        Infrastructure, billing and workspace ownership cannot be changed here.
        Contact your authorised administrator for those requests.
      </p>
    </section>
  );
}
