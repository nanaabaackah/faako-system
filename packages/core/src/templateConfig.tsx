import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  isLoading: boolean;
  error: string;
  updateTemplateConfig: (updates: Partial<TemplateConfig>) => Promise<TemplateConfig>;
  resetTemplateConfig: () => Promise<TemplateConfig>;
  storePreviewConfig: (draft: Partial<TemplateConfig>) => void;
}

const STORAGE_KEY = "reebs_template_config";
const PREVIEW_KEY = `${STORAGE_KEY}_preview`;
const TEMPLATE_CONTENT_URL = "/api/websiteContent?section=template&key=config";
const TEMPLATE_CONTENT_SECTION = "template";
const TEMPLATE_CONTENT_KEY = "config";

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

const normalizeTemplateConfig = (value: Partial<TemplateConfig> | null | undefined): TemplateConfig => {
  const source = value && typeof value === "object" ? value : {};
  return Object.keys(DEFAULT_TEMPLATE_CONFIG).reduce((acc, key) => {
    const configKey = key as keyof TemplateConfig;
    const nextValue = source[configKey];
    acc[configKey] =
      typeof nextValue === "string" && nextValue.trim()
        ? nextValue.trim()
        : DEFAULT_TEMPLATE_CONFIG[configKey];
    return acc;
  }, {} as TemplateConfig);
};

const readErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
};

const fetchTemplateConfig = async (): Promise<TemplateConfig | null> => {
  const response = await fetch(TEMPLATE_CONTENT_URL);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = await response.json();
  const remoteConfig = payload?.content?.payload;
  return remoteConfig && typeof remoteConfig === "object"
    ? normalizeTemplateConfig(remoteConfig)
    : null;
};

const saveTemplateConfig = async (config: TemplateConfig) => {
  const response = await fetch("/api/websiteContent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section: TEMPLATE_CONTENT_SECTION,
      key: TEMPLATE_CONTENT_KEY,
      payload: config,
      sortOrder: 0,
      isActive: true,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = await response.json();
  return normalizeTemplateConfig(payload?.content?.payload || config);
};

const getPreviewConfig = (): TemplateConfig | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (!params.has("templatePreview")) return null;

  try {
    const preview = window.localStorage.getItem(PREVIEW_KEY);
    if (!preview) return null;
    const parsed = JSON.parse(preview);
    return normalizeTemplateConfig(parsed);
  } catch {
    return null;
  }
};

export function TemplateConfigProvider({ children }: { children: React.ReactNode }) {
  const [previewConfig] = useState<TemplateConfig | null>(() => getPreviewConfig());
  const [config, setConfig] = useState<TemplateConfig>(() =>
    previewConfig || { ...DEFAULT_TEMPLATE_CONFIG },
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !previewConfig);
  const [error, setError] = useState("");
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (previewConfig) return;

    let active = true;
    setIsLoading(true);
    setError("");

    fetchTemplateConfig()
      .then((remoteConfig) => {
        if (!active) return;
        if (remoteConfig) {
          setConfig(remoteConfig);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Unable to load website settings.");
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [previewConfig]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--accent",
        config.accentColor || DEFAULT_TEMPLATE_CONFIG.accentColor,
      );
    }
  }, [config]);

  const updateTemplateConfig = useCallback(async (updates: Partial<TemplateConfig>) => {
    const previous = configRef.current;
    const nextConfig = normalizeTemplateConfig({ ...previous, ...updates });
    setConfig(nextConfig);
    setError("");

    try {
      const savedConfig = await saveTemplateConfig(nextConfig);
      setConfig(savedConfig);
      return savedConfig;
    } catch (err) {
      setConfig(previous);
      const message = err instanceof Error ? err.message : "Unable to save website settings.";
      setError(message);
      throw err;
    }
  }, []);

  const resetTemplateConfig = useCallback(async () => {
    const previous = configRef.current;
    const nextConfig = normalizeTemplateConfig(DEFAULT_TEMPLATE_CONFIG);
    setConfig(nextConfig);
    setError("");

    try {
      const savedConfig = await saveTemplateConfig(nextConfig);
      setConfig(savedConfig);
      return savedConfig;
    } catch (err) {
      setConfig(previous);
      const message = err instanceof Error ? err.message : "Unable to save website settings.";
      setError(message);
      throw err;
    }
  }, []);

  const storePreviewConfig = useCallback((draft: Partial<TemplateConfig>) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(draft));
  }, []);

  const contextValue = useMemo(
    () => ({
      config,
      isLoading,
      error,
      updateTemplateConfig,
      resetTemplateConfig,
      storePreviewConfig,
    }),
    [config, error, isLoading, resetTemplateConfig, storePreviewConfig, updateTemplateConfig],
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
