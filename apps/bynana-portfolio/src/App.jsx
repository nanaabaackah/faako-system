import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { AppUpdateNotice, GoogleAnalyticsRouteTracker } from '@faako/ui';
import { HiXMark } from 'react-icons/hi2';

import Navbar from './components/Navbar';
import SideRails from './components/SideRails';
import Footer from './components/Footer';
import { useTheme } from './hooks/useTheme';
import ErrorBoundary from './components/ErrorBoundary';
import BackgroundFX from './components/BackgroundFX';
import Loader from './components/Loader';
import GradualBlur from './components/GradualBlur';

import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Projects from './pages/Projects';
import Blog from './pages/Blog';
import ProjectDetail from './pages/ProjectDetail';
import BlogPostDetail from './pages/BlogPostDetail';
import ErrorPage from './pages/Error';
import useScrollAnimations from './hooks/useScrollAnimations';
import { projectDetailsBySlug } from './content/projectDetails';

const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const GOOGLE_ANALYTICS_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === 'true';

function AppLayout() {
  const location = useLocation();
  const theme = useTheme();
  const projectDetailMatch = location.pathname.match(/^\/projects\/([^/]+)\/?$/);
  const isProjectDetailRoute = Boolean(projectDetailMatch);
  const projectDetailSlug = projectDetailMatch?.[1]?.toLowerCase() ?? '';
  const projectDetailTitle = projectDetailsBySlug[projectDetailSlug]?.title ?? 'Project not found';
  const [isHomeBlurbActive, setIsHomeBlurbActive] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  useScrollAnimations(location.pathname);

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

  useEffect(() => {
    setIsPageLoading(true);
    const timerId = window.setTimeout(() => {
      setIsPageLoading(false);
    }, 620);

    return () => window.clearTimeout(timerId);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('is-page-loading', isPageLoading);

    return () => {
      document.body.classList.remove('is-page-loading');
    };
  }, [isPageLoading]);

  return (
    <div className="app-layer">
      <GoogleAnalyticsRouteTracker
        measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
        enabled={GOOGLE_ANALYTICS_ENABLED}
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
      <Loader active={isPageLoading} />
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<Blog />} />

          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/blog/:slug" element={<BlogPostDetail />} />
          <Route path="*" element={<ErrorPage variant="not-found" />} />
        </Routes>
      </div>
      <Footer themeControls={theme} />
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

function App() {
  return (
    <Router>
      <AppWithBoundary />
    </Router>
  );
}
export default App;
