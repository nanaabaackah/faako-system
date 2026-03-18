import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import NotFound from "./NotFound.jsx";
import { caseStudies } from "../data/caseStudies.js";
import "../styles/pages/CaseStudyDetail.css";

export default function CaseStudyDetail() {
  const { slug } = useParams();
  const caseStudy = caseStudies.find((item) => item.slug === slug);

  if (!caseStudy) {
    return <NotFound />;
  }

  const heroStats = caseStudy.stats.slice(0, 2);

  const snapshotValue = (label, fallback) =>
    caseStudy.snapshot.items.find((item) =>
      item.label.toLowerCase().includes(label.toLowerCase())
    )?.value || fallback;

  const projectMeta = [
    { label: "Published", value: "February 11, 2026" },
    { label: "Category", value: caseStudy.tag },
    {
      label: "Industry",
      value: snapshotValue("industry", "Digital operations"),
    },
    {
      label: "Website",
      value: "www.faako.nanaabaackah.com",
    },
  ];

  const relatedCaseStudies = caseStudies.filter(
    (item) => item.slug !== caseStudy.slug
  );

  return (
    <section className="page case-detail-page page-stack">
      <header className="case-detail-hero-block reveal" style={{ "--delay": "0ms" }}>
        <div className="case-detail-hero-main">
          <p className="case-detail-kicker">
            {caseStudy.hero.eyebrow} · {caseStudy.tag}
          </p>
          <h1>{caseStudy.hero.headline}</h1>
          <div className="case-detail-hero-stats">
            {heroStats.map((stat, index) => (
              <article className="case-detail-hero-stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <h3>{stat.label}</h3>
                <p>
                  {caseStudy.challenge.points[index]?.text ||
                    caseStudy.solution.points[index]?.text}
                </p>
              </article>
            ))}
          </div>
          <div className="case-detail-top-actions">
            <PrimaryButton to={caseStudy.hero.primaryCta.to}>
              {caseStudy.hero.primaryCta.label}
            </PrimaryButton>
            <Link className="button button-ghost" to="/case-studies">
              Back to case studies
            </Link>
          </div>
        </div>

        <figure className="case-detail-hero-visual">
          <img src={caseStudy.hero.image} alt={caseStudy.hero.imageAlt} />
        </figure>
      </header>

      <section className="case-detail-body">
        <aside className="case-detail-profile card reveal" style={{ "--delay": "80ms" }}>
          <h2>{caseStudy.title}</h2>
          <p>{caseStudy.summary}</p>
          <ul className="case-detail-profile-list">
            {projectMeta.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        </aside>

        <article className="case-detail-article reveal" style={{ "--delay": "120ms" }}>
          <section className="case-detail-article-intro">
            <blockquote>"{caseStudy.quote.text}"</blockquote>
            <p>
              {caseStudy.quote.name} · {caseStudy.quote.role}
            </p>
          </section>

          <section className="case-detail-article-section">
            <p className="eyebrow">Challenge</p>
            <h2>{caseStudy.challenge.title}</h2>
            <p>{caseStudy.challenge.lead}</p>
            {caseStudy.challenge.points.map((point) => (
              <p key={point.label}>
                <strong>{point.label}: </strong>
                {point.text}
              </p>
            ))}
          </section>

          <aside className="case-detail-callout">
            <p>
              "{caseStudy.solution.lead} {caseStudy.workflow.lead}"
            </p>
          </aside>

          <section className="case-detail-article-section">
            <p className="eyebrow">Solution</p>
            <h2>{caseStudy.solution.title}</h2>
            <p>{caseStudy.solution.lead}</p>
            {caseStudy.solution.points.map((point) => (
              <p key={point.label}>
                <strong>{point.label}: </strong>
                {point.text}
              </p>
            ))}
          </section>

          <section className="case-detail-article-section">
            <p className="eyebrow">Results</p>
            <h2>{caseStudy.outcomes.title}</h2>
            <div className="case-detail-results-grid">
              {caseStudy.outcomes.stats.map((stat) => (
                <div className="case-detail-result-item" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="case-detail-article-section">
            <p className="eyebrow">Key features</p>
            <h2>{caseStudy.features.title}</h2>
            <div className="case-detail-feature-rows">
              {caseStudy.features.items.map((feature) => (
                <article className="case-detail-feature-row" key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="case-detail-article-section">
            <p className="eyebrow">Tools</p>
            <div className="case-detail-tool-list">
              {caseStudy.tools.items.map((tool) => (
                <span className="case-detail-tool" key={tool}>
                  {tool}
                </span>
              ))}
            </div>
            <div className="case-detail-inline-actions">
              <PrimaryButton to="/contact">Start a similar project</PrimaryButton>
              <Link className="button button-ghost" to={caseStudy.hero.secondaryCta.to}>
                {caseStudy.hero.secondaryCta.label}
              </Link>
            </div>
          </section>
        </article>
      </section>

      <section className="case-detail-related section-seam-top">
        <div className="section-header reveal">
          <p className="eyebrow">More Stories</p>
          <h2>Explore another case study.</h2>
        </div>
        <div className="case-detail-related-grid">
          {relatedCaseStudies.map((item, index) => (
            <article
              key={item.slug}
              className="case-detail-related-card reveal"
              style={{ "--delay": `${index * 120}ms` }}
            >
              <div className="case-detail-related-image">
                <img src={item.thumbnail} alt={item.title} />
              </div>
              <div className="case-detail-related-copy">
                <span className="case-detail-related-tag">{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <Link to={`/case-studies/${item.slug}`} className="text-link">
                  View project <FontAwesomeIcon icon={faArrowRight} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
