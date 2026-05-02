import React from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageShell } from "@faako/ui";
import Layout from "../components/Layout";
import usePageTitle from "../hooks/usePageTitle";
import "../styles/pages/ErrorPage.css";

type ErrorPageProps = {
  statusCode?: "404" | "500";
  title?: string;
  message?: string;
};

const ERROR_COPY: Record<Required<ErrorPageProps>["statusCode"], {
  title: string;
  message: string;
}> = {
  "404": {
    title: "Page not found.",
    message:
      "The page may have moved, or the link may be out of date.",
  },
  "500": {
    title: "Something went wrong.",
    message:
      "We could not load this page properly. Try again from the homepage.",
  },
};

const ErrorPage: React.FC<ErrorPageProps> = ({
  statusCode = "500",
  title,
  message,
}) => {
  const copy = ERROR_COPY[statusCode];
  const resolvedTitle = title || copy.title;

  usePageTitle(`${statusCode} — ${resolvedTitle.replace(/\.$/, "")}`);

  return (
    <Layout>
      <PageShell className="error-page">
        <div className="error-page__status" aria-hidden="true">
          {statusCode}
        </div>
        <EmptyState
          className="error-page__panel"
          title={resolvedTitle}
          message={message || copy.message}
          actions={
            <>
              <Link to="/" className="ui-button ui-button--primary">
                Go home
              </Link>
              <Link to="/search" className="ui-button ui-button--secondary">
                Search the site
              </Link>
            </>
          }
        />
      </PageShell>
    </Layout>
  );
};

export default ErrorPage;
