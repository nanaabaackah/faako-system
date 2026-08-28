import {
  HERO_PROOF_ITEMS,
  HERO_STATS,
} from "/src/components/home/homeContent";
import { formatHeroStatValue } from "/src/components/home/homeCatalog";

function HomeHeroSection({
  heroVideoRef,
  templateSettings,
  heroEmail,
  onHeroEmailChange,
  onHeroLeadSubmit,
  heroStats,
  yearsServingBadge,
}) {
  return (
    <section id="hero-section" className="home-hero">
      <div className="hero-video-container" aria-hidden="true">
        <video
          ref={heroVideoRef}
          className="hero-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
        >
          <source src="/imgs/moving/background18.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="hero-overlay" aria-hidden="true" />

      <div className="hero-content reveal">
        <h1 className="hero-title">{templateSettings.heroHeading}</h1>

        <p className="hero-subtitle">{templateSettings.heroTagline}</p>

        <div className="hero-primary-actions" aria-label="Start planning">
          <a href="/rentals" className="hero-primary-action">Browse rentals</a>
          <a href="/shop" className="hero-secondary-action">Shop party supplies</a>
        </div>

        <form className="hero-lead-form reveal" onSubmit={onHeroLeadSubmit}>
          <span className="sr-only" id="home-newsletter-label">Get planning updates by email</span>
          <input
            type="email"
            value={heroEmail}
            onChange={(event) => onHeroEmailChange(event.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            aria-describedby="home-newsletter-label"
            required
          />
          <button type="submit" className="hero-lead-submit">
            <span>Get planning updates</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="hero-proof-row reveal" aria-label="Services and Products we have">
          {HERO_PROOF_ITEMS.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="why-stats-shell reveal" role="region" aria-label="REEBS highlights">
          <div className="why-stats" role="list" aria-label="REEBS highlights">
            {HERO_STATS.map((stat) => (
              <p className="why-stat" role="listitem" key={stat.key}>
                <span className="why-stat-value">
                  {stat.key === "years"
                    ? `${yearsServingBadge}+ years`
                    : formatHeroStatValue(heroStats[stat.key])}
                </span>
                <span className="why-stat-label">{stat.label}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeHeroSection;
