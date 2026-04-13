import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  HiOutlineArchiveBox,
  HiOutlineArrowPath,
  HiOutlineArrowRight,
  HiOutlineBanknotes,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineCamera,
  HiOutlineChartBar,
  HiOutlineCircleStack,
  HiOutlineClipboardDocumentCheck,
  HiOutlineComputerDesktop,
  HiOutlineCpuChip,
  HiOutlineCreditCard,
  HiOutlineCubeTransparent,
  HiOutlineCursorArrowRays,
  HiOutlineDocumentText,
  HiOutlineKey,
  HiOutlineRectangleGroup,
  HiOutlineQrCode,
  HiOutlineServerStack,
  HiOutlineShieldCheck,
  HiOutlineShoppingCart,
  HiOutlineSquares2X2,
  HiOutlineSwatch,
  HiOutlineUsers,
} from 'react-icons/hi2';
import Seo from '../components/Seo';
import NextUpCta from '../components/NextUpCta';
import { projectDetails, projectDetailsBySlug } from '../content/projectDetails';
import '../styles/pages/ProjectDetail.css';

const MOCKUP_POOL = [
  '/imgs/mockups/portfolio/PORTFOLIO_1.png',
  '/imgs/mockups/portfolio/PORTFOLIO_2.png',
  '/imgs/mockups/portfolio/PORTFOLIO_3.png',
  '/imgs/mockups/portfolio/PORTFOLIO_4.png',
];

const hashSlug = (value = '') =>
  Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);

const buildVisuals = (slug, sectionCount = 0) => {
  const base = hashSlug(slug) % MOCKUP_POOL.length;
  const hero = MOCKUP_POOL[base];
  const strip = [1, 2].map((offset) => MOCKUP_POOL[(base + offset) % MOCKUP_POOL.length]);
  const sectionVisuals = Array.from(
    { length: Math.max(1, sectionCount) },
    (_, index) => MOCKUP_POOL[(base + index + 1) % MOCKUP_POOL.length],
  );

  return { hero, strip, sectionVisuals };
};

const getNextProject = (slug) => {
  const visibleProjects = projectDetails.filter((project) => !project.hidden);
  const index = visibleProjects.findIndex((project) => project.slug === slug);
  const safeIndex = index === -1 ? 0 : index;
  return visibleProjects[(safeIndex + 1) % visibleProjects.length];
};

const findFact = (detail, labels = []) => {
  const normalized = labels.map((label) => label.toLowerCase());
  return detail.atAGlance?.find(({ label = '' }) => normalized.includes(label.toLowerCase()))?.value;
};

const buildOverviewBody = (detail) => {
  if (detail.overview?.body) return detail.overview.body;

  const users = findFact(detail, ['Users']);
  const scope = findFact(detail, ['Scope', 'Product area', 'Goal']);
  const tools = findFact(detail, ['Tools', 'Stack']);

  const parts = [
    users ? `Designed for ${users}.` : null,
    scope ? `Built around ${scope}.` : null,
    tools ? `Delivered with ${tools}.` : null,
  ].filter(Boolean);

  if (!parts.length) return detail.summary;
  return parts.join(' ');
};

const buildChallenges = (detail) => {
  if (Array.isArray(detail.challenges) && detail.challenges.length) {
    return detail.challenges.slice(0, 3);
  }

  const challengeSection = detail.sections?.find((section) =>
    ['problem', 'constraints', 'challenges'].includes((section.id || '').toLowerCase()),
  );

  if (challengeSection?.list?.length) {
    return challengeSection.list.slice(0, 3);
  }

  if (challengeSection?.summary) {
    return [challengeSection.summary];
  }

  return detail.summary ? [detail.summary] : [];
};

const buildDiscovery = (detail, challenges = []) => {
  if (detail.discovery) return detail.discovery;

  const product = findFact(detail, ['Product', 'Platform', 'Product area']) || detail.title;
  const users = findFact(detail, ['Users']);
  const scope = findFact(detail, ['Scope', 'Goal', 'Product area']);

  return {
    label: '[Discovery Phase]',
    paragraphs: [
      `Discovery started with a practical audit of ${product}, mapping how people were actually using the system before any redesign or implementation decisions were made.`,
      `${users ? `I mapped core user groups (${users}) and traced their task paths.` : 'I mapped core user groups and traced their task paths.'} ${scope ? `The initial scope focused on ${scope}.` : ''} ${challenges[0] || ''}`.trim(),
    ],
    image: detail.discoveryImage || '/imgs/mockups/portfolio/PORTFOLIO_4.png',
  };
};

