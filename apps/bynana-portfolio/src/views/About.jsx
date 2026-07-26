import React from 'react';
import { Link } from 'react-router-dom';
import { HiArrowUpRight } from 'react-icons/hi2';
import Seo from '../components/Seo';
import ExploreMore from '../components/ExploreMore';
import '../styles/pages/About.css';

const SERVICES = [
  'Business analysis and requirements definition',
  'Business process mapping and automation',
  'ERP implementation and customization',
  'Digital experience strategy (web + intranet + client workflows)',
  'Frontend product development',
  'API integrations and reporting systems',
  'UX audits, content refinement, and SEO improvements',
];

const STACK_COLUMNS = [
  ['React', 'Vue 3', 'JavaScript', 'Tailwind CSS', 'HTML/CSS', 'Node.js'],
  ['Express', 'PostgreSQL', 'Prisma', 'REST APIs', 'Python', 'QWeb/XML'],
];

const BLOG_POSTS = [
  'Shipping ERP changes without stalling operations',
  'Building Smarter Workflows with Odoo',
  'Launching a Live Kids Party Shop + Rental Portal ERP',
  'Rebuilding a Company Intranet',
];

const PROJECTS = [
  { label: 'Kids Party Shop + Rental Portal ERP (Storefront, CRM, POS, Bookings, Inventory, Finance, Analytics)', href: '/projects/kids-party-shop-rental' },
  { label: 'Development Operations System (Projects, Proposals, Rent, Finance, Appointments, System Health)', href: '/projects/development-tracker' },
  { label: 'Odoo ERP Customization', href: '/projects/odoo' },
  { label: 'Intranet Website Redesign (including Internal Learning System)', href: '/projects/reconstruction' },
];

const SKILLS = [
  'Business process analysis, requirements gathering, and workflow design',
  'Process automation discovery and implementation planning',
  'Stakeholder alignment, acceptance criteria, and UAT coordination',
  'Digital product strategy across website, intranet, ERP, and client workflows',
  'Workflow mapping and operational process optimization',
  'Rollout enablement, onboarding, and team training',
  'UX audits, accessibility reviews, and design-system consistency',
  'SEO optimization, content refinement, and lead-focused improvements',
  'Analytics reporting, KPI tracking, and data-informed iteration',
  'Documentation automation, QA planning, and delivery coordination',
  'Cross-functional stakeholder collaboration and change management',
  'Odoo.sh and Odoo Studio administration',
];

const CERTIFICATES = [
  'Web Development with HTML, CSS, JavaScript',
  'Developing Front-End Apps with React',
  'Developing Back-End Apps with Node.js and Express',
  'Python for Data Science, AI & Development',
  'Database Management Essentials',
  'Developing AI Applications with Python and Flask',
];

const EDUCATION = [
"Trent university",
" Bachelor of Arts Honours (BAH)",
" Business and Computer Science",
];

const ABOUT_CLARITY = {
  leftLines: ['Blah!', 'blah!', 'blah!'],
  rightTop: 'What does',
  rightBottom: 'this mean?',
  centerLine: ['I make digital experiences easy', 
              'With a lot of knowledge and yes, AI.'],
};

const ABOUT_ROWS = [
  {
    label: 'Bio',
    content:
      'Business Analyst and Product Engineer. I turn operational needs into clear requirements, automated workflows, and reliable digital systems.',
    sideTitle: 'Services',
    sideType: 'list',
    sideContent: SERVICES,
  },
  {
    label: 'Currently',
    content:
      'Working as a Business Analyst at MTN Ghana, with a current focus on analyzing and automating business processes.',
    sideTitle: 'Stack',
    sideType: 'stack',
    sideContent: STACK_COLUMNS,
  },
  {
    label: 'Formerly',
    content: [
      'IT Technician & Front-End Developer, IBW Surveyors Ltd (Oct 2024 - Jul 2025)',
      'Digital Experience Lead, ERP Systems Manager, and Research Administrator, IN Engineering + Surveying Ltd (Sep 2022 - Oct 2024)',
    ],
    contentType: 'list',
  },
  {
    label: 'Projects',
    content: PROJECTS,
    contentType: 'projectLinks',
  },
  {
    label: 'Skills',
    content: SKILLS,
    contentType: 'list',
  },
  {
    label: 'Blog Posts',
    content: BLOG_POSTS,
    contentType: 'links',
  },
  {
    label: 'Certificates',
    content: CERTIFICATES,
    contentType: 'list',
  },
  {
    label: 'Education',
    content: EDUCATION,
    contentType: 'list',
  },
];

