const BROWSER_CHROME_VARIABLE = "--browser-chrome-color";
const THEME_COLOR_SELECTOR = 'meta[name="theme-color"]';
const TRANSPARENT_VALUES = new Set(["", "transparent", "rgba(0, 0, 0, 0)"]);

const normalizeResolvedColor = (value = "") => {
  const trimmed = String(value || "").trim();
  if (TRANSPARENT_VALUES.has(trimmed)) return "";
  return trimmed;
};

const resolveCssColor = (value = "") => {
  if (typeof document === "undefined") return "";

  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.inset = "-9999px";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.backgroundColor = trimmed;

  (document.body || document.documentElement).appendChild(probe);
  const resolved = normalizeResolvedColor(getComputedStyle(probe).backgroundColor);
  probe.remove();

  return resolved;
};

const readCssVariableColor = (element, variableName = BROWSER_CHROME_VARIABLE) => {
  if (!element || typeof window === "undefined") return "";
  const rawValue = getComputedStyle(element).getPropertyValue(variableName).trim();
  return resolveCssColor(rawValue);
};

const ensureThemeColorMeta = () => {
  if (typeof document === "undefined") return [];

  const existing = Array.from(document.head.querySelectorAll(THEME_COLOR_SELECTOR));
  if (existing.length) return existing;

  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  document.head.appendChild(meta);
  return [meta];
};

export const readMobileBrowserChromeColor = (fallbackColor = "#ffffff") => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return fallbackColor;
  }

  return (
    readCssVariableColor(document.body) ||
    readCssVariableColor(document.documentElement) ||
    normalizeResolvedColor(getComputedStyle(document.body).backgroundColor) ||
    normalizeResolvedColor(getComputedStyle(document.documentElement).backgroundColor) ||
    fallbackColor
  );
};

export const syncMobileBrowserChrome = ({ fallbackColor = "#ffffff" } = {}) => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => {};
  }

  const sync = () => {
    const color = readMobileBrowserChromeColor(fallbackColor);
    ensureThemeColorMeta().forEach((meta) => {
      meta.setAttribute("content", color);
    });
  };

  let frameId = 0;
  const scheduleSync = () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
    frameId = window.requestAnimationFrame(sync);
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });

  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
  }

  const colorSchemeMedia =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const handleColorSchemeChange = () => scheduleSync();

  window.addEventListener("pageshow", scheduleSync);
  window.addEventListener("resize", scheduleSync, { passive: true });
  document.addEventListener("visibilitychange", scheduleSync);

  if (colorSchemeMedia) {
    if (typeof colorSchemeMedia.addEventListener === "function") {
      colorSchemeMedia.addEventListener("change", handleColorSchemeChange);
    } else if (typeof colorSchemeMedia.addListener === "function") {
      colorSchemeMedia.addListener(handleColorSchemeChange);
    }
  }

  scheduleSync();

  return () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
    observer.disconnect();
    window.removeEventListener("pageshow", scheduleSync);
    window.removeEventListener("resize", scheduleSync);
    document.removeEventListener("visibilitychange", scheduleSync);

    if (colorSchemeMedia) {
      if (typeof colorSchemeMedia.removeEventListener === "function") {
        colorSchemeMedia.removeEventListener("change", handleColorSchemeChange);
      } else if (typeof colorSchemeMedia.removeListener === "function") {
        colorSchemeMedia.removeListener(handleColorSchemeChange);
      }
    }
  };
};
