import React, { useEffect, useRef, useState } from 'react';

const RANDOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const FRAME_MS = 32;

const isPreservedChar = (character) => /[\s.,/+&%-]/.test(character);

const randomCharacter = () => RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];

const buildScrambledText = (text, revealCount) =>
  text
    .split('')
    .map((character, index) => {
      if (isPreservedChar(character) || index < revealCount) return character;
      return randomCharacter();
    })
    .join('');

function DecryptedText({
  as = 'span',
  text,
  className,
  duration = 900,
  delay = 0,
  threshold = 0.35,
  triggerOnce = true,
}) {
  const Tag = as;
  const [displayText, setDisplayText] = useState(text);
  const targetRef = useRef(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    setDisplayText(text);
    if (!triggerOnce) {
      hasAnimatedRef.current = false;
    }
  }, [text, triggerOnce]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setDisplayText(text);
      return undefined;
    }

    let intervalId = null;
    let timeoutId = null;

    const runAnimation = () => {
      if (triggerOnce && hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;

      const steps = Math.max(12, Math.round(duration / FRAME_MS));
      let step = 0;

      if (intervalId) {
        window.clearInterval(intervalId);
      }

      intervalId = window.setInterval(() => {
        step += 1;
        const revealCount = Math.floor((step / steps) * text.length);
        setDisplayText(buildScrambledText(text, revealCount));

        if (step >= steps) {
          window.clearInterval(intervalId);
          intervalId = null;
          setDisplayText(text);
        }
      }, FRAME_MS);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        if (delay > 0) {
          timeoutId = window.setTimeout(runAnimation, delay);
        } else {
          runAnimation();
        }

        if (triggerOnce) {
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [delay, duration, text, threshold, triggerOnce]);

  return (
    <Tag ref={targetRef} className={className} aria-label={text}>
      {displayText}
    </Tag>
  );
}

export default DecryptedText;
