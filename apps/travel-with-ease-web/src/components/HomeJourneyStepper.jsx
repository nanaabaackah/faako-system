import RichText from "./RichText.jsx";
import "../styles/components/rich-text.css";
import { useId, useRef, useState } from "react";
import Stepper, { Step } from "./reactbits/Stepper.jsx";
import "../styles/components/home-journey-stepper.css";

/* Both paths use the same approved CMS content as /how-it-works, not duplicate copy. */
const journeys = [
  { value: "package", label: "Packages" },
  { value: "planning", label: "Personal Planning" },
];

/** @param {{ flows: {package?: {steps: {heading: string, text: string}[]}, planning?: {steps: {heading: string, text: string}[]}}, copy?: Record<string,string> }} props */
export default function HomeJourneyStepper({ flows, copy = {} }) {
  const [active, setActive] = useState("package");
  const tabs = useRef([]);
  const id = useId();
  if (!flows?.package?.steps?.length || !flows?.planning?.steps?.length) return null;

  function changeFlow(value, focus = false) {
    setActive(value);
    if (focus) tabs.current[journeys.findIndex(journey => journey.value === value)]?.focus();
  }

  function handleTabKeys(event, index) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? journeys.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + journeys.length) % journeys.length;
    changeFlow(journeys[next].value, true);
  }

  return (
    <div className="journey-process__interactive" aria-label="How it works">
      <div className="journey-process__tabs" role="tablist" aria-label="Travel booking process">
        {journeys.map((journey, index) => (
          <button
            key={journey.value}
            type="button"
            id={`${id}-${journey.value}-tab`}
            role="tab"
            aria-selected={active === journey.value}
            aria-controls={`${id}-${journey.value}-panel`}
            tabIndex={active === journey.value ? 0 : -1}
            ref={element => { tabs.current[index] = element; }}
            onClick={() => changeFlow(journey.value)}
            onKeyDown={event => handleTabKeys(event, index)}
          >
            {(journey.value === "package" ? copy.packageTab : copy.planningTab) || journey.label}
          </button>
        ))}
      </div>
      {journeys.map(journey => (
        <div
          key={journey.value}
          className="journey-process__flow-panel"
          id={`${id}-${journey.value}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${journey.value}-tab`}
          tabIndex={0}
          hidden={active !== journey.value}
        >
        {active === journey.value && (
          <Stepper
            key={journey.value}
        initialStep={1}
        indicator="numbers"
        orientation="horizontal"
        transition="fade"
        theme="light"
        accentColor="#010c33"
        frame={false}
        radius={8}
        width="100%"
        backButtonText="Back"
        nextButtonText="Next"
        completeButtonText="Finish"
        completedContent={
          <div className="journey-process__finished">
            <h3>{copy.finishHeading || "Ready when you are."}</h3>
            <p>{copy.finishBody || "Share your ideas and we'll help you work out your next steps."}</p>
            <a className="journey-process__action" href="#plan">{copy.finishCta || "Plan my trip"}</a>
          </div>
        }
        style={{
          "--stepper-ink": "var(--brand-navy)",
          "--stepper-muted": "#5d6372",
          "--stepper-faint": "rgb(1 12 51 / 18%)",
          "--stepper-well": "transparent",
          "--stepper-track": "rgb(1 12 51 / 15%)",
          "--stepper-tile": "var(--brand-cream)",
          "--stepper-tile-edge": "rgb(1 12 51 / 14%)",
          "--stepper-tile-highlight": "transparent",
          "--stepper-tile-shadow": "none",
          "--stepper-solid": "var(--brand-navy)",
          "--stepper-solid-ink": "var(--brand-cream)",
          "--stepper-ring": "var(--brand-gold)",
          "--stepper-hover-fill": "rgb(1 12 51 / 5%)"
        }}
      >
        {flows[journey.value].steps.map((entry, index) => (
          <Step key={index} title={entry.heading}>
            <div className="journey-process__step-copy">
              <h3>{entry.heading}</h3>
              <RichText value={entry.text}/>
            </div>
          </Step>
        ))}
          </Stepper>
        )}
        </div>
      ))}
    </div>
  );
}
