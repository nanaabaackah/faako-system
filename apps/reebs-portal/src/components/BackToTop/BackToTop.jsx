import React, { useEffect, useState } from 'react';

function BackToTop({ scrollContainerRef }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollHost = scrollContainerRef?.current || window;
    const usingWindow = scrollHost === window;

    const getScrollTop = () =>
      usingWindow ? window.scrollY || window.pageYOffset || 0 : scrollHost.scrollTop;

    const handleScroll = () => {
      setVisible(getScrollTop() > 240);
    };

    handleScroll();
    scrollHost.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollHost.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  const handleBackToTop = () => {
    const scrollHost = scrollContainerRef?.current || window;
    scrollHost.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      className="back-to-top"
      onClick={handleBackToTop}
      aria-label="Back to top"
      type="button"
    >
      ↑
    </button>
  );
}

export default BackToTop;
