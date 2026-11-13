import Masonry from "./reactbits/Masonry.jsx";
import "../styles/components/package-masonry.css";

/** @param {{ images: { src: string, alt: string, width: number, height: number }[] }} props */
export default function PackageMasonry({ images = [] }) {
  if (!images.length) return null;
  return (
    <div className="twe-package-masonry" aria-label="Package photographs">
      <Masonry
        items={images.map((image, index) => ({
          id: `photo-${index}`,
          img: image.src,
          width: image.width,
          height: image.height,
          title: image.alt,
          alt: image.alt
        }))}
        columnWidth={220}
        gap={10}
        radius={8}
        animateFrom="bottom"
        stagger={0.035}
        duration={0.4}
        bounce={0}
        blurToFocus={false}
        revealOnScroll
        hoverEffect="none"
        focusOnHover={false}
        captions="none"
        parallax={0}
        lightbox
        draggable={false}
      />
    </div>
  );
}
