import TiltedCard from "./reactbits/TiltedCard.jsx";

/* Visual enhancement only. Service name, fee, description and native link stay
   in Astro so they remain available without hydration or JavaScript. */
/** @param {{ imageSrc: string }} props */
export default function ServiceTiltBackground({ imageSrc }) {
  return (
    <TiltedCard
      imageSrc={imageSrc}
      altText=""
      captionText=""
      showTooltip={false}
      containerWidth="100%"
      containerHeight="100%"
      imageWidth="100%"
      imageHeight="100%"
      rotateAmplitude={2.5}
      scaleOnHover={1.015}
      radius={8}
      perspective={1100}
      smoothness={0.7}
      glare={0}
      shadow={0}
      parallax={0}
      gyroscope={false}
      floating={false}
      intro={false}
      trackWindow={false}
      flipOnClick={false}
      className="twe-service-tilt"
    />
  );
}
