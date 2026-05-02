import { Link } from "react-router-dom";
import { HOME_SERVICES } from "/src/components/home/homeContent";

function HomeServicesSection() {
  return (
    <section className="home-flow home-flow--services">
      <div className="container">
        <div className="section-header reveal">
          <h2 className="section-title">Everything You Need, In One Place</h2>
          <p className="section-description">Rentals, styling, and party supplies without running around town.</p>
        </div>

        <div className="services-rail reveal">
          {HOME_SERVICES.map((service) => (
            <Link to={service.to} className="service-row" key={service.title}>
              <img
                src={service.image}
                alt={service.alt}
                className="service-media"
                loading="lazy"
              />
              <div className="service-copy">
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
                <span className="service-inline-link">{service.linkLabel} →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeServicesSection;
