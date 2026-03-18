import { Mesh, Program, Renderer, Triangle, Vec3 } from "ogl";
import { useEffect, useRef } from "react";
import "../styles/components/orb.css";

const vertexShader = /* glsl */ `
  precision highp float;

  attribute vec2 position;
  attribute vec2 uv;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float iTime;
  uniform vec3 iResolution;
  uniform float hue;
  uniform float hover;
  uniform float rot;
  uniform float hoverIntensity;
  uniform vec3 backgroundColor;

  varying vec2 vUv;

  vec3 rgb2yiq(vec3 c) {
    float y = dot(c, vec3(0.299, 0.587, 0.114));
    float i = dot(c, vec3(0.596, -0.274, -0.322));
    float q = dot(c, vec3(0.211, -0.523, 0.312));
    return vec3(y, i, q);
  }

  vec3 yiq2rgb(vec3 c) {
    float r = c.x + 0.956 * c.y + 0.621 * c.z;
    float g = c.x - 0.272 * c.y - 0.647 * c.z;
    float b = c.x - 1.106 * c.y + 1.703 * c.z;
    return vec3(r, g, b);
  }

  vec3 adjustHue(vec3 color, float hueDeg) {
    float hueRad = hueDeg * 3.14159265 / 180.0;
    vec3 yiq = rgb2yiq(color);
    float cosA = cos(hueRad);
    float sinA = sin(hueRad);
    float i = yiq.y * cosA - yiq.z * sinA;
    float q = yiq.y * sinA + yiq.z * cosA;
    yiq.y = i;
    yiq.z = q;
    return yiq2rgb(yiq);
  }

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);
    return -1.0 + 2.0 * fract(vec3(
      p3.x + p3.y,
      p3.x + p3.z,
      p3.y + p3.z
    ) * p3.zyx);
  }

  float snoise3(vec3 p) {
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;
    vec4 h = max(0.6 - vec4(
      dot(d0, d0),
      dot(d1, d1),
      dot(d2, d2),
      dot(d3, d3)
    ), 0.0);
    vec4 n = h * h * h * h * vec4(
      dot(d0, hash33(i)),
      dot(d1, hash33(i + i1)),
      dot(d2, hash33(i + i2)),
      dot(d3, hash33(i + 1.0))
    );
    return dot(vec4(31.316), n);
  }

  vec4 extractAlpha(vec3 colorIn) {
    float a = max(max(colorIn.r, colorIn.g), colorIn.b);
    return vec4(colorIn.rgb / (a + 1e-5), a);
  }

  const vec3 baseColor1 = vec3(0.780392, 0.949020, 1.000000);
  const vec3 baseColor2 = vec3(0.470588, 0.635294, 1.000000);
  const vec3 baseColor3 = vec3(0.686275, 0.392157, 1.000000);
  const float innerRadius = 0.82;
  const float noiseScale = 0.65;

  float light1(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * attenuation);
  }

  float light2(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * dist * attenuation);
  }

  vec4 draw(vec2 uv) {
    vec3 color1 = adjustHue(baseColor1, hue);
    vec3 color2 = adjustHue(baseColor2, hue);
    vec3 color3 = adjustHue(baseColor3, hue);

    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float bgLuminance = dot(backgroundColor, vec3(0.299, 0.587, 0.114));
    float noise = snoise3(vec3(
      vec2(cos(ang * 2.0), sin(ang * 2.0)) * 0.6 + uv * noiseScale * 0.18,
      iTime * 0.18
    )) * 0.5 + 0.5;

    float wobble = (noise - 0.5) * 0.035;
    float radius = innerRadius + wobble;
    float ringWidth = mix(0.085, 0.12, noise);
    float ringDistance = abs(len - radius);

    float coreRing = 1.0 - smoothstep(ringWidth * 0.35, ringWidth, ringDistance);
    float innerCut = smoothstep(radius - ringWidth * 1.8, radius - ringWidth * 0.62, len);
    float outerCut = 1.0 - smoothstep(radius + ringWidth * 0.2, radius + ringWidth * 2.2, len);
    float ringMask = clamp(coreRing * innerCut * outerCut, 0.0, 1.0);

    float softGlow = 1.0 - smoothstep(ringWidth * 0.25, ringWidth * 4.0, ringDistance);
    softGlow *= smoothstep(radius - ringWidth * 2.3, radius - ringWidth * 0.2, len);

    float outerGlow = 1.0 - smoothstep(0.0, ringWidth * 7.0, ringDistance);
    outerGlow *= smoothstep(radius - ringWidth * 0.6, radius + ringWidth * 0.4, len);

    float sweep = 0.5 + 0.5 * cos(ang - iTime * 0.45);
    float blendArc = 0.5 + 0.5 * sin(ang + 0.8);
    vec3 arcColor = mix(color3, color2, blendArc);
    vec3 ringColor = mix(color1, arcColor, sweep);

    float highlightArc = pow(max(cos(ang - iTime * 0.65 - 1.0), 0.0), 7.0);
    float highlight = highlightArc * (1.0 - smoothstep(ringWidth * 0.18, ringWidth * 1.6, ringDistance));

    vec3 finalCol = ringColor * ringMask * 1.25;
    finalCol += ringColor * softGlow * 0.32;
    finalCol += mix(color1, vec3(1.0), 0.42) * highlight * 1.55;
    finalCol += mix(color2, color3, 0.4) * outerGlow * 0.12;
    finalCol = mix(finalCol, finalCol * 0.88, bgLuminance * 0.15);
    finalCol = clamp(finalCol, 0.0, 1.0);

    return extractAlpha(finalCol);
  }

  vec4 mainImage(vec2 fragCoord) {
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;

    float angle = rot;
    float s = sin(angle);
    float c = cos(angle);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

    uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
    uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

    return draw(uv);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec4 col = mainImage(fragCoord);
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`;

