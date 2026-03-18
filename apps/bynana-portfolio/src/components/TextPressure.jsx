import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/components/TextPressure.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const easeOut = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function TextPressure({
  as = 'span',
  text = '',
  className = '',
  spread = 0.24,
  maxScale = 1.22,
}) {
  const Tag = as;
  const rootRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [pointerX, setPointerX] = useState(0.5);
  const [reducedMotion, setReducedMotion] = useState(false);
  const safeText = String(text ?? '');
  const characters = useMemo(() => Array.from(safeText), [safeText]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = (event) => setReducedMotion(event.matches);

    applyPreference(mediaQuery);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', applyPreference);
    } else {
      mediaQuery.addListener(applyPreference);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', applyPreference);
      } else {
        mediaQuery.removeListener(applyPreference);
      }
    };
  }, []);

  const updatePointer = (clientX) => {
    const node = rootRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width) return;
    setPointerX(clamp((clientX - rect.left) / rect.width, 0, 1));
  };

  const handleMouseEnter = (event) => {
    setIsHovered(true);
    updatePointer(event.clientX);
  };

  const handleMouseMove = (event) => {
    if (!isHovered) return;
    updatePointer(event.clientX);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setPointerX(0.5);
  };

  const active = isHovered && !reducedMotion;
  const maxDelta = Math.max(maxScale - 1, 0);
  const length = Math.max(characters.length, 1);

  const content = (
    <span className="text-pressure__line" aria-hidden="true">
      {characters.map((character, index) => {
        const position = (index + 0.5) / length;
        const distance = Math.abs(position - pointerX);
        const intensity = active ? easeOut(1 - distance / spread) : 0;
        const scale = 1 + maxDelta * intensity;

        return (
          <span
            key={`text-pressure-${safeText}-${index}`}
            className={`text-pressure__char ${character === ' ' ? 'is-space' : ''}`}
            style={{ '--tp-scale': scale.toFixed(3) }}
          >
            {character === ' ' ? '\u00A0' : character}
          </span>
        );
      })}
    </span>
  );

  return React.createElement(
    Tag,
    {
      ref: rootRef,
      className: `text-pressure ${active ? 'is-active' : ''} ${className}`.trim(),
      'aria-label': safeText,
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
    content,
  );
}

export default TextPressure;
