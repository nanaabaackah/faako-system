import { PROCESS_STEPS } from "/src/components/home/homeContent";

function HomeProcessSection() {
  return (
    <section id="how-it-works" className="home-flow home-flow--process">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Simple Steps, Zero Stress</h2>
          <p className="section-description">From first chat to final pickup, we keep it clear and easy.</p>
        </div>

        <ol className="process-line">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title} className="process-step">
              <span className="process-index">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default HomeProcessSection;
