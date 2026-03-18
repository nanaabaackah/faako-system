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
          preload="auto"
          disablePictureInPicture
        >
          <source src="/imgs/moving/background18.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="hero-overlay" aria-hidden="true" />

      <div className="hero-content">
        <h1 className="hero-title">{templateSettings.heroHeading}</h1>

        <p className="hero-subtitle">{templateSettings.heroTagline}</p>

        <form className="hero-lead-form" onSubmit={onHeroLeadSubmit}>
          <input
            type="email"
            value={heroEmail}
            onChange={(event) => onHeroEmailChange(event.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            required
          />
          <button type="submit" className="hero-lead-submit">
            <span>Sign up to our Newsletter</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="hero-proof-row" aria-label="Services and Products we have">
          {HERO_PROOF_ITEMS.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="why-stats-shell" role="region" aria-label="REEBS highlights">
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
