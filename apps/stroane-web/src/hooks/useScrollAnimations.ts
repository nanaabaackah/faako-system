import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SELECTORS = [
  ".trust-stats",
  ".why-section",
  ".service-row",
  ".products-section",
  ".footer__cta",
  ".footer__emblem-row",
  ".footer__body",
  "[data-scroll-reveal]",
  "section:not(.hero-section)",
].join(", ");

const inViewport = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
};

const revealElement = (el: Element) => {
  const element = el as HTMLElement;
  element.style.opacity = "1";
  element.style.transform = "translateY(0)";
};

const animateIn = (el: Element) => {
  const element = el as HTMLElement;
  if (!element.animate) return undefined;

  return element.animate(
    [
      { opacity: 0, transform: "translateY(18px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    {
      duration: 700,
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      fill: "forwards",
    }
  );
};

export function useScrollAnimations() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Clean stale state from previous page
    document.querySelectorAll(".scroll-anim").forEach((el) => {
      el.classList.remove("scroll-anim", "in-view");
      (el as HTMLElement).style.opacity = "";
      (el as HTMLElement).style.transform = "";
    });

    const elements = Array.from(document.querySelectorAll<Element>(SELECTORS));
    const initiallyVisible = new Set<Element>();
    const revealTimers = new Set<number>();
    const activeAnimations = new Map<Element, Animation>();
    let viewportFallbackTimer: number | undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      elements.forEach((el) => {
        el.classList.add("scroll-anim", "in-view");
        revealElement(el);
      });
      return;
    }

    elements.forEach((el) => {
      el.classList.add("scroll-anim");
      if (inViewport(el)) {
        // Already visible on load — no initial hidden state
        initiallyVisible.add(el);
      } else {
        (el as HTMLElement).style.opacity = "0";
        (el as HTMLElement).style.transform = "translateY(18px)";
      }
    });

    const finishReveal = (el: Element) => {
      activeAnimations.get(el)?.cancel();
      activeAnimations.delete(el);
      revealElement(el);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) {
            if (initiallyVisible.has(target)) {
              // First observation of an element that was already visible — skip animation
              initiallyVisible.delete(target);
              revealElement(target);
            } else {
              const animation = animateIn(target);
              if (animation) {
                activeAnimations.set(target, animation);
                animation.onfinish = () => finishReveal(target);
                animation.oncancel = () => activeAnimations.delete(target);
              } else {
                revealElement(target);
              }
              const timer = window.setTimeout(() => {
                finishReveal(target);
                revealTimers.delete(timer);
              }, 760);
              revealTimers.add(timer);
            }
            target.classList.add("in-view");
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px -24px 0px" }
    );

    const revealVisibleElements = () => {
      elements.forEach((el) => {
        if (!inViewport(el)) return;
        initiallyVisible.delete(el);
        el.classList.add("in-view");
        finishReveal(el);
        observer.unobserve(el);
      });
    };

    const scheduleViewportFallback = () => {
      if (viewportFallbackTimer) window.clearTimeout(viewportFallbackTimer);
      viewportFallbackTimer = window.setTimeout(revealVisibleElements, 220);
    };

    elements.forEach((el) => observer.observe(el));
    window.addEventListener("scroll", scheduleViewportFallback, { passive: true });
    window.addEventListener("resize", scheduleViewportFallback);
    scheduleViewportFallback();

    return () => {
      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations.clear();
      revealTimers.forEach((timer) => window.clearTimeout(timer));
      if (viewportFallbackTimer) window.clearTimeout(viewportFallbackTimer);
      window.removeEventListener("scroll", scheduleViewportFallback);
      window.removeEventListener("resize", scheduleViewportFallback);
      observer.disconnect();
    };
  }, [pathname]);
}
