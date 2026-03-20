import { useEffect } from "react";

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
  if (element.matches("input, select, textarea, option, source, svg, path, use")) return true;
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

  return Array.from(registry.values()).sort(sortTargets);
};

const markVisible = (element) => {
  element.classList.remove("reveal-pending");
  element.classList.add("is-revealed");
  element.classList.remove("reveal-text", "reveal-media", "reveal-block");
  element.dataset.revealState = "visible";
};

const setRevealState = (element, nextState) => {
  if (!(element instanceof HTMLElement)) return;
  if (nextState === "visible") {
    element.classList.remove("reveal-pending");
    element.classList.add("is-revealed");
  } else {
    element.classList.add("reveal-pending");
    element.classList.remove("is-revealed");
  }
  element.dataset.revealState = nextState;
};

export default function useScrollReveal(pathname, scrollContainerRef) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    if (!isPublicPath(pathname)) return undefined;

    const scrollHost = scrollContainerRef?.current || window;
    const observerRoot = scrollHost === window ? null : scrollHost;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reduceData = window.matchMedia("(prefers-reduced-data: reduce)").matches;
    const lowPowerDevice = (window.navigator?.hardwareConcurrency || 8) <= 4;
    const disableAnimatedReveal = reduceMotion || reduceData || lowPowerDevice;
    const observedTargets = new WeakSet();
    let mutationFrame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target;
          if (entry.isIntersecting) {
            if (target.dataset.revealState !== "visible") {
              setRevealState(target, "visible");
            }
            return;
          }

          if (target.dataset.revealState !== "hidden") {
            setRevealState(target, "hidden");
          }
        });
      },
      {
        threshold: 0.12,
        root: observerRoot,
        rootMargin: "-4% 0px -12% 0px",
      }
    );

    const registerTargets = () => {
      const targets = collectRevealTargets();
      if (!targets.length) return;

      targets.forEach(({ element, kind }) => {
        if (observedTargets.has(element)) return;
        observedTargets.add(element);

        if (disableAnimatedReveal) {
          markVisible(element);
          return;
        }

        element.classList.remove("is-revealed");
        element.classList.add("reveal-pending", `reveal-${kind}`);
        element.dataset.revealKind = kind;
        element.dataset.revealState = "hidden";
        if (kind === "media") {
          const rect = element.getBoundingClientRect();
          const midpoint = window.innerWidth / 2;
          element.dataset.revealSide =
            rect.left + rect.width / 2 < midpoint ? "left" : "right";
        }
        observer.observe(element);
      });
    };

    registerTargets();

    if (disableAnimatedReveal) {
      return () => {
        observer.disconnect();
      };
    }

    const mutationObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            if (mutationFrame) window.cancelAnimationFrame(mutationFrame);
            mutationFrame = window.requestAnimationFrame(registerTargets);
          })
        : null;

    mutationObserver?.observe(scrollHost === window ? document.body : scrollHost, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      mutationObserver?.disconnect();
      if (mutationFrame) window.cancelAnimationFrame(mutationFrame);
    };
  }, [pathname, scrollContainerRef]);
}
