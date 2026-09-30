export default {
  appId: "@faako/travel-with-ease-portal",
  brand: { name: "Travel With Ease", businessName: "Travel With Ease", shortName: "TWE", browserChromeColor: "#010c33" },
  theme: { presetId: "core-neutral", tokenOverrides: { "--sys-bg": "#f4ede3", "--sys-bg-elevated": "#eee4d5", "--sys-surface": "#fffdf9", "--sys-surface-strong": "#ffffff", "--sys-border": "rgba(1,12,51,.14)", "--sys-border-strong": "rgba(1,12,51,.24)", "--sys-text": "#000a1f", "--sys-muted": "#656874", "--sys-accent": "#010c33", "--sys-accent-contrast": "#ffffff", "--sys-accent-soft": "rgba(122,184,255,.16)", "--sys-success": "#19734b", "--sys-success-soft": "#e4f3eb", "--sys-warning": "#92640d", "--sys-warning-soft": "#faf0d8", "--sys-danger": "#b42318", "--sys-danger-soft": "#fde9e7", "--sys-danger-contrast": "#fff", "--sys-info": "#2563a8", "--sys-info-soft": "#e4f0fb", "--sys-shadow-sm": "0 8px 22px rgba(0,10,31,.07)", "--sys-shadow-md": "0 18px 44px rgba(0,10,31,.10)", "--sys-shadow-lg": "0 30px 70px rgba(0,10,31,.14)", "--sys-overlay": "rgba(0,10,31,.45)" } },
  // Match the development server; do not invent production origins.
  security: { profileId: "authenticated-workspace", authMode: "bearer", allowedOrigins: ["http://localhost:5188"] },
};
