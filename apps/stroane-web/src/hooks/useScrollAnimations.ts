import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { animate } from "animejs";

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

const animateIn = (el: Element) =>
  animate(el as HTMLElement, {
    opacity: [0, 1],
    filter: ["blur(8px)", "blur(0px)"],
    duration: 700,
    ease: "outQuad",
  } as Parameters<typeof animate>[1]);

const animateOut = (el: Element) =>
  animate(el as HTMLElement, {
    opacity: [1, 0],
    filter: ["blur(0px)", "blur(8px)"],
    duration: 500,
    ease: "inQuad",
  } as Parameters<typeof animate>[1]);

export function useScrollAnimations() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Clean stale state from previous page
    document.querySelectorAll(".scroll-anim").forEach((el) => {
      el.classList.remove("scroll-anim", "in-view");
      (el as HTMLElement).style.opacity = "";
      (el as HTMLElement).style.filter = "";
    });

    const elements = Array.from(document.querySelectorAll<Element>(SELECTORS));
    const initiallyVisible = new Set<Element>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      elements.forEach((el) => {
        el.classList.add("scroll-anim", "in-view");
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
        (el as HTMLElement).style.filter = "blur(8px)";
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) {
            if (initiallyVisible.has(target)) {
              // First observation of an element that was already visible — skip animation
              initiallyVisible.delete(target);
            } else {
              animateIn(target);
            }
            target.classList.add("in-view");
          } else if (target.classList.contains("in-view")) {
            target.classList.remove("in-view");
            animateOut(target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [pathname]);
}
