import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../styles/components/ScrollToTop.css";

const ScrollToTop: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    const targetId = decodeURIComponent(hash.slice(1));
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, [hash, pathname, search]);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      className={`scroll-top-btn${visible ? " scroll-top-btn--visible" : ""}`}
      onClick={handleClick}
      aria-label="Scroll to top"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 14V4M4 9l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

export default ScrollToTop;
