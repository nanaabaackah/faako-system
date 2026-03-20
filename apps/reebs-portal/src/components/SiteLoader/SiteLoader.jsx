import React from "react";
import "./SiteLoader.css";

function SiteLoader({
  label = "Loading",
  sublabel = "Getting things ready for you.",
  compact = false,
}) {
  return (
    <div
      className={`site-loader ${compact ? "is-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
      data-no-reveal="true"
    >
      <div className="site-loader-mark" aria-hidden="true">
        <div className="site-loader-ring" />
        <div className="site-loader-core">R</div>
        <span className="site-loader-dot site-loader-dot-a" />
        <span className="site-loader-dot site-loader-dot-b" />
        <span className="site-loader-dot site-loader-dot-c" />
      </div>
      <p className="site-loader-label">{label}</p>
      {sublabel ? <p className="site-loader-sublabel">{sublabel}</p> : null}
    </div>
  );
}

export default SiteLoader;
