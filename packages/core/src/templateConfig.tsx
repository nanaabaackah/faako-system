import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface TemplateConfig {
  heroKicker: string;
  heroHeading: string;
  heroTagline: string;
  heroSub: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroTertiaryCta: string;
  accentColor: string;
}

interface TemplateConfigContextValue {
  config: TemplateConfig;
  updateTemplateConfig: (updates: Partial<TemplateConfig>) => void;
  resetTemplateConfig: () => void;
  storePreviewConfig: (draft: Partial<TemplateConfig>) => void;
}

const STORAGE_KEY = "reebs_template_config";
const PREVIEW_KEY = `${STORAGE_KEY}_preview`;

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
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

const TemplateConfigContext = createContext<TemplateConfigContextValue | null>(null);

const loadTemplateConfig = (): TemplateConfig => {
  if (typeof window === "undefined") return { ...DEFAULT_TEMPLATE_CONFIG };

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_TEMPLATE_CONFIG };
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_TEMPLATE_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_TEMPLATE_CONFIG };
  }
};

const getPreviewConfig = (): TemplateConfig | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (!params.has("templatePreview")) return null;

  try {
    const preview = window.localStorage.getItem(PREVIEW_KEY);
    if (!preview) return null;
    const parsed = JSON.parse(preview);
    return { ...DEFAULT_TEMPLATE_CONFIG, ...parsed };
  } catch {
    return null;
  }
};

export function TemplateConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TemplateConfig>(() => {
    const base = loadTemplateConfig();
    const preview = getPreviewConfig();
    return preview || base;
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--accent",
        config.accentColor || DEFAULT_TEMPLATE_CONFIG.accentColor,
      );
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config]);

  const updateTemplateConfig = useCallback((updates: Partial<TemplateConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetTemplateConfig = useCallback(() => {
    setConfig({ ...DEFAULT_TEMPLATE_CONFIG });
  }, []);

  const storePreviewConfig = useCallback((draft: Partial<TemplateConfig>) => {
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
    [config, resetTemplateConfig, storePreviewConfig, updateTemplateConfig],
  );

  return (
    <TemplateConfigContext.Provider value={contextValue}>
      {children}
    </TemplateConfigContext.Provider>
  );
}

export function useTemplateConfig() {
  const context = useContext(TemplateConfigContext);

  if (!context) {
    throw new Error("useTemplateConfig must be used within a TemplateConfigProvider");
  }

  return context;
}
