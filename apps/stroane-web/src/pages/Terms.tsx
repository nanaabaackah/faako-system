import React from "react";
import { Link } from "react-router-dom";
import LegalLayout, { type LegalSection } from "../components/LegalLayout";
import useSEOMeta from "../hooks/useSEOMeta";

const SECTIONS: LegalSection[] = [
  {
    heading: "Acceptance of Terms",
    body: (
      <p>
        By accessing or using the Stroane website, services, or products you
        agree to these Terms &amp; Conditions. If you do not agree, please do
        not use the service. Continued use after changes are posted is taken as
        acceptance of the revised terms.
      </p>
    ),
  },
  {
    heading: "Services We Provide",
    body: (
      <>
        <p>
          Stroane offers food safety advisory, audits, training, and supplies to
          food businesses in Ghana. The scope of each engagement is set out in
          a written proposal and accepted by both parties before work begins.
        </p>
        <p>
          Advisory work does not replace official inspection, licensing, or
          regulatory approval from the Ghana Food and Drugs Authority or any
          other regulator.
        </p>
      </>
    ),
  },
  {
    heading: "Pricing & Payments",
    body: (
      <>
        <p>
          Pricing and basket totals shown on the Stroane store are estimates.
          Final invoicing reflects confirmed availability, delivery, taxes, and
          any custom configuration agreed in writing.
        </p>
        <p>
          Payment terms are stated on each invoice. Late payment may delay
          delivery, follow-up audits, or scheduled training.
        </p>
      </>
    ),
  },
  {
    heading: "Use of the Website",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the site in any way that breaches Ghanaian law.</li>
          <li>Attempt to interfere with normal operation of the site.</li>
          <li>Misrepresent your identity when contacting us or placing orders.</li>
          <li>Reproduce site content for commercial use without permission.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Intellectual Property",
    body: (
      <p>
        All site content &mdash; including text, graphics, logos, audit
        templates, and training materials &mdash; is owned by Stroane or its
        licensors and protected by intellectual-property law. You may not copy,
        redistribute, or build commercial derivatives without written consent.
      </p>
    ),
  },
  {
    heading: "Disclaimers",
    body: (
      <p>
        The site and the materials on it are provided on an &ldquo;as is&rdquo;
        basis. Stroane makes reasonable efforts to keep guidance accurate, but
        food safety regulation can change and individual operations vary.
        Always confirm specific decisions with the relevant regulator or with a
        Stroane advisor before acting.
      </p>
    ),
  },
  {
    heading: "Limitation of Liability",
    body: (
      <p>
        To the maximum extent permitted by law, Stroane is not liable for
        indirect or consequential loss arising from use of the site or from
        decisions made on the basis of general advisory content. Direct
        engagement contracts contain their own liability terms.
      </p>
    ),
  },
  {
    heading: "Governing Law",
    body: (
      <p>
        These terms are governed by the laws of the Republic of Ghana.
        Disputes arising in connection with them are subject to the exclusive
        jurisdiction of the courts of Ghana.
      </p>
    ),
  },
  {
    heading: "Changes to These Terms",
    body: (
      <p>
        We may update these terms from time to time. Material changes will be
        flagged at the top of this page with a new &ldquo;last updated&rdquo;
        date. Please review periodically.
      </p>
    ),
  },
];

const Terms: React.FC = () => {
  useSEOMeta({
    title: "Terms & Conditions | Stroane",
    description:
      "Stroane Terms & Conditions for use of the website, advisory services, training, and store.",
    canonical: "https://stroanesolutions.com/terms",
  });

  return (
    <LegalLayout
      title="Terms & Conditions"
      lastUpdated="14 May 2026"
      intro={
        <p>
          These terms cover how you use the Stroane website, our advisory and
          training services, and the Stroane store. For questions, please{" "}
          <Link to="/contact">contact us</Link>.
        </p>
      }
      sections={SECTIONS}
    />
  );
};

export default Terms;
