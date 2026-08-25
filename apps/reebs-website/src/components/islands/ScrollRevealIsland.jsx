import { useRef } from "react";
import useScrollReveal from "../../hooks/useScrollReveal.js";

function ScrollRevealIsland({ path = "/" }) {
  const scrollContainerRef = useRef(
    typeof document === "undefined" ? null : document.querySelector(".main"),
  );

  useScrollReveal(String(path || "/"), scrollContainerRef);
  return null;
}

export default ScrollRevealIsland;
