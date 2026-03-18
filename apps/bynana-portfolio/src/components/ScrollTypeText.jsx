import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/components/ScrollTypeText.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function ScrollTypeText({
  as = 'span',
  text = '',
  className = '',
  start = 0.9,
  end = 0.24,
  showCaret = false,
  inline = false,
}) {
  const Tag = as;
  const targetRef = useRef(null);
  const [typedLength, setTypedLength] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const safeText = useMemo(() => String(text ?? ''), [text]);

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
    if (reducedMotion) {
      setTypedLength(safeText.length);
      return undefined;
    }

    let rafId = 0;

    const update = () => {
      rafId = 0;
      const node = targetRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
      const startPx = viewportHeight * start;
      const endPx = viewportHeight * end;
      const anchor = rect.top + rect.height * 0.5;
      const denominator = Math.max(1, startPx - endPx);
      const progress = clamp((startPx - anchor) / denominator, 0, 1);
      const nextLength = Math.round(progress * safeText.length);

      setTypedLength((current) => (current === nextLength ? current : nextLength));
    };

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [end, reducedMotion, safeText, start]);

  const typedText = reducedMotion ? safeText : safeText.slice(0, typedLength);
  const shouldShowCaret = showCaret && !reducedMotion && typedLength < safeText.length;

  const content = [
    <span key="ghost" className="scroll-type-text__ghost" aria-hidden="true">
      {safeText}
    </span>,
    <span key="typed" className="scroll-type-text__typed" aria-hidden="true">
      {typedText}
      {shouldShowCaret ? <span className="scroll-type-text__caret">|</span> : null}
    </span>,
  ];

  return React.createElement(
    Tag,
    {
      ref: targetRef,
      className: `scroll-type-text ${inline ? 'scroll-type-text--inline' : ''} ${className}`.trim(),
      'aria-label': safeText,
    },
    content,
  );
}

export default ScrollTypeText;
