export default {
  appId: "@faako/ttngh",
  brand: {
    name: "The Thriving Network GH",
    businessName: "The Thriving Network GH",
    shortName: "TTNGH",
    browserChromeColor: "#ffffff",
  },
  theme: {
    presetId: "ttngh",
    tokenOverrides: {
      // Match the existing site tokens; this file does not replace global.css.
      "--sys-bg": "var(--paper)",
      "--sys-bg-elevated": "var(--surface)",
      "--sys-surface": "rgb(255 255 255 / 68%)",
      "--sys-surface-strong": "var(--paper)",
      "--sys-border": "rgb(var(--brand-berry-rgb) / 14%)",
      "--sys-border-strong": "rgb(var(--brand-berry-rgb) / 24%)",
      "--sys-text": "var(--ink)",
      "--sys-muted": "var(--muted)",
      "--sys-accent": "var(--brand-pink)",
      "--sys-accent-contrast": "var(--white)",
      "--sys-accent-soft": "var(--surface-pink-hover)",
      "--sys-success": "#2f7d4b",
      "--sys-success-soft": "rgba(47, 125, 75, 0.12)",
      "--sys-warning": "#c27d2a",
      "--sys-warning-soft": "rgba(194, 125, 42, 0.12)",
      "--sys-danger": "#b64d3c",
      "--sys-danger-soft": "rgba(182, 77, 60, 0.12)",
      "--sys-danger-contrast": "#ffffff",
      "--sys-info": "#305f9a",
      "--sys-info-soft": "rgba(48, 95, 154, 0.12)",
      "--sys-shadow-sm": "0 8px 22px rgb(var(--brand-berry-rgb) / 8%)",
      "--sys-shadow-md": "0 16px 42px rgb(var(--brand-berry-rgb) / 12%)",
      "--sys-shadow-lg": "0 24px 68px rgb(var(--brand-berry-rgb) / 18%)",
      "--sys-overlay": "rgb(var(--brand-berry-rgb) / 42%)",
    },
  },
  security: {
    profileId: "public-interactive",
    // Public Astro site: contact enquiries use an email-app handoff, not login.
    authMode: "none",
  },
};
