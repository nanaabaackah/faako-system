import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  initializeGoogleAnalytics,
  setGoogleAnalyticsConsent,
  trackGoogleAnalyticsPageView,
} from "../src/googleAnalytics.ts";

const installBrowser = () => {
  const scripts = [];
  const elements = new Map();
  const analyticsWindow = {
    location: {
      href: "https://example.test/private?token=secret#fragment",
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

  return { analyticsWindow, scripts };
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
  const { analyticsWindow } = installBrowser();
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
  assert.ok(analyticsWindow.dataLayer.some(
    (entry) => entry[0] === "consent"
      && entry[1] === "update"
      && entry[2].analytics_storage === "denied",
  ));
});
