import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getGoogleAnalyticsDiagnostics,
  initializeGoogleAnalytics,
  resolveGoogleAnalyticsMeasurementId,
  setGoogleAnalyticsConsent,
  trackGoogleAnalyticsPageView,
} from "../src/googleAnalytics.ts";

const installBrowser = () => {
  const scripts = [];
  const elements = new Map();
  const cookieWrites = [];
  let cookieValue = "";
  const analyticsWindow = {
    location: {
      href: "https://example.test/private?token=secret#fragment",
      hostname: "example.test",
      origin: "https://example.test",
    },
  };
  const analyticsDocument = {
    title: "Example page",
    head: {
      appendChild(script) {
        scripts.push(script);
        if (script.id) elements.set(script.id, script);
      },
    },
    createElement() {
      return { id: "", async: false, src: "" };
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll() {
      return scripts;
    },
  };
  Object.defineProperty(analyticsDocument, "cookie", {
    configurable: true,
    get: () => cookieValue,
    set: (value) => cookieWrites.push(value),
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: analyticsWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: analyticsDocument,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { doNotTrack: "0" },
  });

  return {
    analyticsWindow,
    cookieWrites,
    scripts,
    setCookies(value) { cookieValue = value; },
  };
};

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;
});

test("does not initialise or load Google Analytics before analytics consent", () => {
  const { analyticsWindow, scripts } = installBrowser();

  const initialized = initializeGoogleAnalytics({
    measurementId: "G-TEST123456",
    consent: { analytics: false, marketing: false },
  });

  assert.equal(initialized, false);
  assert.equal(analyticsWindow["ga-disable-G-TEST123456"], true);
  assert.deepEqual(scripts, []);
  assert.deepEqual(analyticsWindow.__faakoGoogleAnalyticsInitializedIds, undefined);
});

test("resolves the first configured measurement ID and handles missing configuration", () => {
  installBrowser();
  assert.equal(resolveGoogleAnalyticsMeasurementId("", "  G-SECOND123  "), "G-SECOND123");
  assert.equal(resolveGoogleAnalyticsMeasurementId(undefined, " "), "");
  assert.deepEqual(getGoogleAnalyticsDiagnostics(""), {
    configured: false,
    collectionEnabled: false,
    consentDefaulted: false,
    doNotTrack: false,
    initialized: false,
    lastAction: "missing-measurement-id",
    lastPagePath: "",
    scriptPresent: false,
  });
  assert.equal(getGoogleAnalyticsDiagnostics("G-TEST123456").collectionEnabled, false);
});

test("initialises before sending one sanitized GA4 page view after consent", () => {
  const { analyticsWindow, scripts } = installBrowser();

  assert.equal(initializeGoogleAnalytics({
    measurementId: "G-TEST123456",
    consent: { analytics: true, marketing: false },
  }), true);
  assert.equal(trackGoogleAnalyticsPageView({
    measurementId: "G-TEST123456",
  }), true);

  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST123456");
  const commands = analyticsWindow.dataLayer;
  assert.ok(commands.some((entry) => entry[0] === "config" && entry[1] === "G-TEST123456"));
  const pageView = commands.find((entry) => entry[0] === "event" && entry[1] === "page_view");
  assert.equal(pageView[2].page_location, "https://example.test/private");
  assert.equal(pageView[2].page_path, "/private");
});

test("revoking consent blocks later page views", () => {
  const { analyticsWindow, cookieWrites, setCookies } = installBrowser();
  setCookies("_ga=base; _ga_TEST123=stream; essential=yes");
  initializeGoogleAnalytics({
    measurementId: "G-TEST123456",
    consent: { analytics: true, marketing: false },
  });

  assert.equal(setGoogleAnalyticsConsent("G-TEST123456", {
    analytics: false,
    marketing: false,
  }), true);
  assert.equal(trackGoogleAnalyticsPageView({ measurementId: "G-TEST123456" }), false);
  assert.equal(analyticsWindow["ga-disable-G-TEST123456"], true);
  assert.ok(cookieWrites.some((value) => value.startsWith("_ga=; Max-Age=0")));
  assert.ok(cookieWrites.some((value) => value.startsWith("_ga_TEST123=; Max-Age=0")));
  assert.ok(cookieWrites.every((value) => !value.startsWith("essential=")));
  assert.ok(analyticsWindow.dataLayer.some(
    (entry) => entry[0] === "consent"
      && entry[1] === "update"
      && entry[2].analytics_storage === "denied",
  ));
});

test("deduplicates sanitized page views while tracking real path changes", () => {
  const { analyticsWindow } = installBrowser();
  initializeGoogleAnalytics({
    measurementId: "G-TEST123456",
    consent: { analytics: true, marketing: false },
  });

  assert.equal(trackGoogleAnalyticsPageView({
    measurementId: "G-TEST123456",
    pageLocation: "https://example.test/shop?campaign=one#top",
  }), true);
  assert.equal(trackGoogleAnalyticsPageView({
    measurementId: "G-TEST123456",
    pageLocation: "https://example.test/shop?campaign=two#details",
  }), false);
  assert.equal(trackGoogleAnalyticsPageView({
    measurementId: "G-TEST123456",
    pageLocation: "https://example.test/contact",
  }), true);

  assert.equal(
    analyticsWindow.dataLayer.filter((entry) => entry[0] === "event" && entry[1] === "page_view").length,
    2,
  );
  assert.equal(getGoogleAnalyticsDiagnostics("G-TEST123456").lastPagePath, "/contact");
});

test("Do Not Track prevents initialization, script loading, and page views", () => {
  const { analyticsWindow, scripts } = installBrowser();
  Object.defineProperty(globalThis.navigator, "doNotTrack", { configurable: true, value: "1" });

  assert.equal(initializeGoogleAnalytics({
    measurementId: "G-TEST123456",
    consent: { analytics: true, marketing: false },
  }), false);
  assert.equal(scripts.length, 0);
  assert.equal(trackGoogleAnalyticsPageView({ measurementId: "G-TEST123456" }), false);
  assert.equal(analyticsWindow["ga-disable-G-TEST123456"], true);
  assert.equal(getGoogleAnalyticsDiagnostics("G-TEST123456").lastAction, "blocked-by-do-not-track");
});

test("repeated initialization does not add duplicate Google tag scripts", () => {
  const { scripts } = installBrowser();
  const options = {
    measurementId: "G-TEST123456",
    consent: { analytics: true, marketing: false },
  };

  assert.equal(initializeGoogleAnalytics(options), true);
  assert.equal(initializeGoogleAnalytics(options), true);
  assert.equal(scripts.length, 1);
});
