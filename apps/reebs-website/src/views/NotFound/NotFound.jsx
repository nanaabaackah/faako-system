import { Link } from "react-router-dom";
import { AppIcon } from "../../components/Icon/Icon";
import { faArrowRight } from "../../icons/iconSet";
import "./NotFound.css";

export default function NotFound() {
  return (
    <main className="storefront-not-found" id="main-content">
      <section className="storefront-not-found__card">
        <p className="storefront-not-found__eyebrow">404 · Page not found</p>
        <h1>This page has left the party.</h1>
        <p>
          The link may be outdated, or the page may have moved. Continue with the shop or browse the rental catalogue.
        </p>
        <div className="storefront-not-found__actions">
          <Link to="/shop" className="btn btn-primary">
            Shop products <AppIcon icon={faArrowRight} />
          </Link>
          <Link to="/rentals" className="btn btn-secondary">
            Browse rentals
          </Link>
        </div>
      </section>
    </main>
  );
}
