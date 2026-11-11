import { useEffect, useRef, useState } from "react";
import { ArrowRight4 } from "@faako/ui";
import TiltedCard, { TiltedCardLayer } from "./reactbits/TiltedCard.jsx";
import { moneySegments } from "../lib/currency-display.js";
import "../styles/components/package-ticket.css";

/* A travel-package ticket based on TWE's existing React Bits TiltedCard.
   Front carries the published destination, duration and price. The reverse
   contains the published overview and a native link to the package route.
   Decorative barcode and imagery never imply a confirmed reservation. */
function PackageFee({ text }) {
  return moneySegments(text).map((segment, index) =>
    segment.minor ? (
      <span key={index} className="twe-money" data-twe-money={segment.minor} data-ghs-label={segment.displayText}>
        <span data-money-value>{segment.displayText}</span>
        <small data-money-original hidden> ({segment.displayText})</small>
      </span>
    ) : (
      <span key={index}>{segment.text}</span>
    )
  );
}

/** @param {{ title: string, duration?: string, price: string, priceNote?: string, tagline: string, overview: string, href: string, imageSrc?: string, imageSrcSet?: string, imageSizes?: string, mobileImageSrcSet?: string, imagePosition?: string, mobileImagePosition?: string, index?: number, headingLevel?: "h2"|"h3" }} props */
export default function PackageTicketCard({
  title, duration, price, priceNote, tagline, overview, href, imageSrc, imageSrcSet,
  imageSizes, mobileImageSrcSet, imagePosition, mobileImagePosition,
  index = 0, headingLevel = "h3"
}) {
  const Heading = headingLevel;
  const [flipped, setFlipped] = useState(false);
  const frontToggleRef = useRef(null);
  const backToggleRef = useRef(null);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return; }
    (flipped ? backToggleRef : frontToggleRef).current?.focus({ preventScroll: true });
  }, [flipped]);
  // Like the ticket demo, the blank ticket surface also flips when clicked;
  // package links and explicit flip buttons retain their own actions.
  const flipSurface = (event, next) => {
    if (event.target.closest("a, button")) return;
    setFlipped(next);
  };
  return (
    <div className="twe-package-ticket" data-ticket-index={index}>
      <TiltedCard
        className="twe-package-ticket__tilt"
        imageSrc={imageSrc}
        imageSrcSet={imageSrcSet}
        imageSizes={imageSizes}
        mobileImageSrcSet={mobileImageSrcSet}
        imagePosition={imagePosition}
        imageMobilePosition={mobileImagePosition}
        altText=""
        captionText=""
        showTooltip={false}
        containerWidth="100%"
        containerHeight="100%"
        imageWidth="100%"
        imageHeight="100%"
        radius={8}
        rotateAmplitude={9}
        scaleOnHover={1.025}
        smoothness={0.65}
        perspective={850}
        glare={0.22}
        glareColor="#f4ede3"
        shadow={0.25}
        parallax={0.55}
        gyroscope={false}
        floating={false}
        intro={false}
        flipped={flipped}
        flipOnClick={false}
        backContent={
          <div className="twe-ticket twe-ticket--back" onClick={event => flipSurface(event, false)}>
            <div className="twe-ticket__stub twe-ticket__stub--back" aria-hidden="true">
            </div>
            <div className="twe-ticket__back-main">
              <Heading>{title}</Heading>
              <p className="twe-ticket__description">{overview}</p>
              <div className="twe-ticket__actions">
                <button
                  ref={backToggleRef}
                  type="button"
                  className="twe-ticket__flip twe-ticket__flip--back"
                  aria-label={`Back to ${title} ticket`}
                  title="Back to ticket"
                  onClick={() => setFlipped(false)}
                >
                  <ArrowRight4 size={20} aria-hidden="true" focusable="false" />
                </button>
                <a
                  href={href}
                  className="twe-ticket__link"
                  aria-label={`Explore ${title} package`}
                  title="Explore package"
                >
                  <ArrowRight4 size={20} aria-hidden="true" focusable="false" />
                </a>
              </div>
            </div>
          </div>
        }
      >
        <div className="twe-ticket twe-ticket--front" onClick={event => flipSurface(event, true)}>
          <TiltedCardLayer depth={18} className="twe-ticket__main">
            <div className="twe-ticket__content">
              <Heading><a href={href}>{title}</a></Heading>
              {duration && <p className="twe-ticket__duration">{duration}</p>}
              <p className="twe-ticket__summary">{tagline}</p>
            </div>
            <div className="twe-ticket__bottom">
              <div className="twe-ticket__price-group">
                <p className="twe-ticket__fee"><PackageFee text={price} /></p>
                {priceNote && <small className="twe-ticket__price-note">{priceNote}</small>}
              </div>
              <button
                ref={frontToggleRef}
                type="button"
                className="twe-ticket__flip"
                aria-label={`View ${title} details`}
                title="View details"
                onClick={() => setFlipped(true)}
              >
                <ArrowRight4 size={20} aria-hidden="true" focusable="false" />
              </button>
            </div>
          </TiltedCardLayer>
          <TiltedCardLayer depth={10} className="twe-ticket__stub" aria-hidden="true">
            <svg className="twe-ticket__barcode" viewBox="0 0 40 90" preserveAspectRatio="none" focusable="false" aria-hidden="true">
              {Array.from({ length: 21 }, (_, i) => (
                <rect key={i} x={i * 1.9} y="0" width={i % 4 === 0 ? 1.5 : 0.7} height="90" />
              ))}
            </svg>
          </TiltedCardLayer>
        </div>
      </TiltedCard>
    </div>
  );
}
