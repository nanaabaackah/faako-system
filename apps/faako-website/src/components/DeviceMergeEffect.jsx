import { useEffect, useRef, useState } from "react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const easeInOutCubic = (t) => {
  if (t < 0.5) {
    return 4 * t * t * t;
  }

  return 1 - Math.pow(-2 * t + 2, 3) / 2;
};

function useMergeProgress() {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    let measureRafId = 0;
    let animationRafId = 0;
    const targetProgressRef = { current: 0 };
    const currentProgressRef = { current: 0 };

    const animateToTarget = () => {
      animationRafId = 0;
      const current = currentProgressRef.current;
      const target = targetProgressRef.current;
      const next = current + (target - current) * 0.14;

      currentProgressRef.current = next;
      setProgress(next);

      if (Math.abs(target - next) > 0.001) {
        animationRafId = window.requestAnimationFrame(animateToTarget);
        return;
      }

      if (target !== next) {
        currentProgressRef.current = target;
        setProgress(target);
      }
    };

    const ensureAnimation = () => {
      if (!animationRafId) {
        animationRafId = window.requestAnimationFrame(animateToTarget);
      }
    };

    const measureTarget = () => {
      measureRafId = 0;

      if (!containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const start = viewportHeight * 0.98;
      const end = viewportHeight * 0.08;
      const raw = (start - rect.top) / (start - end);
      const normalized = clamp(raw, 0, 1);
      targetProgressRef.current = easeInOutCubic(normalized);

      ensureAnimation();
    };

    const onScroll = () => {
      if (!measureRafId) {
        measureRafId = window.requestAnimationFrame(measureTarget);
      }
    };

    const onResize = () => {
      setViewportWidth(window.innerWidth);
      onScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();

    return () => {
      if (measureRafId) {
        window.cancelAnimationFrame(measureRafId);
      }
      if (animationRafId) {
        window.cancelAnimationFrame(animationRafId);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return { containerRef, progress, viewportWidth };
}

function DeviceMergeStage({
  laptopSrc = "/imgs/elements/dashboard-laptop.svg",
  phoneSrc = "/imgs/elements/dashboard-phone.svg",
  startDistance = 420,
  className = "",
  children,
}) {
  const { containerRef, progress, viewportWidth } = useMergeProgress();
  const inverse = 1 - progress;
  const sectionHeaderHalfWidth = clamp(
    Math.min(700, viewportWidth - 80) / 2,
    150,
    350,
  );
  const splitDistance = Math.max(
    startDistance,
    sectionHeaderHalfWidth + clamp(viewportWidth * 0.6, 220, 380),
  );

  const rowY = clamp(viewportWidth * -1, -86, -44);
  const imageDrop = progress * clamp(viewportWidth * 0.18, 140, 250);
  const laptopFinalX = 0;
  const laptopX = laptopFinalX + (-splitDistance - laptopFinalX) * inverse;
  const laptopY = rowY + (-10 * inverse) + imageDrop;
  const laptopScale = 0.58 + progress * 0.32;
  const laptopRotate = 0;
  const laptopOpacity = 1;
  const laptopBlur = 0;

  const phoneFinalX = clamp(viewportWidth * 0.52, 120, 320);
  const phoneFinalY = rowY + 30;
  const phoneX = phoneFinalX + (splitDistance - phoneFinalX) * inverse;
  const phoneY =
    phoneFinalY + ((rowY + 12) - phoneFinalY) * inverse + imageDrop + progress * 18;
  const phoneScale = 0.6 + progress * 0.38;
  const phoneRotate = 0;
  const phoneOpacity = 1;
  const phoneBlur = 0;
  const stageScale = 0.9 + progress * 0.16;
  const stageLift = 2 * inverse;

  return (
    <div ref={containerRef} className={`device-merge-effect ${className}`}>
      <div
        className="device-merge-effect__stage"
        style={{
          transform: `translateY(${stageLift}px) scale(${stageScale})`,
          transformOrigin: "50% 45%",
          willChange: "transform",
        }}
      >
        <div className="device-merge-effect__backglow" aria-hidden="true" />
        <div className="device-merge-effect__floor" aria-hidden="true" />
        {children ? (
          <div className="device-merge-effect__center">
            {children}
          </div>
        ) : null}

        <img
          src={laptopSrc}
          alt="Desktop dashboard preview"
          className="device-merge-effect__laptop"
          loading="lazy"
          style={{
            transform: `translate(calc(-50% + ${laptopX}px), calc(-50% + ${laptopY}px)) rotate(${laptopRotate}deg) scale(${laptopScale})`,
            opacity: laptopOpacity,
            filter: `drop-shadow(0 44px 85px rgba(0, 0, 0, 0.28)) blur(${laptopBlur}px)`,
          }}
        />

        <img
          src={phoneSrc}
          alt="Mobile dashboard preview"
          className="device-merge-effect__phone"
          loading="lazy"
          style={{
            transform: `translate(calc(-50% + ${phoneX}px), calc(-50% + ${phoneY}px)) rotate(${phoneRotate}deg) scale(${phoneScale})`,
            opacity: phoneOpacity,
            filter: `drop-shadow(0 32px 65px rgba(0, 0, 0, 0.3)) blur(${phoneBlur}px)`,
          }}
        />
      </div>

      <p
        className="device-merge-effect__hint"
        style={{ opacity: clamp(1 - progress * 1.15, 0, 1) }}
      >
        Scroll to merge desktop and mobile
      </p>
    </div>
  );
}

export function DeviceMerge(props) {
  return <DeviceMergeStage {...props} />;
}

export function DeviceMergeLabeled(props) {
  return <DeviceMergeStage {...props} />;
}

export function DeviceMergeAdvanced(props) {
  return <DeviceMergeStage {...props} />;
}

export default DeviceMerge;
