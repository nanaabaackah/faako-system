import type { UiThemePreset } from "@faako/types";

export const ERP_SHELL_THEME = "erp-shell";
export const SYSTEM_THEME_FALLBACK_ID = "core-neutral";

const withFonts = (
  id: string,
  label: string,
  fontBody: string,
  fontDisplay: string,
): UiThemePreset => ({
  id,
  label,
  tokens: {
    "--sys-font-body": fontBody,
    "--sys-font-display": fontDisplay,
  },
});

export const SYSTEM_THEME_PRESETS: Record<string, UiThemePreset> = {
  [SYSTEM_THEME_FALLBACK_ID]: withFonts(
    SYSTEM_THEME_FALLBACK_ID,
    "Core Neutral",
    "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
  ),
  "reebs-portal": withFonts(
    "reebs-portal",
    "REEBS Portal",
    "\"Nunito\", \"Segoe UI\", sans-serif",
    "\"Baloo 2\", \"Segoe UI\", sans-serif",
  ),
  "reebs-website": withFonts(
    "reebs-website",
    "REEBS Website",
    "\"Nunito\", \"Segoe UI\", sans-serif",
    "\"Baloo 2\", \"Segoe UI\", sans-serif",
  ),
  "faako-erp": withFonts(
    "faako-erp",
    "Faako ERP",
    "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
  ),
  "faako-website": withFonts(
    "faako-website",
    "Faako Website",
    "\"Inter\", \"Segoe UI\", sans-serif",
    "\"Inter\", \"Segoe UI\", sans-serif",
  ),
  "dev-erp": withFonts(
    "dev-erp",
    "Dev ERP",
    "\"Inter\", \"Segoe UI\", sans-serif",
    "\"Inter\", \"Segoe UI\", sans-serif",
  ),
  "bynana-portfolio": withFonts(
    "bynana-portfolio",
    "By Nana Portfolio",
    "\"Space Grotesk\", \"Segoe UI\", sans-serif",
    "\"Space Grotesk\", \"Segoe UI\", sans-serif",
  ),
  "faako-api": withFonts(
    "faako-api",
    "Faako API",
    "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
  ),
  "system-starter": withFonts(
    "system-starter",
    "System Starter",
    "\"Inter\", \"Segoe UI\", sans-serif",
    "\"Inter\", \"Segoe UI\", sans-serif",
  ),
  "ui-workbench": withFonts(
    "ui-workbench",
    "UI Workbench",
    "\"Inter\", \"Segoe UI\", sans-serif",
    "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
  ),
};

export const resolveSystemThemePreset = (presetId?: string) =>
  SYSTEM_THEME_PRESETS[presetId || ""] || SYSTEM_THEME_PRESETS[SYSTEM_THEME_FALLBACK_ID];

export const buildResolvedThemeTokens = (
  presetId?: string,
  tokenOverrides: Record<string, string> = {},
) => ({
  ...resolveSystemThemePreset(presetId).tokens,
  ...tokenOverrides,
});

export const getSystemThemeMetaColor = (presetId?: string) =>
  buildResolvedThemeTokens(presetId)["--sys-bg"] || "";
