import { useEffect, useRef, useState } from "react";
import useScrollReveal from "../../hooks/useScrollReveal.js";

function RevealController({ path }) {
  const scrollContainerRef = useRef(
    typeof document === "undefined" ? null : document.querySelector(".main"),
  );

  useScrollReveal(String(path || "/"), scrollContainerRef);
  return null;
}

function ScrollRevealIsland({ path = "/" }) {
  const [isPageHydrated, setIsPageHydrated] = useState(false);

  useEffect(() => {
    const checkHydration = () => {
      if (!document.querySelector("astro-island[ssr]")) {
        setIsPageHydrated(true);
        return true;
      }
      return false;
    };

    if (checkHydration()) return undefined;

    const observer = new MutationObserver(() => {
      if (checkHydration()) observer.disconnect();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["ssr"],
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return isPageHydrated ? <RevealController path={path} /> : null;
}

export default ScrollRevealIsland;
