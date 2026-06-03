import React from "react";
import { AnimatedLoadingState } from "@faako/ui";

function SiteLoader({
  label = "Loading",
  sublabel = "Getting things ready for you.",
  compact = false,
}) {
  return (
    <AnimatedLoadingState
      compact={compact}
      title={label}
      message={sublabel}
    />
  );
}

export default SiteLoader;
