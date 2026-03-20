import { QUICK_ANSWERS } from "/src/components/home/homeContent";

function HomeQuickAnswersSection() {
  return (
    <section className="home-flow home-flow--answers">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Before You Book</h2>
        </div>

        <div className="answers-grid">
          {QUICK_ANSWERS.map((item) => (
            <article key={item.question} className="answer-row">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeQuickAnswersSection;
