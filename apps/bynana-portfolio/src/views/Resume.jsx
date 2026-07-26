import React, { useState } from 'react';
import Seo from '../components/Seo';
import { TickCircle } from 'iconsax-react';
import { HiArrowDown } from 'react-icons/hi2';
import ExploreMore from '../components/ExploreMore';

const stats = [
  { value: '50%+', label: 'Workflow automation across custom ERP delivery' },
  { value: '90%', label: 'Team adoption after rollout and onboarding' },
  { value: '200+', label: 'Projects supported across research + operations' },
  { value: '20+', label: 'Team members enabled through docs and office hours' },
];

const experience = [
  {
    role: 'Business Analyst',
    company: 'MTN Ghana',
    meta: 'Accra, Ghana · 2026 to Present',
    highlights: [
      'Analyze current-state business processes and identify practical opportunities for automation.',
      'Translate operational needs into clear requirements, workflow definitions, and implementation priorities.',
      'Work with business and technical stakeholders to align process changes with reliable system behavior.',
      'Support validation and adoption so automated workflows remain usable, traceable, and sustainable.',
    ],
  },
  {
    role: 'IT Technician & Front-End Developer',
    company: 'IBW Surveyors Ltd',
    meta: 'Remote · Oct 2024 to Jul 2025',
    highlights: [
      'Rebuilt internal portals with responsive UI patterns and clearer navigation.',
      'Delivered reporting workflows using BigQuery, Looker Studio, and SQL Server.',
      'Automated onboarding + document routing flows to reduce manual effort.',
      'Improved security coordination with MSP partners and reduced downtime.',
    ],
  },
  {
    role: 'Digital Experience Lead & ERP Systems Manager',
    company: 'IN Engineering + Surveying Ltd',
    meta: 'Hybrid · Sep 2022 to Oct 2024',
    highlights: [
      'Improved the company\'s full digital touchpoint ecosystem (website, intranet, ERP, client workflows), ensuring consistency, performance, and improved engagement across platforms.',
      'Conducted UX audits, refreshed content strategy, and implemented SEO improvements that increased lead generation by 10%.',
      'Managed analytics reporting and monitored user behavior to guide UI changes and workflow optimization.',
      'Led end-to-end Odoo ERP deployment and customization across five departments.',
      'Built custom modules with Python, JavaScript, QWeb, and XML for operations + finance.',
    ],
  },
];

const projectHighlights = [
  {
    name: 'Kids Party Shop + Rental Portal ERP',
    stack: 'React/Vite · Express · Prisma · PostgreSQL',
    summary:
      'Live storefront and role-aware ERP for CRM intake, POS, orders, bookings, inventory, finance, fulfillment, workforce workflows, and operational analytics.',
    image: '/imgs/projects/dashboard-case.png',
    href: '/projects/kids-party-shop-rental',
  },
  {
    name: 'Faako Platform Foundation',
    stack: 'React/Vite · Express · Shared Platform Packages',
    summary:
      'Public brand and onboarding surfaces backed by an API foundation and a shared ERP shell for future operational modules.',
    image: '/imgs/projects/erp-case.png',
    href: 'https://faako.nanaabaackah.com',
    external: true,
  },
  {
    name: 'Development Operations System',
    stack: 'React · Express · Prisma · PostgreSQL',
    summary:
      'Internal ERP for projects and tasks, proposals, intake review, rent, finance, appointments, reporting, access control, automation, audit activity, and system health.',
    image: '/imgs/10.png',
    href: '/projects/development-tracker',
  },
];

const skillGroups = [
  {
    title: 'Business Analysis + Automation',
    items: [
      'Business process analysis',
      'Requirements gathering',
      'Process mapping',
      'Workflow automation',
      'Acceptance criteria',
      'UAT coordination',
      'Stakeholder alignment',
    ],
  },
  {
    title: 'Frontend + UX',
    items: ['React', 'Vue 3', 'Tailwind CSS', 'HTML/CSS', 'Figma', 'Accessibility', 'Design systems'],
  },
  {
    title: 'Backend + Data',
    items: ['Node.js', 'Express', 'PostgreSQL', 'Prisma', 'REST APIs', 'ETL', 'SQL reporting'],
  },
  {
    title: 'ERP + Product Ops',
    items: ['Odoo.sh', 'Odoo Studio', 'Operational workflows', 'Rollout enablement', 'QA planning', 'Analytics'],
  },
  {
    title: 'AI + Delivery',
    items: ['Prompt engineering', 'LLM-assisted prototyping', 'Documentation automation', 'Testing support'],
  },
];

const certifications = [
  'Web Development with HTML, CSS, JavaScript',
  'Developing Front-End Apps with React',
  'Developing Back-End Apps with Node.js and Express',
  'Python for Data Science, AI & Development',
  'Database Management Essentials',
  'Developing AI Applications with Python and Flask',
];

const resumeMeta = [
  { label: 'Location', value: 'Accra, Ghana' },
  { label: 'Current role', value: 'Business Analyst at MTN Ghana' },
  { label: 'Focus', value: 'Business-process automation, ERP, and product engineering' },
];

const ResumeSection = ({ title, headingId, children }) => (
  <section className="resume-section" aria-labelledby={headingId} data-scroll-reveal="fadeInUp">
    <div className="resume-section__header">
      <h2 id={headingId}>{title}</h2>
    </div>
    {children}
  </section>
);

