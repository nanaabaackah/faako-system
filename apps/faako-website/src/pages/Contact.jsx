import { Link } from "react-router-dom";
import "../styles/pages/Contact.css";

export default function Contact() {
  return (
    <section className="page contact contact-redesign ">
      <section className="contact-hero-surface reveal" style={{ "--delay": "0ms" }}>
        <div className="contact-hero-copy">
          <p className="eyebrow">Contact Us</p>
          <h1>Let&apos;s build the right system for your team.</h1>
          <p className="lead">
            Email, call, or send the form to discuss the setup your business needs.
          </p>

          <div className="contact-direct-lines">
            <a className="contact-direct-link" href="mailto:hello@faako.nanaabaackah.com">
              hello@faako.nanaabaackah.com
            </a>
            <a className="contact-direct-link" href="tel:+233555000111">
              +233 (0) 55 500 0111
            </a>
            <span>Customer Support · Monday-Friday, 9:00am-6:00pm GMT</span>
          </div>

          <div className="contact-topic-grid">
            <article className="contact-topic-card">
              <h4>Customer Support</h4>
              <p>
                We help your team solve day-to-day issues quickly and clearly.
              </p>
            </article>
            <article className="contact-topic-card">
              <h4>Project Planning</h4>
              <p>
                We review your priorities and budget, then share a practical plan.
              </p>
            </article>
            <article className="contact-topic-card">
              <h4>Partnerships</h4>
              <p>
                For partnership or media requests, contact our team directly.
              </p>
            </article>
          </div>
        </div>

        <form
          className="contact-form-card form card reveal"
          style={{ "--delay": "120ms" }}
          action="mailto:hello@faako.nanaabaackah.com"
          method="post"
          encType="text/plain"
        >
          <div className="contact-form-head">
            <h3>Get in touch</h3>
            <p className="muted">You can reach us any time.</p>
          </div>

          <div className="contact-form-row">
            <label>
              First name
              <input type="text" name="firstName" placeholder="Ama" required />
            </label>
            <label>
              Last name
              <input type="text" name="lastName" placeholder="Mensah" required />
            </label>
          </div>

          <label>
            Your email
            <input
              type="email"
              name="email"
              placeholder="you@company.com"
              required
            />
          </label>

          <div className="contact-phone-row">
            <label>
              Code
              <select name="countryCode" defaultValue="+233">
                <option value="+233">+233</option>
                <option value="+44">+44</option>
                <option value="+1">+1</option>
              </select>
            </label>
            <label>
              Phone number
              <input
                type="tel"
                name="phone"
                placeholder="55 500 0111"
                required
              />
            </label>
          </div>

          <label>
            How can we help?
            <textarea
              name="message"
              rows={5}
              maxLength={350}
              placeholder="Tell us what you need help with and when you want to start."
              required
            />
          </label>

          <button className="button button-primary" type="submit">
            Submit request
          </button>
          <p className="contact-form-legal">
            By contacting us, you agree to our <Link to="/terms">Terms</Link>{" "}
            and <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </form>
      </section>

      <section className="contact-location-block reveal" style={{ "--delay": "180ms" }}>

        <div className="contact-location-copy">
          <p className="eyebrow">Our Location</p>
          <h2>Connecting near and far.</h2>
          <p className="lead">
            We support teams in Ghana and beyond through remote help, workshops,
            and on-site visits when needed.
          </p>
          <ul className="contact-location-list">
            <li>Accra team for planning and advisory</li>
            <li>Remote support for distributed teams</li>
            <li>On-site support available for larger rollouts</li>
          </ul>
          <div className="contact-actions">
            <a className="button button-primary" href="mailto:hello@faako.nanaabaackah.com">
              Email the team
            </a>
            <Link className="button button-ghost" to="/case-studies">
              View sample scenarios
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}
