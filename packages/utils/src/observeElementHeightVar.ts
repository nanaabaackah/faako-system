interface ObserveElementHeightVarOptions {
  source: HTMLElement | null;
  target: HTMLElement | null;
  cssVar?: string;
  fallback?: number;
}

export const observeElementHeightVar = ({
  source,
  target,
  cssVar = "--topbar-height",
  fallback,
}: ObserveElementHeightVarOptions) => {
  if (!target) {
    return () => {};
  }

  const applyHeight = (nextHeight?: number | null) => {
    if (typeof nextHeight === "number" && Number.isFinite(nextHeight) && nextHeight > 0) {
      target.style.setProperty(cssVar, `${Math.ceil(nextHeight)}px`);
      return;
    }

    if (typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0) {
      target.style.setProperty(cssVar, `${Math.ceil(fallback)}px`);
    }
  };

  applyHeight(null);

  if (!source || typeof window === "undefined") {
    return () => {};
  }

  let animationFrameId = 0;

  const syncHeight = () => {
    animationFrameId = 0;
    applyHeight(source.getBoundingClientRect().height);
  };

  const scheduleSync = () => {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
    }

    animationFrameId = window.requestAnimationFrame(syncHeight);
  };

  const resizeObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleSync) : null;
  resizeObserver?.observe(source);

  window.addEventListener("resize", scheduleSync);
  window.addEventListener("orientationchange", scheduleSync);
  window.visualViewport?.addEventListener("resize", scheduleSync);

  scheduleSync();

  return () => {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
    }

    resizeObserver?.disconnect();
    window.removeEventListener("resize", scheduleSync);
    window.removeEventListener("orientationchange", scheduleSync);
    window.visualViewport?.removeEventListener("resize", scheduleSync);
  };
};
