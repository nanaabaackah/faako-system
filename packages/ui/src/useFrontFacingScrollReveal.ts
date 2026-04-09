import { RefObject, useEffect } from "react";

type ScrollRevealOptions = {
  enabled?: boolean;
  rootRef?: RefObject<HTMLElement | null>;
  query?: string;
  getTargets?: () => Array<HTMLElement | null | undefined>;
  getMotionImage?: (node: HTMLElement) => HTMLElement | null;
  getMutationRoot?: () => Node | null;
  threshold?: number;
  rootMargin?: string;
};

const DEFAULT_QUERY = "[data-scroll], .reveal";
const ENTER_OFFSET = 28;
const EXIT_OFFSET = 22;
const ENTER_BLUR = 6;
const EXIT_BLUR = 4;
const ENTER_DURATION = 760;
const EXIT_DURATION = 420;
const ENTER_EASING = "cubic-bezier(0.215, 0.61, 0.355, 1)";
const EXIT_EASING = "cubic-bezier(0.55, 0.085, 0.68, 0.53)";

const parseDelayMs = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return 0;
  if (raw.endsWith("ms")) return Number.parseFloat(raw) || 0;
  if (raw.endsWith("s")) return (Number.parseFloat(raw) || 0) * 1000;
  return Number.parseFloat(raw) || 0;
};

const defaultGetMotionImage = (node: HTMLElement) => {
  if (
    node.classList.contains("feature-visual") ||
    node.classList.contains("hero-visual")
  ) {
    return node.querySelector<HTMLElement>("img");
  }
  return null;
};

const toUniqueElements = (nodes: Array<HTMLElement | null | undefined>) => {
  const unique = new Set<HTMLElement>();
  nodes.forEach((node) => {
    if (node instanceof HTMLElement) {
      unique.add(node);
    }
  });
  return Array.from(unique);
};

const setStaticState = (node: HTMLElement, isVisible: boolean, direction: "up" | "down") => {
  node.classList.add("js-observed-reveal");
  node.classList.toggle("is-visible", isVisible);
  node.style.transition = "none";
  node.style.opacity = isVisible ? "1" : "0";
  node.style.transform = isVisible
    ? "translateY(0px)"
    : `translateY(${direction === "down" ? ENTER_OFFSET : -ENTER_OFFSET}px)`;
  node.style.filter = isVisible ? "blur(0px)" : `blur(${ENTER_BLUR}px)`;
  node.style.willChange = isVisible ? "auto" : "transform, opacity, filter";
};

const readNodeDelay = (node: HTMLElement) =>
  parseDelayMs(node.style.getPropertyValue("--delay")) ||
  parseDelayMs(getComputedStyle(node).getPropertyValue("--delay"));

