import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  HiArrowDown,
  HiArrowRight,
  HiOutlineCircleStack,
  HiOutlineCubeTransparent,
  HiOutlineMap,
  HiOutlineSwatch,
} from 'react-icons/hi2';
import { FaCss3Alt } from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import LogoLoop from '../components/LogoLoop';
import DecryptedText from '../components/DecryptedText';
import StarBorder from '../components/StarBorder';
import {
  SiExpress,
  SiFigma,
  SiHtml5,
  SiJavascript,
  SiNodedotjs,
  SiOdoo,
  SiOpenai,
  SiPostgresql,
  SiPrisma,
  SiPython,
  SiReact,
  SiTailwindcss,
  SiVuedotjs,
} from 'react-icons/si';
import '../styles/pages/Home.css';

const ShapeBlur = lazy(() => import('../components/ShapeBlur'));

const EXPERIENCE_START_YEAR = 2022;
const EXPERIENCE_START_MONTH_INDEX = 8; // September (0-indexed)
const PUBLIC_TRUST_STATS_ENDPOINT =
  'https://api.dev.nanaabaackah.com/api/public/trust-stats';
const TRUST_STATS_ENDPOINT =
  import.meta.env.VITE_TRUST_STATS_ENDPOINT ||
  (import.meta.env.DEV ? '/api/public/trust-stats' : PUBLIC_TRUST_STATS_ENDPOINT);
const TRUST_STATS_CACHE_KEY = 'bynana:trust-stats:organizations';
const TRUST_STATS_RETRY_DELAYS = [0, 600, 1800];

const parseCountValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === 'object') {
    const nested =
      value.count ??
      value.total ??
      value.value ??
      value.organizations ??
      value.organizationCount ??
      value.items;
    return parseCountValue(nested);
  }

  return null;
};

