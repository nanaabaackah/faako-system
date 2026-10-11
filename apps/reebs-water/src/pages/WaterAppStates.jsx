import { InlineNotice } from "@faako/ui";

export function WaterLoading({ label }) {
  return (
    <main className="water-app-state">
      <p role="status">{label}</p>
    </main>
  );
}

export function WaterAccessDenied({ onLogout }) {
  return (
    <main className="water-app-state" aria-labelledby="water-access-denied-title">
      <h1 id="water-access-denied-title">403 · Access denied</h1>
      <InlineNotice
        tone="warning"
        title="You do not have access to Water"
        message="Your account is authenticated, but it does not have permission to access this business."
      />
      <button type="button" className="water-app-logout" onClick={onLogout}>Sign out</button>
    </main>
  );
}
