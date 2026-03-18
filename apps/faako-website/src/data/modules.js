import {
  faGlobe,
  faBoxesStacked,
  faHandshake,
  faChartLine,
  faRoute,
  faUserTie,
} from "@fortawesome/free-solid-svg-icons";

export const moduleShowcaseItems = [
  {
    id: "website",
    icon: faGlobe,
    kicker: "Growth",
    title: "Website",
    description: "Help people find you online and contact your team quickly.",
    signals: ["Easy to find", "Lead capture"],
    outcome: "More customer enquiries",
    detailSummary:
      "Launch a clear business website that captures enquiries and sends them to the right person on your team.",
    problem:
      "Customer enquiries come from many places and often get missed.",
    value:
      "Every visitor gets a clear next step, so fewer opportunities are lost.",
    capabilities: [
      {
        title: "Simple page structure",
        text: "Your pages are organized so visitors quickly understand your service and reach out.",
      },
      {
        title: "Built-in enquiry flow",
        text: "Contact forms and booking actions send requests directly to your team.",
      },
      {
        title: "Fast and practical setup",
        text: "Pages load quickly and basic search visibility is set from day one.",
      },
    ],
    workflows: [
      "A visitor opens your page and sends an enquiry",
      "The enquiry is saved and assigned to the right person",
      "Follow-up progress appears in customer records and reports",
    ],
    includes: [
      "Mobile-friendly layout",
      "Service and product pages",
      "Lead forms and clear call-to-action buttons",
      "Basic traffic and enquiry tracking",
    ],
    integrations: ["CRM", "Reports", "WhatsApp alerts"],
    metrics: [
      { value: "< 2s", label: "Typical mobile load time" },
      { value: "100%", label: "Enquiry visibility" },
      { value: "24/7", label: "Always-open contact point" },
    ],
  },
  {
    id: "inventory",
    icon: faBoxesStacked,
    kicker: "Operations",
    title: "Inventory",
    description: "Track stock clearly across all your locations.",
    signals: ["Live stock", "Multi-branch"],
    outcome: "Live visibility",
    detailSummary:
      "Keep stock updates in one place so your team always knows what is available.",
    problem:
      "Stock updates are delayed or inconsistent, causing avoidable errors and missed sales.",
    value:
      "One trusted stock view keeps purchasing, sales, and delivery aligned.",
    capabilities: [
      {
        title: "Real-time stock movement",
        text: "Every sale, transfer, and adjustment updates stock totals right away.",
      },
      {
        title: "Multi-location control",
        text: "Track stock by branch or store with clear movement history.",
      },
      {
        title: "Reorder support",
        text: "Low-stock alerts help your team reorder before key items run out.",
      },
    ],
    workflows: [
      "A sale updates stock at the selected location",
      "Low-stock alerts flag what needs reordering",
      "Restocks update available quantity and reports",
    ],
    includes: [
      "Stock item catalog",
      "Location-based quantities",
      "Transfer and adjustment history",
      "Low-stock alerts",
    ],
    integrations: ["Orders", "Delivery", "Reports"],
    metrics: [
      { value: "Live", label: "Stock updates" },
      { value: "Multi-site", label: "Location support" },
      { value: "Lower", label: "Stockout risk" },
    ],
  },
  {
    id: "crm",
    icon: faHandshake,
    kicker: "Customers",
    title: "CRM",
    description: "Track customer conversations, follow-ups, and sales progress.",
    signals: ["Follow-ups", "Sales progress"],
    outcome: "Stronger customer follow-up",
    detailSummary:
      "Keep every customer conversation and follow-up in one place so your team responds faster and misses less.",
    problem:
      "Customer history is spread across chats and notes, so follow-ups are often missed.",
    value:
      "A shared view gives your team context, ownership, and faster response time.",
    capabilities: [
      {
        title: "Unified customer timeline",
        text: "Calls, messages, and quote requests are stored in one place for each customer.",
      },
      {
        title: "Sales progress tracking",
        text: "Move deals through clear stages with ownership and reminders.",
      },
      {
        title: "Follow-up automation",
        text: "Set reminders and tasks so no customer request is ignored.",
      },
    ],
    workflows: [
      "A new enquiry is added to customer follow-up",
      "It is assigned and moved through clear stages",
      "Completed outcomes appear in reports",
    ],
    includes: [
      "Lead and client records",
      "Stage board for follow-up",
      "Task and follow-up reminders",
      "Activity history log",
    ],
    integrations: ["Website", "Reports", "Invoicing"],
    metrics: [
      { value: "Faster", label: "Lead response" },
      { value: "Clear", label: "Follow-up ownership" },
      { value: "Higher", label: "Follow-up consistency" },
    ],
  },
  {
    id: "reports",
    icon: faChartLine,
    kicker: "Insights",
    title: "Reports",
    description: "See sales and business trends without manual spreadsheets.",
    signals: ["Auto dashboards", "Weekly summaries"],
    outcome: "Clearer decisions",
    detailSummary:
      "Turn daily business data into clear dashboards and simple weekly reports.",
    problem:
      "Important numbers arrive late when reports are built by hand.",
    value:
      "You get trusted numbers quickly, with simple views for every team.",
    capabilities: [
      {
        title: "Live performance dashboards",
        text: "Track sales, stock movement, and team activity from one reporting view.",
      },
      {
        title: "Scheduled report drops",
        text: "Send weekly summaries to leadership by email or WhatsApp.",
      },
      {
        title: "Trend tracking",
        text: "Compare periods to spot growth opportunities and risks early.",
      },
    ],
    workflows: [
      "Data from core features updates reports",
      "Dashboards refresh automatically throughout the day",
      "Weekly summary is shared with decision makers",
    ],
    includes: [
      "Business dashboards",
      "Branch and team comparisons",
      "Weekly and monthly summaries",
      "Exportable report views",
    ],
    integrations: ["Inventory", "CRM", "Finance"],
    metrics: [
      { value: "1 view", label: "Business snapshot" },
      { value: "Daily", label: "Auto refresh cycle" },
      { value: "Clear", label: "Decision insights" },
    ],
  },
  {
    id: "delivery",
    icon: faRoute,
    kicker: "Logistics",
    title: "Delivery",
    description: "Monitor routes, delivery status, and dispatch progress.",
    signals: ["Live routes", "Status updates"],
    outcome: "Route tracking",
    detailSummary:
      "Coordinate dispatch, routes, and delivery proof in one place so customers and teams stay informed.",
    problem:
      "Delivery updates are unclear, and dispatch teams spend time chasing status manually.",
    value:
      "Route status and delivery confirmations stay visible from start to finish.",
    capabilities: [
      {
        title: "Dispatch queue",
        text: "Organize pending deliveries by location, priority, and assigned driver.",
      },
      {
        title: "Status visibility",
        text: "Track each order through dispatched, in-transit, and delivered status.",
      },
      {
        title: "Proof and issue notes",
        text: "Capture delivery proof and issue notes for complete records.",
      },
    ],
    workflows: [
      "Confirmed order enters dispatch queue",
      "Driver assignment and route status update in real time",
      "Completed delivery updates customer and internal records",
    ],
    includes: [
      "Dispatch board",
      "Driver and route planning",
      "Delivery status history",
      "Proof-of-delivery notes",
    ],
    integrations: ["Orders", "Inventory", "CRM"],
    metrics: [
      { value: "Lower", label: "Failed deliveries" },
      { value: "Faster", label: "Dispatch turnaround" },
      { value: "Clear", label: "Delivery accountability" },
    ],
  },
  {
    id: "hr",
    icon: faUserTie,
    kicker: "Team",
    title: "HR",
    description: "Manage roles, attendance, and staff accountability clearly.",
    signals: ["Attendance", "Role controls"],
    outcome: "People operations",
    detailSummary:
      "Manage your team with clear role ownership and attendance tracking.",
    problem:
      "Team responsibilities and attendance records are inconsistent across branches.",
    value:
      "Managers can see who is scheduled, active, and responsible for each task.",
    capabilities: [
      {
        title: "Role and access setup",
        text: "Set responsibilities and permissions to match real team duties.",
      },
      {
        title: "Attendance visibility",
        text: "Track attendance and missing shifts across locations.",
      },
      {
        title: "Operational accountability",
        text: "Assign owners to tasks so nothing is left unmanaged.",
      },
    ],
    workflows: [
      "Managers assign roles and location responsibility",
      "Daily attendance and team activity are logged",
      "Team progress and gaps are reviewed from one dashboard",
    ],
    includes: [
      "Role and permission setup",
      "Attendance records",
      "Team assignment logs",
      "Accountability snapshots",
    ],
    integrations: ["Scheduler", "Reports", "Operations"],
    metrics: [
      { value: "Clear", label: "Role ownership" },
      { value: "Consistent", label: "Attendance tracking" },
      { value: "Fewer", label: "Operational handoff gaps" },
    ],
  },
];

export const moduleById = Object.fromEntries(
  moduleShowcaseItems.map((item) => [item.id, item]),
);

export const getModuleById = (moduleId) => moduleById[moduleId];
