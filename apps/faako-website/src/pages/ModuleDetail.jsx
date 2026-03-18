import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import NotFound from "./NotFound.jsx";
import { getModuleById, moduleShowcaseItems } from "../data/modules.js";
import "../styles/pages/ModuleDetail.css";

export default function ModuleDetail() {
  const { moduleId } = useParams();
  const module = getModuleById(moduleId);

  if (!module) {
    return <NotFound />;
  }

  const relatedModules = moduleShowcaseItems
    .filter((item) => item.id !== module.id)
    .slice(0, 3);

  return (
    <section className="page module-detail-page module-detail-page--v2 page-stack">
      <header className="module-detail-hero reveal" data-scroll style={{ "--delay": "0ms" }}>
        <Link className="module-detail-back text-link" to="/solutions">
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to modules
        </Link>

        <div className="module-detail-hero-main">
          <span className="module-detail-icon" aria-hidden="true">
            <FontAwesomeIcon icon={module.icon} />
          </span>
          <p className="eyebrow">{module.kicker} Module</p>
          <h1>{module.title}</h1>
          <p className="lead">{module.detailSummary}</p>
          <div className="module-detail-actions">
            <PrimaryButton to="/contact">Talk to us about this feature</PrimaryButton>
            <Link to="/configure" className="button button-ghost">
              Build your setup
            </Link>
          </div>
        </div>

        <div className="module-detail-stats">
          {module.metrics.map((metric) => (
            <article className="module-detail-stat reveal" data-scroll key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </article>
          ))}
        </div>
      </header>

      <section className="module-detail-snapshot reveal" data-scroll style={{ "--delay": "60ms" }}>
        <article className="module-detail-snapshot-card">
          <p className="eyebrow">Expected Outcome</p>
          <h2>{module.outcome || "Faster operations with clearer team visibility."}</h2>
        </article>
        <article className="module-detail-snapshot-card module-detail-snapshot-card--soft">
          <p className="eyebrow">Implementation Fit</p>
          <p>
            This feature is ideal when you want clear improvements without replacing everything at once.
          </p>
        </article>
      </section>

      <section className="module-detail-body">
        <article className="module-detail-panel reveal" data-scroll style={{ "--delay": "80ms" }}>
          <p className="eyebrow">What It Solves</p>
          <h2>From daily stress to clear progress</h2>
          <div className="module-detail-problem-grid">
            <div className="module-detail-problem-card module-detail-problem-card--issue">
              <h3>Current challenge</h3>
              <p>{module.problem}</p>
            </div>
            <div className="module-detail-problem-card module-detail-problem-card--value">
              <h3>What improves</h3>
              <p>{module.value}</p>
            </div>
          </div>
        </article>

        <article className="module-detail-panel reveal" data-scroll style={{ "--delay": "120ms" }}>
          <p className="eyebrow">Capabilities</p>
          <h2>What your team can do</h2>
          <div className="module-detail-feature-grid">
            {module.capabilities.map((capability) => (
              <article className="module-detail-feature-card" key={capability.title}>
                <h3>{capability.title}</h3>
                <p>{capability.text}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="module-detail-panel reveal" data-scroll style={{ "--delay": "160ms" }}>
          <p className="eyebrow">Daily flow</p>
          <h2>How it runs day to day</h2>
          <ol className="module-detail-workflow">
            {module.workflows.map((step) => (
              <li key={step}>
                <FontAwesomeIcon icon={faCheckCircle} />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="module-detail-panel reveal" data-scroll style={{ "--delay": "200ms" }}>
          <p className="eyebrow">Scope</p>
          <h2>What is included</h2>
          <div className="module-detail-tag-list">
            {module.includes.map((item) => (
              <span className="module-detail-tag" key={item}>
                <FontAwesomeIcon icon={faCheck} />
                {item}
              </span>
            ))}
          </div>

          <h3>Integrates with</h3>
          <div className="module-detail-tag-list module-detail-tag-list--soft">
            {module.integrations.map((item) => (
              <span className="module-detail-tag module-detail-tag--soft" key={item}>
                {item}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="module-detail-related reveal" data-scroll style={{ "--delay": "240ms" }}>
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Related Modules</p>
          <h2>Add connected features as you grow.</h2>
        </div>

        <div className="module-detail-related-grid">
          {relatedModules.map((item) => (
            <Link key={item.id} to={`/modules/${item.id}`} className="module-detail-related-card">
              <span className="module-detail-related-icon">
                <FontAwesomeIcon icon={item.icon} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="module-detail-related-link">
                View module <FontAwesomeIcon icon={faArrowRight} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
