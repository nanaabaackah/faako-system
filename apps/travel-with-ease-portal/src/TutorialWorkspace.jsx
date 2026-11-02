import { useCallback, useEffect, useRef, useState } from "react";
import { GuidedTour } from "@faako/ui/GuidedTour";
import "@faako/ui/guided-tour.css";
import "./tutorials.css";
import Button from "./ActionButton.jsx";

export default function TutorialWorkspace({ api, session, navigate, section }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    try {
      setData(await api.get("/api/auth/tutorials", { responseMode: "data" }));
      setError("");
    } catch {
      setError(
        "Your tutorial progress could not be loaded. The workspace is still available.",
      );
    }
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);
  const steps = data?.catalogue.flatMap((tour) => tour.steps) || [];
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === data?.progress.position),
  );
  const step = steps[index];
  const active =
    data?.progress.enabled && data.progress.status === "active" && !dismissed;
  async function act(type, extra = {}) {
    if (inFlight.current || !data) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.post("/api/auth/tutorials", {
        json: { type, ...extra, revision: data.progress.revision },
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      setData(result);
      setDismissed(false);
      if (result.progress.enabled && result.progress.status === "active") {
        const next = result.catalogue
          .flatMap((tour) => tour.steps)
          .find((item) => item.id === result.progress.position);
        if (next && next.module !== section && navigate(next.module) === false)
          setDismissed(true);
      }
    } catch {
      setError(
        "Progress was not saved. Reload progress before trying again. No workspace content was changed.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <footer
      className="tutorial-footer"
      data-tour="tutorial-footer"
      aria-label="Workspace tutorials"
    >
      <div className="tutorial-footer-controls">
        <Button
          type="button"
          aria-pressed={Boolean(data?.progress.enabled)}
          disabled={!data || busy}
          onClick={() => act("toggle", { enabled: !data.progress.enabled })}
        >
          Tutorial Mode: {data?.progress.enabled ? "On" : "Off"}
        </Button>
        <Button
          type="button"
          disabled={!data || busy}
          onClick={() => setList(!list)}
          aria-expanded={list}
        >
          View available tutorials
        </Button>
        <Button
          type="button"
          disabled={!data || busy}
          onClick={() => act("resume")}
        >
          Resume tutorial
        </Button>
        <Button
          type="button"
          disabled={!data || busy}
          onClick={() => act("restart")}
        >
          Restart tutorial
        </Button>
        <Button
          type="button"
          disabled={!data || busy}
          onClick={() => act("complete")}
        >
          Mark tutorial completed
        </Button>
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button type="button" disabled={busy} onClick={load}>
            Reload progress
          </Button>
        </div>
      )}
      {data?.progress.enabled &&
        data.progress.status === "new" &&
        !dismissed && (
          <GuidedTour
            step={{
              id: "welcome-introduction",
              target: "workspace",
              title: "Welcome to Travel With Ease",
              description:
                "Settle into your workspace with a guided introduction to the tools available to your role. Nothing will be sent, edited or published by this guide. Choose Next to begin, or Skip for now to return later.",
            }}
            position={1}
            total={steps.length + 1}
            busy={busy}
            onNext={() => act("start")}
            onBack={() => {}}
            onSkip={() => {
              setDismissed(true);
              act("skip");
            }}
          />
        )}
      {list && data && (
        <ul className="tutorial-list">
          {data.catalogue.map((tour) => (
            <li key={tour.id}>
              <Button
                type="button"
                disabled={busy}
                onClick={() => act("launch", { tutorialId: tour.id })}
              >
                {tour.title}
              </Button>
              <span>
                {tour.steps.every((item) =>
                  data.progress.completed.includes(item.id),
                )
                  ? "Completed"
                  : "Available"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {active && step && section === step.module && (
        <GuidedTour
          step={step}
          position={index + 1}
          total={steps.length}
          busy={busy}
          onNext={() => act("next")}
          onBack={() => act("back")}
          onSkip={() => {
            setDismissed(true);
            act("skip");
          }}
        />
      )}
      {data?.progress.status === "completed" && (
        <p role="status">
          Introduction completed. Tutorials remain available whenever you need
          them.
        </p>
      )}
    </footer>
  );
}
