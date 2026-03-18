import { useEffect } from 'react';
import { animate, stagger } from 'animejs';

const PREPARED_CLASS = 'scroll-reveal-target';
const REVEALED_CLASS = 'scroll-reveal-target--visible';

const TARGET_SELECTOR = [
  '[data-scroll-reveal]',
  'main .hero-animate',
  'main .about-animate',
  '.animate-box',
  'main > header',
  'main > section',
  'main > article',
  'main .about-section',
  'main .about-card',
  'main .about-value',
  'main .about-case',
  'main .about-panel',
  'main .about-timeline li',
  'main .project-tile',
  'main .projects-reading__card',
  'main .blog-card',
  'main .blog-feature__card',
  'main .blog-feed__item',
  'main .contact-card',
  'main .contact-link',
  'main .resume-section',
  'main .case-section',
  'main .case-card',
  'main .case-callout',
  'main .case-nav-card',
  'main .home-latest',
  'main .home-feed',
].join(', ');

const EXCLUDED_SELECTOR = [
  '.home-feed__dot',
  '.scroll-to-top',
].join(', ');

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getRevealBlur = (target) =>
  Math.max(0, parseNumber(target.dataset.animateBlur ?? target.dataset.scrollBlur, 12));

const resolveEffect = (el) => {
  const effect = el.dataset.scrollReveal || el.dataset.animateEffect;
  if (!effect) return 'fadeInUp';
  return effect;
};

const getRevealPreset = (effect) => {
  switch (effect) {
    case 'fadeIn':
      return { translateX: 0, translateY: 0, scale: 0.98 };
    case 'fadeInLeft':
      return { translateX: -34, translateY: 0, scale: 1 };
    case 'fadeInRight':
      return { translateX: 34, translateY: 0, scale: 1 };
    case 'pop':
      return { translateX: 0, translateY: 18, scale: 0.94 };
    case 'fadeInUp':
    default:
      return { translateX: 0, translateY: 26, scale: 1 };
  }
};

const getTargets = () => {
  const rawTargets = Array.from(document.querySelectorAll(TARGET_SELECTOR));

  return rawTargets.filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (EXCLUDED_SELECTOR && el.matches(EXCLUDED_SELECTOR)) return false;
    if (el.dataset.scrollIgnore === 'true') return false;
    if (el.offsetHeight < 24 || el.offsetWidth < 24) return false;
    return true;
  });
};

const isInViewport = (target) => {
  const rect = target.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const entryLine = viewportHeight * 0.95;
  return rect.top <= entryLine && rect.bottom >= 0;
};

const prepareTarget = (target, revealNow = false) => {
  if (!(target instanceof HTMLElement)) return;

  if (revealNow) {
    target.classList.add(PREPARED_CLASS, REVEALED_CLASS);
    target.style.removeProperty('opacity');
    target.style.removeProperty('transform');
    target.style.removeProperty('will-change');
    return;
  }

  const preset = getRevealPreset(resolveEffect(target));
  const revealBlur = getRevealBlur(target);
  target.classList.add(PREPARED_CLASS);
  target.classList.remove(REVEALED_CLASS);
  target.style.opacity = '0';
  target.style.transform = `translate3d(${preset.translateX}px, ${preset.translateY}px, 0) scale(${preset.scale})`;
  target.style.filter = `blur(${revealBlur}px)`;
};

const revealTargets = (targets, animations) => {
  if (!targets.length) return;

  const ordered = [...targets].sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
  );
  const baseDelay = stagger(75);

  ordered.forEach((target) => {
    target.classList.add(REVEALED_CLASS);
    target.style.willChange = 'opacity, transform, filter';
  });

  const animation = animate(ordered, {
    opacity: [0, 1],
    filter: (target) => [`blur(${getRevealBlur(target)}px)`, 'blur(0px)'],
    translateX: (target) => {
      const { translateX } = getRevealPreset(resolveEffect(target));
      return [translateX, 0];
    },
    translateY: (target) => {
      const { translateY } = getRevealPreset(resolveEffect(target));
      return [translateY, 0];
    },
    scale: (target) => {
      const { scale } = getRevealPreset(resolveEffect(target));
      return [scale, 1];
    },
    duration: (target) => parseNumber(target.dataset.animateDuration, 760),
    delay: (target, index, length) =>
      parseNumber(target.dataset.animateDelay, 0) + baseDelay(target, index, length),
    ease: (target) => target.dataset.animateEase || 'out(4)',
    onComplete: (completedAnimation) => {
      const animatables = completedAnimation?.animatables ?? [];
      animatables.forEach(({ target }) => {
        target.style.removeProperty('opacity');
        target.style.removeProperty('transform');
        target.style.removeProperty('filter');
        target.style.removeProperty('will-change');
      });
    },
  });

  animations.push(animation);
};

const useScrollAnimations = (dependencyKey) => {
  useEffect(() => {
    const targets = getTargets();

    if (!targets.length) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const animations = [];

    if (reduceMotion || typeof window.IntersectionObserver !== 'function') {
      targets.forEach((target) => prepareTarget(target, true));
      return;
    }

    const immediatelyVisible = [];
    targets.forEach((target) => {
      prepareTarget(target);
      if (isInViewport(target)) {
        immediatelyVisible.push(target);
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target);

        if (!entering.length) return;

        revealTargets(entering, animations);
        entering.forEach((target) => observer.unobserve(target));
      },
      {
        threshold: 0.01,
        rootMargin: '0px 0px -4% 0px',
      },
    );

    if (immediatelyVisible.length) {
      revealTargets(immediatelyVisible, animations);
    }

    targets.forEach((target) => {
      if (!immediatelyVisible.includes(target)) {
        observer.observe(target);
      }
    });

    return () => {
      observer.disconnect();
      animations.forEach((instance) => instance.pause?.());
    };
  }, [dependencyKey]);
};

export default useScrollAnimations;
