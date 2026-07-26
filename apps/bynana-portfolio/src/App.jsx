import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, StaticRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { AppUpdateNotice, GoogleAnalyticsRouteTracker } from '@faako/ui';
import { HiXMark } from 'react-icons/hi2';

import Navbar from './components/Navbar';
import SideRails from './components/SideRails';
import Footer from './components/Footer';
import CookieConsentBanner from './components/CookieConsentBanner';
import {
  BYNANA_COOKIE_PREFS_EVENT,
  hasByNanaAnalyticsConsent,
} from './utils/cookieConsent';
import { useTheme } from './hooks/useTheme';
import ErrorBoundary from './components/ErrorBoundary';
import BackgroundFX from './components/BackgroundFX';
import GradualBlur from './components/GradualBlur';
import ErrorPage from './views/Error';

import useScrollAnimations from './hooks/useScrollAnimations';

const Home = lazy(() => import('./views/Home'));
const About = lazy(() => import('./views/About'));
const Contact = lazy(() => import('./views/Contact'));
const Projects = lazy(() => import('./views/Projects'));
const Blog = lazy(() => import('./views/Blog'));
const Privacy = lazy(() => import('./views/Privacy'));
const Resume = lazy(() => import('./views/Resume'));
const ProjectDetail = lazy(() => import('./views/ProjectDetail'));
const BlogPostDetail = lazy(() => import('./views/BlogPostDetail'));

const PROJECT_TITLES = {
  reconstruction: 'Intranet Website Redesign',
  'development-tracker': 'Development Operations System',
  odoo: 'Odoo ERP Customization',
  'kids-party-shop-rental': 'Kids Party Shop + Rental Portal ERP',
  portfolio: 'Portfolio Website',
};

const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const GOOGLE_ANALYTICS_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === 'true';

function AppLayout() {
  const location = useLocation();
  const theme = useTheme();
  const projectDetailMatch = location.pathname.match(/^\/projects\/([^/]+)\/?$/);
  const isProjectDetailRoute = Boolean(projectDetailMatch);
  const projectDetailSlug = projectDetailMatch?.[1]?.toLowerCase() ?? '';
  const projectDetailTitle = PROJECT_TITLES[projectDetailSlug] ?? 'Project not found';
  const [isHomeBlurbActive, setIsHomeBlurbActive] = useState(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(hasByNanaAnalyticsConsent);
  useScrollAnimations(location.pathname);

  useEffect(() => {
    const handlePreferences = (event) => {
      setAnalyticsAllowed(Boolean(event.detail?.analytics));
    };

    window.addEventListener(BYNANA_COOKIE_PREFS_EVENT, handlePreferences);
    return () => window.removeEventListener(BYNANA_COOKIE_PREFS_EVENT, handlePreferences);
  }, []);

  useEffect(() => {
    let observer;
    let frameId;
    let disposed = false;

    setIsHomeBlurbActive(false);

    if (location.pathname !== '/') {
      return () => {};
    }

    const observeBlurb = () => {
      if (disposed) return;

      const blurbSection = document.querySelector('.home-blurb');

      if (!blurbSection) {
        frameId = window.requestAnimationFrame(observeBlurb);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          const isActive = entry.isIntersecting && entry.intersectionRatio >= 0.25;
          setIsHomeBlurbActive(isActive);
        },
        {
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        },
      );

      observer.observe(blurbSection);
    };

    observeBlurb();

    return () => {
      disposed = true;

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      if (observer) {
        observer.disconnect();
      }
    };
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.style.removeProperty('--magnet-lines-color');
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="app-layer">
      <GoogleAnalyticsRouteTracker
        measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
        enabled={GOOGLE_ANALYTICS_ENABLED && analyticsAllowed}
      />
      <AppUpdateNotice
        appName="By Nana"
        mode="auto"
        enabled={import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === 'true'}
      />
      <BackgroundFX />
      <GradualBlur
        target="page"
        position="top"
        height="6rem"
        strength={1.6}
        divCount={5}
        curve="bezier"
        exponential
        animated="scroll"
        opacity={1}
        zIndex={44}
      />
      <GradualBlur
        target="page"
        position="bottom"
        height="7rem"
        strength={2}
        divCount={6}
        curve="bezier"
        exponential
        animated="scroll"
        opacity={1}
        zIndex={44}
      />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {!isProjectDetailRoute && (
        <Navbar
          themeControls={theme}
          lightBrand={isHomeBlurbActive}
        />
      )}
      {!isProjectDetailRoute && <SideRails lightStyle={isHomeBlurbActive} />}
      {isProjectDetailRoute && (
        <div className="case-floating-bar" role="presentation">
          <p className="case-floating-bar__title">{projectDetailTitle}</p>
          <Link className="case-floating-bar__close" to="/projects">
            Close project
            <HiXMark size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="app-main-shell">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/resume" element={<Resume />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/privacy" element={<Privacy />} />

            <Route path="/projects/:slug" element={<ProjectDetail />} />
            <Route path="/blog/:slug" element={<BlogPostDetail />} />
            <Route path="*" element={<ErrorPage variant="not-found" />} />
          </Routes>
        </Suspense>
      </div>
      <Footer themeControls={theme} />
      <CookieConsentBanner />
    </div>
  );
}

function AppWithBoundary() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.key}>
      <AppLayout />
    </ErrorBoundary>
  );
}

function App({ staticLocation }) {
  const Router = staticLocation ? StaticRouter : BrowserRouter;

  return (
    <Router {...(staticLocation ? { location: staticLocation } : {})}>
      <AppWithBoundary />
    </Router>
  );
}
export default App;
