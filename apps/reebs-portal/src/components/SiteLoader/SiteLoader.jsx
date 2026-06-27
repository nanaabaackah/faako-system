import React from "react";
import { AnimatedLoadingState } from "@faako/ui";

function SiteLoader({
  label = "Loading",
  sublabel = "Getting things ready for you.",
  compact = false,
  page = !compact,
  variant = "portal",
}) {
  return (
    <AnimatedLoadingState
      compact={compact}
      page={page}
      title={label}
      message={sublabel}
      variant={variant}
    />
  );
}

export default SiteLoader;
