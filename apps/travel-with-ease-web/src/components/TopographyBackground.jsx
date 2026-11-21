import { useEffect, useState } from "react";
import Topography from "./react-bits/Topography.jsx";

export default function TopographyBackground() {
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  if (!motionAllowed) {
    return <div className="closing-topography" data-topography-static />;
  }

  return (
    <Topography
      color="#D8B56A"
      lineCount={22}
      lineWidth={1}
      majorLines={false}
      elevation={1}
      foreground={0.2}
      scale={1}
      detail={0.35}
      tilt={32}
      speed={0.18}
      direction="forward"
      morph={0.12}
      glow={0.15}
      depthOfField={0}
      fog={0.35}
      brightness={1.1}
      opacity={1}
      mouseInteraction={false}
      hoverEffect="light"
      clickEffect="none"
      markers="dots"
      glitch={0}
      intro
      lightMode={false}
      className="closing-topography"
    />
  );
}
