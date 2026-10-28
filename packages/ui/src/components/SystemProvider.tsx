import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { AppSystemConfig } from "@faako/types";
import { readMobileBrowserChromeColor } from "@faako/utils";
import { buildResolvedThemeTokens, getSystemThemeMetaColor, resolveSystemThemePreset } from "@faako/theme";
import { normalizeAuthMode, normalizeSecurityProfileId } from "@faako/security";
import { ToastProvider } from "./Feedback";

interface UiSystemContextValue {
  appSystem: AppSystemConfig;
  themeTokens: Record<string, string>;
}

const FALLBACK_SYSTEM: AppSystemConfig = {
  appId: "unknown-app",
  brand: {
    name: "Faako System",
  },
  theme: {
    presetId: "core-neutral",
  },
  security: {
    profileId: "public-static",
    authMode: "none",
  },
};

const UiSystemContext = createContext<UiSystemContextValue>({
  appSystem: FALLBACK_SYSTEM,
  themeTokens: buildResolvedThemeTokens("core-neutral"),
});

const ensureThemeMeta = (color: string) => {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
};

export function UiSystemProvider({
  appSystem,
  children,
}: PropsWithChildren<{ appSystem: AppSystemConfig }>) {
  const safeAppSystem = appSystem || FALLBACK_SYSTEM;
  const preset = useMemo(
    () => resolveSystemThemePreset(safeAppSystem?.theme?.presetId),
    [safeAppSystem?.theme?.presetId],
  );
  const themeTokens = useMemo(
    () => buildResolvedThemeTokens(preset.id, safeAppSystem?.theme?.tokenOverrides || {}),
    [preset.id, safeAppSystem?.theme?.tokenOverrides],
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const root = document.documentElement;
    const previousValues = new Map<string, string>();
    const previousAttrs = {
      theme: root.getAttribute("data-faako-theme"),
      securityProfile: root.getAttribute("data-security-profile"),
      authMode: root.getAttribute("data-auth-mode"),
      appId: root.getAttribute("data-faako-app"),
    };

    root.setAttribute("data-faako-theme", preset.id);
    root.setAttribute(
      "data-security-profile",
      normalizeSecurityProfileId(safeAppSystem?.security?.profileId),
    );
    root.setAttribute("data-auth-mode", normalizeAuthMode(safeAppSystem?.security?.authMode));
    root.setAttribute("data-faako-app", safeAppSystem.appId);

    Object.entries(themeTokens).forEach(([key, value]) => {
      previousValues.set(key, root.style.getPropertyValue(key));
      root.style.setProperty(key, value);
    });

    ensureThemeMeta(
      readMobileBrowserChromeColor(
        safeAppSystem?.brand?.browserChromeColor || getSystemThemeMetaColor(preset.id)
      )
    );

    return () => {
      Object.entries(previousAttrs).forEach(([key, value]) => {
        const attrName =
          key === "theme"
            ? "data-faako-theme"
            : key === "securityProfile"
              ? "data-security-profile"
              : key === "authMode"
                ? "data-auth-mode"
                : "data-faako-app";
        if (value) {
          root.setAttribute(attrName, value);
        } else {
          root.removeAttribute(attrName);
        }
      });

      previousValues.forEach((value, key) => {
        if (value) {
          root.style.setProperty(key, value);
        } else {
          root.style.removeProperty(key);
        }
      });
    };
  }, [
    preset.id,
    safeAppSystem.appId,
    safeAppSystem?.brand?.browserChromeColor,
    safeAppSystem?.security?.authMode,
    safeAppSystem?.security?.profileId,
    themeTokens,
  ]);

  const contextValue = useMemo(
    () => ({
      appSystem: safeAppSystem,
      themeTokens,
    }),
    [safeAppSystem, themeTokens],
  );

  return (
    <UiSystemContext.Provider value={contextValue}>
      <ToastProvider>{children}</ToastProvider>
    </UiSystemContext.Provider>
  );
}

export const useUiSystem = () => useContext(UiSystemContext);
