import React from "react";
import { Link } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import "../styles/ErrorPage.css";

type ErrorPageProps = {
  statusCode?: "404" | "500";
  title?: string;
  message?: string;
};

const ERROR_COPY: Record<Required<ErrorPageProps>["statusCode"], {
  title: string;
  message: string;
  eyebrow: string;
}> = {
  "404": {
    eyebrow: "Page Not Found",
    title: "We can't find that page.",
    message:
      "The link may be out of date, or the page may have moved. Try one of these instead, or head back to the homepage.",
  },
  "500": {
    eyebrow: "Something Broke",
    title: "Something went wrong on our side.",
    message:
      "We couldn't load this page properly. Try refreshing, or head back to a known-good page below.",
  },
};

const HELPFUL_LINKS = [
  { label: "Services", to: "/services", hint: "Audits, HACCP, training, FDA support" },
  { label: "Shop", to: "/shop", hint: "Thermometers, supplies, records" },
  { label: "Resources", to: "/resources", hint: "Guides, FAQs, and standards" },
  { label: "Contact", to: "/contact", hint: "Send a message or book a consultation" },
];

const ErrorPage: React.FC<ErrorPageProps> = ({
  statusCode = "500",
  title,
  message,
}) => {
  const copy = ERROR_COPY[statusCode];
  const resolvedTitle = title || copy.title;
  const resolvedMessage = message || copy.message;
  const digits = statusCode.split("");

  useSEOMeta({
    title: `${statusCode} — ${resolvedTitle.replace(/\.$/, "")} | Stroane`,
    description: "Page not available.",
    noIndex: true,
  });

  return (
    <Layout>
      <div className="error-page">
        <div className="error-page__inner">
          {/* Left — oversized digits */}
          <div className="error-page__visual" aria-hidden="true">
            <div className="error-page__digits">
              {digits.map((digit, i) => (
                <span
                  key={i}
                  className={`error-page__digit error-page__digit--${i}`}
                  data-digit={digit}
                >
                  {digit}
                </span>
              ))}
            </div>
            <div className="error-page__dots">
              <span />
              <span />
              <span />
            </div>
          </div>

          {/* Right — copy + actions */}
          <div className="error-page__content">
            <span className="error-page__eyebrow">{copy.eyebrow}</span>
            <h1 className="error-page__title">{resolvedTitle}</h1>
            <p className="error-page__message">{resolvedMessage}</p>

            <div className="error-page__actions">
              <Link to="/" className="error-page__btn error-page__btn--primary">
                Go home
                <HiArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/search" className="error-page__btn error-page__btn--ghost">
                Search the site
              </Link>
            </div>

            <div className="error-page__helpful">
              <span className="error-page__helpful-label">Or try one of these</span>
              <ul>
                {HELPFUL_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to}>
                      <div>
                        <strong>{link.label}</strong>
                        <span>{link.hint}</span>
                      </div>
                      <HiArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ErrorPage;
