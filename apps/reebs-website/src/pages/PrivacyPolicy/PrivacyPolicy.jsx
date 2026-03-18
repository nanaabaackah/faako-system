import React from "react";
import "./PrivacyPolicy.css";
import LegalDocumentPage from "../../components/LegalDocumentPage/LegalDocumentPage";

const LAST_UPDATED = "February 28, 2026";

const sections = [
  {
    id: "collection",
    label: "1.",
    title: "Personal data we collect",
    summary:
      "We collect only the information needed to respond to enquiries, fulfil bookings, process orders, and support customers.",
    items: [
      "Contact details such as your name, phone number, email address, delivery address, and venue notes.",
      "Order and booking details such as event dates, quantities, styling preferences, rental selections, and communication history.",
      "Technical data such as your browser, device type, IP address, pages viewed, and basic analytics events.",
      "Payment references or proof of payment, but we do not store full bank card numbers, PINs, or mobile money credentials.",
    ],
  },
  {
    id: "use",
    label: "2.",
    title: "How we use your data",
    summary:
      "We use data for operational, support, and compliance purposes.",
    items: [
      "To quote, confirm, deliver, set up, collect, or support your order or booking.",
      "To send service updates, invoices, delivery notices, and customer support replies.",
      "To reduce fraud, verify transactions, keep accounting records, and manage disputes.",
      "To improve the site, product selection, and customer experience through analytics and service reviews.",
      "To send marketing only where you have opted in or where we otherwise have a lawful basis to do so.",
    ],
  },
  {
    id: "ghana-standards",
    label: "3.",
    title: "Ghana data protection standards",
    summary:
      "REEBS handles personal data in line with Ghana's Data Protection Act, 2012 (Act 843).",
    items: [
      "We collect personal data for clear business purposes and only where it is relevant to the service we are providing.",
      "We aim to keep data accurate, secure, and limited to staff or service providers who need it for a valid task.",
      "You can opt out of marketing messages at any time by contacting us or using the unsubscribe method provided.",
      "If data is processed through service providers outside Ghana, we use reasonable contractual and security safeguards.",
    ],
  },
  {
    id: "sharing",
    label: "4.",
    title: "Who we share data with",
    summary:
      "We share data only where it is needed to run the business or comply with the law.",
    items: [
      "Website hosting, form, analytics, and workflow providers that help us operate the site.",
      "Payment, banking, and mobile money partners that confirm transactions.",
      "Drivers, couriers, setup crew, and logistics partners involved in fulfilment.",
      "Professional advisers, insurers, regulators, or law-enforcement authorities where disclosure is required.",
      "We do not sell your personal data.",
    ],
  },
  {
    id: "retention-rights",
    label: "5.",
    title: "Retention and your rights",
    summary:
      "We keep data only for as long as it is reasonably needed for service delivery, legal compliance, accounting, and dispute handling.",
    items: [
      "You may ask for access to the personal data we hold about you.",
      "You may ask us to correct inaccurate details or update incomplete records.",
      "You may ask us to stop direct marketing or withdraw consent where consent is the basis for processing.",
      "You may raise a complaint with REEBS first and, if needed, with the Data Protection Commission of Ghana.",
    ],
  },
];

function PrivacyPolicy() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro="This policy explains what personal data REEBS Party Themes collects, why we collect it, how we use it, and what choices you have."
      marketNote="This version is written for customers in Ghana and aligns with the Data Protection Act, 2012 (Act 843)."
      sections={sections}
      contactHeading="Need a privacy or data request?"
      contactBody="Contact REEBS if you want access to your data, need a correction, or want us to stop marketing messages."
    />
  );
}

export default PrivacyPolicy;
