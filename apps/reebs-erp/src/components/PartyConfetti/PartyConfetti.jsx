import React, { useEffect, useState } from "react";

const PARTY_BITS = [
  { x: "6%", y: "16%", size: "14px", delay: "0s", duration: "8.6s", shape: "dot", color: "var(--party-1)" },
  { x: "14%", y: "58%", size: "11px", delay: "0.6s", duration: "9.4s", shape: "ribbon", color: "var(--party-2)" },
  { x: "28%", y: "12%", size: "16px", delay: "1.2s", duration: "8.2s", shape: "star", color: "var(--party-3)" },
  { x: "42%", y: "70%", size: "12px", delay: "0.2s", duration: "9.1s", shape: "dot", color: "var(--party-4)" },
  { x: "56%", y: "18%", size: "12px", delay: "1s", duration: "8.8s", shape: "ribbon", color: "var(--party-2)" },
  { x: "68%", y: "62%", size: "15px", delay: "0.4s", duration: "9.7s", shape: "star", color: "var(--party-1)" },
  { x: "78%", y: "22%", size: "13px", delay: "1.4s", duration: "8.4s", shape: "dot", color: "var(--party-4)" },
  { x: "88%", y: "54%", size: "14px", delay: "0.9s", duration: "9.3s", shape: "ribbon", color: "var(--party-3)" },
];

function PartyConfetti({ className = "" }) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reduceData = window.matchMedia("(prefers-reduced-data: reduce)").matches;
    const mobileView = window.matchMedia("(max-width: 900px)").matches;
    return !reduceMotion && !reduceData && !mobileView;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceData = window.matchMedia("(prefers-reduced-data: reduce)");
    const mobileView = window.matchMedia("(max-width: 900px)");
    const updateState = () => {
      setEnabled(!reduceMotion.matches && !reduceData.matches && !mobileView.matches);
    };

    updateState();

    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener("change", updateState);
      reduceData.addEventListener("change", updateState);
      mobileView.addEventListener("change", updateState);
      return () => {
        reduceMotion.removeEventListener("change", updateState);
        reduceData.removeEventListener("change", updateState);
        mobileView.removeEventListener("change", updateState);
      };
    }

    reduceMotion.addListener(updateState);
    reduceData.addListener(updateState);
    mobileView.addListener(updateState);
    return () => {
      reduceMotion.removeListener(updateState);
      reduceData.removeListener(updateState);
      mobileView.removeListener(updateState);
    };
  }, []);

  if (!enabled) return null;

  const classes = ["party-confetti", className].filter(Boolean).join(" ");

  return (
    <div className={classes} aria-hidden="true">
      {PARTY_BITS.map((bit, index) => (
        <span
          key={`party-bit-${index}`}
          className={`party-dot party-dot-${bit.shape}`}
          style={{
            "--party-x": bit.x,
            "--party-y": bit.y,
            "--party-size": bit.size,
            "--party-delay": bit.delay,
            "--party-duration": bit.duration,
            "--party-color": bit.color,
          }}
        />
      ))}
    </div>
  );
}

export default PartyConfetti;
