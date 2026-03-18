import { useEffect, useMemo, useRef } from "react";
import "../styles/components/particles.css";

const defaultColors = ["#ffffff", "#ffffff", "#ffffff"];
const TAU = Math.PI * 2;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const mix = (a, b, t) => a + (b - a) * t;

const hexToRgb = (hex) => {
  let normalized = hex.replace(/^#/, "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const parsed = Number.parseInt(normalized, 16);
  const r = ((parsed >> 16) & 255) / 255;
  const g = ((parsed >> 8) & 255) / 255;
  const b = (parsed & 255) / 255;

  return [r, g, b];
};

const rotateX = (y, z, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [y * cos - z * sin, y * sin + z * cos];
};

const rotateY = (x, z, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, -x * sin + z * cos];
};

export default function Particles({
  particleCount = 200,
  particleSpread = 10,
  speed = 0.1,
  particleColors,
  moveParticlesOnHover = false,
  particleHoverFactor = 1,
  alphaParticles = false,
  particleBaseSize = 100,
  sizeRandomness = 1,
  cameraDistance = 20,
  disableRotation = false,
  pixelRatio = 1,
  className = "",
}) {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const paletteKey = useMemo(() => {
    const palette =
      Array.isArray(particleColors) && particleColors.length
        ? particleColors
        : defaultColors;

    return palette.join("|");
  }, [particleColors]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) {
      return undefined;
    }

    container.appendChild(canvas);

    const dpr = Math.max(1, Math.min(2, pixelRatio || window.devicePixelRatio || 1));
    const palette = paletteKey.split("|").map(hexToRgb);
    const safeCount = Math.max(12, Math.floor(particleCount));
    const particles = new Array(safeCount).fill(null).map(() => {
      let x = 0;
      let y = 0;
      let z = 0;
      let len = 0;

      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        len = x * x + y * y + z * z;
      } while (len > 1 || len === 0);

      const radius = Math.cbrt(Math.random());
      const color = palette[Math.floor(Math.random() * palette.length)];

      return {
        x: x * radius,
        y: y * radius,
        z: z * radius,
        rx: Math.random(),
        ry: Math.random(),
        rz: Math.random(),
        rw: Math.random(),
        color,
      };
    });

    let width = 1;
    let height = 1;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handleMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current = { x, y };
    };

    const resetMouse = () => {
      mouseRef.current = { x: 0, y: 0 };
    };

    const drawPoint = (pointX, pointY, size, red, green, blue, alpha) => {
      if (alphaParticles) {
        const gradient = context.createRadialGradient(
          pointX,
          pointY,
          0,
          pointX,
          pointY,
          size,
        );
        gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
        context.fillStyle = gradient;
      } else {
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
      }

      context.beginPath();
      context.arc(pointX, pointY, size, 0, TAU);
      context.fill();
    };

    const update = (timestamp) => {
      frameId = window.requestAnimationFrame(update);
      const delta = timestamp - lastTime;
      lastTime = timestamp;
      elapsed += delta * speed;

      const time = elapsed * 0.001;
      const hoverOffsetX =
        moveParticlesOnHover
          ? -mouseRef.current.x * particleHoverFactor * particleSpread * 0.42
          : 0;
      const hoverOffsetY =
        moveParticlesOnHover
          ? -mouseRef.current.y * particleHoverFactor * particleSpread * 0.42
          : 0;

      context.clearRect(0, 0, width, height);

      const drawQueue = [];
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const roll = disableRotation ? 0 : elapsed * 0.00006;
      const yaw = disableRotation ? 0 : Math.cos(elapsed * 0.0005) * 0.16 + roll;
      const pitch = disableRotation ? 0 : Math.sin(elapsed * 0.0002) * 0.11;

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        let x = particle.x * particleSpread;
        let y = particle.y * particleSpread;
        let z = particle.z * particleSpread * 10;

        x += Math.sin(time * particle.rz + TAU * particle.rw) * mix(0.1, 1.5, particle.rx);
        y += Math.sin(time * particle.ry + TAU * particle.rx) * mix(0.1, 1.5, particle.rw);
        z += Math.sin(time * particle.rw + TAU * particle.ry) * mix(0.1, 1.5, particle.rz);

        [x, z] = rotateY(x, z, yaw);
        [y, z] = rotateX(y, z, pitch);

        x += hoverOffsetX;
        y += hoverOffsetY;

        const depth = cameraDistance - z * 0.08;
        if (depth <= 0.05) {
          continue;
        }

        const perspective = cameraDistance / depth;
        const pointX = centerX + x * perspective * 18;
        const pointY = centerY + y * perspective * 18;

        if (pointX < -32 || pointX > width + 32 || pointY < -32 || pointY > height + 32) {
          continue;
        }

        const randomFactor =
          sizeRandomness === 0
            ? 1
            : 1 + sizeRandomness * (particle.rx - 0.5);
        const size = Math.max(0.45, (particleBaseSize / 90) * perspective * randomFactor);
        const pulse = 0.2 * Math.sin(time + particle.ry * TAU);

        const red = Math.round(clamp01(particle.color[0] + pulse * 0.35) * 255);
        const green = Math.round(clamp01(particle.color[1] + pulse * 0.35) * 255);
        const blue = Math.round(clamp01(particle.color[2] + pulse * 0.35) * 255);
        const alpha = alphaParticles
          ? clamp01(0.12 + perspective * 0.28)
          : clamp01(0.32 + perspective * 0.38);

        drawQueue.push({ pointX, pointY, size, red, green, blue, alpha, depth });
      }

      drawQueue.sort((left, right) => right.depth - left.depth);

      for (let index = 0; index < drawQueue.length; index += 1) {
        const draw = drawQueue[index];
        drawPoint(
          draw.pointX,
          draw.pointY,
          draw.size,
          draw.red,
          draw.green,
          draw.blue,
          draw.alpha,
        );
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    if (moveParticlesOnHover) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", resetMouse);
    }
    frameId = window.requestAnimationFrame(update);

    return () => {
      window.removeEventListener("resize", resize);
      if (moveParticlesOnHover) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", resetMouse);
      }
      window.cancelAnimationFrame(frameId);
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, [
    alphaParticles,
    cameraDistance,
    disableRotation,
    moveParticlesOnHover,
    paletteKey,
    particleBaseSize,
    particleCount,
    particleHoverFactor,
    particleSpread,
    pixelRatio,
    sizeRandomness,
    speed,
  ]);

  return <div ref={containerRef} className={`particles-container ${className}`.trim()} />;
}
