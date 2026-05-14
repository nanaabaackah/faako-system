import React from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import "../styles/components/LegalLayout.css";

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

interface Props {
  title: string;
  lastUpdated: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}

const LegalLayout: React.FC<Props> = ({ title, lastUpdated, intro, sections }) => {
  return (
    <Layout>
      <div className="legal-page">
        <header className="legal-page__header">
          <div className="legal-page__header-inner">
            <nav className="legal-page__crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span>{title}</span>
            </nav>
            <h1 className="legal-page__title">{title}</h1>
            <p className="legal-page__updated">
              Last updated: <time>{lastUpdated}</time>
            </p>
          </div>
        </header>

        <div className="legal-page__body">
          <article className="legal-page__inner">
            {intro ? <div className="legal-page__intro">{intro}</div> : null}

            <nav className="legal-page__toc" aria-label="On this page">
              <span className="legal-page__toc-label">On this page</span>
              <ol>
                {sections.map((s, i) => (
                  <li key={s.heading}>
                    <a href={`#section-${i + 1}`}>{s.heading}</a>
                  </li>
                ))}
              </ol>
            </nav>

            {sections.map((s, i) => (
              <section
                key={s.heading}
                id={`section-${i + 1}`}
                className="legal-page__section"
              >
                <h2>
                  <span className="legal-page__section-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.heading}
                </h2>
                <div className="legal-page__section-body">{s.body}</div>
              </section>
            ))}

            <footer className="legal-page__footer">
              <p>
                Have a question about this policy?{" "}
                <Link to="/contact">Contact us</Link>.
              </p>
            </footer>
          </article>
        </div>
      </div>
    </Layout>
  );
};

export default LegalLayout;
