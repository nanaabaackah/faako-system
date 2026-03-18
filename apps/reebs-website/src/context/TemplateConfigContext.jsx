import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "reebs_template_config";
const PREVIEW_KEY = `${STORAGE_KEY}_preview`;

export const DEFAULT_TEMPLATE_CONFIG = {
  heroKicker: "Party rentals, decor, and supplies across Ghana",
  heroHeading: "REEBS Party Themes",
  heroTagline: "We promise less hassle, more fun!",
  heroSub:
    "Bouncy castles, party planning, balloons, and curated party boxes delivered or set up for you.",
  heroPrimaryCta: "View Rentals",
  heroSecondaryCta: "Explore Our Shop",
  heroTertiaryCta: "Talk to Us",
  accentColor: "#ff7a59",
};

const TemplateConfigContext = createContext(/** @type {import("react").ContextType<any>} */ (null));

const loadTemplateConfig = () => {
  if (typeof window === "undefined") return { ...DEFAULT_TEMPLATE_CONFIG };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_TEMPLATE_CONFIG };
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_TEMPLATE_CONFIG, ...parsed };
  } catch (err) {
    return { ...DEFAULT_TEMPLATE_CONFIG };
  }
};

const getPreviewConfig = () => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("templatePreview")) return null;
  try {
    const preview = window.localStorage.getItem(PREVIEW_KEY);
    if (!preview) return null;
    const parsed = JSON.parse(preview);
    return { ...DEFAULT_TEMPLATE_CONFIG, ...parsed };
  } catch (err) {
    return null;
  }
};

export function TemplateConfigProvider({ children }) {
  const [config, setConfig] = useState(() => {
    const base = loadTemplateConfig();
    const preview = getPreviewConfig();
    return preview || base;
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--accent", config.accentColor || DEFAULT_TEMPLATE_CONFIG.accentColor);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config]);

  const updateTemplateConfig = useCallback((updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetTemplateConfig = useCallback(() => {
    setConfig({ ...DEFAULT_TEMPLATE_CONFIG });
  }, []);

  const storePreviewConfig = useCallback((draft) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(draft));
  }, []);

  const contextValue = useMemo(
    () => ({
      config,
      updateTemplateConfig,
      resetTemplateConfig,
      storePreviewConfig,
    }),
    [config, updateTemplateConfig, resetTemplateConfig, storePreviewConfig]
  );

  return <TemplateConfigContext.Provider value={contextValue}>{children}</TemplateConfigContext.Provider>;
}

export function useTemplateConfig() {
  const context = useContext(TemplateConfigContext);
  if (!context) {
    throw new Error("useTemplateConfig must be used within a TemplateConfigProvider");
  }
  return context;
}