function ProjectHighlightCard({ project }) {
  const [hasError, setHasError] = useState(false);
  const showPlaceholder = !project.image || hasError;

  return (
    <article className="resume-project ui-panel">
      <div className="resume-project__media ui-media" aria-hidden="true">
        {showPlaceholder ? (
          <div className="ui-media--placeholder">
            <div>
              <strong>Add project visual</strong>
              <span>{project.name}</span>
            </div>
          </div>
        ) : (
          <img src={project.image} alt="" loading="lazy" onError={() => setHasError(true)} />
        )}
      </div>
      <div className="resume-project__content">
        <h3>{project.name}</h3>
        <p className="resume-project__stack">{project.stack}</p>
        <p>{project.summary}</p>
        <a
          className="ui-link"
          href={project.href}
          target={project.external ? '_blank' : undefined}
          rel={project.external ? 'noreferrer noopener' : undefined}
        >
          Explore project
        </a>
      </div>
    </article>
  );
}

const ResumeContent = ({ idPrefix }) => {
  const headingId = (name) => `${idPrefix}-${name}-heading`;

  return (
    <div className="resume-shell">
      <header className="resume-hero" data-scroll-reveal="fadeInUp">
        <div className="resume-hero__copy">
          <p className="ui-kicker">Resume</p>
          <h1 className="ui-heading">Business Analyst and Product Engineer improving how teams work.</h1>
          <p className="ui-copy">
            I connect process analysis, requirements, automation, product thinking, and full-stack delivery to turn
            operational friction into clearer, more reliable ways of working.
          </p>
          <div className="ui-action-row">
            <a className="ui-button ui-button--primary" href="mailto:nanaabaackah@gmail.com">
              Book a call
            </a>
            <a
              className="ui-button"
              href="/documents/Nana Aba Ackah Resume.pdf"
              target="_blank"
              rel="noreferrer noopener"
            >
              Download resume <HiArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <aside className="resume-hero__panel ui-panel">
          <div className="resume-hero__meta">
            {resumeMeta.map(({ label, value }) => (
              <div key={label} className="resume-hero__meta-item">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="resume-hero__links">
            <a href="https://www.linkedin.com/in/nana-aba-ackah/" target="_blank" rel="noreferrer noopener">
              LinkedIn
            </a>
            <a href="https://github.com/nanaabaackah/" target="_blank" rel="noreferrer noopener">
              GitHub
            </a>
          </div>
        </aside>
      </header>

      <section className="resume-stats" aria-label="Resume impact stats" data-scroll-reveal="fadeInUp">
        {stats.map(({ value, label }) => (
          <article className="resume-stat ui-panel" key={label}>
            <span>{value}</span>
            <p>{label}</p>
          </article>
        ))}
      </section>

      <ResumeSection headingId={headingId('experience')} title="Experience">
        <div className="resume-experience">
          {experience.map(({ role, company, meta, highlights }) => (
            <article className="resume-role ui-panel" key={`${company}-${role}`}>
              <div className="resume-role__header">
                <p>{meta}</p>
                <h3>{company}</h3>
                <span>{role}</span>
              </div>
              <ul>
                {highlights.map((highlight) => (
                  <li key={`${company}-${highlight}`}>{highlight}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </ResumeSection>

      <ResumeSection headingId={headingId('projects')} title="Selected Builds">
        <div className="resume-project-grid">
          {projectHighlights.map((project) => (
            <ProjectHighlightCard key={project.name} project={project} />
          ))}
        </div>
      </ResumeSection>

      <ResumeSection headingId={headingId('skills')} title="Technical Toolkit">
        <div className="resume-skills-grid">
          {skillGroups.map(({ title, items }) => (
            <article className="resume-skill ui-panel" key={title}>
              <h3>{title}</h3>
              <ul className="ui-chip-row">
                {items.map((item) => (
                  <li className="ui-chip" key={`${title}-${item}`}>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </ResumeSection>

      <ResumeSection headingId={headingId('certs')} title="Certifications">
        <div className="resume-cert-grid">
          {certifications.map((name) => (
            <article className="resume-cert ui-panel" key={name}>
              <TickCircle size={18} variant="Bold" aria-hidden="true" />
              <span>{name}</span>
            </article>
          ))}
        </div>
      </ResumeSection>

      <section className="resume-cta ui-panel" data-scroll-reveal="fadeInUp">
        <h2>Let&apos;s collaborate</h2>
        <p>
          Have a workflow-heavy product to ship? I work with founders, ops leaders, and product teams to move from messy
          process to measurable outcomes.
        </p>
        <div className="ui-action-row">
          <a className="ui-button ui-button--primary" href="mailto:nanaabaackah@gmail.com">
            Email me
          </a>
          <a
            className="ui-button"
            href="/documents/Nana Aba Ackah Resume.pdf"
            target="_blank"
            rel="noreferrer noopener"
          >
            Save PDF
          </a>
        </div>
      </section>
    </div>
  );
};

function Resume({ embedded = false, sectionId }) {
  const WrapperTag = embedded ? 'section' : 'main';
  const desktopSectionProps = embedded ? { className: 'section-back-desktop' } : { id: 'sec_back-desktop' };

  return (
    <>
      <WrapperTag
        id={sectionId || (!embedded ? 'main-content' : undefined)}
        tabIndex={!embedded ? '-1' : undefined}
        className="resume-page"
      >
        {!embedded && (
          <Seo
            title="Resume | By Nana"
            description="Experience, skills, and selected work across business analysis, business-process automation, product engineering, and ERP systems."
          />
        )}
        <section {...desktopSectionProps}>
          <div className="who">
            <ResumeContent idPrefix="desktop" />
          </div>
        </section>

        {!embedded && <ExploreMore current="resume" />}
      </WrapperTag>
    </>
  );
}

export default Resume;
