export const projectDetails = [
  {
    slug: 'reconstruction',
    seo: {
      title: 'Projects | Intranet Website Redesign | By Nana',
      description:
        'Case study: intranet redesign + internal learning system built for simple, accessible workflows across a mixed-age workforce.',
      path: '/projects/reconstruction',
    },
    eyebrow: 'Case study',
    title: 'Intranet Website Redesign',
    summary:
      'A cluttered intranet and separate learning resources were unified into one simple, accessible internal platform designed for cross-department staff, including older team members.',
    heroImage: '/imgs/mockups/ibw/IBW_1.png',
    supportingImages: ['/imgs/mockups/ibw/IBW_3.png', '/imgs/mockups/ibw/IBW_2.png'],
    discoveryImage: '/imgs/mockups/ibw/IBW_4.png',
    pills: ['Intranet redesign', 'Learning system', 'Accessibility-first', 'Google Workspace', 'Enablement'],
    heroFacts: [
      { label: 'Deliverables', value: 'Intranet Website + Internal Learning Hub' },
      { label: 'Stack', value: 'Google Sites, HTML/CSS/JS, Figma, Google Drive' },
      { label: 'Role', value: 'Front-End Developer' },
      { label: 'Service', value: 'UX Audit + IA + Accessibility-led Redesign' },
    ],
    atAGlance: [
      { label: 'Product', value: 'Intranet website + integrated internal learning system' },
      { label: 'Users', value: 'Cross-department staff, including older and non-technical users' },
      { label: 'Goal', value: 'Simple navigation, clearer onboarding, and lower support dependency' },
      { label: 'Tools', value: 'Google Sites, HTML/CSS/JS, Figma, Google Drive' },
    ],
    stats: [
      { value: '30%', label: 'Support requests reduced' },
      { value: '2', label: 'Internal systems merged into one platform' },
      { value: 'Task-first', label: 'Navigation model across key workflows' },
      { value: 'Self-serve', label: 'Content updates enabled' },
    ],
    challenges: [
      'Intranet content was scattered across duplicate pages, outdated files, and inconsistent link structures, making routine task lookup slow and frustrating.',
      'A large part of the intranet audience was older staff, so dense layouts, small text, and deep navigation trees caused avoidable confusion and support dependency.',
      'The internal learning resources were disconnected from the intranet, which fragmented onboarding and made it harder for teams to follow one consistent training path.',
    ],
    storefrontShowcase: {
      label: '[Intranet + Learning Hub]',
      headline:
        'THE REDESIGNED INTRANET NOW GUIDES STAFF INTO TASKS AND TRAINING WITH MINIMAL COGNITIVE LOAD.',
      paragraphs: [
        'The experience was simplified into clear, high-contrast entry points so staff can move from homepage to key operational actions without getting lost in nested pages.',
        'Learning modules were brought into the same ecosystem, so onboarding and daily references now live in one predictable interface with consistent labels and structure.',
      ],
      image: '/imgs/mockups/ibw/IBW_7.png',
    },
    sections: [
      {
        id: 'problem',
        title: 'Problem and Constraints',
        image: '/imgs/mockups/ibw/IBW_4.png',
        list: [
          'Google Sites platform constraints limited how far layout and interaction patterns could go.',
          'Content sprawl from duplicate links and outdated documents.',
          'The user base included many older staff, so readability and ease of use were non-negotiable.',
          'Adoption risk required training and documentation alongside launch.',
        ],
      },
      {
        id: 'design-strategy',
        title: 'Design Strategy for Older and Non-Technical Users',
        image: '/imgs/mockups/ibw/IBW_5.png',
        list: [
          'Simplified information architecture to reduce decision fatigue and click depth.',
          'Larger typography, stronger visual hierarchy, and higher contrast for easier scanning.',
          'Plain-language labels and descriptive navigation names instead of internal jargon.',
          'Clear task grouping (forms, reports, policies, onboarding) with consistent page templates.',
          'Accessibility checks for keyboard navigation, readable spacing, and predictable interaction patterns.',
        ],
      },
      {
        id: 'learning-system',
        title: 'Integrated Internal Learning System',
        image: '/imgs/mockups/ibw/IBW_8.png',
        cards: [
          { title: 'Single learning entry point', detail: 'Training materials moved into one structured path from the intranet.' },
          { title: 'Role-based module grouping', detail: 'New hires, managers, and content owners follow clearer tracks.' },
          { title: 'Drive-native maintenance', detail: 'Content owners update training resources without engineering support.' },
          { title: 'Onboarding consistency', detail: 'Teams get one reliable source for SOPs, videos, and reference docs.' },
        ],
      },
      {
        id: 'before-after',
        title: 'Before and After',
        image: '/imgs/mockups/ibw/IBW_9.png',
        compare: {
          beforeLabel: 'Before',
          before: [
            'Fragmented intranet and learning resources',
            'Deep navigation and inconsistent naming',
            'Harder usability for older staff',
            'High support requests for routine tasks',
          ],
          afterLabel: 'After',
          after: [
            'One intranet hub for tasks and training',
            'Task-first routes with simplified labels',
            'Accessible, readable interface patterns',
            'Lower support load via self-serve usage',
          ],
        },
      },
      {
        id: 'rollout',
        title: 'Delivery and Rollout',
        image: '/imgs/mockups/ibw/IBW_10.png',
        cards: [
          { title: 'Plan', detail: 'Content inventory, IA cleanup, and stakeholder walkthroughs.' },
          { title: 'Build', detail: 'Responsive HTML/CSS/JS components embedded in Google Sites.' },
          { title: 'Enable', detail: 'Training, quick guides, and update ownership for continuity.' },
        ],
      },
    ],
    actions: [
      { label: 'Back to projects', href: '/projects' },
      { label: 'Book a working session', href: 'https://dev.nanaabaackah.com/book', external: true },
    ],
  },
  {
    slug: 'development-tracker',
    seo: {
      title: 'Projects | Development Projects Tracker | By Nana',
      description:
        'Case study: full-stack development tracker platform with dashboard modules for accounting, bookings, productivity, reporting, and system monitoring.',
      path: '/projects/development-tracker',
    },
    eyebrow: 'Case study',
    title: 'Development Projects Tracker',
    summary:
      'A standalone full-stack tracker for development operations, combining project visibility, productivity planning, bookings, accounting, reporting, and system-health monitoring in one workspace.',
    heroImage: '/imgs/mockups/dev/DEV_1.png',
    supportingImages: ['/imgs/mockups/dev/DEV_4.png', '/imgs/mockups/dev/DEV_2.png'],
    discoveryImage: '/imgs/mockups/dev/DEV_3.png',
    pills: ['SaaS dashboard', 'React + Express', 'Prisma + PostgreSQL', 'Auth + security', 'AI productivity'],
    heroFacts: [
      { label: 'Deliverables', value: 'Development Tracking Platform' },
      { label: 'Stack', value: 'React/Vite, Express, Prisma, PostgreSQL' },
      { label: 'Role', value: 'Full-Stack Product Engineer' },
      { label: 'Service', value: 'Architecture + Dashboard Product Delivery' },
    ],
    atAGlance: [
      { label: 'Product', value: 'Development projects tracker + admin workspace' },
      { label: 'Users', value: 'Admin, operations leads, finance, contributors' },
      {
        label: 'Scope',
        value:
          'Dashboard, productivity, accounting, bookings, organizations, users, inventory, system health, reports, audit logs',
      },
      { label: 'Tools', value: 'React, Express API, Prisma schema + migrations, PostgreSQL' },
    ],
    stats: [
      { value: '11', label: 'Core app modules in main navigation' },
      { value: '20+', label: 'API routes across auth, tracker, and analytics domains' },
      { value: 'Cookie + CSRF', label: 'Session security model' },
      { value: 'Multi-tenant', label: 'Organization-scoped data model' },
    ],
    challenges: [
      'Development tracking data was fragmented across spreadsheets, notes, and separate dashboards, which made cross-functional visibility difficult to maintain.',
      'Security expectations required stronger session handling, CSRF protection, and rate limiting without making daily usage cumbersome.',
      'Operational workflows such as bookings, accounting, and productivity planning needed to coexist in one platform while still staying modular and maintainable.',
    ],
    storefrontShowcase: {
      label: '[Tracker Workspace]',
      headline:
        'ONE TRACKER NOW CONNECTS DEVELOPMENT PLANNING, DELIVERY SIGNALS, AND OPERATIONAL REPORTING.',
      paragraphs: [
        'The interface provides a unified control center where teams can monitor work health, financial posture, bookings, and delivery status without switching tools.',
        'Behind the UI, an Express API and Prisma-backed Postgres schema keep modules connected through organization-scoped data and shared auth rules.',
      ],
      image: '/imgs/mockups/dev/DEV_11.png',
    },
    diagrams: [
      {
        id: 'dev-tracker-system-layout',
        title: 'System Layout Diagram',
        caption: 'Frontend modules, API layer, data model, and integrations from the Dev codebase.',
        ariaLabel:
          'System architecture for development tracker showing React dashboard, Express API, Prisma Postgres, Google Calendar integration, and OpenAI productivity coach.',
        nodes: [
          { id: 'ui', label: 'React Dashboard', detail: '11 module routes', x: 16, y: 18, tone: 'accent' },
          { id: 'public-book', label: 'Public Booking', detail: 'Org-scoped booking page', x: 50, y: 10, tone: 'light' },
          { id: 'auth', label: 'Auth Layer', detail: 'Session + CSRF checks', x: 76, y: 18, tone: 'light' },
          { id: 'api', label: 'Express API', detail: 'REST handlers + middleware', x: 50, y: 46, tone: 'accent' },
          { id: 'db', label: 'PostgreSQL + Prisma', detail: 'Core tracker data', x: 50, y: 84, tone: 'light' },
          { id: 'google', label: 'Google Calendar', detail: 'Booking sync + callbacks', x: 18, y: 87, tone: 'base' },
          { id: 'ai', label: 'OpenAI Coach', detail: 'Productivity planning endpoint', x: 83, y: 87, tone: 'base' },
        ],
        edges: [
          { from: 'ui', to: 'api', label: 'app APIs', labelT: 0.6, labelOffset: -1.6 },
          { from: 'public-book', to: 'api', label: 'public booking APIs', labelT: 0.4, labelOffset: -2.2 },
          { from: 'auth', to: 'api', label: 'session checks', labelT: 0.62, labelOffset: 1.6 },
          { from: 'api', to: 'db', label: 'Prisma/SQL' },
          { from: 'api', to: 'google', label: 'calendar integration' },
          { from: 'api', to: 'ai', label: 'AI planning' },
        ],
      },
      {
        id: 'dev-tracker-db-layout',
        title: 'Database Layout Diagram',
        caption: 'Key relational groups from the Prisma schema used by the tracker.',
        ariaLabel:
          'Database layout for development tracker with organization root, users and roles, bookings, accounting, productivity, and integration settings.',
        nodes: [
          { id: 'org', label: 'Organization', detail: 'Tenant root entity', x: 14, y: 20, tone: 'accent' },
          { id: 'role', label: 'Role', detail: 'Role + permissions', x: 34, y: 20, tone: 'light' },
          { id: 'user', label: 'User', detail: 'Profile + status', x: 52, y: 20, tone: 'light' },
          { id: 'booking', label: 'Booking', detail: 'Calendar-linked events', x: 78, y: 20, tone: 'accent' },
          { id: 'booking-settings', label: 'Booking Settings', detail: 'Default booking config', x: 20, y: 50, tone: 'base' },
          { id: 'calendar', label: 'Calendar Integration', detail: 'OAuth tokens + sync state', x: 39, y: 50, tone: 'base' },
          { id: 'accounting', label: 'Accounting Entry', detail: 'Revenue/expense ledger', x: 60, y: 50, tone: 'light' },
          { id: 'productivity-entry', label: 'Productivity Entry', detail: 'Daily tracking metrics', x: 80, y: 50, tone: 'light' },
          { id: 'productivity-todo', label: 'Productivity Todo', detail: 'Task + priority workflow', x: 50, y: 81, tone: 'base' },
        ],
        edges: [
          { from: 'org', to: 'role' },
          { from: 'org', to: 'user' },
          { from: 'org', to: 'booking' },
          { from: 'org', to: 'booking-settings' },
          { from: 'org', to: 'calendar' },
          { from: 'org', to: 'accounting' },
          { from: 'org', to: 'productivity-entry' },
          { from: 'org', to: 'productivity-todo' },
          { from: 'role', to: 'user' },
          { from: 'user', to: 'productivity-entry' },
          { from: 'user', to: 'productivity-todo' },
          { from: 'booking', to: 'calendar' },
        ],
      },
    ],
    sections: [
      {
        id: 'workspace-modules',
        title: 'Workspace Modules',
        image: '/imgs/mockups/dev/DEV_6.png',
        cards: [
          { title: 'Dashboard', detail: 'KPI and health overview for active operations.' },
          { title: 'Productivity', detail: 'Focus planning, task tracking, and AI coaching.' },
          { title: 'Accounting', detail: 'Revenue/expense entries, invoice actions, and payment state.' },
          { title: 'Bookings', detail: 'Manual + public bookings with calendar sync support.' },
          { title: 'Ops modules', detail: 'Organizations, users, inventory, reports, settings, audit logs.' },
        ],
      },
      {
        id: 'security',
        title: 'Security and Access Strategy',
        image: '/imgs/mockups/dev/DEV_7.png',
        list: [
          'Session security with HttpOnly auth cookies and CSRF token validation.',
          'Role-aware authorization with admin-only guards on sensitive endpoints.',
          'Rate limiting on auth and public booking routes to reduce abuse risk.',
          'Input sanitization, safe URL checks, and bounded query controls in API handlers.',
        ],
      },
      {
        id: 'data-architecture',
        title: 'Data Architecture',
        image: '/imgs/mockups/dev/DEV_8.png',
        cards: [
          { title: 'Organization-first model', detail: 'Core entities are scoped by organization for safer tenant boundaries.' },
          { title: 'Relational role mapping', detail: 'Roles and users map permissions and operational ownership.' },
          { title: 'Tracker domain entities', detail: 'Bookings, accounting entries, productivity entries, and todos share consistent indexing.' },
          { title: 'Prisma migrations', detail: 'Schema evolution maintained with migration history in version control.' },
        ],
      },
      {
        id: 'integrations',
        title: 'Integrations and Automations',
        image: '/imgs/mockups/dev/DEV_9.png',
        list: [
          'Google Calendar OAuth flow for booking sync, callback processing, and disconnect actions.',
          'Productivity coach endpoint connected to OpenAI Responses API for planning guidance.',
          'Live job-board aggregation from Remotive and Arbeitnow for opportunity tracking.',
          'Trust and site-status checks across related platforms for operational visibility.',
        ],
      },
      {
        id: 'results',
        title: 'Implementation Outcomes',
        image: '/imgs/mockups/dev/DEV_10.png',
        compare: {
          beforeLabel: 'Before',
          before: [
            'Multiple disconnected trackers',
            'Limited security controls for admin workflows',
            'Manual consolidation for reporting',
            'No unified daily planning signal',
          ],
          afterLabel: 'After',
          after: [
            'One modular dashboard for development operations',
            'Cookie + CSRF + role-gated API access model',
            'Centralized reporting across core modules',
            'Productivity tracking with AI-assisted execution support',
          ],
        },
      },
    ],
    actions: [
      { label: 'View live tracker', href: 'https://dev.nanaabaackah.com', external: true },
      { label: 'Back to projects', href: '/projects' },
    ],
  },
  {
    slug: 'odoo',
    seo: {
      title: 'Projects | Odoo ERP Customization | By Nana',
      description:
        'Case study: Odoo customization and workflow automation across CRM, projects, finance, and operations.',
      path: '/projects/odoo',
    },
    eyebrow: 'Case study',
    title: 'Odoo ERP Customization',
    summary:
      'Cross-department Odoo delivery focused on safe automation, strong adoption, and clearer reporting across the delivery lifecycle.',
    heroImage: '/imgs/mockups/ineng/INENG_1.png',
    supportingImages: ['/imgs/mockups/ineng/INENG_2.png', '/imgs/mockups/ineng/INENG_3.png'],
    discoveryImage: '/imgs/mockups/ineng/INENG_4.png',
    pills: ['ERP automation', 'Python + ORM', 'QWeb/XML', 'Odoo Studio', 'Odoo.sh'],
    heroFacts: [
      { label: 'Deliverables', value: 'ERP Workflow Customization' },
      { label: 'Stack', value: 'Python/ORM, QWeb/XML, Studio, Odoo.sh, GitHub' },
      { label: 'Role', value: 'ERP Systems Manager & Developer' },
      { label: 'Service', value: 'Automation + Odoo Development' },
    ],
    atAGlance: [
      { label: 'Role', value: 'ERP systems manager (product + delivery lead)' },
      { label: 'Users', value: 'Ops, Finance, Project leads, Sales, HR' },
      { label: 'Scope', value: 'CRM to delivery to accounting workflows' },
      { label: 'Tools', value: 'Python/ORM, QWeb/XML, Studio, Odoo.sh, GitHub' },
    ],
    stats: [
      { value: '50%+', label: 'Workflow automation gains' },
      { value: '90%', label: 'Adoption in first 3 months' },
      { value: '5 depts', label: 'Cross-functional rollout coverage' },
      { value: '1 playbook', label: 'Training + office-hours enablement' },
    ],
    challenges: [
      'Before automation, teams repeatedly re-entered the same records across CRM, project, and accounting workflows, creating unnecessary handoffs and introducing avoidable data errors.',
      'Status updates and notifications were handled manually across departments, so follow-ups depended heavily on individual habits rather than consistent process rules.',
      'Reporting required frequent cleanup because naming conventions, record ownership, and state transitions were not standardized between operations, sales, and finance.',
    ],
    storefrontShowcase: {
      label: '[Operations Workspace]',
      headline:
        'A CLEAN OPERATIONAL FRONTEND NOW SITS ON TOP OF CORE ERP AUTOMATIONS.',
      paragraphs: [
        'The interface gives operations, sales, and finance teams a unified workspace where day-to-day actions are clear, consistent, and easier to execute.',
        'Each screen is connected to backend ERP workflows for records, states, and notifications, so frontend updates and business logic stay synchronized across the full system.',
      ],
      image: '/imgs/mockups/ineng/INENG_5.png',
    },
    sections: [
      {
        id: 'constraints',
        title: 'Delivery Constraints',
        image: '/imgs/mockups/ineng/INENG_6.png',
        list: [
          'High-stakes workflows required safe, reversible, audit-friendly changes.',
          'Mixed user comfort levels across power and occasional users.',
          'Data consistency issues around naming and state ownership.',
          'Adoption risk required docs and training to ship with features.',
        ],
      },
      {
        id: 'approach',
        title: 'Approach',
        image: '/imgs/mockups/ineng/INENG_7.png',
        cards: [
          { title: 'Discovery', detail: 'Interviews, workflow mapping, and data audits.' },
          { title: 'Build', detail: 'Python logic, QWeb/XML views, and Studio configuration in sprints.' },
          { title: 'Enable', detail: 'Staged QA on Odoo.sh, training, docs, and adoption tracking.' },
        ],
      },
      {
        id: 'workflow-shift',
        title: 'Workflow Shift',
        image: '/imgs/mockups/ineng/INENG_8.png',
        compare: {
          beforeLabel: 'Before',
          before: [
            'Manual handoffs across sales, projects, and finance',
            'Inconsistent project naming and identifiers',
            'Duplicate or missed notifications',
            'Invoice states checked manually',
          ],
          afterLabel: 'After',
          after: [
            'Automated CRM → Project → Accounting transitions',
            'Standardized project IDs and naming',
            'Deduplicated notifications with fallbacks',
            'Automated invoice status alerts',
          ],
        },
      },
      {
        id: 'highlights',
        title: 'Automation Highlights',
        image: '/imgs/mockups/ineng/INENG_9.png',
        cards: [
          {
            title: 'Email deduplication',
            detail: 'Grouped recipients and added team-level fallbacks to reduce noise and misses.',
          },
          {
            title: 'Invoice status alerts',
            detail: 'Template-driven payment-state notifications for finance without manual checks.',
          },
          {
            title: 'Project numbering',
            detail: 'Auto-generated IDs/names for cleaner reporting and traceability.',
          },
        ],
      },
    ],
    actions: [
      { label: 'Back to projects', href: '/projects' },
      { label: 'Book a working session', href: 'https://dev.nanaabaackah.com/book', external: true },
    ],
  },
  {
    slug: 'reebs',
    seo: {
      title: 'Projects | REEBS ERP + Commerce Platform | By Nana',
      description:
        'Case study: live storefront + ERP operating system for bookings, inventory, accounting, delivery, HR, and operations.',
      path: '/projects/reebs',
    },
    eyebrow: 'Flagship case study',
    title: 'Party Rental Website + ERP Platform',
    summary:
      'A live React + Netlify Functions operating system that unifies customer storefront flows with internal ERP modules across bookings, orders, inventory, delivery, documents, accounting, maintenance, and workforce management.',
    heroImage: '/imgs/mockups/reebs/REEBS_2.png',
    supportingImages: ['/imgs/mockups/reebs/REEBS_3.png', '/imgs/mockups/reebs/REEBS_7.png'],
    discoveryImage: '/imgs/mockups/reebs/REEBS_5.png',
    pills: ['Live system', 'ERP + Commerce', 'Bookings + Orders', 'Inventory + Finance', 'Ops + HR'],
    heroFacts: [
      { label: 'Deliverables', value: 'Website + ERP Umbrella System' },
      { label: 'Stack', value: 'React, Netlify Functions, PostgreSQL, Prisma, Role-based Auth' },
      { label: 'Role', value: 'Full-Stack Product Engineer' },
      { label: 'Service', value: 'Architecture + Product Delivery' },
    ],
    atAGlance: [
      { label: 'Platform', value: 'Customer storefront + internal ERP' },
      { label: 'Users', value: 'Customers, admin, managers, delivery crew, finance, HR' },
      {
        label: 'Scope',
        value:
          'Catalog, bookings, orders, stock movement, invoicing, expenses, delivery, documents, maintenance, timesheets, roles',
      },
      { label: 'Stack', value: 'React + Vite, Netlify Functions, PostgreSQL (Railway), Prisma schema and migrations' },
    ],
    stats: [
      { value: '1 platform', label: 'Storefront + admin operational flows' },
      { value: '2 channels', label: 'Retail orders and rental bookings in one model' },
      { value: 'Integer cents', label: 'Financial accuracy across reports and invoices' },
      { value: 'Multi-tenant ready', label: 'Organization-scoped data and role-based access' },
    ],
    challenges: [
      'Storefront activity and internal operations were previously fragmented, so teams had to manually reconcile bookings, orders, inventory, and finance records.',
      'Retail sales and rental reservations shared inventory but followed different workflows, creating overbooking risk and inconsistent stock state transitions.',
      'Delivery, documents, accounting, and maintenance data lived in separate tools, which reduced visibility and slowed operational handoffs.',
    ],
    storefrontShowcase: {
      label: '[Storefront + ERP]',
      headline:
        'THE PUBLIC STOREFRONT IS FULLY CONNECTED TO THE LIVE ERP OPERATING SYSTEM.',
      paragraphs: [
        'Customers move through shopping, rental booking, and checkout flows while internal teams operate from the same real-time records in the admin workspace.',
        'Each storefront action writes through serverless API workflows into shared order, booking, inventory, delivery, document, and accounting services, so the full lifecycle stays synchronized.',
      ],
      image: '/imgs/mockups/reebs/REEBS_1.png',
    },
    diagrams: [
      {
        id: 'system-layout',
        title: 'System Layout Diagram',
        caption: 'Web storefront, ERP modules, serverless APIs, data layer, and external integrations.',
        ariaLabel:
          'System architecture showing storefront, admin ERP console, Netlify functions, PostgreSQL, WhatsApp notifications, and geocoding services.',
        nodes: [
          { id: 'storefront', label: 'Storefront UI', detail: 'Home, shop, rentals, cart', x: 14, y: 18, tone: 'accent' },
          { id: 'checkout', label: 'Checkout + Booking', detail: 'Orders and booking intake', x: 50, y: 4, tone: 'light' },
          { id: 'admin', label: 'Admin ERP Console', detail: 'Ops, accounting, HR modules', x: 86, y: 18, tone: 'accent' },
          { id: 'api', label: 'Netlify Functions API', detail: 'Auth, business rules, writes', x: 50, y: 44, tone: 'accent' },
          { id: 'db', label: 'PostgreSQL + Prisma', detail: 'Unified operational data', x: 50, y: 80, tone: 'light' },
          { id: 'whatsapp', label: 'WhatsApp Cloud API', detail: 'Ops alerts', x: 18, y: 84, tone: 'base' },
          { id: 'geocode', label: 'Geocoding Services', detail: 'Nominatim + Google fallback', x: 81, y: 84, tone: 'base' },
        ],
        edges: [
          { from: 'storefront', to: 'api', label: 'HTTPS', labelT: 0.54, labelOffset: -0.3 },
          { from: 'checkout', to: 'api', label: 'orders + bookings', labelT: 0.48, labelOffset: -1.8 },
          { from: 'admin', to: 'api', label: 'staff APIs', labelT: 0.62, labelOffset: 1.6 },
          { from: 'api', to: 'db', label: 'SQL' },
          { from: 'api', to: 'whatsapp', label: 'notifications' },
          { from: 'api', to: 'geocode', label: 'address lookup' },
        ],
      },
      {
        id: 'database-layout',
        title: 'Database Layout Diagram',
        caption: 'Core entities and relationships behind bookings, orders, inventory, and finance.',
        ariaLabel:
          'Database layout showing organization, users, customers, products, orders and bookings, inventory, financials, maintenance, and workforce records.',
        nodes: [
          { id: 'org', label: 'Organization', detail: 'Tenant root and scoping', x: 12, y: 22, tone: 'accent' },
          { id: 'users', label: 'User + EmployeeProfile', detail: 'Roles, permissions, HR records', x: 33, y: 22, tone: 'light' },
          { id: 'customers', label: 'Customer', detail: 'Order and booking ownership', x: 56, y: 22, tone: 'light' },
          { id: 'products', label: 'Product Catalog', detail: 'Retail + rental inventory', x: 80, y: 22, tone: 'accent' },
          { id: 'ordersBookings', label: 'Order + Booking', detail: 'Core transaction entities', x: 24, y: 52, tone: 'accent' },
          { id: 'lineItems', label: 'OrderItem + BookingItem', detail: 'Per-item pricing and quantities', x: 44, y: 52, tone: 'light' },
          { id: 'stock', label: 'StockMovement', detail: 'Audit trail of stock changes', x: 63, y: 52, tone: 'light' },
          { id: 'opsDocs', label: 'Delivery + Document', detail: 'Fulfillment and invoice files', x: 83, y: 52, tone: 'light' },
          { id: 'financials', label: 'Expense + Financials', detail: 'Costs, P&L, reporting', x: 25, y: 80, tone: 'base' },
          { id: 'maintenance', label: 'Maintenance + Vendor', detail: 'Asset lifecycle and suppliers', x: 50, y: 80, tone: 'base' },
          { id: 'workforce', label: 'Timesheet + Roles', detail: 'Workforce and access control', x: 75, y: 80, tone: 'base' },
        ],
        edges: [
          { from: 'org', to: 'users' },
          { from: 'org', to: 'customers' },
          { from: 'org', to: 'products' },
          { from: 'org', to: 'ordersBookings' },
          { from: 'customers', to: 'ordersBookings' },
          { from: 'products', to: 'lineItems' },
          { from: 'ordersBookings', to: 'lineItems' },
          { from: 'lineItems', to: 'stock' },
          { from: 'ordersBookings', to: 'opsDocs' },
          { from: 'ordersBookings', to: 'financials' },
          { from: 'products', to: 'maintenance' },
          { from: 'users', to: 'workforce' },
        ],
      },
    ],
    sections: [
      {
        id: 'commerce-layer',
        title: 'Commerce Layer (Public Website)',
        image: '/imgs/mockups/reebs/REEBS_14.png',
        summary:
          'The public layer covers informational pages, product discovery, rentals, cart, checkout, and booking forms.',
        cards: [
          { title: 'Shop + Rentals', detail: 'Separate storefront browsing with a shared inventory source.' },
          { title: 'Checkout path', detail: 'Customer capture + order creation through createOrder API.' },
          { title: 'Booking intake', detail: 'Event details and rental items posted to bookings API.' },
          { title: 'Trust content', detail: 'Policy pages, FAQ, gallery, and delivery expectations.' },
        ],
      },
      {
        id: 'booking-orders',
        title: 'Booking and Order Operations Module',
        image: '/imgs/mockups/reebs/REEBS_9.png',
        summary:
          'Retail orders and rental bookings are handled as dedicated flows but consolidated under one operational system.',
        compare: {
          beforeLabel: 'Before',
          before: [
            'Bookings and orders managed in separate tools',
            'Manual availability checks',
            'No shared lifecycle status model',
            'Frequent reconciliation effort between teams',
          ],
          afterLabel: 'With REEBS ERP',
          after: [
            'Unified order + booking records under one platform',
            'Availability-aware validations at API level',
            'Shared status handling from intake to completion',
            'Cleaner operational handoffs and auditability',
          ],
        },
      },
      {
        id: 'inventory-control',
        title: 'Inventory and Stock Movement Module',
        image: '/imgs/mockups/reebs/REEBS_11.png',
        summary:
          'Inventory is managed as a unified core service with stock movement logs, counts, and availability support.',
        cards: [
          { title: 'Stock endpoint', detail: 'Controlled stock in/out operations with user attribution.' },
          { title: 'Activity logs', detail: 'Historical movement trail for audits and variance checks.' },
          { title: 'Inventory counts', detail: 'Count snapshots and stock valuation support.' },
          { title: 'Unified catalog', detail: 'Products supporting both sales and rental workflows.' },
        ],
      },
      {
        id: 'financials-accounting',
        title: 'Accounting and Financials Module',
        image: '/imgs/mockups/reebs/REEBS_8.png',
        summary:
          'Financial reporting, expense capture, invoicing, and P&L visibility are connected directly to live order and booking data.',
        cards: [
          { title: 'Integer-based money model', detail: 'Values stored in integer cents to avoid floating-point drift.' },
          { title: 'Financials endpoint', detail: 'Revenue split, expense totals, and profitability windows.' },
          { title: 'Expenses module', detail: 'Category-driven operational expenses tied to users and dates.' },
          { title: 'Accounting view', detail: 'Receipts, invoices, trends, and finance-oriented KPIs.' },
        ],
      },
      {
        id: 'delivery-logistics',
        title: 'Delivery and Logistics Module',
        image: '/imgs/mockups/reebs/REEBS_6.png',
        summary:
          'Delivery planning and operational fulfillment are tracked from booking context through dispatch updates.',
        list: [
          'Delivery board tracks route ownership and status progression.',
          'Geocoding support maps venue addresses for planning.',
          'Operational handoffs are visible to admin and manager roles.',
          'Delivery context links back to order/booking records for clarity.',
        ],
      },
      {
        id: 'documents-invoicing',
        title: 'Documents and Invoicing Module',
        image: '/imgs/mockups/reebs/REEBS_11.png',
        cards: [
          { title: 'Document service', detail: 'Centralized storage for operational and finance files.' },
          { title: 'Invoice generation', detail: 'Branded invoice creation from transaction context.' },
          { title: 'Invoice retrieval', detail: 'Detail endpoint supports review and downstream sharing.' },
          { title: 'Close-ready records', detail: 'Receipts and invoices connected to accounting workflows.' },
        ],
      },
      {
        id: 'maintenance-asset-health',
        title: 'Maintenance and Asset Health Module',
        image: '/imgs/mockups/reebs/REEBS_12.png',
        list: [
          'Maintenance logs track service events against equipment and assets.',
          'Vendor records support supplier contacts and lead-time context.',
          'Asset lifecycle activity links maintenance events to operations reliability.',
          'Operational visibility improves readiness before booking allocation.',
        ],
      },
      {
        id: 'workforce-and-access',
        title: 'HR, Timesheets, Roles, and Access',
        image: '/imgs/mockups/reebs/REEBS_4.png',
        cards: [
          { title: 'Staff authentication', detail: 'Role-aware login and token-based API access.' },
          { title: 'HR profiles', detail: 'Employee records with contact and job details.' },
          { title: 'Timesheets', detail: 'Clock-in/out workflow support for operational crews.' },
          { title: 'Roles and permissions', detail: 'Admin/manager/staff access control by route and module.' },
        ],
      },
      {
        id: 'platform-infrastructure',
        title: 'Platform Infrastructure and Integrations',
        image: '/imgs/mockups/reebs/REEBS_13.png',
        summary:
          'The backend is built as Netlify serverless functions with organization-level scoping and optional third-party integrations.',
        list: [
          'Functions layer covers auth, inventory, bookings, orders, delivery, documents, HR, and financial services.',
          'Organization scoping supports multi-tenant-ready behavior and data isolation.',
          'WhatsApp and push-notification hooks keep managers informed on transactional events.',
          'Prisma schema and migrations maintain consistent data contracts across releases.',
          'Public storefront and admin routes share one operational source of truth.',
        ],
      },
    ],
    actions: [
      { label: 'View live platform', href: 'https://reebspartythemes.netlify.app/', external: true },
      { label: 'Read launch recap', href: '/blog/reebs' },
      { label: 'Book a working session', href: 'https://dev.nanaabaackah.com/book', external: true },
    ],
  },
  {
    slug: 'portfolio',
    seo: {
      title: 'Projects | Portfolio Website (React) | By Nana',
      description:
        'Case study: React portfolio website built as a storytelling and conversion platform with reusable case-study and blog structure.',
      path: '/projects/portfolio',
    },
    eyebrow: 'Case study',
    title: 'Portfolio Website (React)',
    summary:
      'A custom portfolio platform built to present projects, blog content, and service positioning in a clear narrative structure that balances brand expression with technical credibility.',
    heroImage: '/imgs/mockups/portfolio/PORTFOLIO_8.png',
    supportingImages: ['/imgs/mockups/portfolio/PORTFOLIO_5.png', '/imgs/mockups/portfolio/PORTFOLIO_4.png'],
    discoveryImage: '/imgs/mockups/portfolio/PORTFOLIO_1.png',
    pills: ['Personal brand site', 'React + Vite', 'Case-study framework', 'Accessibility-aware', 'SEO-ready'],
    heroFacts: [
      { label: 'Deliverables', value: 'Portfolio Website + Case Study Pages' },
      { label: 'Stack', value: 'React, Vite, React Router, Custom CSS' },
      { label: 'Role', value: 'Product Designer + Front-End Engineer' },
      { label: 'Service', value: 'Brand Experience + Front-End Delivery' },
    ],
    atAGlance: [
      { label: 'Product', value: 'Professional portfolio and thought-leadership website' },
      { label: 'Users', value: 'Potential clients, hiring teams, and collaborators' },
      { label: 'Goal', value: 'Showcase capability through detailed case studies and clear conversion paths' },
      { label: 'Tools', value: 'React, Vite, React Router, Custom CSS, Netlify deployment workflow' },
    ],
    stats: [
      { value: '5+', label: 'Featured project case studies' },
      { value: '2 content types', label: 'Project + blog architecture' },
      { value: 'Mobile-first', label: 'Responsive layout strategy' },
      { value: 'Reusable', label: 'Structured detail-page framework' },
    ],
    challenges: [
      'The portfolio needed to communicate both design thinking and engineering depth without overwhelming first-time visitors with dense technical content.',
      'Project narratives had to be modular and reusable so new case studies could be added quickly while maintaining consistent quality and structure.',
      'The website needed to feel distinctive in presentation but still stay readable, performant, and accessible across desktop and mobile devices.',
    ],
    storefrontShowcase: {
      label: '[Portfolio Experience]',
      headline:
        'THE WEBSITE COMBINES BRAND STORYTELLING WITH STRUCTURED TECHNICAL BREAKDOWNS.',
      paragraphs: [
        'Each section is intentionally sequenced to guide visitors from context to implementation details, helping them understand both outcomes and process.',
        'Under the visual layer, reusable page patterns and content blocks make it easy to scale project and blog content without redesigning the site structure for every update.',
      ],
      image: '/imgs/mockups/portfolio/PORTFOLIO_10.png',
    },
    sections: [
      {
        id: 'strategy',
        title: 'Content and Narrative Strategy',
        image: '/imgs/mockups/portfolio/PORTFOLIO_6.png',
        list: [
          'Mapped audience intent into clear paths for services, projects, and contact.',
          'Built case-study storytelling around context, constraints, decisions, and outcomes.',
          'Created consistent section architecture so every project page remains easy to scan.',
          'Balanced visual personality with direct, evidence-based technical writing.',
        ],
      },
      {
        id: 'information-architecture',
        title: 'Information Architecture',
        image: '/imgs/mockups/portfolio/PORTFOLIO_7.png',
        cards: [
          { title: 'Route system', detail: 'Dedicated routes for Home, About, Projects, Contact, Blog, and dynamic detail pages.' },
          { title: 'Project data model', detail: 'Case studies are driven by structured content objects for maintainable updates.' },
          { title: 'Blog structure', detail: 'Post lists and detail pages reuse shared metadata and body sections.' },
          { title: 'Navigation clarity', detail: 'Global navigation and page hierarchy reduce click uncertainty.' },
        ],
      },
      {
        id: 'frontend-execution',
        title: 'Frontend Execution',
        image: '/imgs/mockups/portfolio/PORTFOLIO_9.png',
        cards: [
          { title: 'Component reuse', detail: 'Shared UI blocks for CTAs, image handling, metadata, and page sections.' },
          { title: 'Animation layer', detail: 'Scroll-reveal and motion accents support hierarchy without distracting from content.' },
          { title: 'Theme support', detail: 'Light and dark modes are coordinated through global design tokens.' },
          { title: 'Media handling', detail: 'Mockups and visuals are mapped per project for clear contextual storytelling.' },
        ],
      },
      {
        id: 'quality',
        title: 'Performance, Accessibility, and SEO',
        image: '/imgs/mockups/portfolio/PORTFOLIO_2.png',
        list: [
          'Route-level SEO metadata for project and blog detail pages.',
          'Semantic headings, readable type scaling, and keyboard-friendly interaction patterns.',
          'Optimized image usage with lazy loading across visual-heavy sections.',
          'Vite build pipeline keeps delivery fast for production deployment.',
        ],
      },
      {
        id: 'outcomes',
        title: 'Outcome and Ongoing Iteration',
        image: '/imgs/mockups/portfolio/PORTFOLIO_3.png',
        compare: {
          beforeLabel: 'Before',
          before: [
            'Portfolio content existed in fragmented or static formats',
            'Limited space for process-level project storytelling',
            'Harder to maintain consistency across new case studies',
            'Fewer structured pathways to contact and conversion',
          ],
          afterLabel: 'After',
          after: [
            'Unified website with scalable project and blog architecture',
            'Detailed case-study format that shows decision-making and implementation',
            'Reusable content model for faster ongoing updates',
            'Clear conversion routes through CTAs and contact flows',
          ],
        },
      },
    ],
    actions: [
      { label: 'View GitHub repository', href: 'https://github.com/nanaabaackah/bynana-portfolio', external: true },
      { label: 'Visit live website', href: 'https://nanaabaackah.com', external: true },
      { label: 'Back to projects', href: '/projects' },
    ],
  },
];

export const projectDetailsBySlug = Object.fromEntries(
  projectDetails.map((project) => [project.slug, project]),
);
