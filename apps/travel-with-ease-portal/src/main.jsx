import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import "@faako/ui/compat.css";
import "./styles/global.css";
import "./styles/typography.css";
import App from "./App.jsx";
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_TWE_LOCAL_WORKSPACE === "true"
) {
  import("../dev/WorkspaceControls.jsx").then((module) => {
    const element = document.createElement("div");
    document.body.prepend(element);
    createRoot(element).render(createElement(module.default));
  });
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
