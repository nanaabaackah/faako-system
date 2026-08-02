import React from "react";
import "./DeliveryPolicy.css";
import LegalDocumentPage from "../../components/LegalDocumentPage/LegalDocumentPage";

const LAST_UPDATED = "February 28, 2026";

const sections = [
  {
    id: "coverage",
    label: "1.",
    title: "Coverage and delivery windows",
    summary:
      "REEBS primarily delivers and services orders within Greater Accra and nearby areas, with extended coverage available by quote.",
    items: [
      "Your quotation or confirmation will state the expected delivery, setup, or pickup window.",
      "For shop orders, dispatch starts after payment is confirmed and stock is allocated.",
      "For rentals and event work, delivery and setup windows are scheduled around your venue, route plan, and crew availability.",
    ],
  },
  {
    id: "timing",
    label: "2.",
    title: "Order timing and stock availability",
    summary:
      "Ghana's Electronic Transactions Act, 2008 (Act 772) expects suppliers to fulfil within the agreed period, or within 14 days if no period was stated.",
    items: [
      "Where no specific lead time is agreed, we aim to dispatch or fulfil within 14 days after order acceptance.",
      "If stock or scheduling changes affect your order, we will notify you promptly and offer an updated date, substitute, credit, or cancellation option.",
      "Custom work and event-date services may require longer lead times, which will be stated in your quote or booking confirmation.",
    ],
  },
  {
    id: "access",
    label: "3.",
    title: "Access, handover, and setup conditions",
    summary:
      "Please make the site ready before the delivery team arrives.",
    items: [
      "A responsible adult must be present to receive goods, guide placement, and sign off on rentals or setup work.",
      "You must provide safe access, usable power where needed, and accurate directions, parking, or venue access instructions.",
      "If entry is delayed by security checks, locked venues, or missing site contacts, waiting or repeat-visit fees may apply.",
      "Visible issues should be reported immediately at handover so that we can address them on the spot where possible.",
    ],
  },
  {
    id: "risk",
    label: "4.",
    title: "Risk, failed delivery, and re-delivery",
    summary:
      "Responsibility shifts once goods are handed over or rentals are set up.",
    items: [
      "Risk for rented items passes to you at delivery and remains with you until collection.",
      "If nobody is available to receive the order, or the address is incorrect, we may return the goods to our base and arrange a new delivery at your cost.",
      "If delivery fails because the site is unsafe or inaccessible, we may reschedule, relocate, or cancel the affected part of the order.",
    ],
  },
  {
    id: "delays",
    label: "5.",
    title: "Delays, force majeure, and communication",
    summary:
      "Road conditions in Ghana can change quickly, so some delays are outside our direct control.",
    items: [
      "Traffic, flooding, severe weather, fuel shortages, road closures, curfews, strikes, or public restrictions may delay fulfilment.",
      "If a major delay happens, we will contact you using the details on your order and confirm the next available solution.",
      "If fulfilment becomes impossible, the affected item or service will be handled under the refund policy or any other remedy required by law.",
    ],
  },
];

function DeliveryPolicy() {
  return (
    <LegalDocumentPage
      title="Delivery Policy"
      lastUpdated={LAST_UPDATED}
      intro="This policy explains how REEBS handles dispatch, delivery, setup, pickup, and failed delivery situations for shop orders, rentals, and event work."
      marketNote="This version is written for Ghana-based fulfilment and references the Electronic Transactions Act, 2008 (Act 772) for supplier delivery timing and cancellation standards."
      sections={sections}
      contactHeading="Need a delivery clarification?"
      contactBody="Contact REEBS before you book if your venue has access restrictions, special timing needs, or out-of-area delivery requirements."
    />
  );
}

export default DeliveryPolicy;
