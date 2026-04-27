(function initAnalytics() {
  var gaId = "G-5JFM7XNL2Y";
  if (!gaId) return;

  var host = window.location.hostname;
  var isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]";
  var doNotTrackEnabled =
    window.doNotTrack === "1" ||
    navigator.doNotTrack === "1" ||
    navigator.msDoNotTrack === "1";
  if (isLocalHost || doNotTrackEnabled) return;

  var loadAnalytics = function () {
    if (window.__reebsAnalyticsLoaded) return;
    window.__reebsAnalyticsLoaded = true;

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + gaId;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", gaId);
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(loadAnalytics, { timeout: 2500 });
    return;
  }

  window.addEventListener("load", function () {
    window.setTimeout(loadAnalytics, 900);
  }, { once: true });
})();
