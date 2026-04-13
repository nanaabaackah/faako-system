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
    slug: 'kids-party-shop-rental',
    seo: {
      title: 'Kids Party Shop + Rental Launch Recap | By Nana',
      description:
        'Launch recap for a kids party shop and rental business public website, admin portal, and Netlify Functions ERP backend spanning commerce, bookings, finance, and operations.',
      path: '/blog/kids-party-shop-rental',
    },
    eyebrow: 'Launch recap',
    title: 'Kids party shop and rental business: live website + portal ERP',
    summary:
      'A live React/Vite storefront now works with a dedicated portal and Netlify Functions backend for inventory, bookings, delivery, accounting, and operations.',
    tags: ['Full-stack', 'E-commerce', 'ERP'],
    quickFacts: [
      { label: 'Format', value: 'Launch recap' },
      { label: 'Stack', value: 'React/Vite, Netlify Functions, PostgreSQL' },
      { label: 'Outcome', value: 'Live website + portal ERP' },
    ],
    sections: [
      {
        id: 'kids-party-shop-rental-pillars',
        title: 'Approach pillars',
        list: [
          'Public website stays focused on shopping, rentals, booking, checkout, and policy content.',
          'POS/order builder gives staff a faster path for in-store sales while staying tied to inventory and order records.',
          'Portal app owns admin workflows, Netlify Functions, Prisma migrations, and operational data.',
          'Shared organization/auth helpers keep website and portal requests aligned without collapsing app ownership.',
          'Future camera scanning is planned for quicker item lookup at the point of sale.',
        ],
      },
      {
        id: 'kids-party-shop-rental-website',
        title: 'Customer website highlights',
        cards: [
          { title: 'Shop + rental discovery', detail: 'Public pages for products, rental items, cart, checkout, and booking intake.' },
          { title: 'Portal redirects', detail: 'Staff/admin routes redirect into the dedicated portal app instead of living in the website bundle.' },
          { title: 'Customer support paths', detail: 'FAQ, contact, delivery, refund, privacy, and terms pages stay in the customer-facing app.' },
          { title: 'Backend handoff', detail: 'Website requests point to the deployed portal/functions host for operational writes.' },
        ],
      },
      {
        id: 'kids-party-shop-rental-portal',
        title: 'Internal ERP capabilities',
        cards: [
          { title: 'Inventory + movement logs', detail: 'Portal-owned functions manage catalog data, stock movements, counts, and activity history.' },
          { title: 'POS + order builder', detail: 'Staff can build walk-in sales through product search, SKU/barcode lookup, stock-aware cart lines, and order submission.' },
          { title: 'Orders + bookings + scheduler', detail: 'Retail orders, rental reservations, customer records, and schedule views run from the admin workspace.' },
          { title: 'Accounting + documents', detail: 'Financials, expenses, invoice documents, and branded invoice generation stay tied to live transactions.' },
          { title: 'Ops suite', detail: 'Delivery, maintenance, HR, timesheets, vendors, marketing, roles, settings, and operations workflows live in the portal.' },
        ],
      },
      {
        id: 'kids-party-shop-rental-challenges',
        title: 'Challenges and solutions',
        cards: [
          {
            title: 'Hybrid inventory complexity',
            detail: 'Handled with a unified catalog, reservations, and movement audit trails.',
          },
          {
            title: 'In-store sales speed',
            detail: 'Handled with a POS/order builder now, with camera-based item scanning scoped as a future workflow.',
          },
          {
            title: 'Permissions + scoping',
            detail: 'Kept organization headers, auth tokens, and role-aware portal routes explicit across the split apps.',
          },
          {
            title: 'Financial consistency',
            detail: 'Kept integer-safe money handling and financial views on the backend side of the portal boundary.',
          },
        ],
      },
      {
        id: 'kids-party-shop-rental-outcomes',
        title: 'Live outcomes',
        list: [
          'Live customer website for product discovery, rentals, booking, checkout, and support pages.',
          'POS/order builder supports staff-created sales with product search, barcode/SKU lookup, and stock-aware order lines.',
          'Dedicated portal/backend for orders, bookings, inventory, accounting, documents, delivery, and staff workflows.',
          'Future camera scanning is planned for faster item capture from the POS workflow.',
          'Shared workspace utilities reduce duplication while keeping website and portal responsibilities separate.',
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