export function useFrontFacingScrollReveal({
  enabled = true,
  rootRef,
  query = DEFAULT_QUERY,
  getTargets,
  getMotionImage = defaultGetMotionImage,
  getMutationRoot,
  threshold = 0.22,
  rootMargin = "-5% 0px -8% 0px",
}: ScrollRevealOptions = {}) {
  useEffect(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return undefined;
    }

    const scrollHost = rootRef?.current ?? null;
    const observerRoot = scrollHost ?? null;
    const scrollTarget: HTMLElement | Window = scrollHost ?? window;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observedTargets = new WeakSet<HTMLElement>();
    const visibilityMap = new WeakMap<HTMLElement, boolean>();
    const animationMap = new WeakMap<HTMLElement, Animation>();
    const featureVisualEntries: Array<{ node: HTMLElement; image: HTMLElement }> = [];
    let mutationFrame = 0;
    let zoomRafId = 0;

    const collectTargets = () => {
      if (typeof getTargets === "function") {
        return toUniqueElements(getTargets());
      }
      return toUniqueElements(Array.from(document.querySelectorAll<HTMLElement>(query)));
    };

    const getScrollTop = () =>
      scrollHost ? scrollHost.scrollTop : window.scrollY || window.pageYOffset || 0;

    let lastScrollTop = getScrollTop();
    let scrollDirection: "up" | "down" = "down";

    const setScrollDirection = () => {
      const currentTop = getScrollTop();
      if (currentTop > lastScrollTop + 1) {
        scrollDirection = "down";
      } else if (currentTop < lastScrollTop - 1) {
        scrollDirection = "up";
      }
      lastScrollTop = currentTop;
    };

    const updateFeatureVisualZoom = () => {
      if (!featureVisualEntries.length) return;

      const viewportHeight = window.innerHeight || 1;

      featureVisualEntries.forEach(({ node, image }) => {
        const rect = node.getBoundingClientRect();
        const start = viewportHeight;
        const end = -rect.height * 0.35;
        const progress = Math.min(
          Math.max((start - rect.top) / (start - end), 0),
          1
        );
        const scale = 1 + progress * 0.18;
        image.style.transform = `scale(${scale.toFixed(4)})`;
      });
    };

    const scheduleFeatureZoom = () => {
      if (zoomRafId) return;
      zoomRafId = window.requestAnimationFrame(() => {
        zoomRafId = 0;
        updateFeatureVisualZoom();
      });
    };

    const stopAnimation = (node: HTMLElement) => {
      const activeAnimation = animationMap.get(node);
      if (!activeAnimation) return;
      activeAnimation.cancel();
      animationMap.delete(node);
    };

    const animateNode = (node: HTMLElement, isEntering: boolean) => {
      stopAnimation(node);

      const enterFrom = scrollDirection === "down" ? ENTER_OFFSET : -ENTER_OFFSET;
      const exitTo = scrollDirection === "down" ? -EXIT_OFFSET : EXIT_OFFSET;
      const delay = isEntering ? readNodeDelay(node) : 0;
      const keyframes = isEntering
        ? [
            {
              opacity: 0,
              transform: `translateY(${enterFrom}px)`,
              filter: `blur(${ENTER_BLUR}px)`,
            },
            {
              opacity: 1,
              transform: "translateY(0px)",
              filter: "blur(0px)",
            },
          ]
        : [
            {
              opacity: 1,
              transform: "translateY(0px)",
              filter: "blur(0px)",
            },
            {
              opacity: 0,
              transform: `translateY(${exitTo}px)`,
              filter: `blur(${EXIT_BLUR}px)`,
            },
          ];

      node.classList.add("js-observed-reveal");
      node.classList.toggle("is-visible", isEntering);
      node.style.willChange = "transform, opacity, filter";

      if (typeof node.animate !== "function") {
        setStaticState(node, isEntering, scrollDirection);
        return;
      }

      const animation = node.animate(keyframes, {
        duration: isEntering ? ENTER_DURATION : EXIT_DURATION,
        delay,
        easing: isEntering ? ENTER_EASING : EXIT_EASING,
        fill: "forwards",
      });

      animationMap.set(node, animation);

      animation.onfinish = () => {
        if (animationMap.get(node) !== animation) return;
        animationMap.delete(node);
        setStaticState(node, isEntering, scrollDirection);
      };

      animation.oncancel = () => {
        if (animationMap.get(node) === animation) {
          animationMap.delete(node);
        }
      };
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const node = entry.target;
          if (!(node instanceof HTMLElement)) return;

          const isVisible = entry.isIntersecting;
          const wasVisible = visibilityMap.get(node);

          if (wasVisible === isVisible) return;

          visibilityMap.set(node, isVisible);
          animateNode(node, isVisible);
        });
      },
      {
        threshold,
        root: observerRoot,
        rootMargin,
      }
    );

    const registerTargets = () => {
      const targets = collectTargets();

      targets.forEach((node) => {
        if (observedTargets.has(node)) return;
        observedTargets.add(node);

        const motionImage = getMotionImage(node);
        if (motionImage) {
          motionImage.style.transformOrigin = "50% 50%";
          motionImage.style.willChange = "transform";
          featureVisualEntries.push({ node, image: motionImage });
        }

        if (prefersReducedMotion) {
          setStaticState(node, true, scrollDirection);
          return;
        }

        setStaticState(node, false, scrollDirection);
        visibilityMap.set(node, false);
        observer.observe(node);
      });

      if (!prefersReducedMotion) {
        scheduleFeatureZoom();
      }
    };

    registerTargets();

    if (prefersReducedMotion) {
      return () => {
        observer.disconnect();
      };
    }

    const handleScroll = () => {
      setScrollDirection();
      scheduleFeatureZoom();
    };

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", scheduleFeatureZoom);

    const mutationObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            if (mutationFrame) window.cancelAnimationFrame(mutationFrame);
            mutationFrame = window.requestAnimationFrame(registerTargets);
          })
        : null;

    const mutationRoot =
      getMutationRoot?.() ??
      (scrollHost ? scrollHost : document.body);

    if (mutationRoot) {
      mutationObserver?.observe(mutationRoot, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
      mutationObserver?.disconnect();
      scrollTarget.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", scheduleFeatureZoom);

      if (mutationFrame) window.cancelAnimationFrame(mutationFrame);
      if (zoomRafId) window.cancelAnimationFrame(zoomRafId);

      collectTargets().forEach((node) => {
        stopAnimation(node);
        node.style.willChange = "auto";
      });

      featureVisualEntries.forEach(({ image }) => {
        image.style.willChange = "auto";
      });
    };
  }, [
    enabled,
    getMotionImage,
    getMutationRoot,
    getTargets,
    query,
    rootMargin,
    rootRef,
    threshold,
  ]);
}
