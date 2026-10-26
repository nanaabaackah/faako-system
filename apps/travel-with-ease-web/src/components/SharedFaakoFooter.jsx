import { AppBottomBar } from "@faako/ui";
import { createElement } from "react";

// Static React rendering uses the shared context's safe default; no hydration.
export default function SharedFaakoFooter() {
  return createElement(AppBottomBar, { businessName: "Travel With Ease", variant: "footer" });
}
