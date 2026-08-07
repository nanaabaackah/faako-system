import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppUpdateNotice, UiSystemProvider } from "@faako/ui";
import "@faako/ui/ui.css";
import "@faako/ui/compat.css";
import "../index.css";
import "../styles/globals.css";
import appSystem from "../../appSystem.js";
import PortalApp from "./PortalApp";
import { registerStroaneServiceWorker } from "../registerServiceWorker";

const updateNoticeEnabled =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true";

registerStroaneServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <BrowserRouter>
        <AppUpdateNotice
          appName="Stroane Admin"
          checkUrl="/"
          mode="prompt"
          enabled={updateNoticeEnabled}
        />
        <PortalApp />
      </BrowserRouter>
    </UiSystemProvider>
  </StrictMode>,
);
