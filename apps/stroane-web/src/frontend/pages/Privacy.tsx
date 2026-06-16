import React from "react";
import { Link } from "react-router-dom";
import LegalLayout, { type LegalSection } from "../../components/LegalLayout";
import useSEOMeta from "../../hooks/useSEOMeta";

const SECTIONS: LegalSection[] = [
  {
    heading: "Information We Collect",
    body: (
      <>
        <p>We collect information you give us directly, including:</p>
        <ul>
          <li>Name, business name, email address, and phone number.</li>
          <li>Details of your operation that you share for advisory work.</li>
          <li>Order, pricing, and delivery information from the Stroane store.</li>
          <li>Content of messages you send us by email, WhatsApp, or web form.</li>
        </ul>
        <p>
          We also collect limited technical information automatically &mdash;
          such as device type, browser, approximate location, and pages viewed
          &mdash; to keep the site secure and improve it.
        </p>
      </>
    ),
  },
  {
    heading: "How We Use Information",
    body: (
      <>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Respond to enquiries and deliver agreed services.</li>
          <li>Prepare pricing, invoices, and audit or training reports.</li>
          <li>Comply with legal, tax, and regulatory obligations.</li>
          <li>Improve the website, our materials, and our advisory work.</li>
          <li>Send service announcements where relevant to active clients.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Legal Bases",
    body: (
      <p>
        We process personal data on the basis of your consent, on the basis of
        a contract with you, to comply with legal obligations, and on the basis
        of legitimate interest in running and improving our advisory practice.
      </p>
    ),
  },
  {
    heading: "Sharing Information",
    body: (
      <>
        <p>
          We do not sell personal data. We may share limited information with:
        </p>
        <ul>
          <li>Service providers (e.g. hosting, email) under contract.</li>
          <li>Regulators or auditors where required by law.</li>
          <li>Specific recipients you direct us to share with (e.g. for joint audits).</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Data Retention",
    body: (
      <p>
        We keep client records for as long as necessary to meet contractual,
        tax, and regulatory obligations, then delete or anonymise them on a
        schedule. You may request deletion of your personal data at any time,
        subject to record-keeping requirements that apply to professional
        services.
      </p>
    ),
  },
  {
    heading: "Security",
    body: (
      <p>
        We apply reasonable administrative and technical safeguards to protect
        the personal data we hold, including access controls, encrypted email
        for sensitive material, and least-privilege access to our systems. No
        method of transmission is 100% secure, so please use discretion when
        sharing sensitive information online.
      </p>
    ),
  },
  {
    heading: "Your Rights",
    body: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Ask us to correct inaccurate information.</li>
          <li>Ask us to delete personal data where appropriate.</li>
          <li>Withdraw consent for processing based on consent.</li>
          <li>Object to processing in defined circumstances.</li>
        </ul>
        <p>
          Send requests to{" "}
          <a href="mailto:info@stroanesolutions.com">info@stroanesolutions.com</a>.
        </p>
      </>
    ),
  },
  {
    heading: "Cookies",
    body: (
      <p>
        We use a small number of cookies to keep the site working and to
        understand usage. See our <Link to="/cookies">Cookie Policy</Link> for
        the full list and how to manage them.
      </p>
    ),
  },
  {
    heading: "Changes to This Policy",
    body: (
      <p>
        We update this policy when our practices change or when regulation
        evolves. Material changes will be flagged at the top of this page with
        a new &ldquo;last updated&rdquo; date.
      </p>
    ),
  },
];

const Privacy: React.FC = () => {
  useSEOMeta({
    title: "Privacy Policy | Stroane",
    description:
      "How Stroane collects, uses, and protects personal data from website visitors, clients, and store customers.",
    canonical: "https://stroanesolutions.com/privacy",
  });

  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="14 May 2026"
      intro={
        <p>
          This policy explains what information Stroane collects, how we use
          it, and the choices you have. If you have questions, please{" "}
          <Link to="/contact">contact us</Link>.
        </p>
      }
      sections={SECTIONS}
    />
  );
};

export default Privacy;
