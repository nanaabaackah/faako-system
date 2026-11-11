import AnimatedList from "./reactbits/AnimatedList.jsx";
import "../styles/components/package-itinerary-interactive.css";

/* A day-by-day editorial list. Every approved day stays in the DOM and readable,
   including before hydration, without motion, and with JavaScript disabled. */
/** @param {{ days: { day: number, title: string, text: string }[] }} props */
export default function PackageItinerary({ days = [] }) {
  if (!days.length) return null;
  const items = days.map((day, index) => ({
    id: `day-${day.day}-${index}`,
    day: day.day,
    title: day.title,
    description: day.text
  }));
  return (
    <div className="twe-package-itinerary" aria-label="Day-by-day itinerary">
      <AnimatedList
        items={items}
        semantic="list"
        initialSelectedIndex={-1}
        selectOnHover={false}
        enableArrowNavigation={false}
        animation="fade"
        animateOnce
        stagger={0.035}
        showGradients={false}
        displayScrollbar={false}
        frame={false}
        theme="light"
        accentColor="#010c33"
        radius={8}
        gap={0}
        width="100%"
        maxHeight="none"
        className="twe-package-itinerary__list"
        itemClassName="twe-package-itinerary__item"
        renderItem={item => (
          <div className="twe-package-itinerary__entry">
            <span className="twe-package-itinerary__day">Day {item.day}</span>
            <div className="twe-package-itinerary__copy">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        )}
        style={{
          "--al-ink": "var(--brand-navy)",
          "--al-muted": "#5d6372",
          "--al-tile": "transparent",
          "--al-tile-edge": "transparent",
          "--al-tile-highlight": "transparent",
          "--al-tile-shadow": "none",
          "--al-well": "transparent",
          "--al-ring": "var(--brand-navy)",
          "--al-ring-fill": "rgb(1 12 51 / 4%)"
        }}
      />
    </div>
  );
}
