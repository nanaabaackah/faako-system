import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import '../styles/pages/Projects.css';

const projects = [
  {
    title: 'Kids Party Shop + Rental Portal ERP',
    summary:
      'Split kids party shop and rental business stack with a public storefront, CRM-backed contact intake, POS/order builder, admin portal, Express API backend, and PostgreSQL data model.',
    stack: 'React · Vite · Express API · PostgreSQL',
    impact: 'Live website + portal',
    href: '/projects/kids-party-shop-rental',
    image: '/imgs/mockups/reebs/REEBS_1.png',
    badge: 'Website + Portal',
    track: 'flagship',
    cta: 'View case study',
  },
  {
    title: 'Odoo ERP Customization',
    summary: 'Automated cross-department workflows with Python, QWeb, and XML.',
    stack: 'Python · Odoo · QWeb · XML',
    impact: '50% workflow gain',
    href: '/projects/odoo',
    image: '/imgs/mockups/ineng/INENG_1.png',
    badge: 'ERP System',
    track: 'enablement',
    cta: 'Read case',
  },
  {
    title: 'Intranet Website Redesign',
    summary:
      'Unified intranet redesign that also embedded an internal learning system for onboarding and self-serve training.',
    stack: 'Google Sites · HTML/CSS · Figma',
    impact: 'UX refresh',
    href: '/projects/reconstruction',
    image: '/imgs/mockups/ibw/IBW_1.png',
    badge: 'UX refresh',
    track: 'ux_refresh',
    cta: 'Open project',
  },
  {
    title: 'Development Operations System (Dev ERP)',
    summary:
      'Internal operations portal for registry-driven modules, proposals, rent, accounting, invoicing, appointments, reports, access control, alerts, and system health.',
    stack: 'React · Express · Prisma · PostgreSQL',
    impact: 'Ops + finance portal',
    href: '/projects/development-tracker',
    image: '/imgs/mockups/dev/DEV_2.png',
    badge: 'Dev ERP',
    track: 'systems',
    cta: 'View case study',
  },
  {
    title: 'Portfolio Website (React)',
    summary: 'Open-source portfolio with case studies, animation, and accessibility-first structure.',
    stack: 'React · Vite · CSS3',
    impact: 'Case + repo',
    href: '/projects/portfolio',
    image: '/imgs/mockups/portfolio/PORTFOLIO_6.png',
    badge: 'Web Development',
    track: 'public',
    cta: 'View case study',
  },
];

function ProjectVisual({ project }) {
  const [hasError, setHasError] = useState(false);
  const showPlaceholder = !project.image || hasError;

  if (showPlaceholder) {
    return (
      <div className="projects-marquee__visual" aria-hidden="true">
        <div className="projects-marquee__placeholder">
          <div>
            <strong>Add project image</strong>
            <span>{project.title}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-marquee__visual" aria-hidden="true">
      <img
        className="projects-marquee__image"
        src={project.image}
        alt=""
        loading="lazy"
        onError={() => setHasError(true)}
      />
      <div className="projects-marquee__hover-frame">
        <img className="projects-marquee__hover-image" src={project.image} alt="" loading="lazy" />
      </div>
    </div>
  );
}

const ProjectCard = ({ project, clone = false }) => {
  const { title, href, badge, external, cta } = project;
  const LinkComponent = external ? 'a' : Link;
  const linkProps = external
    ? { href, target: '_blank', rel: 'noreferrer noopener' }
    : { to: href };

  return (
    <li className="projects-marquee__item" role={clone ? undefined : 'listitem'}>
      <LinkComponent
        className="projects-marquee__link"
        {...linkProps}
        aria-label={clone ? undefined : `${title} - ${cta}`}
        tabIndex={clone ? -1 : undefined}
      >
        <ProjectVisual project={project} />
        <div className="projects-marquee__caption">
          <span className="projects-marquee__title">{title}</span>
          {badge && <span className="projects-marquee__badge">{badge}</span>}
        </div>
      </LinkComponent>
    </li>
  );
};

const ProjectMarquee = () => (
  <section className="projects-marquee" aria-label="Featured projects carousel" data-scroll-reveal="fadeInUp">
    <div className="projects-marquee__track">
      <ul className="projects-marquee__group">
        {projects.map((project) => (
          <ProjectCard key={`primary-${project.title}`} project={project} />
        ))}
      </ul>
      <ul className="projects-marquee__group projects-marquee__group--clone" aria-hidden="true">
        {projects.map((project) => (
          <ProjectCard key={`clone-${project.title}`} project={project} clone />
        ))}
      </ul>
    </div>
  </section>
);

const ProjectsContent = () => (
  <div className="projects-showcase">

    <div className="projects-showcase__center">
      <p className="projects-showcase__count">[{projects.length} FEATURED PROJECTS]</p>
    </div>
    
    <ProjectMarquee />
  </div>
);

function Projects({ embedded = false, sectionId }) {
  const WrapperTag = embedded ? 'section' : 'main';

  return (
    <>
      <WrapperTag
        id={sectionId || (!embedded ? 'main-content' : undefined)}
        tabIndex={!embedded ? '-1' : undefined}
        className="projects-page"
      >
        {!embedded && (
          <Seo
            title="Projects | By Nana"
            description="Selected case studies by Nana Aba across ERP systems, internal tools, and product engineering."
            path="/projects"
          />
        )}

        <ProjectsContent />
      </WrapperTag>
    </>
  );
}

export default Projects;
