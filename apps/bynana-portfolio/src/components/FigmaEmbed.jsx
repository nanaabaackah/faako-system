import React, { useState } from 'react';
import { CloseCircle, Eye } from 'iconsax-react';

function FigmaEmbed({ figmaUrl, previewImage, alt }) {
  const [isOpen, setIsOpen] = useState(false);

  const openLightbox = () => setIsOpen(true);
  const closeLightbox = () => setIsOpen(false);

  return (
    <>
      <div className="figma-wrapper">
        <button
          type="button"
          className="figma-trigger"
          onClick={openLightbox}
          aria-label={`Open fullscreen Figma preview: ${alt}`}
        >
          <img src={previewImage} alt={alt} className="figma-thumb" loading="lazy" />
          <span className="figma-overlay">
            Open fullscreen preview <Eye size={16} variant="Bold" aria-hidden="true" />
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} fullscreen preview`}
        >
          <button type="button" className="lightbox-close" onClick={closeLightbox} aria-label="Close preview">
            <CloseCircle size={22} variant="Bold" aria-hidden="true" />
          </button>
          <div className="lightbox-content">
            <iframe
              src={figmaUrl}
              title={alt}
              width="100%"
              height="100%"
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}

export default FigmaEmbed;
