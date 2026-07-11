const HEALTHY_STATUSES = new Set(["ok", "online", "healthy", "operational", "success"]);
const CRITICAL_STATUSES = new Set(["offline", "error", "failed", "down"]);

const normalizeStatus = (value) => String(value || "unknown").trim().toLowerCase();
const normalizeText = (value, maxLength = 240) => String(value || "").trim().slice(0, maxLength);

export const isMonitorHealthy = (status) => HEALTHY_STATUSES.has(normalizeStatus(status));

export const getIncidentSeverity = (status) => {
  const normalized = normalizeStatus(status);
  if (CRITICAL_STATUSES.has(normalized)) return "critical";
  if (normalized === "not_configured" || normalized === "unknown") return "coverage";
  return "warning";
};

const buildHttpDiagnosis = (check) => {
  const httpStatus = Number(check?.httpStatus);
  if (check?.errorType === "timeout") {
    return {
      cause: "The endpoint did not answer before the monitoring timeout.",
      impact: "Users may see a loading failure or an unavailable service.",
      actions: [
        { title: "Check the hosting deployment", detail: "Confirm the service is running and inspect the latest deployment logs." },
        { title: "Check database and upstream calls", detail: "A slow database, migration, or third-party request can keep the health endpoint open." },
        { title: "Retry the endpoint directly", detail: "Open the failing URL after checking the service to confirm it now responds." },
      ],
    };
  }
  if (check?.errorType === "network_error") {
    return {
      cause: "The monitor could not establish a usable network connection.",
      impact: "The app may be unreachable even if its deployment process reports success.",
      actions: [
        { title: "Verify DNS and custom domain", detail: "Confirm the hostname points to the intended Cloudflare or Railway service." },
        { title: "Check TLS and provider status", detail: "Inspect certificate status and the hosting provider's deployment health." },
        { title: "Test the provider URL", detail: "Compare the custom domain with the provider-issued URL to isolate DNS from application failure." },
      ],
    };
  }
  if (httpStatus >= 500) {
    return {
      cause: `The service responded with HTTP ${httpStatus}, indicating an application or upstream server failure.`,
      impact: "The affected route is online at the network layer but cannot complete requests reliably.",
      actions: [
        { title: "Inspect application logs", detail: "Start with the request timestamp and look for the first server-side exception." },
        { title: "Review the latest deployment", detail: "Check environment variables, database connectivity, and pending migrations." },
        { title: "Verify recovery", detail: "Retry the exact URL and confirm it returns a successful response before closing the incident." },
      ],
    };
  }
  if (httpStatus === 404) {
    return {
      cause: "The host responded, but the monitored route was not found.",
      impact: "Monitoring is targeting a missing path, or the deployed app is missing that route.",
      actions: [
        { title: "Confirm the route", detail: "Compare the monitored path with the app's deployed route and health endpoint." },
        { title: "Check redirects and SPA rules", detail: "Verify Cloudflare redirects or Railway routing are sending the path to the correct service." },
        { title: "Update monitoring metadata", detail: "Correct the registered path if the application route changed intentionally." },
      ],
    };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      cause: `The endpoint is reachable but rejected the monitor with HTTP ${httpStatus}.`,
      impact: "The service may be healthy, but the selected health check cannot verify it without the expected access policy.",
      actions: [
        { title: "Use a public health endpoint", detail: "Point monitoring at a minimal endpoint that does not expose private data." },
        { title: "Review proxy and access rules", detail: "Check Cloudflare Access, authentication middleware, and route permissions." },
        { title: "Retest without browser state", detail: "Confirm the health endpoint succeeds without relying on a logged-in session." },
      ],
    };
  }
  if (httpStatus === 429) {
    return {
      cause: "The monitor was rate limited by the application or edge provider.",
      impact: "Real users may also be throttled if the limit is too broad or too low.",
      actions: [
        { title: "Inspect rate-limit scope", detail: "Confirm health checks have an appropriate allowance and do not share a restrictive user bucket." },
        { title: "Review traffic spikes", detail: "Check whether unusual traffic or repeated retries exhausted the current window." },
        { title: "Retry after the window", detail: "Verify the endpoint recovers when the configured rate-limit window resets." },
      ],
    };
  }
  return {
    cause: httpStatus
      ? `The endpoint returned HTTP ${httpStatus}, which is not a successful health signal.`
      : "The latest check did not return enough evidence to confirm the endpoint is healthy.",
    impact: "Availability cannot be confirmed for this monitored surface.",
    actions: [
      { title: "Open the failing endpoint", detail: "Confirm the response and whether the route behaves differently outside the monitor." },
      { title: "Inspect hosting logs", detail: "Review the deployment and request logs at the recorded check time." },
      { title: "Refresh monitoring", detail: "Run a new check after correcting the underlying configuration or service issue." },
    ],
  };
};

