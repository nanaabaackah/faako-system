import { REEBS_PUBLIC_COMMERCE } from "@faako/config";
import { Link } from "react-router-dom";

// Use the existing page shell, hero and buttons; this is a paused state, not a
// replacement storefront design. Render it on the server as well as the client.
export default function PublicCommercePaused({ booking = false }) {
  const prefix = booking ? "booking" : "checkout";
  return (
    <div className={`${prefix}-page${booking ? " rentals-theme" : ""}`} id="main">
      <main className={`${prefix}-shell page-shell`}>
        <section className={`${prefix}-hero glass-card page-hero`} aria-labelledby="commerce-paused-heading">
          <div className="page-hero-copy">
            <h1 id="commerce-paused-heading" className="page-hero-title">
              {booking ? "Online rental bookings are paused" : "Online checkout is paused"}
            </h1>
            <p role="status">{REEBS_PUBLIC_COMMERCE.disabledMessage}</p>
            <div className="booking-cta-row">
              <Link className="hero-btn hero-btn-primary" to={booking ? "/rentals" : "/shop"}>
                {booking ? "Browse rentals" : "Browse shop"}
              </Link>
              <Link className="hero-btn hero-btn-ghost" to="/contact">Contact REEBS</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
