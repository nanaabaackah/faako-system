import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkerAlt,
  faArrowRight,
  faStore,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import "../styles/pages/NotFound.css";

const quickLinks = [
  { to: "/", label: "Home" },
  { to: "/solutions", label: "Solutions" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
];

export default function NotFound() {
  return (
    <section className="page not-found-page not-found-page--v2">
      <div className="not-found-shell reveal" data-scroll style={{ "--delay": "0ms" }}>
        <span className="not-found-kicker">
          <FontAwesomeIcon icon={faMapMarkerAlt} />
          Page Not Found
        </span>
        <p className="not-found-code">404</p>
        <h1>This route is not available.</h1>
        <p className="lead">
          The link may be outdated, moved, or entered incorrectly. Use the quick routes below.
        </p>

        <div className="not-found-actions">
          <Link className="button button-primary" to="/">
            <FontAwesomeIcon icon={faStore} />
            Go to home
          </Link>
          <Link className="button button-ghost" to="/contact">
            <FontAwesomeIcon icon={faHeadset} />
            Contact support
          </Link>
        </div>

        <div className="not-found-links card reveal" data-scroll style={{ "--delay": "120ms" }}>
          <h2>Popular pages</h2>
          <nav className="not-found-grid">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
