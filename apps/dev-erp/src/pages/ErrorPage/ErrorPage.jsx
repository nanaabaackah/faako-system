import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { hasStoredSession } from "../../utils/authSession";

const ErrorPage = ({ code, title, message }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isNotFound = code === "404";
  const requestPath = location.pathname !== "/error" ? location.pathname : "";
  const hasActiveSession = hasStoredSession();
  const primaryHref = hasActiveSession ? "/dashboard" : "/login";
  const primaryLabel = hasActiveSession ? "Go home" : "Go to login";
  const displayTitle = isNotFound ? "Page not found" : title;
  const barcodeBars = Array.from({ length: 18 }, (_, index) => index + 1);

  return (
    <section className="error-page" aria-labelledby="error-page-title">
      <div className="error-page__section">
        <div className="error-page__mark" aria-hidden="true">
          <div className="error-page__barcode">
            {barcodeBars.map((bar) => <span key={bar} />)}
          </div>
          <p className="error-page__label">Error</p>
        </div>

        <div className="error-page__copy">
          <p className="error-page__code">{code}</p>
          <h1 id="error-page-title">{displayTitle}</h1>
          {isNotFound && requestPath ? (
            <p className="error-page__path">
              Missing route <span>{requestPath}</span>
            </p>
          ) : null}
          {!isNotFound ? <p className="error-page__message">{message}</p> : null}
          <div className="error-page__actions">
            <Link className="button button-primary" to={primaryHref}>
              {primaryLabel} <span aria-hidden="true">→</span>
            </Link>
            <button
              className="error-page__back"
              type="button"
              onClick={() => navigate(-1)}
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

ErrorPage.defaultProps = {
  code: "500",
  title: "Something went wrong.",
  message: "The page could not be loaded right now. Try again or head back to a safe route.",
};

export default ErrorPage;
