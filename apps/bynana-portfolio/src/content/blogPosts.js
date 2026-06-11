export const featuredPost = {
    title: 'Shipping ERP changes without stalling operations',
    date: '2025-01-10',
    readTime: '7 min read',
    summary:
        'How I blend discovery, change management, and incremental releases so teams keep moving while the stack evolves.',
    highlights: [
        'Start with a one-week intake to map workflows, owners, and quick automation wins.',
        'Ship behind feature flags with tight release notes so nothing surprises finance or ops.',
        'Pair adoption reviews with office hours to keep usage high long after launch.'
    ],
    tags: ['ERP delivery', 'Change management', 'Product ops']
};

export const articles = [
    {
        title: 'Building Smarter Workflows with Odoo: My Journey Customising a Full ERP for Real Operations',
        date: '2024-04-20',
        readTime: '6 min read',
        image: '/imgs/projects/erp-case.png',
        summary:
            'How I turned a standard Odoo install into a tailored operations engine—automating approvals, connecting CRM to projects, and giving leaders clearer visibility.',
        takeaways: [
            'Built end-to-end project workflows across Surveying, Engineering, and Construction with automated approvals.',
            'Shipped director/admin reporting views, branded QWeb PDFs, and notification rules that matched real processes.',
            'Kept migrations and performance stable while extending models, fields, and API integrations via GitHub Actions.'
        ],
        tags: ['ERP', 'Odoo', 'Automation'],
        cta: { label: 'Read Odoo ERP customisation story', href: '/projects/odoo' }
    },
    {
        title: 'Rebuilding a Company Intranet: From Static Pages to a Modern Internal Hub',
        date: '2025-01-15',
        readTime: '5 min read',
        image: '/imgs/article2.png',
        summary:
            'How I rebuilt IBW Surveyors’ intranet from a cluttered Google Site into a structured, branded hub with searchable resources and embedded tools.',
        takeaways: [
            'Restructured navigation, onboarding, and policy libraries to cut page sprawl and duplicate content.',
            'Shipped branded layouts with custom HTML/CSS/JS, reporting views, and interactive forms that teams can maintain.',
            'Worked around Google Sites limits while integrating BigQuery reporting and Google Workspace tools.'
        ],
        tags: ['Intranet', 'UX', 'Enablement'],
        cta: { label: 'Read the intranet reconstruction story', href: '/projects/reconstruction' }
    },
    {
        title: 'Creating an Internal Learning Portal to Support Organizational Growth',
        date: '2025-02-05',
        readTime: '5 min read',
        image: '/imgs/article.png',
        summary:
            'I built an internal learning portal so staff could find training videos, SOPs, and role-based paths in one accessible, structured place.',
        takeaways: [
            'Designed topic-based sections with visual lesson cards and embedded videos/docs.',
            'Organized tracks from beginner to advanced plus role-specific paths to reduce overwhelm.',
            'Used Google Sites/Notion patterns with simple forms/quizzes so teams could self-serve.'
        ],
        tags: ['Learning', 'Enablement', 'UX'],
        cta: { label: 'Read the intranet redesign story', href: '/projects/reconstruction' }
    },
    {
        title: 'Rebuilding My Portfolio: A Blend of Creativity, Code, and Continuous Iteration',
        date: '2025-02-25',
        readTime: '6 min read',
        image: '/imgs/projects/website-case.png',
        summary:
            'A look at how I evolved my portfolio from a static page into a React/Vite build with motion, accessibility, automation, and a plan for a full build-series.',
        takeaways: [
            'Built a React/Vite SPA with animated hero, dynamic projects grid, and light, intentional styling.',
            'Kept performance and accessibility front and center with Lighthouse goals, Playwright + axe tests, and SEO tweaks.',
            'Automated content touches (Zapier → Sheets for Instagram pulls) and scoped next steps for blog + interactive case studies.'
        ],
        tags: ['Portfolio', 'Frontend', 'Accessibility'],
        cta: { label: 'Follow the portfolio build series', href: '/blog/portfolio' }
    },
    {
        title: 'Launching a Live Kids Party Shop + Rental Portal ERP',
        date: '2025-03-05',
        readTime: '7 min read',
        image: '/imgs/projects/dashboard-case.png',
        summary:
            'How I split a kids party shop and rental business into a live customer website, dedicated portal backend, and admin ERP for rentals, sales, finance, and operations.',
        takeaways: [
            'Public website routes shoppers and rental customers through discovery, cart, checkout, and booking flows.',
            'POS/order builder supports staff-created sales with product search, SKU/barcode lookup, and stock-aware cart lines.',
            'Portal-owned Express API handlers centralize orders, bookings, inventory, accounting, documents, and delivery.',
            'Future camera scanning is scoped as the next step for faster in-store item capture.'
        ],
        tags: ['Full-stack', 'ERP', 'E-commerce'],
        cta: { label: 'Read the launch recap', href: '/blog/kids-party-shop-rental' }
    },
    {
        title: 'Setting Up a Stock Management System That Stays Accurate',
        date: '2025-04-02',
        readTime: '5 min read',
        image: '/imgs/projects/case-study-mobdesk.png',
        summary:
            'A setup playbook for unified inventory: item masters, movement logs, vendor context, and reporting that keeps retail and rentals aligned.',
        takeaways: [
            'Standardize the catalog for retail and rental items with clear availability rules.',
            'Use audit logs and movement reasons to keep stock trustworthy across teams.',
            'Connect vendors, maintenance checks, and delivery schedules to inventory.'
        ],
        tags: ['Inventory', 'Operations', 'ERP'],
        cta: { label: 'Read the stock setup playbook', href: '/blog/stock-management' }
    },
    {
        title: 'Snowflake World Tour Toronto: data apps & AI, responsibly',
        date: '2025-09-15',
        readTime: '4 min read',
        image: '/imgs/snowflake/IMG_4979.PNG',
        summary:
            'Governance-first takeaways from Snowflake World Tour—Native Apps, AI workloads, and telemetry to keep data products reliable.',
        takeaways: [
            'Ship AI features with clear SLIs—latency, cost, and model drift thresholds.',
            'Use Native App-style packaging for safer data sharing and rollbacks.',
            'Tie reporting to ownership, access controls, and observability before adding data.'
        ],
        tags: ['Data', 'AI', 'Governance'],
        cta: { label: 'Read the Snowflake recap', href: '/blog/snowflake' }
    },
    {
        title: 'GDG DevFest Toronto: weekend of AI, mobile, and cloud',
        date: '2025-11-18',
        readTime: '3 min read',
        image: '/imgs/devfest/IMG_6445.jpg',
        summary:
            'Notes from DevFest Toronto—sessions on AI, mobile, and cloud that sparked ideas for faster onboarding and team enablement.',
        takeaways: [
            'Rapid prototyping with LLMs: ship draft flows, then validate with real data and guardrails.',
            'Mobile-first isn’t optional: performance budgets and offline-first patterns keep experiences resilient.',
            'Enablement matters: bring talks home as playbooks, not just slides.'
        ],
        tags: ['Community', 'AI', 'Cloud'],
        cta: {
            label: 'Read the DevFest recap',
            href: '/blog/devfest'
        }
    }
];

export const quickNotes = [
    'Keep a running changelog in the same place as your meeting notes.',
    'Define “done” with a single screenshot or Loom per feature—no walls of text.',
    'Adoption > features: I’d rather ship one sticky workflow than five unused ones.',
    'Accessibility checks belong in the definition of done, not a retro.',
    'Reporting needs an owner; otherwise it turns into wallpaper.'
];

export const readingList = [
    { title: 'Building better release trains for SaaS teams', source: 'LeadDev Live', href: 'https://leaddev.com' },
    { title: 'Operational analytics with Snowflake Native Apps', source: 'Snowflake Blog', href: 'https://www.snowflake.com/blog/' },
    { title: 'Practical systems thinking for product teams', source: 'Systems School', href: 'https://systemsschool.org' }
];
