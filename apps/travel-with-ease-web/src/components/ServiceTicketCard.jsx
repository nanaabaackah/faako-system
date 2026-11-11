import { useEffect, useRef, useState } from "react";
import { ArrowRight4 } from "@faako/ui";
import TiltedCard, { TiltedCardLayer } from "./reactbits/TiltedCard.jsx";
import { moneySegments } from "../lib/currency-display.js";
import "../styles/components/service-ticket.css";

/* The React Bits ticket demo, adapted to TWE's published service content.
   A real service link remains available on the front when JavaScript is disabled.
   The barcode is decoration; it is not a booking credential. */
function ServiceFee({ text }) {
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

/** @param {{ title: string, price: string, summary: string, description: string, href: string, imageSrc: string, index: number }} props */
export default function ServiceTicketCard({ title, price, summary, description, href, imageSrc, index = 0 }) {
  const [flipped, setFlipped] = useState(false);
  const frontToggleRef = useRef(null);
  const backToggleRef = useRef(null);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return; }
    (flipped ? backToggleRef : frontToggleRef).current?.focus({ preventScroll: true });
  }, [flipped]);
  // Like the ticket demo, the blank ticket surface also flips when clicked;
  // service links and explicit flip buttons retain their own actions.
  const flipSurface = (event, next) => {
    if (event.target.closest("a, button")) return;
    setFlipped(next);
  };
  return (
    <div className="twe-service-ticket" data-ticket-index={index}>
      <TiltedCard
        className="twe-service-ticket__tilt"
        imageSrc={imageSrc}
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
        intro
        introDelay={index * 85}
        flipped={flipped}
        flipOnClick={false}
        backContent={
          <div className="twe-ticket twe-ticket--back" onClick={event => flipSurface(event, false)}>
            <div className="twe-ticket__stub twe-ticket__stub--back" aria-hidden="true">
            </div>
            <div className="twe-ticket__back-main">
              <h3>{title}</h3>
              <p className="twe-ticket__description">{description}</p>
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
                  aria-label={`Explore ${title} service`}
                  title="Explore service"
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
              <h3><a href={href}>{title}</a></h3>
              <p className="twe-ticket__summary">{summary}</p>
            </div>
            <div className="twe-ticket__bottom">
              <p className="twe-ticket__fee"><ServiceFee text={price} /></p>
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
