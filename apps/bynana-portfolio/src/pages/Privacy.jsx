import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import '../styles/pages/Privacy.css';

const sections = [
  {
    title: 'Information collected directly',
    items: [
      'Name, email address, project notes, and message content when you contact me.',
      'Scheduling or enquiry details you choose to send through email, forms, or linked booking tools.',
      'Public professional information you intentionally share for a project conversation.',
    ],
  },
  {
    title: 'Browser storage and cookies',
    items: [
      'Essential storage remembers theme preference, cookie consent choice, and contact-form cooldown timing.',
      'Optional analytics, if accepted, may collect page paths, device/browser type, approximate region, and performance signals.',
      'No analytics cookies are used for page-view tracking unless you accept optional analytics.',
    ],
  },
  {
    title: 'Payments',
    items: [
      'This portfolio does not collect card, mobile money, bank, CVV, or PIN details.',
      'When a linked client payment flow uses Paystack, those payment credentials are entered with Paystack and are not stored on this website.',
      'Project records may include invoice references, payment status, or communication needed for accounting and support.',
    ],
  },
  {
    title: 'How information is used',
    items: [
      'To respond to enquiries, prepare project recommendations, and provide agreed services.',
      'To protect the site from abuse and understand content performance in aggregate.',
      'To keep accounting, support, and legal records where required.',
    ],
  },
];

function Privacy() {
  return (
    <main className="privacy-page" id="main-content">
      <Seo
        title="Privacy & Cookie Policy | By Nana"
        description="How By Nana handles contact details, browser storage, analytics choices, and payment-provider disclosures."
      />
      <section className="privacy-hero">
        <p className="privacy-eyebrow">Privacy & Cookie Policy</p>
        <h1>Small data footprint, clearly explained.</h1>
        <p>
          This page explains what information is collected through this portfolio,
          what browser storage is used, and what is not stored here.
        </p>
        <span>Last updated: June 19, 2026</span>
      </section>

      <section className="privacy-grid" aria-label="Privacy policy sections">
        {sections.map((section) => (
          <article className="privacy-card" key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="privacy-card privacy-card--wide">
        <h2>Choices and requests</h2>
        <p>
          You can reject optional analytics in the cookie popup, clear browser
          storage in your browser settings, or email{' '}
          <a href="mailto:nanaabaackah@gmail.com">nanaabaackah@gmail.com</a> for
          access, correction, or deletion requests where applicable.
        </p>
        <Link to="/contact" className="privacy-link">
          Contact me
        </Link>
      </section>
    </main>
  );
}

export default Privacy;
