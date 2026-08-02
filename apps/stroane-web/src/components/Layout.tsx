import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import ScrollToTop from "./ScrollToTop";
import { useScrollAnimations } from "../hooks/useScrollAnimations";

const Layout: React.FC<{
  children: React.ReactNode;
  hideHeader?: boolean;
  externalNavigationBaseUrl?: string;
}> = ({
  children,
  hideHeader,
  externalNavigationBaseUrl,
}) => {
  useScrollAnimations();

  return (
    <div className="min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {!hideHeader && <Header externalNavigationBaseUrl={externalNavigationBaseUrl} />}
      <main id="main-content" className="flex-grow relative" tabIndex={-1}>
        {children}
      </main>
      <Footer externalNavigationBaseUrl={externalNavigationBaseUrl} />
      <ScrollToTop />
    </div>
  );
};

export default Layout;
