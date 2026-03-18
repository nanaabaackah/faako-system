import React, { useEffect, useId, useRef, useState } from 'react';
import '../styles/components/FuzzyText.css';

function FuzzyText({
  as = 'span',
  className = '',
  children,
  baseFrequency = 0.006,
  hoverFrequency = 0.017,
  baseScale = 8,
  hoverScale = 16,
}) {
  const Tag = as;
  const safeId = useId().replace(/[:]/g, '');
  const turbulenceRef = useRef(null);
  const displacementRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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

  useEffect(() => {
    const turbulenceNode = turbulenceRef.current;
    const displacementNode = displacementRef.current;
    if (!turbulenceNode || !displacementNode) return undefined;

    if (reducedMotion) {
      turbulenceNode.setAttribute('baseFrequency', `${baseFrequency} ${baseFrequency}`);
      displacementNode.setAttribute('scale', `${baseScale}`);
      return undefined;
    }

    let rafId = 0;
    let t = 0;

    const render = () => {
      t += 0.015;

      const targetFrequency = isHovered ? hoverFrequency : baseFrequency;
      const targetScale = isHovered ? hoverScale : baseScale;
      const modulationA = Math.sin(t * 1.33) * targetFrequency * 0.25;
      const modulationB = Math.cos(t * 0.83) * targetFrequency * 0.22;
      const frequencyX = Math.max(0.001, targetFrequency + modulationA);
      const frequencyY = Math.max(0.001, targetFrequency + modulationB);
      const animatedScale = Math.max(1, targetScale + Math.sin(t * 1.1) * targetScale * 0.17);
      const seed = ((Math.sin(t * 0.74) + 1) * 50).toFixed(2);

      turbulenceNode.setAttribute('baseFrequency', `${frequencyX.toFixed(4)} ${frequencyY.toFixed(4)}`);
      turbulenceNode.setAttribute('seed', seed);
      displacementNode.setAttribute('scale', animatedScale.toFixed(2));

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [baseFrequency, hoverFrequency, baseScale, hoverScale, isHovered, reducedMotion]);

  return (
    <Tag
      className={`fuzzy-text ${className}`.trim()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg className="fuzzy-text__defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id={`fuzzy-filter-${safeId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency={`${baseFrequency} ${baseFrequency}`}
              numOctaves="2"
              seed="2"
              stitchTiles="stitch"
              result="noise"
            />
            <feDisplacementMap
              ref={displacementRef}
              in="SourceGraphic"
              in2="noise"
              scale={baseScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <span className="fuzzy-text__content" style={{ filter: `url(#fuzzy-filter-${safeId})` }}>
        {children}
      </span>
    </Tag>
  );
}

export default FuzzyText;
