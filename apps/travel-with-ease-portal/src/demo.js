// Browser-only synthetic fixtures. This adapter never calls fetch or stores data.
export function demoEnabled({
  allowed,
  hostname,
  search = "",
  pathname = "/",
  stagingAllowed = false,
}) {
  const local =
    allowed === true &&
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname) &&
    new URLSearchParams(search).get("demo") === "1";
  // This is only a synthetic frontend session, never an application staff session.
  // The server independently protects and gates /demo behind verified Access.
  const staging =
    stagingAllowed === true &&
    hostname === "portal-staging.travelwitheasegh.com" &&
    ["/demo", "/demo/"].includes(pathname);
  return local || staging;
}

export function createDemoClient() {
  const permissions = [
    "content.read",
    "content.write",
    "content.publish",
    "media.read",
    "media.write",
    "enquiries.read",
    "enquiries.write",
    "staff.manage",
    "support.approve",
  ];
  const session = {
    user: { id: "demo-owner", role: "owner", permissions },
    csrfToken: "synthetic-not-a-credential",
  };
  const timestamp = "2026-10-27T09:00:00.000Z";
  const enquiries = [
    {
      id: "10000000-0000-4000-8000-000000000001",
      kind: "personalised",
      status: "new",
      version: 1,
      contact: {
        name: "Demo Traveller",
        email: "traveller@example.invalid",
        phone: "",
      },
      details: {
        destination: "Example destination",
        notes: "Synthetic enquiry for interface testing only.",
      },
      created_at: timestamp,
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      kind: "package",
      status: "contacted",
      version: 1,
      contact: {
        name: "Sample Guest",
        email: "guest@example.invalid",
        phone: "",
      },
      details: { package: "Example package — not an actual offer" },
      created_at: timestamp,
    },
  ];
  const pages = new Map();
  const history = new Map();
  let signedIn = true;
  const fail = (status, message) => {
    throw Object.assign(new Error(message), { status });
  };
  const copy = (value) => structuredClone(value);
  const pageBody = (page) => ({
    heading: `Demo ${page}`,
    body: "Synthetic draft. Changes stay in this browser tab and disappear on reload.",
    ctaLabel: "",
    ctaPath: "/#plan",
    seoTitle: `Demo ${page}`,
    seoDescription: "Local demonstration only.",
    imageId: null,
    entries: [],
    contactEmail: "",
    contactPhone: "",
    articles:
      page === "journal"
        ? [
            {
              slug: "sample-travel-guide",
              title: "Sample travel guide",
              excerpt: "Synthetic editorial for the demo workspace.",
              body: "Prepare your dates, destination ideas and budget before making an enquiry. This is demonstration content, not a published TWE article.",
              date: "2026-10-30",
            },
          ]
        : [],
    footprint:
      page === "travel-footprint"
        ? [
            { countryCode: "KE", total: 12, status: "verified" },
            { countryCode: "TZ", total: 4, status: "verified" },
            { countryCode: "GH", total: 2, status: "verified" },
          ]
        : [],
  });
  return {
    async get(path) {
      const url = new URL(path, "http://demo.invalid");
      if (url.pathname === "/api/auth/status")
        return { configured: true, mode: "local_demo" };
      if (url.pathname === "/api/auth/session")
        return signedIn
          ? copy(session)
          : fail(401, "Demo signed out. Reload to start again.");
      if (!signedIn) return fail(401, "Demo signed out.");
      if (url.pathname === "/api/agent/inquiries") {
        const items = enquiries.filter(
          (item) =>
            (!url.searchParams.get("status") ||
              item.status === url.searchParams.get("status")) &&
            (!url.searchParams.get("kind") ||
              item.kind === url.searchParams.get("kind")),
        );
        return copy({ items, nextOffset: null });
      }
      if (url.pathname.startsWith("/api/agent/inquiries/"))
        return (
          copy(
            enquiries.find(
              (item) => item.id === url.pathname.split("/").at(-1),
            ),
          ) || fail(404, "Demo enquiry not found.")
        );
      if (url.pathname === "/api/agent/media")
        return { items: [], configured: false };
      if (url.pathname === "/api/agent/administration/staff")
        return { items: [{ id: "demo-editor", role: "editor", active: true }] };
      if (url.pathname === "/api/agent/content/publication-jobs")
        return { items: [] };
      if (url.pathname === "/api/agent/content")
        return {
          items: ["home", "about", "services"].map((slug) => ({
            id: slug,
            slug,
            version: pages.get(slug)?.version || 1,
            draft_revision_id: `demo-${slug}-draft`,
            published_revision_id: null,
          })),
        };
      const match = url.pathname.match(
        /^\/api\/agent\/content\/([a-z]+(?:-[a-z]+)*)(?:\/(preview|revisions))?$/,
      );
      if (match) {
        const page = match[1];
        if (!pages.has(page))
          pages.set(page, { version: 1, body: pageBody(page) });
        return copy(
          match[2] === "revisions"
            ? { items: history.get(page) || [] }
            : pages.get(page),
        );
      }
      return fail(404, "This operation is not part of the local demo.");
    },
    async post(path, { json } = {}) {
      if (path === "/api/auth/logout" || path === "/api/auth/logout-all") {
        signedIn = false;
        return { signedOut: true };
      }
      if (!signedIn) return fail(401, "Demo signed out.");
      const enquiry = path.match(/^\/api\/agent\/inquiries\/([^/]+)\/status$/);
      if (enquiry) {
        const item = enquiries.find((value) => value.id === enquiry[1]);
        if (!item || item.version !== json.expectedVersion)
          return fail(409, "Demo enquiry changed. Refresh.");
        if (!["new", "contacted", "closed"].includes(json.status))
          return fail(400, "Invalid demo status.");
        item.status = json.status;
        item.version++;
        return copy(item);
      }
      const draft = path.match(
        /^\/api\/agent\/content\/([a-z]+(?:-[a-z]+)*)\/draft$/,
      );
      if (draft) {
        const page = draft[1],
          current = pages.get(page);
        if (current?.version !== json.expectedVersion)
          return fail(409, "Demo draft changed. Refresh.");
        const item = { version: current.version + 1, body: copy(json.body) };
        pages.set(page, item);
        history.set(page, [
          {
            id: `demo-revision-${item.version}`,
            version: item.version,
            created_at: timestamp,
          },
          ...(history.get(page) || []),
        ]);
        return copy(item);
      }
      return fail(
        503,
        "Demo only: publishing, uploads, staff provisioning and history restoration require the authenticated backend. No action was performed.",
      );
    },
  };
}
