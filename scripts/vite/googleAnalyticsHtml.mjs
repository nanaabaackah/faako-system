const SCRIPT_ID_PREFIX = "faako-google-analytics";
const BOOTSTRAP_FILE_NAME = "assets/faako-google-analytics-bootstrap.js";

const BOOTSTRAP_SOURCE = `(function () {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });
  window.__faakoGoogleAnalyticsConsentDefaulted = true;
}());
`;

const resolveGoogleAnalyticsMeasurementId = (...values) => {
  const measurementId = values
    .map((value) => String(value || "").trim())
    .find(Boolean);

  return measurementId || "";
};

const toBoolean = (value) => value === true || String(value || "").trim().toLowerCase() === "true";

const isGoogleAnalyticsEnabledForEnvironment = (mode, enableInDevelopment) => {
  return mode === "production" || toBoolean(enableInDevelopment);
};

const getScriptId = (measurementId) => (
  `${SCRIPT_ID_PREFIX}-${measurementId.replace(/[^a-z0-9_-]/gi, "-")}`
);

const joinBasePath = (base, path) => {
  if (!base || base === "./") return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
};

const getBootstrapSrc = (base) => joinBasePath(base || "/", BOOTSTRAP_FILE_NAME);

const getRequestPath = (requestUrl = "") => {
  try {
    return decodeURIComponent(requestUrl.split("?")[0] || "");
  } catch {
    return requestUrl.split("?")[0] || "";
  }
};

export const createGoogleAnalyticsHtmlPlugin = ({
  measurementId,
  fallbackMeasurementId,
  enableInDevelopment,
  enabled,
  mode = process.env.NODE_ENV === "production" ? "production" : "development",
} = {}) => {
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId, fallbackMeasurementId);
  const shouldInject = Boolean(
    resolvedMeasurementId
    && (typeof enabled === "boolean"
      ? enabled
      : isGoogleAnalyticsEnabledForEnvironment(mode, enableInDevelopment))
  );
  let resolvedConfig;

  return {
    name: "faako-google-analytics-html",
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      if (!shouldInject) return;

      server.middlewares.use((request, response, next) => {
        const requestPath = getRequestPath(request.url);
        const bootstrapPaths = new Set([
          `/${BOOTSTRAP_FILE_NAME}`,
          getBootstrapSrc(resolvedConfig?.base),
        ]);

        if (!bootstrapPaths.has(requestPath)) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "application/javascript; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(BOOTSTRAP_SOURCE);
      });
    },
    generateBundle() {
      if (!shouldInject) return;

      this.emitFile({
        type: "asset",
        fileName: BOOTSTRAP_FILE_NAME,
        source: BOOTSTRAP_SOURCE,
      });
    },
    transformIndexHtml() {
      if (!shouldInject) return;

      const scriptId = getScriptId(resolvedMeasurementId);

      return [
        {
          tag: "script",
          attrs: {
            id: scriptId,
            async: true,
            src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(resolvedMeasurementId)}`,
          },
          injectTo: "head-prepend",
        },
        {
          tag: "script",
          attrs: {
            src: getBootstrapSrc(resolvedConfig?.base),
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
};
