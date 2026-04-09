import { useFrontFacingScrollReveal } from "@faako/ui/useFrontFacingScrollReveal";

const REVEAL_SELECTORS = {
  block: [
    "main form",
    "main .hero-proof-row",
    "main .hero-ctas",
    "main .cta-actions",
    "main .featured-more",
    "main [class*='metrics'] > *",
    "main [class*='rates-row'] > *",
    ".site-footer .footer-promo",
    ".site-footer .footer-brand",
    ".site-footer .footer-column",
    ".site-footer .footer-contact-list",
    ".site-footer .footer-rates",
    ".site-footer .footer-bottom",
  ],
  text: [
    "main h1",
    "main h2",
    "main h3",
    "main h4",
    "main h5",
    "main h6",
    "main p",
    "main li",
    "main blockquote",
    "main figcaption",
    "main .section-kicker",
    "main .kicker",
    "main .hero-proof-row span",
    "main .about-pill",
    "main .cta-chip",
    "main .why-stat",
    ".site-footer h3",
    ".site-footer p",
    ".site-footer li",
    ".site-footer .footer-link",
    ".site-footer .footer-rate-pill",
    ".site-footer .footer-hours",
  ],
  media: [
    "main img",
    "main picture",
    "main video",
    "main figure",
    "main .hero-video-container",
    "main [class*='media']",
    "main [class*='image']",
    "main [class*='photo']",
    ".site-footer img",
  ],
};

const REVEAL_KIND_PRIORITY = {
  text: 1,
  block: 2,
  media: 3,
};

const isPublicPath = (pathname = "") => {
  const normalized = pathname.toLowerCase();
  return !normalized.startsWith("/admin");
};

const hasMeaningfulText = (element) =>
  String(element?.textContent || "")
    .replace(/\s+/g, " ")
    .trim().length > 0;

const shouldSkipElement = (element, kind) => {
  if (!(element instanceof HTMLElement)) return true;
  if (element.closest("[data-no-reveal='true']")) return true;
  if (element.closest(".loader, .site-loader, .shop-skeleton, .cookie-banner")) return true;
  if (element.classList.contains("site-header")) return true;
  if (element.classList.contains("shell-bottom-cta")) return true;
  if (element.classList.contains("back-to-top")) return true;
  if (element.classList.contains("party-confetti")) return true;
  if (element.classList.contains("app-icon")) return true;
  if (element.classList.contains("sr-only")) return true;
  if (element.matches("input, select, textarea, option, source, svg, path, use, .ui-date-field__trigger, .ui-dropdown-field__trigger")) return true;
  if (element.closest(".search-field")) return true;
  if (kind === "text" && !hasMeaningfulText(element)) return true;
  if (
    kind === "text" &&
    element.matches("li") &&
    element.querySelector("h1, h2, h3, h4, h5, h6, p, figure, img, video")
  ) {
    return true;
  }
  if (kind === "text" && element.closest("nav")) return true;
  if (
    kind === "media" &&
    element.matches("figure, picture") &&
    element.querySelector("img, picture, video")
  ) {
    return true;
  }
  if (
    kind === "media" &&
    element.matches("figure") &&
    !element.querySelector("img, picture, video")
  ) {
    return true;
  }
  if (element.offsetParent === null && !element.matches("video, .hero-video-container")) return true;
  return false;
};

const sortTargets = (a, b) => {
  if (a.element === b.element) return 0;
  const position = a.element.compareDocumentPosition(b.element);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
};

const collectRevealTargets = () => {
  const registry = new Map();

  Object.entries(REVEAL_SELECTORS).forEach(([kind, selectors]) => {
    document.querySelectorAll(selectors.join(", ")).forEach((element) => {
      if (shouldSkipElement(element, kind)) return;

      const existing = registry.get(element);
      if (
        !existing ||
        REVEAL_KIND_PRIORITY[kind] > REVEAL_KIND_PRIORITY[existing.kind]
      ) {
        registry.set(element, { element, kind });
      }
    });
  });

  return Array.from(registry.values())
    .sort(sortTargets)
    .map(({ element }) => element);
};

export default function useScrollReveal(pathname, scrollContainerRef) {
  useFrontFacingScrollReveal({
    enabled: isPublicPath(pathname),
    rootRef: scrollContainerRef,
    getTargets: collectRevealTargets,
    getMutationRoot: () => scrollContainerRef?.current || document.body,
  });
}