const findHeroFact = (detail, labels = []) => {
  const normalized = labels.map((label) => label.toLowerCase());
  return detail.heroFacts?.find(({ label = '' }) => normalized.includes(label.toLowerCase()))?.value;
};

const buildDesignSystem = (detail) => {
  if (detail.designSystem) return detail.designSystem;

  const product = findFact(detail, ['Product', 'Platform', 'Product area']) || detail.title;
  const users = findFact(detail, ['Users']);
  const tools = findFact(detail, ['Tools', 'Stack']);
  const service = findHeroFact(detail, ['Service']) || 'Product Delivery';

  return {
    label: '[Design System]',
    paragraphs: [
      `For ${product}, I defined a reusable design system that aligned layout, component behavior, and content hierarchy across every major user flow.`,
      `${users ? `Patterns were shaped around real user groups (${users})` : 'Patterns were shaped around real user groups'} so screens stayed consistent while still supporting different operational tasks.`,
      `${tools ? `Using ${tools},` : 'Using the existing stack,'} I created modular UI building blocks and predictable state rules, so new pages could be launched faster without introducing visual drift.`,
    ],
    boardCards: [
      {
        tone: 'accent',
        kicker: 'Component',
        title: detail.pills?.[0] || 'Core Module',
        body: 'Primary surface for high-priority actions',
      },
      {
        tone: 'light',
        kicker: 'Interaction',
        title: 'Shared States',
        body: 'Default, active, warning, and empty states',
      },
      {
        tone: 'light',
        kicker: 'Token',
        title: detail.pills?.[1] || 'Typography',
        body: 'Spacing, type scale, and alignment rhythm',
      },
      {
        tone: 'accent',
        kicker: 'System',
        title: service,
        body: 'Consistent rules applied across modules',
      },
      {
        tone: 'light',
        kicker: 'Scale',
        title: 'Reusable Patterns',
        body: 'Built for iterative expansion without rework',
      },
    ],
  };
};

const buildStorefrontShowcase = (detail) => {
  if (detail.storefrontShowcase) return detail.storefrontShowcase;

  const users = findFact(detail, ['Users']) || 'customers and internal teams';
  const scope = findFact(detail, ['Scope', 'Goal', 'Product area']) || 'core transactions';
  const stack = findFact(detail, ['Stack', 'Tools']) || 'the existing product stack';

  return {
    label: '[Storefront + System]',
    headline:
      'A FULL-SCREEN STOREFRONT EXPERIENCE CONNECTS DIRECTLY TO THE OPERATIONAL BACKEND.',
    paragraphs: [
      `The public-facing website was designed to do more than present content. It acts as the front door to ${scope}, creating a clear path from customer intent to system action.`,
      `Behind the interface, every interaction is tied to shared platform logic used by ${users}. Using ${stack}, the storefront stays synchronized with inventory, workflow, and reporting so the full product ecosystem remains connected.`,
    ],
    image: '/imgs/mockups/portfolio/PORTFOLIO_1.png',
  };
};

function CaseImage({ src, alt, className = '', placeholderLabel = 'Add image here' }) {
  const [hasError, setHasError] = useState(false);
  const showPlaceholder = !src || hasError;

  return (
    <div className={`case-image ${className}`.trim()}>
      {showPlaceholder ? (
        <div className="case-image__placeholder">
          <div>
            <strong>{placeholderLabel}</strong>
            <span>Placeholder for your visual asset</span>
          </div>
        </div>
      ) : (
        <img src={src} alt={alt} loading="lazy" onError={() => setHasError(true)} />
      )}
    </div>
  );
}

