import { useEffect, useId, useRef, useState } from "react";

export interface GuidedTourStep {
  id: string;
  target: string;
  title: string;
  description: string;
}

/** Presentation only: the host owns navigation, permission filtering and persistence. */
export function GuidedTour({
  step,
  position,
  total,
  busy,
  onNext,
  onBack,
  onSkip,
}: {
  step: GuidedTourStep;
  position: number;
  total: number;
  busy?: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLElement>(null);
  const [found, setFound] = useState(false);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, [step.id]);
  useEffect(() => {
    let target: HTMLElement | null = null;
    const locate = () => {
      const next = /^[a-z0-9-]+$/.test(step.target)
        ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
        : null;
      const visible = next && next.getClientRects().length > 0 ? next : null;
      if (target === visible) return;
      target?.classList.remove("faako-tour-target");
      target = visible;
      setFound(Boolean(target));
      target?.classList.add("faako-tour-target");
      target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    };
    setFound(false);
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", locate);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", locate);
      target?.classList.remove("faako-tour-target");
    };
  }, [step.id, step.target]);
  return (
    <section
      ref={panel}
      className="faako-guided-tour"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) {
          event.stopPropagation();
          onSkip();
        }
      }}
    >
      <p className="faako-tour-position" aria-live="polite">
        Step {position} of {total}
      </p>
      <h2 id={titleId}>{step.title}</h2>
      <p id={descriptionId}>{step.description}</p>
      {!found && (
        <p className="faako-tour-unavailable">
          This control is not currently visible. You can continue or pause the
          guide; no action is required.
        </p>
      )}
      <div className="faako-tour-actions">
        <button type="button" disabled={busy || position <= 1} onClick={onBack}>
          Back
        </button>
        <button type="button" disabled={busy} onClick={onSkip}>
          Skip for now
        </button>
        <button type="button" disabled={busy} onClick={onNext}>
          {position === total ? "Finish" : "Next"}
        </button>
      </div>
    </section>
  );
}