function AboutRow({ row }) {
  return (
    <article className="about-hero__row" data-scroll-reveal="fadeInUp">
      <p className="about-hero__label">{row.label}</p>

      <div className="about-hero__content">
        {row.contentType === 'list' ? (
          <ul>
            {row.content.map((item) => (
              <li key={`${row.label}-${item}`}>{item}</li>
            ))}
          </ul>
        ) : null}

        {row.contentType === 'links' ? (
          <ul className="about-hero__links about-hero__blog-links">
            {row.content.map((item) => (
              <li key={`${row.label}-${item}`}>
                <Link to="/blog">
                  <span>{item}</span>
                  <HiArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {row.contentType === 'projectLinks' ? (
          <ul className="about-hero__links about-hero__project-links">
            {row.content.map((item) => (
              <li key={`${row.label}-${item.href}`}>
                <Link to={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        ) : null}

        {!row.contentType ? <p>{row.content}</p> : null}
      </div>

      <aside className="about-hero__side">
        {row.sideTitle ? <h3>{row.sideTitle}</h3> : null}

        {row.sideType === 'list' ? (
          <ul>
            {row.sideContent.map((item) => (
              <li key={`${row.label}-side-${item}`}>{item}</li>
            ))}
          </ul>
        ) : null}

        {row.sideType === 'stack' ? (
          <div className="about-hero__stack">
            {row.sideContent.map((column, columnIndex) => (
              <ul key={`${row.label}-stack-${columnIndex}`}>
                {column.map((item) => (
                  <li key={`${row.label}-stack-${item}`}>{item}</li>
                ))}
              </ul>
            ))}
          </div>
        ) : null}
      </aside>
    </article>
  );
}

function AboutContent() {
  const centerLines = Array.isArray(ABOUT_CLARITY.centerLine)
    ? ABOUT_CLARITY.centerLine
    : String(ABOUT_CLARITY.centerLine)
        .split('\n')
        .filter(Boolean);

  return (
    <div className="about-shell">
      <header className="about-hero" aria-label="About page introduction">
        <div className="about-hero__layout">
          <aside className="about-hero__profile" data-scroll-reveal="fadeInUp">
            <div className="about-hero__portrait">
              <img src="/imgs/IMG_5131.JPG" alt="Nana Aba Ackah portrait" loading="lazy" />
            </div>

            <div className="about-hero__profile-meta">
              <h1>Nana Aba Ackah</h1>
              <p>Business Analyst & Product Engineer</p>
              <p>[NOW]</p>
              <p>Accra, Ghana</p>
            </div>
          </aside>

          <div className="about-hero__rows">
            {ABOUT_ROWS.map((row) => (
              <AboutRow key={row.label} row={row} />
            ))}
          </div>
        </div>
      </header>

      <section className="about-clarity" aria-label="About clarity statement" data-scroll-reveal="fadeInUp">
        <div className="about-clarity__stage">
          <h2 className="about-clarity__left" aria-label={ABOUT_CLARITY.leftLines.join(' ')}>
            {ABOUT_CLARITY.leftLines.map((line, index) => (
              <span key={`clarity-left-${index}`}>{line}</span>
            ))}
          </h2>

          <Link className="about-clarity__center about-clarity__center-link" to="/contact" aria-label="Go to contact page">
            {centerLines.map((line, index) => (
              <span key={`clarity-center-${index}`}>{line}</span>
            ))}
          </Link>

          <p className="about-clarity__right">
            <span>{ABOUT_CLARITY.rightTop}</span>
            <span>{ABOUT_CLARITY.rightBottom}</span>
          </p>
        </div>
      </section>
    </div>
  );
}

function About({ embedded = false, sectionId }) {
  const WrapperTag = embedded ? 'section' : 'main';
  const wrapperClassName = `about-page${embedded ? ' about-page--embedded' : ''}`;

  return (
    <>
      <WrapperTag
        id={sectionId || (!embedded ? 'main-content' : undefined)}
        tabIndex={!embedded ? '-1' : undefined}
        className={wrapperClassName}
      >
        {!embedded && (
          <Seo
            title="About | Nana Aba Ackah"
            description="Business Analyst and Product Engineer focused on business-process automation, ERP-connected products, and workflow-focused systems."
            path="/about"
          />
        )}

        <AboutContent />
      </WrapperTag>
    </>
  );
}

export default About;