const buildMonitorDiagnosis = (monitor, failingChecks) => {
  const status = normalizeStatus(monitor?.status);
  const primaryCheck = failingChecks.find((check) => check?.errorType || check?.httpStatus) || failingChecks[0];

  if (status === "not_configured") {
    return {
      cause: "Monitoring has no deployed base URL for this service.",
      impact: "The module cannot tell whether this app is healthy or down.",
      actions: [
        { title: "Add the production URL", detail: "Set the app's monitoring base URL in the Dev ERP backend environment." },
        { title: "Confirm the health path", detail: "Use a stable public route or a dedicated health endpoint." },
        { title: "Redeploy Dev ERP API", detail: "Environment changes are read by the backend when the service starts." },
      ],
    };
  }

  if (monitor?.kind === "database") {
    return {
      cause: status === "error"
        ? "The database connection or schema probe failed."
        : "The database health signal is incomplete.",
      impact: `Features backed by ${monitor.label} may fail or show stale data.`,
      actions: [
        { title: "Check the database connection variable", detail: "Confirm the Dev ERP backend has the correct URL for this database and environment." },
        { title: "Inspect database and API logs", detail: "Look for authentication, TLS, connectivity, missing-table, or migration errors." },
        { title: "Check migration status", detail: "Apply pending migrations from the database-owning app before retrying the health check." },
      ],
    };
  }

  return buildHttpDiagnosis(primaryCheck);
};

const buildEvidence = (monitor, failingChecks) => {
  const evidence = [];
  failingChecks.slice(0, 6).forEach((check) => {
    const parts = [normalizeText(check.label || check.path || "Endpoint", 100)];
    if (check.httpStatus) parts.push(`HTTP ${check.httpStatus}`);
    if (Number.isFinite(Number(check.responseTimeMs))) parts.push(`${Number(check.responseTimeMs)}ms`);
    if (check.errorType) parts.push(String(check.errorType).replace(/_/g, " "));
    evidence.push({
      label: parts.join(" · "),
      url: normalizeText(check.finalUrl || check.url, 500),
      checkedAt: normalizeText(check.checkedAt, 60),
      detail: normalizeText(check.errorMessage, 180),
    });
  });

  if (!evidence.length) {
    evidence.push({
      label: `${monitor.label} reported ${normalizeStatus(monitor.status).replace(/_/g, " ")}`,
      url: normalizeText(monitor.baseUrl, 500),
      checkedAt: "",
      detail: normalizeText(monitor.note, 180),
    });
  }
  return evidence;
};

export const buildHealthIncidents = (monitors = []) => (
  (Array.isArray(monitors) ? monitors : [])
    .filter((monitor) => monitor?.status && !isMonitorHealthy(monitor.status))
    .map((monitor) => {
      const checks = Array.isArray(monitor.checks) ? monitor.checks : [];
      const failingChecks = checks.filter((check) => !isMonitorHealthy(check?.status));
      const diagnosis = buildMonitorDiagnosis(monitor, failingChecks);
      const severity = getIncidentSeverity(monitor.status);
      return {
        id: `incident-${monitor.id}`,
        monitorId: monitor.id,
        label: monitor.label,
        category: monitor.category || monitor.kind || "service",
        kind: monitor.kind || "service",
        status: normalizeStatus(monitor.status),
        severity,
        summary: severity === "critical"
          ? `${monitor.label} is not completing its latest health check.`
          : severity === "coverage"
            ? `${monitor.label} cannot be fully monitored yet.`
            : `${monitor.label} is responding with a degraded signal.`,
        likelyCause: diagnosis.cause,
        impact: diagnosis.impact,
        actions: diagnosis.actions,
        evidence: buildEvidence(monitor, failingChecks),
        checks: failingChecks,
        baseUrl: normalizeText(monitor.baseUrl, 500),
      };
    })
    .sort((left, right) => {
      const rank = { critical: 0, warning: 1, coverage: 2 };
      return (rank[left.severity] ?? 3) - (rank[right.severity] ?? 3)
        || left.label.localeCompare(right.label);
    })
);

export const getHealthSummaryState = (incidents = []) => {
  const critical = incidents.filter((incident) => incident.severity === "critical").length;
  const warning = incidents.filter((incident) => incident.severity === "warning").length;
  const coverage = incidents.filter((incident) => incident.severity === "coverage").length;
  if (critical) {
    return { tone: "danger", title: "Service interruption detected", detail: `${critical} critical issue${critical === 1 ? "" : "s"} need attention.`, critical, warning, coverage };
  }
  if (warning) {
    return { tone: "warning", title: "Systems need attention", detail: `${warning} degraded service${warning === 1 ? "" : "s"} should be investigated.`, critical, warning, coverage };
  }
  if (coverage) {
    return { tone: "info", title: "Systems are responding", detail: `${coverage} monitoring gap${coverage === 1 ? "" : "s"} remain.`, critical, warning, coverage };
  }
  return { tone: "success", title: "All monitored systems are operational", detail: "No service interruptions or monitoring gaps were found.", critical, warning, coverage };
};
