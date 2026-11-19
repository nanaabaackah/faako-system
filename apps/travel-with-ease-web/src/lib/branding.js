// CMS-driven branding is deliberately constrained to approved hosted font
// families and media produced by the private R2 publication pipeline.
const headingFonts = Object.freeze({
  "poiret-one": '"Poiret One", "Trebuchet MS", Arial, sans-serif',
  "quicksand": '"Quicksand", "Trebuchet MS", Arial, sans-serif',
  "inter": '"Inter", Arial, sans-serif',
  "outfit": '"Outfit", Arial, sans-serif',
});
const bodyFonts = Object.freeze({
  "quicksand": '"Quicksand", "Trebuchet MS", Arial, sans-serif',
  "inter": '"Inter", Arial, sans-serif',
  "outfit": '"Outfit", Arial, sans-serif',
});
const localAssetPattern = /^\/media\/[a-f0-9-]{36}\.webp$/;
export function siteBranding(appearance) {
  const branding = appearance?.branding || {};
  const headingFont = headingFonts[branding.headingFont] || headingFonts["poiret-one"];
  const bodyFont = bodyFonts[branding.bodyFont] || bodyFonts.quicksand;
  const socialImagePattern = /^\\/media\\/[a-f0-9-]{36}-social\\.jpg$/;
  const logo = (key, fallback) =>
    typeof branding[key]?.src === "string" && localAssetPattern.test(branding[key].src)
      ? branding[key].src : fallback;
  return {
    cssVariables: `--font-display: ${headingFont}; --font-body: ${bodyFont};`,
    headerLogo: logo("headerLogo", "/brand/Primary gold.png"),
    scrolledLogo: logo("scrolledLogo", "/brand/dark mode symbol.png"),
    footerLogo: logo("footerLogo", "/brand/midnight primary.png"),
    favicon: logo("favicon", null),
    socialImage: typeof branding.socialImage?.src === "string" && socialImagePattern.test(branding.socialImage.src) ? branding.socialImage : null,
    fonts: { heading: branding.headingFont || "poiret-one", body: branding.bodyFont || "quicksand" },
  };
}
