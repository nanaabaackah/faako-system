import { useEffect, useRef } from 'react';

const DEFAULT_POINTER_X = 0.55;
const DEFAULT_POINTER_Y = 0.34;

function BackgroundFX() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let animationFrameId = 0;
    let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let strokeColor = 'rgba(60, 60, 60, 0.4)';

    const getViewportSize = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        return {
          width: Math.max(1, Math.round(viewport.width)),
          height: Math.max(1, Math.round(viewport.height)),
        };
      }

      return {
        width: Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1),
        height: Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1),
      };
    };

    const initialViewport = getViewportSize();
    const pointer = {
      x: initialViewport.width * DEFAULT_POINTER_X,
      y: initialViewport.height * DEFAULT_POINTER_Y,
    };

    const readStrokeColor = () => {
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue('--magnet-lines-color')
        .trim();
      strokeColor = computed || 'rgba(60, 60, 60, 0.4)';
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = getViewportSize();
      width = viewport.width;
      height = viewport.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (isReducedMotion) {
        drawLines(performance.now());
      }
    };

    const drawLines = (time = 0) => {
      if (!width || !height) return;

      const spacing = Math.max(42, Math.min(72, width / 28));
      const segment = Math.max(24, Math.round(spacing * 0.68));
      const radius = Math.min(width, height) * 0.28;
      const strength = Math.min(42, spacing * 0.72);
      const pulse = isReducedMotion ? 0 : Math.sin(time * 0.00055) * 2.4;

      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;

      for (let x = -spacing; x <= width + spacing; x += spacing) {
        let hasStarted = false;

        for (let y = -segment; y <= height + segment; y += segment) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const influence = Math.exp(-(distance * distance) / (radius * radius));
          const direction = dx === 0 ? 0 : Math.sign(dx);
          const wave = isReducedMotion ? 0 : Math.sin((y + time * 0.1 + x * 0.32) * 0.06) * pulse;
          const displacedX = x + direction * strength * influence + wave * influence;

          if (!hasStarted) {
            ctx.moveTo(displacedX, y);
            hasStarted = true;
          } else {
            ctx.lineTo(displacedX, y);
          }
        }
      }

      for (let y = -spacing; y <= height + spacing; y += spacing) {
        let hasStarted = false;

        for (let x = -segment; x <= width + segment; x += segment) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const influence = Math.exp(-(distance * distance) / (radius * radius));
          const direction = dy === 0 ? 0 : Math.sign(dy);
          const wave = isReducedMotion ? 0 : Math.cos((x + time * 0.1 + y * 0.32) * 0.06) * pulse;
          const displacedY = y + direction * strength * influence + wave * influence;

          if (!hasStarted) {
            ctx.moveTo(x, displacedY);
            hasStarted = true;
          } else {
            ctx.lineTo(x, displacedY);
          }
        }
      }

      ctx.stroke();
    };

    const render = (time) => {
      drawLines(time);
      if (!isReducedMotion) animationFrameId = requestAnimationFrame(render);
    };

    const updatePointer = (clientX, clientY) => {
      pointer.x = clientX;
      pointer.y = clientY;
      if (isReducedMotion) drawLines(performance.now());
    };

    const handlePointerMove = (event) => {
      updatePointer(event.clientX, event.clientY);
    };

    const handlePointerLeave = () => {
      updatePointer(width * DEFAULT_POINTER_X, height * DEFAULT_POINTER_Y);
    };

    const handleReducedMotionChange = (event) => {
      isReducedMotion = event.matches;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      drawLines(performance.now());
      if (!isReducedMotion) animationFrameId = requestAnimationFrame(render);
    };

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleReducedMotionChange);
    } else {
      mediaQuery.addListener(handleReducedMotionChange);
    }

    const themeObserver = new MutationObserver(() => {
      readStrokeColor();
      drawLines(performance.now());
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });

    readStrokeColor();
    resize();
    drawLines(performance.now());

    if (!isReducedMotion) animationFrameId = requestAnimationFrame(render);

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    if (visualViewport) {
      visualViewport.addEventListener('resize', resize);
      visualViewport.addEventListener('scroll', resize);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      if (visualViewport) {
        visualViewport.removeEventListener('resize', resize);
        visualViewport.removeEventListener('scroll', resize);
      }
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleReducedMotionChange);
      } else {
        mediaQuery.removeListener(handleReducedMotionChange);
      }
    };
  }, []);

  return (
    <div className="background-fx" aria-hidden="true">
      <canvas ref={canvasRef} className="background-fx__canvas" />
    </div>
  );
}

export default BackgroundFX;
