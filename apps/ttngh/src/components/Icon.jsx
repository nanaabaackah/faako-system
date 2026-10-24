import {
  Add, ArrowLeft4, ArrowUp, Calendar, CloseCircle,
  HambergerMenu, Heart, Location, MessageQuestion,
  People, SearchNormal1, Sms, TickCircle,
} from "iconsax-react";
import ArrowRight4 from "./ArrowRight4.jsx";

const icons = {
  add: Add, "arrow-left": ArrowLeft4, "arrow-right": ArrowRight4,
  "arrow-up": ArrowUp, calendar: Calendar, close: CloseCircle,
  external: ArrowRight4, menu: HambergerMenu, heart: Heart,
  location: Location, question: MessageQuestion, people: People,
  search: SearchNormal1, email: Sms, check: TickCircle,
};

// Rendered to static SVG by Astro: no client-side React or icon hydration.
// Controls supply their own accessible names; these icons are decorative.
export default function Icon({ name, className = "", ...props }) {
  const Glyph = icons[name];
  if (!Glyph) throw new Error(`Unknown TTNGH icon: ${name}`);
  return <Glyph {...props} className={`ttngh-icon ${className}`.trim()}
    size="1em" color="currentColor" variant="Linear"
    aria-hidden="true" focusable="false" />;
}
