import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { AppUpdateNotice } from "@faako/ui";

export default function SiteEnhancementsIsland() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 320);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <AppUpdateNotice
        appName="Faako"
        mode="auto"
        enabled={
          import.meta.env.PROD ||
          import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true"
        }
      />
      {showScrollTop ? (
        <button
          className="scroll-top"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
        >
          <FontAwesomeIcon icon={faArrowUp} />
        </button>
      ) : null}
    </>
  );
}
