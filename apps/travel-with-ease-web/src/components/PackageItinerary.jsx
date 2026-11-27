import { useEffect, useRef } from "react";
import RichText from "./RichText.jsx";
import "../styles/components/rich-text.css";
import "../styles/components/package-itinerary-interactive.css";

/* Keep all published days in the HTML. Motion is progressive enhancement:
   the page scrolls normally, and visiting a day never hides earlier content. */
/** @param {{ days: { day: number; title: string; text: string }[] }} props */
export default function PackageItinerary({ days = [] }) {
  const timelineRef = useRef(null);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline || typeof IntersectionObserver === "undefined") return;
    const stops = Array.from(timeline.querySelectorAll("li[data-itinerary-day]"));
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer;
    const reset = () => {
      observer?.disconnect();
      for (const stop of stops) {
        stop.removeAttribute("data-revealed");
        stop.removeAttribute("data-connected");
        stop.style.removeProperty("--itinerary-delay");
      }
      if (preference.matches) return;
      observer = new IntersectionObserver(entries => {
        const arriving = entries.filter(entry => entry.isIntersecting)
          .sort((a, b) => stops.indexOf(a.target) - stops.indexOf(b.target));
        arriving.forEach((entry, order) => {
          const stop = entry.target;
          const index = stops.indexOf(stop);
          stop.style.setProperty("--itinerary-delay", `${Math.min(order, 2) * 120}ms`);
          stop.setAttribute("data-revealed", "true");
          for (const previous of stops.slice(0, index)) {
            previous.setAttribute("data-connected", "true");
          }
          observer.unobserve(stop);
        });
      }, { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0 });
      stops.forEach(stop => observer.observe(stop));
    };
    reset();
    preference.addEventListener("change", reset);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", reset);
    };
  }, [days.length]);

  if (!days.length) return null;
  return (
    <ol ref={timelineRef} className="twe-package-itinerary" role="list" aria-label="Day-by-day itinerary">
      {days.map((day, index) => (
        <li className="twe-package-itinerary__item" role="listitem" key={`day-${day.day}-${index}`} data-itinerary-day={day.day}>
          <span className="twe-package-itinerary__marker" aria-hidden="true" />
          {index < days.length - 1 && <span className="twe-package-itinerary__route" aria-hidden="true" />}
          <div className="twe-package-itinerary__entry">
            <span className="twe-package-itinerary__day">Day {day.day}</span>
            <div className="twe-package-itinerary__copy">
              <h3>{day.title}</h3>
              <RichText value={day.text}/>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
