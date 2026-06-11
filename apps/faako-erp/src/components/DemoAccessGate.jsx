import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  DEMO_SCENARIO_OPTIONS,
  getDemoScenarioById,
} from "../data/demoScenarios.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_ACCESS_MODE = String(
  import.meta.env.VITE_FAAKO_ERP_DEMO_ACCESS_MODE || "local",
).trim().toLowerCase();
const DEMO_ACCESS_ENDPOINT = String(
  import.meta.env.VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT || "/api/demo-access",
).trim();
const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getApiError = (fallback) => {
  if (fallback instanceof Error && fallback.message) {
    return fallback.message;
  }

  return fallback || "Something went wrong. Please try again.";
};

const parseApiResponse = async (response) => {
  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok || !payload?.ok) {
    if (payload?.error) {
      throw new Error(payload.error);
    }

    throw new Error("Unable to complete the demo access request right now.");
  }

  return payload;
};

const createPreviewCode = () => {
  const randomValues = new Uint32Array(1);
  window.crypto?.getRandomValues?.(randomValues);
  const randomNumber = randomValues[0] || Math.floor(Math.random() * 1_000_000);
  return String(randomNumber % 1_000_000).padStart(6, "0");
};

const encodeLocalChallenge = (payload) => window.btoa(JSON.stringify(payload));

const decodeLocalChallenge = (token) => {
  try {
    return JSON.parse(window.atob(token));
  } catch {
    return null;
  }
};

const resolveLocalDemoAccess = (payload) => {
  const email = normalizeEmail(payload?.email);

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address to receive the access code.");
  }

  if (payload?.action === "request") {
    const code = createPreviewCode();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

    return {
      ok: true,
      challengeToken: encodeLocalChallenge({ email, code, expiresAt }),
      previewCode: code,
      deliveryMode: "preview",
      message: `Preview access code generated for ${email}.`,
    };
  }

  if (payload?.action === "verify") {
    const challenge = decodeLocalChallenge(String(payload?.challengeToken || ""));
    const submittedCode = String(payload?.code || "").trim();

    if (
      !challenge ||
      challenge.email !== email ||
      challenge.code !== submittedCode ||
      Date.parse(challenge.expiresAt) <= Date.now()
    ) {
      throw new Error("The access code is invalid or expired. Request a fresh code and try again.");
    }

    return {
      ok: true,
      session: {
        email,
        accessToken: encodeLocalChallenge({ email, grantedAt: Date.now() }),
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      },
    };
  }

  throw new Error("Unsupported demo access action.");
};

const postDemoAccess = async (payload) => {
  if (DEMO_ACCESS_MODE === "local") {
    return resolveLocalDemoAccess(payload);
  }

  const response = await fetch(DEMO_ACCESS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse(response);
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
  const [previewCode, setPreviewCode] = useState("");
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
      setPreviewCode("");
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
    setPreviewCode("");
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
      const result = await postDemoAccess({
        action: "request",
        email: normalizedEmail,
      });

      setEmail(normalizedEmail);
      setChallengeToken(result.challengeToken || "");
      setPreviewCode(result.previewCode || "");
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
      const result = await postDemoAccess({
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

              {previewCode ? (
                <div className="demo-access-feedback is-preview">
                  Preview code for this environment: <strong>{previewCode}</strong>
                </div>
              ) : null}

              {deliveryMode === "preview" ? (
                <p className="muted demo-access-footnote">
                  Email delivery is not configured here, so the function returned
                  a preview code for testing instead.
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
