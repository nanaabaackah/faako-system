import React from "react";
import "./RefundPolicy.css";
import LegalDocumentPage from "../../components/LegalDocumentPage/LegalDocumentPage";

const LAST_UPDATED = "February 28, 2026";

const sections = [
  {
    id: "goods",
    label: "1.",
    title: "Online cancellation rights for standard goods",
    summary:
      "For eligible stock goods bought online, Ghana's Electronic Transactions Act, 2008 (Act 772) may give you cancellation rights after delivery.",
    items: [
      "Where the law applies, you may request cancellation within 14 days after delivery of a standard, non-customised item.",
      "Returned goods must be unused, unopened where applicable, and in resalable condition with original packaging.",
      "Return transport is normally your responsibility unless the item is faulty, incorrect, or materially different from what was ordered.",
    ],
  },
  {
    id: "services",
    label: "2.",
    title: "Services, rentals, and event-date bookings",
    summary:
      "Services booked online may have shorter cancellation windows, and date-specific event work is often affected once planning starts.",
    items: [
      "Where the law applies, eligible services may be cancelled within 7 days of contracting if the service has not started.",
      "Date-specific rentals, reserved crew time, setup appointments, and sourced event stock may begin planning immediately, so once preparation starts we may offer a reschedule or credit instead of a cash refund.",
      "If you ask us to start urgently before any cooling-off period ends, the refundable amount may be reduced to reflect work already completed.",
    ],
  },
  {
    id: "exclusions",
    label: "3.",
    title: "Items and situations that are not refundable",
    summary:
      "Some products and services cannot reasonably be returned or reversed.",
    items: [
      "Custom, personalised, printed, or specially sourced goods.",
      "Perishable goods, food items, or hygiene-sensitive items once opened or delivered.",
      "Balloons, decor materials, or consumables already used for your event.",
      "Loss, breakage, staining, or damage that happens after delivery or setup.",
    ],
  },
  {
    id: "supplier",
    label: "4.",
    title: "Stock issues, failed fulfilment, and supplier cancellations",
    summary:
      "If REEBS cannot fulfil the order, we will communicate quickly and offer a lawful remedy.",
    paragraphs: [
      "If we cannot supply within the agreed timeline, or within 14 days where no fulfilment period was agreed, you may cancel the order and choose a substitute, credit, or refund.",
    ],
    items: [
      "If an item is unavailable after payment, we will notify you and agree the next step before dispatch.",
      "If a delivered item is faulty, damaged on arrival, or incorrect, we may inspect it and then replace it, repair it, or refund it as appropriate.",
      "Where cancellation is accepted because REEBS could not fulfil the order, approved refunds are issued within 7 days after confirmation.",
    ],
  },
  {
    id: "processing",
    label: "5.",
    title: "How refunds are paid",
    summary:
      "Approved refunds are returned using the original payment rail where possible.",
    items: [
      "Bank, card, and mobile money providers may take around 5 to 10 business days to complete the reversal after approval.",
      "Where the law allows and where clearly disclosed, non-recoverable fees already incurred may be deducted from the refund.",
      "Nothing in this policy removes any consumer rights you cannot legally waive.",
    ],
  },
];

function RefundPolicy() {
  return (
    <LegalDocumentPage
      title="Refund Policy"
      lastUpdated={LAST_UPDATED}
      intro="This page explains when REEBS offers refunds, when credits or reschedules may apply instead, and how statutory online cancellation rights work for Ghana-based customers."
      marketNote="This version is written for Ghana-based online sales and references the Electronic Transactions Act, 2008 (Act 772) for supplier disclosures, fulfilment timing, and cooling-off rules."
      sections={sections}
      contactHeading="Need to cancel or request a refund?"
      contactBody="Contact REEBS as soon as possible with your order number, booking date, and reason so that we can confirm the correct remedy."
    />
  );
}

export default RefundPolicy;
