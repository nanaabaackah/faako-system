import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import ScrollToTop from "./ScrollToTop";
import { useScrollAnimations } from "../hooks/useScrollAnimations";

const Layout: React.FC<{ children: React.ReactNode; hideHeader?: boolean }> = ({
  children,
  hideHeader,
}) => {
  useScrollAnimations();

  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && <Header />}
      <main className="flex-grow relative">{children}</main>
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Layout;
