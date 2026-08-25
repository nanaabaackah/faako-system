import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  AppBottomBar,
  AppUpdateNotice,
  ErpPageContent,
  ErpShellFrame,
  GoogleAnalyticsRouteTracker,
} from "@faako/ui";
import { getErpPageTitle } from "@faako/utils";
import { useAuth } from "../components/AuthContext/AuthContext";
import BackToTop from "../components/BackToTop/BackToTop";
import Navbar from "../components/Navbar/Navbar";
import CartOverlay from "../components/CartOverlay/CartOverlay";
import PartyConfetti from "../components/PartyConfetti/PartyConfetti";
import DocumentHead from "../components/DocumentHead/DocumentHead";
import useScrollReveal from "../hooks/useScrollReveal";
import shellConfig from "../config/erpShell.js";
import {
  ADMIN_PREFERENCES_CHANGE_EVENT,
  applyAdminPreferences,
  clearAppliedAdminPreferences,
  readAdminPreferences,
  writeAdminPreferences,
} from "../utils/adminPreferences";
import { loadPortalSettings } from "../utils/portalSettings";
import {
  GOOGLE_ANALYTICS_ENABLED,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  hasReebsAnalyticsConsent,
} from "../utils/analytics";
import AppRouter, { RouteFallback } from "./AppRouter";

const PortalSidebar = lazy(() => import("../components/PortalSidebar/PortalSidebar"));
const AdminBottomNav = lazy(() => import("../components/AdminBottomNav/AdminBottomNav"));
const Footer = lazy(() => import("../components/Footer/Footer"));

export default function AppShell() {
  const { user, authReady } = useAuth();
  const location = useLocation();
  const shellScrollRef = useRef(null);
  const preferencesRevisionRef = useRef(0);
  const pathname = location.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isStoreModeRoute = pathname === "/admin/store-mode";
  const pageTitle = useMemo(
    () => getErpPageTitle(pathname, shellConfig.brand.name, shellConfig.pageTitles, "/admin"),
    [pathname],
  );

  useScrollReveal(pathname, shellScrollRef);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("admin-theme", isAdminRoute);
    return () => {
      document.body.classList.remove("admin-theme");
    };
  }, [isAdminRoute, pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const root = document.documentElement;
    if (!isAdminRoute) {
      clearAppliedAdminPreferences(root);
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const activeUserId = authReady ? user?.id : undefined;
    const syncAdminPreferences = () => {
      applyAdminPreferences(readAdminPreferences(activeUserId), { root, mediaQuery });
    };
    const handlePreferencesChange = (event) => {
      const changedUserId = String(event?.detail?.userId || "guest");
      const currentUserId = String(activeUserId || "guest");
      if (changedUserId !== currentUserId) return;
      preferencesRevisionRef.current += 1;
      applyAdminPreferences(event?.detail?.preferences, { root, mediaQuery });
    };

    syncAdminPreferences();
    const controller = new AbortController();
    if (authReady && activeUserId) {
      const loadRevision = preferencesRevisionRef.current;
      loadPortalSettings({ signal: controller.signal })
        .then((data) => {
          if (
            !data?.preferences
            || preferencesRevisionRef.current !== loadRevision
          ) return;
          writeAdminPreferences(activeUserId, data.preferences);
        })
        .catch((error) => {
          if (error?.name !== "AbortError") {
            // Cached preferences remain active while the settings service is unavailable.
          }
        });
    }
    if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", syncAdminPreferences);
    else mediaQuery.addListener(syncAdminPreferences);
    window.addEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);

    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener("change", syncAdminPreferences);
      else mediaQuery.removeListener(syncAdminPreferences);
      window.removeEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);
      controller.abort();
      clearAppliedAdminPreferences(root);
    };
  }, [authReady, isAdminRoute, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    shellScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (!isAdminRoute || typeof document === "undefined") return;
    const adminContent = document.querySelector(".portal-app-content");
    if (adminContent instanceof HTMLElement) {
      adminContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [isAdminRoute, pathname, location.search]);

  const routes = (
    <Suspense fallback={<RouteFallback />}>
      <AppRouter />
    </Suspense>
  );
  const commonChrome = (
    <>
      <GoogleAnalyticsRouteTracker
        measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
        enabled={GOOGLE_ANALYTICS_ENABLED}
        shouldTrack={hasReebsAnalyticsConsent}
      />
      <AppUpdateNotice
        appName="REEBS Portal"
        mode="prompt"
        enabled={import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true"}
      />
      <DocumentHead title={pageTitle} />
    </>
  );

  if (isAdminRoute) {
    if (!authReady) return <>{commonChrome}<RouteFallback /></>;
    if (!user) return <>{commonChrome}{routes}</>;

    if (isStoreModeRoute) {
      return (
        <>
          {commonChrome}
          <div className="portal-app-shell portal-app-shell--store-mode">
            <div className="portal-app-content portal-app-content--store-mode portal-app-content--with-bottom-bar">
              <ErpPageContent as="div" className="portal-app-content__body">{routes}</ErpPageContent>
              <div className="ui-bottom-bar-shell portal-app-bottom-bar-shell"><AppBottomBar /></div>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        {commonChrome}
        <ErpShellFrame
          brand={shellConfig.brand}
          className="portal-app-shell"
          contentClassName="portal-app-content portal-app-content--with-bottom-bar"
          layout="overlay"
          sidebar={<Suspense fallback={null}><PortalSidebar /></Suspense>}
          bottomNav={<Suspense fallback={null}><AdminBottomNav /></Suspense>}
        >
          <ErpPageContent as="div" className="portal-app-content__body">{routes}</ErpPageContent>
          <div className="ui-bottom-bar-shell portal-app-bottom-bar-shell"><AppBottomBar /></div>
        </ErpShellFrame>
      </>
    );
  }

  return (
    <>
      {commonChrome}
      <div className="site-shell">
        <div className="main portal-site-main" ref={shellScrollRef}>
          <PartyConfetti className="site-shell-confetti party-confetti-rentals" />
          <Navbar scrollContainerRef={shellScrollRef} />
          <div className="portal-route-shell portal-route-shell--public">{routes}</div>
          <Suspense fallback={null}><Footer /></Suspense>
          <BackToTop scrollContainerRef={shellScrollRef} />
          <CartOverlay />
        </div>
      </div>
    </>
  );
}
