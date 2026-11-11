import Stepper, { Step } from "./reactbits/Stepper.jsx";
import "../styles/components/home-journey-stepper.css";

/* Keep the CMS-authored process copy; this is presentation only. */
export default function HomeJourneyStepper({ steps = [] }) {
  if (!steps.length) return null;

  return (
    <div className="journey-process__interactive" aria-label="How planning a trip works">
      <Stepper
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
            <h3>Ready when you are.</h3>
            <p>Share your ideas and we'll help you work out your next steps.</p>
            <a className="journey-process__action" href="#plan">Plan my trip</a>
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
        {steps.map((entry, index) => (
          <Step key={index} title={entry.title}>
            <div className="journey-process__step-copy">
              <h3>{entry.title}</h3>
              <p>{entry.text}</p>
            </div>
          </Step>
        ))}
      </Stepper>
    </div>
  );
}
