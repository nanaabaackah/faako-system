import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  DEMO_SCENARIO_OPTIONS,
  getDemoScenarioById,
} from "../data/demoScenarios.js";
import { createDemoAccessApi } from "../api/demoAccess.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_ACCESS_MODE = String(
  import.meta.env.VITE_FAAKO_ERP_DEMO_ACCESS_MODE || "api",
).trim().toLowerCase();
const DEMO_ACCESS_ENDPOINT = String(
  import.meta.env.VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT || "/api/demo-access",
).trim();
const demoAccessApi = createDemoAccessApi({
  endpoint: DEMO_ACCESS_ENDPOINT,
  mode: DEMO_ACCESS_MODE,
});

const getApiError = (fallback) => {
  if (fallback instanceof Error && fallback.message) {
    return fallback.message;
  }

  return fallback || "Something went wrong. Please try again.";
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export default function DemoAccessGate() {
  const { grantAccess, isAuthed, demoScenarioId, setDemoScenarioId } = useAuth();
  const emailInputRef = useRef(null);
  const codeInputRef = useRef(null);
  const previousAuthedRef = useRef(isAuthed);
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("email");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const activeScenario = getDemoScenarioById(demoScenarioId);
  const featuredModules = activeScenario.modules.featuredModules.slice(0, 6);

  useEffect(() => {
    if (previousAuthedRef.current && !isAuthed) {
      setStep("request");
      setEmail("");
      setCode("");
      setChallengeToken("");
      setFeedback("");
      setError("");
      setDeliveryMode("email");
    }

    previousAuthedRef.current = isAuthed;
  }, [isAuthed]);

  useEffect(() => {
    if (isAuthed) {
      document.body.style.removeProperty("overflow");
      return undefined;
    }

    document.body.style.setProperty("overflow", "hidden");

    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [isAuthed]);

  useEffect(() => {
    if (isAuthed) {
      return;
    }

    if (step === "request") {
      emailInputRef.current?.focus();
      return;
    }

    codeInputRef.current?.focus();
  }, [isAuthed, step]);

  if (isAuthed) {
    return null;
  }

  const resetVerification = () => {
    setStep("request");
    setCode("");
    setChallengeToken("");
    setDeliveryMode("email");
    setError("");
    setFeedback("");
  };

  const handleRequestCode = async (event) => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address to receive the access code.");
      return;
    }

    setIsRequesting(true);
    setError("");
    setFeedback("");

    try {
      const result = await demoAccessApi.submit({
        action: "request",
        email: normalizedEmail,
      });

      setEmail(normalizedEmail);
      setChallengeToken(result.challengeToken || "");
      setDeliveryMode(result.deliveryMode || "email");
      setFeedback(
        result.message ||
          `A 6-digit access code has been prepared for ${normalizedEmail}.`,
      );
      setCode("");
      setStep("verify");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyCode = async (event) => {
    event.preventDefault();

    if (!challengeToken) {
      setError("Request a fresh access code before trying to verify.");
      return;
    }

    const normalizedCode = String(code || "").trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("Enter the 6-digit access code from your email.");
      return;
    }

    setIsVerifying(true);
    setError("");
    setFeedback("");

    try {
      const result = await demoAccessApi.submit({
        action: "verify",
        email: normalizeEmail(email),
        code: normalizedCode,
        challengeToken,
      });

      if (!result?.session?.email || !result?.session?.expiresAt) {
        throw new Error("The demo access session could not be created.");
      }

      grantAccess({ ...result.session, scenarioId: demoScenarioId });
    } catch (verifyError) {
      setError(getApiError(verifyError));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      aria-labelledby="faako-demo-access-title"
      aria-modal="true"
      className="demo-access-overlay"
      role="dialog"
    >
      <div className="demo-access-backdrop" />
      <section className="panel glass-card demo-access-modal">
        <div className="demo-access-lead">
          <p className="eyebrow">Live ERP demo</p>
          <h1 id="faako-demo-access-title">Request access to the Faako ERP walkthrough</h1>
          <p className="muted demo-access-copy">
            Choose the business use case you want to explore, then enter your
            email and we will send a generated 6-digit access code so visitors
            can unlock the live demo from the same page.
          </p>

          <div className="demo-scenario-picker">
            <p className="table-strong">Choose a use case</p>
            <div className="demo-scenario-options">
              {DEMO_SCENARIO_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`demo-scenario-option ${demoScenarioId === opt.id ? "is-active" : ""}`}
                  onClick={() => setDemoScenarioId(opt.id)}
                  style={{ "--demo-scenario-accent": opt.accentPreview }}
                  type="button"
                >
                  <span className="demo-scenario-option__label">{opt.label}</span>
                  <span className="demo-scenario-option__desc muted">{opt.description}</span>
                  <span className="demo-scenario-option__modules">
                    {opt.sampleModules.join(" - ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="demo-access-module-pills">
            {featuredModules.map((module) => (
              <span className="status-pill" key={module.id}>
                {module.title}
              </span>
            ))}
          </div>

          <div className="demo-access-benefits">
            <article className="demo-access-benefit">
              <div className="table-strong">Important modules are already staged</div>
              <p className="muted">
                {activeScenario.description}
              </p>
            </article>
            <article className="demo-access-benefit">
              <div className="table-strong">One shell, multiple business stories</div>
              <p className="muted">
                Shared navigation, cards, forms, and responsive behavior stay in
                place while the theme and live records adapt to the selected use case.
              </p>
            </article>
          </div>
        </div>

        <div className="demo-access-panel">
          {step === "request" ? (
            <form className="demo-access-form" onSubmit={handleRequestCode}>
              <div className="field">
                <label htmlFor="demo-access-email">Work email</label>
                <input
                  ref={emailInputRef}
                  autoComplete="email"
                  id="demo-access-email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                />
              </div>

              {error ? (
                <div className="demo-access-feedback is-danger">{error}</div>
              ) : null}

              <button
                className="button button-primary demo-access-submit"
                disabled={isRequesting}
                type="submit"
              >
                {isRequesting ? "Sending code..." : "Send access code"}
              </button>

              <p className="muted demo-access-footnote">
                The code expires quickly and only unlocks this demo workspace.
              </p>
            </form>
          ) : (
            <form className="demo-access-form" onSubmit={handleVerifyCode}>
              <div className="field">
                <label htmlFor="demo-access-code">Enter your access code</label>
                <input
                  ref={codeInputRef}
                  autoComplete="one-time-code"
                  id="demo-access-code"
                  inputMode="numeric"
                  maxLength={6}
                  name="code"
                  onChange={(event) =>
                    setCode(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  type="text"
                  value={code}
                />
              </div>

              <div className="demo-access-email-chip">
                Code requested for <span>{email}</span>
              </div>

              {feedback ? (
                <div className="demo-access-feedback is-info">{feedback}</div>
              ) : null}

              {deliveryMode !== "email" ? (
                <p className="muted demo-access-footnote">
                  The access code is delivered outside this browser session.
                </p>
              ) : null}

              {error ? (
                <div className="demo-access-feedback is-danger">{error}</div>
              ) : null}

              <button
                className="button button-primary demo-access-submit"
                disabled={isVerifying}
                type="submit"
              >
                {isVerifying ? "Unlocking demo..." : "Unlock demo"}
              </button>

              <div className="demo-access-actions">
                <button
                  className="button button-ghost"
                  disabled={isRequesting}
                  onClick={handleRequestCode}
                  type="button"
                >
                  Resend code
                </button>
                <button
                  className="button button-ghost"
                  onClick={resetVerification}
                  type="button"
                >
                  Use another email
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
