import { useEffect, useState } from 'react';
import "./PopupModal.css";

const PopupModal = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const popupShown = sessionStorage.getItem('popupShown');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobileView = window.matchMedia('(max-width: 720px)').matches;

    if (popupShown || reduceMotion || mobileView) {
      return undefined;
    }

    let timer;
    let idleId;
    const showPopup = () => {
      timer = setTimeout(() => {
        setVisible(true);
        sessionStorage.setItem('popupShown', 'true');
      }, 6000);
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(showPopup, { timeout: 1500 });
    } else {
      showPopup();
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-box">
        <button onClick={() => setVisible(false)} className="popup-close">×</button>
        <img
          src='/imgs/promos/banner.jpg'
          alt='REEBS party promo'
          width="800"
          height="450"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
};

export default PopupModal;