function hslToRgb(h, s, l) {
  let r;
  let g;
  let b;

  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let channel = t;
      if (channel < 0) channel += 1;
      if (channel > 1) channel -= 1;
      if (channel < 1 / 6) return p + (q - p) * 6 * channel;
      if (channel < 1 / 2) return q;
      if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return new Vec3(r, g, b);
}

function hexToVec3(color) {
  if (color.startsWith("#")) {
    const r = Number.parseInt(color.slice(1, 3), 16) / 255;
    const g = Number.parseInt(color.slice(3, 5), 16) / 255;
    const b = Number.parseInt(color.slice(5, 7), 16) / 255;
    return new Vec3(r, g, b);
  }

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return new Vec3(
      Number.parseInt(rgbMatch[1], 10) / 255,
      Number.parseInt(rgbMatch[2], 10) / 255,
      Number.parseInt(rgbMatch[3], 10) / 255,
    );
  }

  const hslMatch = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
  if (hslMatch) {
    const h = Number.parseInt(hslMatch[1], 10) / 360;
    const s = Number.parseInt(hslMatch[2], 10) / 100;
    const l = Number.parseInt(hslMatch[3], 10) / 100;
    return hslToRgb(h, s, l);
  }

  return new Vec3(0, 0, 0);
}

export default function Orb({
  hue = 0,
  hoverIntensity = 0.2,
  rotateOnHover = true,
  forceHoverState = false,
  backgroundColor = "#000000",
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
    });
    const { gl } = renderer;

    gl.clearColor(0, 0, 0, 0);
    container.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Vec3(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / Math.max(gl.canvas.height, 1),
          ),
        },
        hue: { value: hue },
        hover: { value: 0 },
        rot: { value: 0 },
        hoverIntensity: { value: hoverIntensity },
        backgroundColor: { value: hexToVec3(backgroundColor) },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (!width || !height) {
        return;
      }

      renderer.setSize(width * dpr, height * dpr);
      gl.canvas.style.width = `${width}px`;
      gl.canvas.style.height = `${height}px`;
      program.uniforms.iResolution.value.set(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / Math.max(gl.canvas.height, 1),
      );
    };

    window.addEventListener("resize", resize);
    resize();

    let targetHover = 0;
    let lastTime = 0;
    let currentRotation = 0;
    const rotationSpeed = 0.3;

    const handleMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      const size = Math.min(width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const uvX = ((x - centerX) / size) * 2.0;
      const uvY = ((y - centerY) / size) * 2.0;

      targetHover = Math.sqrt(uvX * uvX + uvY * uvY) < 0.8 ? 1 : 0;
    };

    const handleMouseLeave = () => {
      targetHover = 0;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    let frameId = 0;

    const update = (time) => {
      frameId = window.requestAnimationFrame(update);

      const delta = (time - lastTime) * 0.001;
      lastTime = time;

      program.uniforms.iTime.value = time * 0.001;
      program.uniforms.hue.value = hue;
      program.uniforms.hoverIntensity.value = hoverIntensity;
      program.uniforms.backgroundColor.value = hexToVec3(backgroundColor);

      const effectiveHover = forceHoverState ? 1 : targetHover;
      program.uniforms.hover.value +=
        (effectiveHover - program.uniforms.hover.value) * 0.1;

      if (rotateOnHover && effectiveHover > 0.5) {
        currentRotation += delta * rotationSpeed;
      }

      program.uniforms.rot.value = currentRotation;
      renderer.render({ scene: mesh });
    };

    frameId = window.requestAnimationFrame(update);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);

      if (container.contains(gl.canvas)) {
        container.removeChild(gl.canvas);
      }

      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [backgroundColor, forceHoverState, hoverIntensity, hue, rotateOnHover]);

  return <div ref={containerRef} className="orb-container" />;
}
