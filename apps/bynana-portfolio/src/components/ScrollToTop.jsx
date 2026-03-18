import React, { useEffect, useState } from 'react';
import { HiArrowUp } from 'react-icons/hi2';

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 80);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      className={`scroll-to-top ${visible ? 'scroll-to-top--visible' : ''}`}
      onClick={handleClick}
      aria-label="Scroll to top"
    >
      <HiArrowUp size={20} aria-hidden="true" />
    </button>
  );
}

export default ScrollToTop;
