const BOOTSTRAP_FILE_PREFIX = "assets/faako-google-analytics";

const getSafeMeasurementId = (measurementId) => measurementId.replace(/[^a-z0-9_-]/gi, "-");

const createBootstrapSource = (measurementId) => `(function () {
  var measurementId = ${JSON.stringify(measurementId)};
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
  window["ga-disable-" + measurementId] = true;
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

const joinBasePath = (base, path) => {
  if (!base || base === "./") return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
};

const getBootstrapFileName = (measurementId) => (
  `${BOOTSTRAP_FILE_PREFIX}-${getSafeMeasurementId(measurementId)}-bootstrap.js`
);

const getBootstrapSrc = (base, measurementId) => joinBasePath(
  base || "/",
  getBootstrapFileName(measurementId),
);

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
  const bootstrapFileName = resolvedMeasurementId ? getBootstrapFileName(resolvedMeasurementId) : "";
  const bootstrapSource = resolvedMeasurementId ? createBootstrapSource(resolvedMeasurementId) : "";

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
          `/${bootstrapFileName}`,
          getBootstrapSrc(resolvedConfig?.base, resolvedMeasurementId),
        ]);

        if (!bootstrapPaths.has(requestPath)) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "application/javascript; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(bootstrapSource);
      });
    },
    generateBundle() {
      if (!shouldInject) return;

      this.emitFile({
        type: "asset",
        fileName: bootstrapFileName,
        source: bootstrapSource,
      });
    },
    transformIndexHtml() {
      if (!shouldInject) return;

      return [
        {
          tag: "script",
          attrs: {
            src: getBootstrapSrc(resolvedConfig?.base, resolvedMeasurementId),
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
};
