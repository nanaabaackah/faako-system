import React from "react";
import "./TermsOfService.css";
import LegalDocumentPage from "../../components/LegalDocumentPage/LegalDocumentPage";

const LAST_UPDATED = "February 28, 2026";

const sections = [
  {
    id: "acceptance",
    label: "1.",
    title: "Online orders and acceptance",
    summary:
      "These terms apply to rentals, shop purchases, styling work, and other services supplied by REEBS in Ghana.",
    paragraphs: [
      "REEBS may contract with you through the website, email, invoices, or direct messaging. Electronic quotations, approvals, invoices, and confirmations are treated as valid records and notices.",
      "A booking or order becomes binding when we confirm availability and receive any required deposit or other agreed payment.",
    ],
    items: [
      "You confirm that you are at least 18 years old, or that you have authority to place the order for your household or organisation.",
      "You must provide accurate names, phone numbers, delivery details, venue access information, and event dates.",
      "Please review quantities, colours, dates, and setup notes before you authorise payment.",
    ],
  },
  {
    id: "pricing",
    label: "2.",
    title: "Pricing, payments, and taxes",
    summary:
      "We aim to make pricing straightforward for Ghana-based bookings and online orders.",
    items: [
      "Quotes are in Ghana cedis unless we clearly state another currency.",
      "Deposits reserve stock, labour, transport capacity, custom materials, or event dates.",
      "Unless we agree otherwise in writing, any outstanding balance must be cleared before dispatch, setup, or collection.",
      "You are responsible for any bank, mobile money, card, tax, levy, or transfer charges that apply to your payment method.",
    ],
  },
  {
    id: "delivery-service",
    label: "3.",
    title: "Delivery, setup, and event timing",
    summary:
      "Event work is time-sensitive, so communication and venue readiness matter.",
    items: [
      "Delivery and setup windows are estimates and may shift because of traffic, venue access, weather, public holidays, or security checks.",
      "A responsible adult must be available to receive goods, inspect rentals, and confirm setup instructions.",
      "If you change the venue, access conditions, or timing after confirmation, pricing and availability may change.",
      "If we cannot fulfil the agreed service window, we will offer a revised time, substitute item, store credit, or refund where appropriate.",
    ],
  },
  {
    id: "rentals",
    label: "4.",
    title: "Rental equipment and customer responsibilities",
    summary:
      "You are responsible for rentals from handover until the items are collected by REEBS.",
    items: [
      "Use rentals only as instructed and keep children supervised at all times around inflatables, games, electrical machines, and moving equipment.",
      "Do not sub-hire, alter, or relocate rented items without our approval.",
      "Protect rentals from rain, theft, fire, sand, sharp objects, pets, and misuse.",
      "Loss, damage, missing parts, or excessive cleaning may be charged at repair or replacement cost.",
    ],
  },
  {
    id: "consumer-rights",
    label: "5.",
    title: "Consumer rights, cancellations, and refunds",
    summary:
      "Ghana's Electronic Transactions Act, 2008 (Act 772) gives consumers specific protections for online contracts, supplier disclosures, and delivery timing.",
    items: [
      "Eligible stock goods may qualify for statutory cancellation rights when they are unused, resalable, and not excluded by law.",
      "Date-specific services, staffed setups, and custom or personalised work may be excluded once sourcing, scheduling, or performance has started.",
      "If an item becomes unavailable after payment, we will contact you promptly to agree on a substitute, credit, or refund.",
      "Our refund and delivery pages explain how REEBS applies these rules to goods, services, and event bookings.",
    ],
  },
  {
    id: "governing-law",
    label: "6.",
    title: "Governing law and disputes",
    summary:
      "These terms are governed by the laws of Ghana.",
    items: [
      "Please contact REEBS first if something goes wrong so that we can try to resolve the issue quickly.",
      "If a dispute cannot be resolved informally, it may be handled through negotiation, mediation, or the courts of Ghana, depending on the issue.",
      "Nothing in these terms removes rights you cannot lawfully waive under applicable Ghanaian law.",
    ],
  },
];

function TermsOfService() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro="These terms set the ground rules for party rentals, party supplies, deliveries, and styling services booked from REEBS Party Themes."
      marketNote="This version is written for Ghana-based transactions and references the Electronic Transactions Act, 2008 (Act 772) for online contracting standards."
      sections={sections}
      contactHeading="Questions before you book?"
      contactBody="If you want help interpreting these terms for a specific booking, delivery, or rental, contact the REEBS team before payment."
    />
  );
}

export default TermsOfService;
