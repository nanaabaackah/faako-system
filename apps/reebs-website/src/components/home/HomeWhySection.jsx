import { AppIcon } from "/src/components/Icon/Icon";
import { WHY_REEBS_ITEMS } from "/src/components/home/homeContent";

function HomeWhySection() {
  return (
    <section className="home-flow home-flow--why">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Why REEBS</h2>
          <p className="section-description">
            One team for rentals, styling, and support, so your day feels fun instead of stressful.
          </p>
        </div>

        <ul className="why-list" role="list">
          {WHY_REEBS_ITEMS.map((item) => (
            <li className="why-item" key={item.title}>
              <span className="why-icon"><AppIcon icon={item.icon} /></span>
              <div className="why-copy">
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default HomeWhySection;
