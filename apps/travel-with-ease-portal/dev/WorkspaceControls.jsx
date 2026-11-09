import { useEffect, useState } from "react";
import { Button, SelectField, UiSystemProvider } from "@faako/ui";
import appSystem from "../appSystem.js";
import "./workspace-controls.css";

export default function WorkspaceControls() {
  const [role, setRole] = useState("owner");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/__workspace")
      .then((response) => response.json())
      .then((data) => setRole(data.role))
      .catch(() => setError("Preview controls unavailable."));
  }, []);
  async function change(action, nextRole = role) {
    if (
      !window.confirm(
        "Reset this synthetic workspace and reload? Local edits and tutorial progress will be cleared.",
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch("/__workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TWE-Workspace": "local-preview",
        },
        body: JSON.stringify({ action, role: nextRole }),
      });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      setError("Preview was not reset. Try again.");
      setBusy(false);
    }
  }
  return (
    <UiSystemProvider appSystem={appSystem}>
      <aside
        className="workspace-preview-toolbar"
        aria-label="Local workspace preview"
      >
        <div>
          <strong>Local workspace preview</strong>
          <p>Synthetic data · Nothing is sent or published · Memory only</p>
          {error && <p role="alert">{error}</p>}
        </div>
        <SelectField
          label="Preview role"
          name="previewRole"
          value={role}
          disabled={busy}
          onChangeValue={(value) => change("role", value)}
        >
          <option value="owner">Owner</option>
          <option value="editor">Editor</option>
          <option value="platform_admin">Superadmin</option>
        </SelectField>
        <Button disabled={busy} onClick={() => change("reset")}>
          Reset preview
        </Button>
      </aside>
    </UiSystemProvider>
  );
}
