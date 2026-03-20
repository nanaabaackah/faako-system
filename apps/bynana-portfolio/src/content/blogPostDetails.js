export const blogPostDetails = [
  {
    slug: 'devfest',
    seo: {
      title: 'GDG DevFest Toronto Recap | By Nana',
      description:
        'Highlights from DevFest Toronto across AI, mobile, and cloud delivery and what I applied after the event.',
      path: '/blog/devfest',
    },
    eyebrow: 'Conference recap',
    title: 'GDG DevFest Toronto: AI, mobile, and cloud takeaways',
    summary:
      'A weekend of talks and workshops that sparked practical ideas for LLM prototyping, mobile reliability, and team enablement.',
    tags: ['AI & LLMs', 'Mobile UX', 'Cloud delivery'],
    quickFacts: [
      { label: 'Format', value: 'Conference recap' },
      { label: 'Location', value: 'Toronto' },
      { label: 'Focus', value: 'AI, mobile, and cloud delivery' },
    ],
    sections: [
      {
        id: 'devfest-highlights',
        title: 'Quick highlights',
        list: [
          'LLM-assisted prototyping works when paired with guardrails and real data checks.',
          'Mobile-first delivery needs explicit performance budgets and offline behavior.',
          'Enablement beats hype: talks should become playbooks teams can run next week.',
        ],
      },
      {
        id: 'devfest-sessions',
        title: 'Sessions that stuck',
        cards: [
          {
            title: 'Building AI features responsibly',
            detail: 'Guardrails, evals, and user education matter more than novelty.',
            tag: 'AI / Responsible AI',
          },
          {
            title: 'Modern Android & Flutter UX',
            detail: 'Motion, accessibility, and state discipline keep mobile experiences trustworthy.',
            tag: 'Mobile / UI',
          },
          {
            title: 'Cloud-native delivery',
            detail: 'Smaller services and clear SLIs improve post-release learning loops.',
            tag: 'Cloud / Delivery',
          },
        ],
      },
      {
        id: 'devfest-apply',
        title: 'What I am applying',
        list: [
          'Run one-week LLM spikes for onboarding drafts, then validate before rollout.',
          'Add mobile performance budgets and low-bandwidth tests before release.',
          'Package launch learnings into Loom + checklist + rollback notes.',
        ],
      },
      {
        id: 'devfest-gallery',
        title: 'Scenes from DevFest',
        gallery: [
          { src: '/imgs/devfest/IMG_6443.jpg', alt: 'DevFest Toronto stage and audience' },
          { src: '/imgs/devfest/IMG_6445.jpg', alt: 'Speaker session at DevFest Toronto' },
          { src: '/imgs/devfest/IMG_6459.jpg', alt: 'Workshop seating and participants' },
          { src: '/imgs/devfest/IMG_6449.jpg', alt: 'Attendees networking at DevFest' },
        ],
      },
    ],
  },
  {
    slug: 'snowflake',
    seo: {
      title: 'Snowflake World Tour Toronto Recap | By Nana',
      description:
        'Governance-first notes from Snowflake World Tour on Native Apps, AI workloads, and reliable data delivery.',
      path: '/blog/snowflake',
    },
    eyebrow: 'Conference recap',
    title: 'Snowflake World Tour Toronto: Data Apps, AI, and Governance',
    summary:
      'What clicked most: shipping AI/data features with clear SLIs, stronger access controls, and repeatable release patterns.',
    tags: ['Data platforms', 'AI workloads', 'Governance'],
    quickFacts: [
      { label: 'Format', value: 'Conference recap' },
      { label: 'Event', value: 'Snowflake World Tour' },
      { label: 'Focus', value: 'Data apps, AI, governance' },
    ],
    sections: [
      {
        id: 'snowflake-highlights',
        title: 'Quick highlights',
        list: [
          'Native App patterns help package data products safely.',
          'LLM workloads need latency/cost/drift thresholds defined up front.',
          'Observability + least-privilege access are core to trusted reporting systems.',
        ],
      },
      {
        id: 'snowflake-sessions',
        title: 'Sessions that stuck',
        cards: [
          {
            title: 'Snowflake Native Apps',
            detail: 'Packaged distribution + access controls for safer external/internal data delivery.',
            tag: 'Native Apps / Governance',
          },
          {
            title: 'LLM workloads on Snowflake',
            detail: 'Telemetry and budget controls keep AI-assisted features reliable.',
            tag: 'AI / Observability',
          },
          {
            title: 'Secure data sharing',
            detail: 'Lineage and audit trails are mandatory for regulated or high-risk reporting.',
            tag: 'Security / Compliance',
          },
        ],
      },
      {
        id: 'snowflake-apply',
        title: 'What I am applying',
        list: [
          'Define SLIs for AI-assisted reporting: latency, cost per request, drift thresholds.',
          'Strengthen data lineage and access controls before adding new data feeds.',
          'Pilot versioned package + rollback patterns for internal data products.',
        ],
      },
      {
        id: 'snowflake-gallery',
        title: 'Scenes from the tour',
        gallery: [
          { src: '/imgs/snowflake/IMG_4980.PNG', alt: 'Snowflake Toronto event venue' },
          { src: '/imgs/snowflake/IMG_4981.PNG', alt: 'Snowflake session slide' },
          { src: '/imgs/snowflake/IMG_4982.PNG', alt: 'Snowflake workshop in progress' },
        ],
      },
    ],
  },
  {
    slug: 'portfolio',
    seo: {
      title: 'Rebuilding My Portfolio | By Nana',
      description:
        'Build-series notes on evolving a portfolio into a high-performance, accessible React/Vite experience.',
      path: '/blog/portfolio',
    },
    eyebrow: 'Build series',
    title: 'Rebuilding my portfolio: creativity, code, and iteration',
    summary:
      'From static page to animated React/Vite experience, this documents how I balance personality, performance, and accessibility.',
    tags: ['Frontend', 'Accessibility', 'Performance'],
    quickFacts: [
      { label: 'Format', value: 'Build series' },
      { label: 'Stack', value: 'React + Vite' },
      { label: 'Focus', value: 'Motion, a11y, performance' },
    ],
    sections: [
      {
        id: 'portfolio-pillars',
        title: 'Approach pillars',
        list: [
          'Ship in slices: design → scaffold → animate → test.',
          'Accessibility first: focus, contrast, and test coverage.',
          'Measure and tune with Lighthouse and bundle/perf checks.',
        ],
      },
      {
        id: 'portfolio-built',
        title: 'What I have built so far',
        cards: [
          { title: 'React/Vite SPA', detail: 'Fast dev loop with route-driven rendering.' },
          { title: 'Animated hero', detail: 'Intentional motion and scrolling cues.' },
          { title: 'Dynamic projects', detail: 'Data-driven cards and case-study routing.' },
          { title: 'Automation', detail: 'Content experiments via Zapier and Sheets.' },
          { title: 'Tests + SEO', detail: 'Playwright + metadata + performance guardrails.' },
        ],
      },
      {
        id: 'portfolio-challenges',
        title: 'Challenges and solutions',
        cards: [
          {
            title: 'Personality vs performance',
            detail: 'Scoped motion and reused primitives to keep interactions expressive but fast.',
          },
          {
            title: 'Lighthouse consistency',
            detail: 'Tuned image formats, loading behavior, and route prefetch strategy.',
          },
          {
            title: 'Iteration speed',
            detail: 'Tokenized spacing/type/color and kept components composable.',
          },
        ],
      },
      {
        id: 'portfolio-next',
        title: 'What is next in the series',
        list: [
          'Publish deeper posts on layout, motion, automation, and accessibility.',
          'Add interactive case studies with process toggles.',
          'Refine analytics around inquiries, not vanity pageviews.',
        ],
      },
    ],
  },
  {
    slug: 'reebs',
    seo: {
      title: 'REEBS Launch Recap | By Nana',
      description:
        'Launch recap for a live party-rental storefront and custom ERP system spanning ops, finance, and fulfillment.',
      path: '/blog/reebs',
    },
    eyebrow: 'Launch recap',
    title: 'Party rental business: live customer site + custom ERP',
    summary:
      'A live React storefront plus internal ERP now powers inventory, bookings, delivery, accounting, and operations in one place.',
    tags: ['Full-stack', 'E-commerce', 'ERP'],
    quickFacts: [
      { label: 'Format', value: 'Launch recap' },
      { label: 'Stack', value: 'React, Node, PostgreSQL' },
      { label: 'Outcome', value: 'Live rentals + ERP platform' },
    ],
    sections: [
      {
        id: 'reebs-pillars',
        title: 'Approach pillars',
        list: [
          'Unified inventory for retail sales and rental reservations.',
          'Customer journey combining shop + booking + delivery details.',
          'Operational control with stock logs, roles, and audit-ready docs.',
          'SaaS-ready architecture foundations.',
        ],
      },
      {
        id: 'reebs-website',
        title: 'Customer website highlights',
        cards: [
          { title: 'Shop + rental discovery', detail: 'Search and filtering for faster browsing.' },
          { title: 'Availability-aware booking', detail: 'Date checks and add-on handling.' },
          { title: 'Checkout details', detail: 'Pickup/delivery captured in one flow.' },
          { title: 'Support pages', detail: 'FAQs, gallery, and policies to reduce pre-booking friction.' },
        ],
      },
      {
        id: 'reebs-portal',
        title: 'Internal ERP capabilities',
        cards: [
          { title: 'Inventory + movement logs', detail: 'Unified catalog with traceable stock updates.' },
          { title: 'Orders + bookings + scheduler', detail: 'Retail and rental tracked together.' },
          { title: 'Accounting + docs', detail: 'Branded invoices, expenses, and financial views.' },
          { title: 'Ops suite', detail: 'Delivery board, waivers, maintenance, HR, vendors.' },
        ],
      },
      {
        id: 'reebs-challenges',
        title: 'Challenges and solutions',
        cards: [
          {
            title: 'Hybrid inventory complexity',
            detail: 'Handled with a unified catalog, reservations, and movement audit trails.',
          },
          {
            title: 'Permissions + scoping',
            detail: 'Applied org-level data boundaries and role-based access.',
          },
          {
            title: 'Financial consistency',
            detail: 'Used integer-safe money handling and shared ledger logic.',
          },
        ],
      },
      {
        id: 'reebs-outcomes',
        title: 'Live outcomes',
        list: [
          'Live booking + checkout flow with delivery details.',
          'Inventory synchronized with orders and booking statuses.',
          'Accounting and document records in one admin workspace.',
          'Operations now coordinated through one shared system.',
        ],
      },
    ],
  },
  {
    slug: 'stock-management',
    seo: {
      title: 'Stock Management Setup Playbook | By Nana',
      description:
        'Practical playbook for setting up inventory foundations that stay accurate across retail and rentals.',
      path: '/blog/stock-management',
    },
    eyebrow: 'Inventory playbook',
    title: 'Setting up a stock management system that stays accurate',
    summary:
      'A practical blueprint for inventory foundations: item masters, movement logs, maintenance checks, and reporting that drives action.',
    tags: ['Inventory', 'Operations', 'ERP setup'],
    quickFacts: [
      { label: 'Format', value: 'Inventory playbook' },
      { label: 'Focus', value: 'Item master + stock rules' },
      { label: 'Best for', value: 'Ops leads and founders' },
    ],
    sections: [
      {
        id: 'stock-signals',
        title: 'Signals you need a formal stock system',
        list: [
          'Stock tracked mainly in spreadsheets or chat.',
          'Retail and rental items mixed without availability rules.',
          'Delivery and pickup not tied back to inventory.',
          'Counts drifting due to weak cycle-count routines.',
        ],
      },
      {
        id: 'stock-setup',
        title: 'Setup blueprint',
        cards: [
          {
            title: '1) Unified item master',
            detail: 'Standardize SKU naming, required fields, and item type.',
          },
          {
            title: '2) Locations + dispatch map',
            detail: 'Define receiving/storage/delivery zones for every movement.',
          },
          {
            title: '3) Movement audit logging',
            detail: 'Track receipts, transfers, adjustments, and returns with reasons.',
          },
          {
            title: '4) Vendor + lead time linking',
            detail: 'Connect reorder logic to supplier reality.',
          },
          {
            title: '5) Maintenance safeguards',
            detail: 'Block availability for assets flagged for service.',
          },
        ],
      },
      {
        id: 'stock-reporting',
        title: 'Reporting views to keep stock honest',
        list: [
          'Stock on hand vs committed (orders + bookings)',
          'Stock movement audit timeline',
          'Maintenance due + asset health',
          'Upcoming deliveries/pickups tied to inventory',
        ],
      },
      {
        id: 'stock-takeaways',
        title: 'Key takeaways',
        list: [
          'Unified catalogs reduce double-booking and data drift.',
          'Audit logs build trust across operations and finance.',
          'Maintenance checks protect customer-facing availability.',
          'Reporting should always answer: committed, at risk, and next action.',
        ],
      },
    ],
  },
];

export const blogPostDetailsBySlug = Object.fromEntries(
  blogPostDetails.map((post) => [post.slug, post]),
);