const ComparisonSection = ({ compare }) => {
  if (!compare) return null;

  return (
    <div className="case-chapter__split">
      <article className="case-card">
        <h3>{compare.beforeLabel || 'Before'}</h3>
        <ul className="case-list case-list--clean">
          {compare.before.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
      <article className="case-card">
        <h3>{compare.afterLabel || 'After'}</h3>
        <ul className="case-list case-list--clean">
          {compare.after.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
    </div>
  );
};

const CardsSection = ({ cards }) => {
  if (!cards?.length) return null;

  return (
    <div className="case-chapter__cards">
      {cards.map((card) => (
        <article className="case-card" key={card.title}>
          <h3>{card.title}</h3>
          {card.detail ? <p>{card.detail}</p> : null}
          {card.items?.length ? (
            <ul className="case-list case-list--clean">
              {card.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
};

const SnippetsSection = ({ snippets }) => {
  if (!snippets?.length) return null;

  return (
    <details className="case-details">
      <summary className="case-details__summary">View implementation highlights</summary>
      <div className="case-details__body case-chapter__cards">
        {snippets.map((snippet) => (
          <article className="case-card" key={snippet.title}>
            <h3>{snippet.title}</h3>
            {snippet.summary ? <p>{snippet.summary}</p> : null}
            <pre>
              <code>{snippet.code}</code>
            </pre>
          </article>
        ))}
      </div>
    </details>
  );
};

const DIAGRAM_ICON_RULES = [
  { keywords: ['token', 'typography', 'spacing', 'type scale', 'alignment', 'color'], icon: HiOutlineSwatch },
  { keywords: ['interaction', 'state', 'active', 'empty', 'warning', 'default'], icon: HiOutlineCursorArrowRays },
  { keywords: ['component', 'module', 'building block'], icon: HiOutlineCubeTransparent },
  { keywords: ['pattern', 'reusable'], icon: HiOutlineSquares2X2 },
  { keywords: ['scale', 'expansion', 'iteration'], icon: HiOutlineArrowPath },
  { keywords: ['layout', 'surface', 'screen'], icon: HiOutlineRectangleGroup },
  { keywords: ['scan', 'camera'], icon: HiOutlineCamera },
  { keywords: ['pos', 'checkout', 'cart', 'storefront', 'order builder'], icon: HiOutlineShoppingCart },
  { keywords: ['qr', 'barcode'], icon: HiOutlineQrCode },
  { keywords: ['payment', 'charge', 'card'], icon: HiOutlineCreditCard },
  { keywords: ['invoice', 'document'], icon: HiOutlineDocumentText },
  { keywords: ['accounting', 'finance', 'money', 'rent'], icon: HiOutlineBanknotes },
  { keywords: ['calendar', 'booking', 'appointment', 'rental'], icon: HiOutlineCalendarDays },
  { keywords: ['report', 'analytics', 'dashboard', 'kpi'], icon: HiOutlineChartBar },
  { keywords: ['auth', 'access', 'session', 'role', 'permission'], icon: HiOutlineShieldCheck },
  { keywords: ['key', 'secret'], icon: HiOutlineKey },
  { keywords: ['database', 'postgres', 'prisma', 'data'], icon: HiOutlineCircleStack },
  { keywords: ['api', 'server', 'backend', 'express', 'function'], icon: HiOutlineServerStack },
  { keywords: ['client', 'frontend', 'react', 'vite', 'ui', 'web', 'portal'], icon: HiOutlineComputerDesktop },
  { keywords: ['inventory', 'catalog', 'product', 'sku', 'item', 'stock'], icon: HiOutlineArchiveBox },
  { keywords: ['organization', 'team', 'tenant', 'company'], icon: HiOutlineBuildingOffice2 },
  { keywords: ['user', 'customer', 'staff'], icon: HiOutlineUsers },
  { keywords: ['health', 'job', 'diagnostic', 'system'], icon: HiOutlineCpuChip },
];

const getDiagramIcon = (node = {}) => {
  const searchableText = `${node.id || ''} ${node.label || ''} ${node.detail || ''}`.toLowerCase();
  return DIAGRAM_ICON_RULES.find(({ keywords }) => keywords.some((keyword) => searchableText.includes(keyword)))?.icon
    || HiOutlineClipboardDocumentCheck;
};

const DiagramNodeCard = ({ node, index, featured = false }) => {
  const Icon = getDiagramIcon(node);

  return (
    <article className={`case-diagram-node case-diagram-node--${node.tone || 'base'} ${featured ? 'is-featured' : ''}`}>
      <div className="case-diagram-node__visual">
        <span className="case-diagram-node__icon" aria-hidden="true">
          <Icon size={featured ? 26 : 22} />
        </span>
        <span className="case-diagram-node__badge">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div>
        <h4>{node.label}</h4>
        {node.detail ? <p>{node.detail}</p> : null}
      </div>
    </article>
  );
};

const DiagramFlowStep = ({ edge, index }) => {
  const title = edge.label || `${edge.from.label} to ${edge.to.label}`;

  return (
    <article className="case-diagram-flow-step">
      <span>{index + 1}</span>
      <div>
        <h4>{title}</h4>
        <p>{`${edge.from.label} -> ${edge.to.label}`}</p>
      </div>
      <HiOutlineArrowRight className="case-diagram-flow-step__arrow" size={18} aria-hidden="true" />
    </article>
  );
};

const isClassDiagram = (diagram = {}) =>
  diagram.type === 'class' || /class|database/i.test(`${diagram.id || ''} ${diagram.title || ''}`);

const DiagramClassEntity = ({ node }) => {
  const attributes = node.attributes || node.fields || (node.detail ? [node.detail] : []);

  return (
    <article className={`case-class-entity case-class-entity--${node.tone || 'base'}`}>
      <header>
        <span className="case-class-entity__icon" aria-hidden="true">
          <HiOutlineCircleStack size={20} />
        </span>
        <div>
          <p>{node.stereotype || 'entity'}</p>
          <h4>{node.label}</h4>
        </div>
      </header>
      {attributes.length ? (
        <ul>
          {attributes.slice(0, 5).map((attribute) => (
            <li key={attribute}>{attribute}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
};

const ClassDiagramCard = ({ diagram }) => {
  const nodes = useMemo(() => diagram.nodes ?? [], [diagram.nodes]);
  const relationships = useMemo(() => {
    const nodeLookup = Object.fromEntries(nodes.map((node) => [node.id, node]));
    return (diagram.edges ?? [])
      .map((edge, index) => {
        const from = nodeLookup[edge.from];
        const to = nodeLookup[edge.to];
        if (!from || !to) return null;
        return {
          ...edge,
          id: edge.id || `${edge.from}-${edge.to}-${index}`,
          from,
          to,
          label: edge.label || edge.cardinality || 'association',
        };
      })
      .filter(Boolean);
  }, [diagram.edges, nodes]);

  return (
    <article className="case-diagram-card case-diagram-card--class">
      <header className="case-diagram-card__header">
        <h3>{diagram.title}</h3>
        {diagram.caption ? <p>{diagram.caption}</p> : null}
      </header>

      <div className="case-class-diagram-board" aria-label={diagram.ariaLabel || diagram.title}>
        <div className="case-diagram-board__mast">
          <div>
            <p>Class diagram</p>
            <h4>{diagram.title}</h4>
          </div>
          <dl>
            <div>
              <dt>Classes</dt>
              <dd>{nodes.length}</dd>
            </div>
            <div>
              <dt>Relations</dt>
              <dd>{relationships.length}</dd>
            </div>
          </dl>
        </div>

        <div className="case-class-diagram-grid">
          {nodes.map((node) => (
            <DiagramClassEntity key={node.id} node={node} />
          ))}
        </div>

        {relationships.length ? (
          <section className="case-class-relationships" aria-label={`${diagram.title} relationships`}>
            <header>
              <p>Relationships</p>
              <h4>Entity links and ownership rules.</h4>
            </header>
            <div className="case-class-relationships__list">
              {relationships.map((relationship) => (
                <article className="case-class-relationship" key={relationship.id}>
                  <span>{relationship.from.label}</span>
                  <span className="case-class-relationship__line">
                    {relationship.label}
                    <HiOutlineArrowRight size={16} aria-hidden="true" />
                  </span>
                  <span>{relationship.to.label}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
};

const ArchitectureDiagramCard = ({ diagram }) => {
  const nodes = useMemo(() => diagram.nodes ?? [], [diagram.nodes]);
  const edges = useMemo(() => {
    const nodeLookup = Object.fromEntries(nodes.map((node) => [node.id, node]));
    return (diagram.edges ?? [])
      .map((edge, index) => {
        const from = nodeLookup[edge.from];
        const to = nodeLookup[edge.to];
        if (!from || !to) return null;
        return { ...edge, id: edge.id || `${edge.from}-${edge.to}-${index}`, from, to };
      })
      .filter(Boolean);
  }, [diagram.edges, nodes]);
  const featureCount = nodes.length > 6 ? 4 : Math.min(3, nodes.length);
  const featuredNodes = nodes.slice(0, featureCount);
  const moduleNodes = nodes.slice(featureCount);
  const flowSteps = edges.filter((edge) => edge.label).slice(0, 6);

  return (
    <article className="case-diagram-card">
      <header className="case-diagram-card__header">
        <h3>{diagram.title}</h3>
        {diagram.caption ? <p>{diagram.caption}</p> : null}
      </header>

      <div className="case-diagram-board" role="img" aria-label={diagram.ariaLabel || diagram.title}>
        <div className="case-diagram-board__mast">
          <div>
            <h4>{diagram.title}</h4>
          </div>
          <dl>
            <div>
              <dt>Modules</dt>
              <dd>{nodes.length}</dd>
            </div>
            <div>
              <dt>Flows</dt>
              <dd>{flowSteps.length || edges.length}</dd>
            </div>
          </dl>
        </div>

        <div className="case-diagram-board__hero">
          {featuredNodes.map((node, index) => (
            <React.Fragment key={node.id}>
              <DiagramNodeCard node={node} index={index} featured />
              {index < featuredNodes.length - 1 ? (
                <span className="case-diagram-arrow" aria-hidden="true">
                  <HiOutlineArrowRight size={18} />
                </span>
              ) : null}
            </React.Fragment>
          ))}
        </div>

        <div className="case-diagram-board__lower">
          {moduleNodes.length ? (
            <section className="case-diagram-panel case-diagram-panel--modules">
              <header>
                <p>Core Modules</p>
                <h4>Independent pieces working from one operating record.</h4>
              </header>
              <div className="case-diagram-panel__grid">
                {moduleNodes.map((node, index) => (
                  <DiagramNodeCard key={node.id} node={node} index={index + featuredNodes.length} />
                ))}
              </div>
            </section>
          ) : null}

          {flowSteps.length ? (
            <section className="case-diagram-panel case-diagram-panel--flow">
              <header>
                <p>How a Request Flows</p>
                <h4>Readable steps without connector clutter.</h4>
              </header>
              <div className="case-diagram-flow-list">
                {flowSteps.map((edge, index) => (
                  <DiagramFlowStep key={edge.id} edge={edge} index={index} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
};

const DiagramCard = ({ diagram }) =>
  isClassDiagram(diagram) ? <ClassDiagramCard diagram={diagram} /> : <ArchitectureDiagramCard diagram={diagram} />;

const DesignSystemPatternCard = ({ card, index, compact = false }) => {
  const Icon = getDiagramIcon({ id: card.kicker, label: card.title, detail: card.body });

  return (
    <article className={`case-design-card case-design-card--${card.tone || 'light'} ${compact ? 'is-compact' : ''}`}>
      <div className="case-design-card__top">
        <span className="case-design-card__icon" aria-hidden="true">
          <Icon size={compact ? 20 : 24} />
        </span>
        <p className="case-design-card__kicker">{card.kicker || `Pattern ${index + 1}`}</p>
      </div>
      <h3 className="case-design-card__title">{card.title}</h3>
      <p className="case-design-card__body">{card.body}</p>
    </article>
  );
};

const DiagramsSection = ({ diagrams }) => {
  if (!diagrams?.length) return null;

  return (
    <section className="case-diagrams" data-scroll-reveal="fadeInUp" aria-label="Architecture and database class diagrams">
      <p className="case-diagrams__label">[Architecture + Database Class Diagrams]</p>
      <div className="case-diagrams__grid">
        {diagrams.map((diagram) => (
          <DiagramCard key={diagram.id || diagram.title} diagram={diagram} />
        ))}
      </div>
    </section>
  );
};

const ProjectDetailContent = ({ detail }) => {
  const sections = detail.sections ?? [];
  const visuals = useMemo(
    () => buildVisuals(detail.slug, sections.length),
    [detail.slug, sections.length],
  );
  const supportingImages = Array.isArray(detail.supportingImages)
    ? detail.supportingImages.filter(Boolean)
    : [];
  const supportingVisualOne = supportingImages[0] || visuals.strip[0];
  const supportingVisualTwo = supportingImages[1] || supportingImages[0] || visuals.strip[1] || visuals.strip[0];
  const heroFacts = (detail.heroFacts?.length ? detail.heroFacts : [
    { label: 'Deliverables', value: detail.title },
    { label: 'Studio', value: 'By Nana Studio' },
    { label: 'Role', value: 'Product Engineer' },
    {
      label: 'Service',
      value: detail.pills?.slice(0, 2).join(' + ') || 'Product Engineering',
    },
  ]).slice(0, 4);
  const overviewHeading = detail.overview?.headline || detail.summary;
  const overviewBody = buildOverviewBody(detail);
  const challenges = buildChallenges(detail);
  const discovery = buildDiscovery(detail, challenges);
  const designSystem = buildDesignSystem(detail);
  const storefrontShowcase = buildStorefrontShowcase(detail);
  const nextProject = useMemo(() => getNextProject(detail.slug), [detail.slug]);
  const nextProjectVisual = useMemo(
    () => nextProject.heroImage || buildVisuals(nextProject.slug, nextProject.sections?.length ?? 0).hero,
    [nextProject.heroImage, nextProject.slug, nextProject.sections?.length],
  );
  const discoveryImage =
    discovery.image || detail.discoveryImage || visuals.sectionVisuals[0] || '/imgs/mockups/portfolio/PORTFOLIO_4.png';
  const storefrontImage =
    storefrontShowcase.image || visuals.hero || '/imgs/mockups/portfolio/PORTFOLIO_1.png';
  const designBoardCards = designSystem.boardCards?.slice(0, 5) ?? [];
  const primaryDesignCards = designBoardCards.slice(0, 3);
  const supportingDesignCards = designBoardCards.slice(3);

  return (
    <>
      <header className="case-hero case-hero--feature" data-scroll-reveal="fadeInUp">
        <h1 className="case-hero__title">{detail.title}</h1>
        <dl className="case-hero-facts">
          {heroFacts.map(({ label, value }) => (
            <div key={label}>
              <dt>[{label}]</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="case-hero-media" data-scroll-reveal="fadeInUp">
        <CaseImage
          src={detail.heroImage || visuals.hero}
          alt={`${detail.title} preview`}
          className="case-hero-media__main"
          placeholderLabel="Add hero image"
        />
      </section>

      <section className="case-overview" data-scroll-reveal="fadeInUp">
        <div className="case-overview__spacer" aria-hidden="true" />
        <div className="case-overview__content">
          <p className="case-overview__label">[Overview]</p>
          <h2 className="case-overview__headline">{overviewHeading}</h2>
          <p className="case-overview__body">{overviewBody}</p>
        </div>
      </section>

      <section className="case-hero-media case-overview-media" data-scroll-reveal="fadeInUp">
        <CaseImage
          src={supportingVisualOne}
          alt={`${detail.title} supporting visual`}
          className="case-hero-media__main"
          placeholderLabel="Add supporting image"
        />
      </section>

      {challenges.length ? (
        <section className="case-challenges" data-scroll-reveal="fadeInUp">
          <p className="case-challenges__label">[The Challenges]</p>
          <div className="case-challenges__list">
            {challenges.map((challenge, index) => (
              <article className="case-challenges__item" key={`${detail.slug}-challenge-${index + 1}`}>
                <p className="case-challenges__index">#{index + 1}</p>
                <p className="case-challenges__text">"{challenge}"</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="case-hero-media case-challenges-media" data-scroll-reveal="fadeInUp">
        <CaseImage
          src={supportingVisualTwo}
          alt={`${detail.title} secondary supporting visual`}
          className="case-hero-media__main"
          placeholderLabel="Add supporting image"
        />
      </section>

      <section className="case-discovery" data-scroll-reveal="fadeInUp">
        <div className="case-discovery__copy">
          <p className="case-discovery__label">{discovery.label || '[Discovery Phase]'}</p>
          {discovery.paragraphs?.map((paragraph, index) => (
            <p key={`${detail.slug}-discovery-${index + 1}`} className="case-discovery__text">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="case-discovery__media">
          <CaseImage
            src={discoveryImage}
            alt={`${detail.title} discovery visual`}
            className="case-discovery__image"
            placeholderLabel="Add discovery image"
          />
        </div>
      </section>

      <section className="case-design-system" data-scroll-reveal="fadeInUp">
        <div className="case-design-system__board">
          <div className="case-design-system__canvas" aria-label={`${detail.title} design system diagram`}>
            <div className="case-design-system__mast">
              <div>
                <p>Design System Map</p>
                <h3>Patterns, states, and tokens working as one kit.</h3>
              </div>
            </div>

            <div className="case-design-system__flow">
              {primaryDesignCards.map((card, index) => (
                <React.Fragment key={`${detail.slug}-design-primary-${index + 1}`}>
                  <DesignSystemPatternCard card={card} index={index} />
                  {index < primaryDesignCards.length - 1 ? (
                    <span className="case-design-system__arrow" aria-hidden="true">
                      <HiOutlineArrowRight size={18} />
                    </span>
                  ) : null}
                </React.Fragment>
              ))}
            </div>

            {supportingDesignCards.length ? (
              <div className="case-design-system__rules">
                <header>
                  <p>Built By Design</p>
                  <h3>Shared rules keep new screens aligned.</h3>
                </header>
                <div className="case-design-system__rule-grid">
                  {supportingDesignCards.map((card, index) => (
                    <DesignSystemPatternCard
                      key={`${detail.slug}-design-support-${index + 1}`}
                      card={card}
                      index={index + primaryDesignCards.length}
                      compact
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="case-design-system__copy">
          <p className="case-design-system__label">{designSystem.label || '[Design System]'}</p>
          {designSystem.paragraphs?.map((paragraph, index) => (
            <p key={`${detail.slug}-design-system-${index + 1}`} className="case-design-system__text">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="case-storefront-showcase" data-scroll-reveal="fadeInUp">
        <div className="case-storefront-showcase__media" aria-hidden="true">
          <CaseImage
            src={storefrontImage}
            alt=""
            className="case-storefront-showcase__image"
            placeholderLabel="Add storefront showcase image"
          />
        </div>

        <div className="case-storefront-showcase__overlay">
          <p className="case-storefront-showcase__label">
            {storefrontShowcase.label || '[Storefront + System]'}
          </p>
          <h2 className="case-storefront-showcase__headline">{storefrontShowcase.headline}</h2>
          {storefrontShowcase.paragraphs?.map((paragraph, index) => (
            <p key={`${detail.slug}-storefront-${index + 1}`} className="case-storefront-showcase__text">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <DiagramsSection diagrams={detail.diagrams} />

      <div className="case-story">
        {sections.map((section, index) => (
          <section
            key={section.id || section.title}
            id={section.id}
            className={`case-chapter ${index % 2 ? 'is-reverse' : ''}`.trim()}
            data-scroll-reveal="fadeInUp"
          >
            <div className="case-chapter__media">
              <CaseImage
                src={section.image || visuals.sectionVisuals[index % visuals.sectionVisuals.length]}
                alt=""
                placeholderLabel="Add section image"
              />
            </div>

            <div className="case-chapter__content">
              <p className="case-chapter__index">
                [{String(index + 1).padStart(2, '0')}] {section.title}
              </p>
              <h2>{section.title}</h2>
              {section.summary ? <p>{section.summary}</p> : null}

              {section.list?.length ? (
                <ul className="case-list">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}

              <CardsSection cards={section.cards} />
              <ComparisonSection compare={section.compare} />
              <SnippetsSection snippets={section.snippets} />
            </div>
          </section>
        ))}
      </div>

      <NextUpCta
        className="case-next-cta"
        eyebrow="Next Project"
        title={nextProject.title}
        href={`/projects/${nextProject.slug}`}
        imageSrc={nextProjectVisual}
        imageAlt={`${nextProject.title} preview`}
        placeholderLabel="Add next project image"
      />
    </>
  );
};

function ProjectDetail() {
  const { slug = '' } = useParams();
  const normalizedSlug = slug.toLowerCase();
  const detail = projectDetailsBySlug[normalizedSlug];

  if (detail?.redirectTo) {
    return <Navigate to={`/projects/${detail.redirectTo}`} replace />;
  }

  if (!detail) {
    return (
      <main id="main-content" tabIndex="-1" className="case-page case-page--detail">
        <div className="case-shell">
          <header className="case-hero">
            <div className="case-hero__copy">
              <p className="case-hero__kicker">Not found</p>
              <h1>Project not found</h1>
              <p className="case-hero__summary">This case study does not exist yet, or the URL changed.</p>
              <div className="case-cta-row">
                <Link className="ui-button ui-button--primary" to="/projects">
                  Back to projects
                </Link>
              </div>
            </div>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex="-1" className="case-page case-page--detail">
      <Seo
        title={detail.seo?.title}
        description={detail.seo?.description}
        path={detail.seo?.path}
        type="article"
      />
      <article className="case-shell">
        <ProjectDetailContent detail={detail} />
      </article>
    </main>
  );
}

export default ProjectDetail;