const extractOrganizationsCount = (payload) => {
  const candidates = [
    payload?.organizations,
    payload?.organizationCount,
    payload?.stats?.organizations,
    payload?.data?.organizations,
    payload?.kpis?.organizations,
  ];

  for (const candidate of candidates) {
    const parsed = parseCountValue(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
};

const getYearsOfExperienceLabel = (currentDate = new Date()) => {
  const yearDelta = currentDate.getFullYear() - EXPERIENCE_START_YEAR;
  const hasReachedAnniversary = currentDate.getMonth() >= EXPERIENCE_START_MONTH_INDEX;
  const fullYears = Math.max(0, yearDelta - (hasReachedAnniversary ? 0 : 1));

  return `${fullYears}+`;
};

const HERO_TITLE = "Hi, I'm Nana Aba Ackah";
const HERO_SUBTITLE = 'Business Analyst & Product Engineer';
const BLURB_TITLE =
  'i am Nana Aba Ackah, a Business Analyst and Product Engineer improving how teams work through process analysis, automation, and reliable digital systems.';
const BLURB_BODY =
  'i translate business needs into clearer workflows, practical requirements, and ERP or SaaS solutions that reduce manual work and support confident delivery.';
const PORTRAIT_IMAGE = '/imgs/IMG_6668.JPG';
const STATS_HEADLINE = 'Driving measurable growth and engagement through thoughtful product design and engineering.';
const STATS_INTRO =
  'Every product I build starts with user goals, then translates them into clear flows and reliable systems with measurable business impact.';
const STATS = [
  {
    dynamicValue: 'experience',
    label: 'Years of experience',
  },
  {
    value: '80%',
    label: 'Workflow Automation Gains',
  },
  {
    value: '90%',
    label: 'Adoption within the first 3 months',
  },
  {
    dynamicValue: 'organizations',
    label: 'Live Systems in Production',
  },
];
const SERVICES = [
  {
    number: '01',
    title: 'ERP-Backed Product Development',
    description:
      'I build full-stack platforms that connect bookings, inventory, payments, and operations into one reliable workflow.',
    icon: HiOutlineMap,
  },
  {
    number: '02',
    title: 'Odoo Automation & Customization',
    description:
      'I customize Odoo modules and automate cross-team processes using Python, XML, and QWeb to reduce repetitive manual work.',
    icon: HiOutlineSwatch,
  },
  {
    number: '03',
    title: 'Operational UX & Frontend Systems',
    description:
      'I design and ship task-first interfaces that improve adoption, speed up onboarding, and support day-to-day execution.',
    icon: HiOutlineCubeTransparent,
  },
  {
    number: '04',
    title: 'Business Process Analysis & Automation',
    description:
      'I map current workflows, define requirements and acceptance criteria, and help teams automate repeatable processes with clear ownership and controls.',
    icon: HiOutlineCircleStack,
  },
];
const EXPERIENCE_TIMELINE = [
  {
    company: 'MTN Ghana',
    role: 'Business Analyst',
    summary:
      'Analyze business processes, clarify requirements, and help automate repeatable workflows so teams can reduce manual effort and operate more consistently.',
    date: '2026 - Present',
  },
  {
    company: 'IBW Surveyors Ltd',
    role: 'IT Technician & Front-End Developer',
    summary:
      'Rebuilt internal portals, delivered reporting workflows with BigQuery and Looker Studio, and automated onboarding and document routing.',
    date: 'Oct 2024 - Jul 2025',
  },
  {
    company: 'IN Engineering + Surveying Ltd',
    role: 'ERP Systems Manager',
    summary:
      'Led Odoo ERP rollout across five departments and shipped custom operations and finance workflows using Python, JavaScript, QWeb, and XML.',
    date: 'Sep 2022 - Oct 2024',
  },
  {
    company: 'IN Engineering + Surveying Ltd',
    role: 'Digital Experience Lead',
    summary:
      'Improved the full digital touchpoint ecosystem across website, intranet, ERP, and client workflows while driving UX, SEO, and engagement improvements.',
    date: 'Sep 2022 - Oct 2024',
  },
  {
    company: 'IN Engineering + Surveying Ltd',
    role: 'Research Administrator',
    summary:
      'Supported research operations, reporting, and documentation workflows to improve team visibility and decision-making.',
    date: 'Sep 2022 - Oct 2024',
  },
];
const SKILL_LOGOS = [
  { label: 'React', icon: SiReact },
  { label: 'Vue 3', icon: SiVuedotjs },
  { label: 'Tailwind CSS', icon: SiTailwindcss },
  { label: 'HTML', icon: SiHtml5 },
  { label: 'CSS', icon: FaCss3Alt },
  { label: 'Figma', icon: SiFigma },
  { label: 'Node.js', icon: SiNodedotjs },
  { label: 'Express', icon: SiExpress },
  { label: 'PostgreSQL', icon: SiPostgresql },
  { label: 'Prisma', icon: SiPrisma },
  { label: 'Odoo', icon: SiOdoo },
  { label: 'Python', icon: SiPython },
  { label: 'JavaScript', icon: SiJavascript },
  { label: 'OpenAI', icon: SiOpenai },
];
const HOME_PROJECTS = [
  {
    title: 'Kids Party Shop + Rental Portal ERP',
    summary:
      'Live storefront and operations ERP spanning CRM intake, POS, orders, bookings, inventory, finance, fulfillment, role-aware workflows, and decision-ready dashboard analytics.',
    stack: 'React · Vite · Express · Prisma · PostgreSQL',
    category: 'Website + ERP Portal',
    href: '/projects/kids-party-shop-rental',
    image: '/imgs/mockups/reebs/REEBS_4.png',
    cta: 'View case study',
  },
  {
    title: 'Odoo ERP Customization',
    summary: 'Automated cross-department workflows with Python, QWeb, and XML.',
    stack: 'Python · Odoo · QWeb · XML',
    category: 'ERP',
    href: '/projects/odoo',
    image: '/imgs/mockups/ineng/INENG_8.png',
    cta: 'View project',
  },
  {
    title: 'Intranet Website Redesign',
    summary:
      'Merged intranet redesign and learning portal into one simpler, accessibility-first internal platform.',
    stack: 'Google Sites · HTML/CSS · Figma',
    category: 'Intranet',
    href: '/projects/reconstruction',
    image: '/imgs/mockups/ibw/IBW_5.png',
    cta: 'View project',
  },
  {
    title: 'Development Operations System',
    summary:
      'Dev ERP workspace covering projects and tasks, proposals, intake review, rent, finance, appointments, reporting, access control, automation, audit activity, and system health.',
    stack: 'React · Express · Prisma · PostgreSQL',
    category: 'Dev ERP',
    href: '/projects/development-tracker',
    image: '/imgs/mockups/dev/DEV_6.png',
    cta: 'View case study',
  },
];

function HomeProjectVisual({ project }) {
  const [hasError, setHasError] = useState(false);
  const showPlaceholder = !project.image || hasError;

  if (showPlaceholder) {
    return (
      <div className="home-projects__media" aria-hidden="true">
        <div className="home-projects__placeholder">
          <strong>Add project image</strong>
          <span>{project.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="home-projects__media" aria-hidden="true">
      <img src={project.image} alt="" loading="lazy" onError={() => setHasError(true)} />
    </div>
  );
}

function HomeProjectTile({ project }) {
  return (
    <article className="home-projects__item">
      <p className="home-projects__meta">{project.category ?? project.stack}</p>
      <Link
        className="home-projects__image-link"
        to={project.href}
        aria-label={`Open ${project.title} project page`}
      >
        <HomeProjectVisual project={project} />
        <span className="home-projects__hover-title">{project.title}</span>
      </Link>
    </article>
  );
}

function HomeServiceCard({ service }) {
  const Icon = service.icon;

  return (
    <StarBorder
      as="article"
      className="home-services__card"
      color="var(--text-2)"
      speed="5s"
      thickness={1}
    >
      <p className="home-services__index" aria-hidden="true">
        {service.number}
      </p>
      <span className="home-services__icon-wrap" aria-hidden="true">
        <Icon size={30} />
      </span>
      <h3 className="home-services__title">{service.title}</h3>
      <span className="home-services__divider" aria-hidden="true" />
      <p className="home-services__description">{service.description}</p>
    </StarBorder>
  );
}

function HomeTimelineEntry({ item, index }) {
  const isLeft = index % 2 === 0;
  const alignmentClass = isLeft ? 'home-timeline__item--left' : 'home-timeline__item--right';

  return (
    <article className={`home-timeline__item ${alignmentClass} home-timeline__item--mobile-right`}>
      <span className="home-timeline__dot" aria-hidden="true" />
      <div
        className="home-timeline__content"
        data-scroll-reveal={isLeft ? 'fadeInLeft' : 'fadeInRight'}
        data-animate-delay={index * 90}
      >
        <h3 className="home-timeline__role">{item.role}</h3>
        <p className="home-timeline__company">{item.company}</p>
        <p className="home-timeline__summary">{item.summary}</p>
        <p className="home-timeline__date">{item.date}</p>
      </div>
    </article>
  );
}

function Home() {
  const [portraitHasError, setPortraitHasError] = useState(false);
  const [shouldRenderPortraitEffect, setShouldRenderPortraitEffect] = useState(false);
  const [liveSystemsCount, setLiveSystemsCount] = useState(null);
  const portraitSectionRef = useRef(null);
  const portraitFrameRef = useRef(null);
  const yearsOfExperience = getYearsOfExperienceLabel();

  useEffect(() => {
    const section = portraitSectionRef.current;
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    if (typeof IntersectionObserver !== 'function') {
      setShouldRenderPortraitEffect(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldRenderPortraitEffect(true);
        observer.disconnect();
      },
      { rootMargin: '360px 0px' },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleScrollToFooter = useCallback(() => {
    const footer = document.getElementById('site-footer') ?? document.querySelector('.site-footer');

    if (footer) {
      footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleScrollToPortrait = useCallback(() => {
    const portraitSection = document.getElementById('home-portrait-section');

    if (portraitSection) {
      portraitSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    window.scrollTo({ top: window.scrollY + window.innerHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const section = portraitSectionRef.current;
    const frame = portraitFrameRef.current;
    if (!section || !frame) return undefined;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      frame.style.setProperty('--portrait-zoom', '1');
      frame.style.setProperty('--portrait-shift', '0px');
      return undefined;
    }

    let ticking = false;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const updateZoom = () => {
      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      const progress = clamp((viewport - rect.top) / (viewport + rect.height), 0, 1);

      const easedProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const minScale = 0.88;
      const maxScale = 1.14;
      const scale = minScale + (maxScale - minScale) * easedProgress;
      const offsetY = (1 - easedProgress) * 14;

      frame.style.setProperty('--portrait-zoom', scale.toFixed(3));
      frame.style.setProperty('--portrait-shift', `${offsetY.toFixed(2)}px`);
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateZoom);
    };

    updateZoom();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer;

    const fetchOrganizationsCount = async () => {
      try {
        const cachedCount = parseCountValue(window.localStorage.getItem(TRUST_STATS_CACHE_KEY));
        if (cachedCount !== null) {
          setLiveSystemsCount(String(cachedCount));
        }
      } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }

      for (const [attempt, delay] of TRUST_STATS_RETRY_DELAYS.entries()) {
        if (delay > 0) {
          await new Promise((resolve) => {
            retryTimer = window.setTimeout(resolve, delay);
          });
        }

        try {
          const response = await fetch(TRUST_STATS_ENDPOINT, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          });

          if (!response.ok) continue;

          const contentType = response.headers.get('content-type') || '';
          if (!contentType.toLowerCase().includes('application/json')) continue;

          const payload = await response.json();
          const count = extractOrganizationsCount(payload);
          if (count === null) continue;

          setLiveSystemsCount(String(count));
          try {
            window.localStorage.setItem(TRUST_STATS_CACHE_KEY, String(count));
          } catch {
            // The live value still renders when storage is unavailable.
          }
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
          if (attempt === TRUST_STATS_RETRY_DELAYS.length - 1) {
            console.warn('Unable to refresh the live organization count.', {
              endpoint: TRUST_STATS_ENDPOINT,
            });
          }
        }
      }
    };

    fetchOrganizationsCount();
    return () => {
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  return (
    <>
      <Seo
        title="Nana Aba Ackah | Business Analyst & Product Engineer"
        description="Business Analyst and Product Engineer focused on business-process automation, ERP systems, operational products, and reliable digital delivery."
        path="/"
      />

      <main id="main-content" tabIndex="-1" className="home home-page">
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero__content" data-scroll-reveal="fadeInUp">
            <h1 id="home-hero-title" className="home-hero__title" aria-label={HERO_TITLE}>
              <span className="home-hero__title-word">
                <span className="home-hero__title-initial">H</span>
                <span className="home-hero__title-rest">i,</span>
              </span>
              <span className="home-hero__title-word">
                <span className="home-hero__title-initial">I</span>
                <span className="home-hero__title-rest">m</span>
              </span>
              <span className="home-hero__title-word">
                <span className="home-hero__title-initial">N</span>
                <span className="home-hero__title-rest">ana</span>
              </span>
              <span className="home-hero__title-word">
                <span className="home-hero__title-initial">A</span>
                <span className="home-hero__title-rest">ba</span>
              </span>
              <span className="home-hero__title-word">
                <span className="home-hero__title-initial">A</span>
                <span className="home-hero__title-rest">ckah</span>
              </span>
            </h1>

            <h2 id="home-hero-subtitle" className="home-hero__subtitle">
              {HERO_SUBTITLE}
            </h2>
          </div>

          <button
            type="button"
            className="home-hero__scroll-cue"
            onClick={handleScrollToFooter}
            aria-label="Scroll down to footer"
          >
            <span>Scroll down</span>
          </button>
        </section>

        <section id="home-skills-section" className="home-skills" aria-labelledby="home-skills-title">
          <div className="home-skills__header" data-scroll-reveal="fadeInUp">
            <p className="ui-kicker">Technical toolkit</p>
            <h2 id="home-skills-title">Skills I Build With</h2>
          </div>

          <LogoLoop items={SKILL_LOGOS} speed={26} pauseOnHover ariaLabel="Skill logos" />
        </section>

        <section className="home-blurb" aria-labelledby="home-blurb-title">
          <div className="home-blurb__inner" data-scroll-reveal="fadeInUp">
            <span className="home-blurb__marker" aria-hidden="true" />
            <h2 id="home-blurb-title" className="home-blurb__title">
              {BLURB_TITLE}
            </h2>
            <p className="home-blurb__body">{BLURB_BODY}</p>

            <a className="home-blurb__cta" href="/about">
              <span className="home-blurb__cta-label">About Me</span>
              <span className="home-blurb__cta-icon" aria-hidden="true">
                <HiArrowRight size={16} aria-hidden="true" />
              </span>
            </a>
          </div>

          <button
            type="button"
            className="home-blurb__explore"
            onClick={handleScrollToPortrait}
            aria-label="Scroll to explore more"
          >
            <span>There&apos;s more ooooo!</span>
            <HiArrowDown size={16} aria-hidden="true" />
          </button>
        </section>

        <section ref={portraitSectionRef} id="home-portrait-section" className="home-portrait" aria-labelledby="home-portrait-heading">
          <h2 id="home-portrait-heading" className="sr-only">
            Portrait section
          </h2>
          <div className="home-portrait__sticky">
            <div ref={portraitFrameRef} className="home-portrait__frame-wrap" data-scroll-reveal="fadeInUp">
              <div className="home-portrait__shape-blur" aria-hidden="true">
                <Suspense fallback={null}>
                  {shouldRenderPortraitEffect ? (
                    <ShapeBlur
                      variation={0}
                      pixelRatioProp={typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
                      shapeSize={1}
                      roundness={0.5}
                      borderSize={0.05}
                      circleSize={0.25}
                      circleEdge={1}
                    />
                  ) : null}
                </Suspense>
              </div>

              <figure className="home-portrait__frame">
                {portraitHasError ? (
                  <div className="home-portrait__placeholder" role="img" aria-label="Add portrait image here">
                    <strong>Portrait image placeholder</strong>
                    <span>Add your image at /imgs/IMG_6668.JPG</span>
                  </div>
                ) : (
                  <img
                    src={PORTRAIT_IMAGE}
                    alt="Nana Aba Ackah portrait"
                    loading="lazy"
                    onError={() => setPortraitHasError(true)}
                  />
                )}
              </figure>
            </div>
          </div>
        </section>

        <section className="home-stats" aria-labelledby="home-stats-title">
          <header className="home-stats__header" data-scroll-reveal="fadeInUp">
            <h2 id="home-stats-title" className="home-stats__headline">
              <DecryptedText as="span" text={STATS_HEADLINE} duration={980} threshold={0.32} />
            </h2>

            <div className="home-stats__intro">
              <span className="home-stats__intro-marker" aria-hidden="true" />
              <DecryptedText
                as="p"
                className="home-stats__intro-text"
                text={STATS_INTRO}
                duration={1120}
                delay={80}
                threshold={0.3}
              />
            </div>
          </header>

          <div className="home-stats__grid" data-scroll-reveal="fadeInUp">
            {STATS.map((item, index) => (
              <article key={item.label} className="home-stats__card">
                <DecryptedText
                  as="h3"
                  className="home-stats__label"
                  text={item.label}
                  duration={920}
                  delay={index * 120}
                />
                <DecryptedText
                  as="p"
                  className="home-stats__value"
                  text={
                    item.dynamicValue === 'experience'
                      ? yearsOfExperience
                      : item.dynamicValue === 'organizations'
                        ? (liveSystemsCount ?? '—')
                        : item.value
                  }
                  duration={980}
                  delay={index * 120 + 120}
                />
              </article>
            ))}
          </div>
        </section>

        <section className="home-services" aria-labelledby="home-services-title">
          <h2 id="home-services-title" className="sr-only">
            Services
          </h2>

          <div className="home-services__stage" data-scroll-reveal="fadeInUp">
            <div className="home-services__grid">
              {SERVICES.map((service) => (
                <HomeServiceCard key={service.title} service={service} />
              ))}
            </div>
          </div>
        </section>

        <section id="home-projects-section" className="home-projects" aria-labelledby="home-projects-title">
          <header className="home-projects__header" data-scroll-reveal="fadeInUp">
            <h2 id="home-projects-title">This has created exceptional digital solutions built on innovation and experience </h2>
          </header>

          <div className="home-projects__grid" data-scroll-reveal="fadeInUp">
            {HOME_PROJECTS.slice(0, 4).map((project) => (
              <HomeProjectTile key={project.title} project={project} />
            ))}
          </div>

          <div className="home-projects__actions" data-scroll-reveal="fadeInUp">
            <a className="home-blurb__cta" href="/projects">
              <span className="home-blurb__cta-label">Projects</span>
              <span className="home-blurb__cta-icon" aria-hidden="true">
                <HiArrowRight size={16} aria-hidden="true" />
              </span>
            </a>
          </div>
        </section>

        <section className="home-timeline" aria-labelledby="home-timeline-title">
          <header className="home-timeline__header" data-scroll-reveal="fadeInUp">
            <h2 id="home-timeline-title">Experience Timeline</h2>
            <p>
              A quick look at the roles where I designed, shipped, and maintained ERP-connected products and internal
              systems.
            </p>
          </header>

          <div className="home-timeline__track" aria-label="Professional experience timeline">
            {EXPERIENCE_TIMELINE.map((item, index) => (
              <HomeTimelineEntry key={`${item.company}-${item.role}`} item={item} index={index} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

export default Home;
