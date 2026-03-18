import React, { useEffect, useState } from 'react';
import { CloseCircle, ExportSquare } from 'iconsax-react';

const LightboxViewer = ({ source, type = 'pdf', buttonText = 'Open Preview' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openLightbox = () => setIsOpen(true);
  const closeLightbox = () => setIsOpen(false);
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button className="lightbox-btn" type="button" onClick={openLightbox}>
        {buttonText} <ExportSquare size={16} variant="Bold" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="lightbox-overlay" role="dialog" aria-modal="true" tabIndex={-1}>
          <button className="lightbox-close" type="button" onClick={closeLightbox} aria-label="Close preview">
            <CloseCircle size={22} variant="Bold" aria-hidden="true" />
          </button>
          <div className="lightbox-content">
            {type === 'pdf' ? (
              <embed
                src={source}
                type="application/pdf"
                width="100%"
                height="100%"
                title="PDF Preview"
              />
            ) : (
              <iframe
                src={source}
                title="External Link Preview"
                width="100%"
                height="100%"
                loading='lazy'
                allowFullScreen
              ></iframe>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LightboxViewer;
