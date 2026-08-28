import emailKit from "../../../../../packages/email-kit/src/index.cjs";
import {
  buildPaymentInstructionLines,
  sanitizePaymentPreference,
} from "./paymentInstructions.js";

const {
  EMAIL_THEMES,
  renderEmailLayout,
  renderKeyValueTable,
  renderList,
  renderMetricGrid,
  renderPanel,
  renderParagraphs,
} = emailKit;

const REEBS_THEME = EMAIL_THEMES.reebs;

const formatAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0.00";
  return (parsed / 100).toFixed(2);
};

const formatWindow = (value) => {
  const map = {
    "9am-11am": "9:00am-11:00am",
    "11am-1pm": "11:00am-1:00pm",
    "1pm-3pm": "1:00pm-3:00pm",
    "3pm-5pm": "3:00pm-5:00pm",
    "5pm-7pm": "5:00pm-7:00pm",
  };
  if (!value) return "";
  return map[value] || value;
};

const buildOrderItemLines = (items = []) =>
  items
    .map((item) => {
      const name = item?.productName || (item?.productId ? `Item ${item.productId}` : "Item");
      const quantity = Number.isFinite(Number(item?.quantity)) ? ` x${item.quantity}` : "";
      const price = Number.isFinite(Number(item?.unitPriceCents))
        ? ` @ GHS ${formatAmount(item.unitPriceCents)}`
        : "";
      return `${name}${quantity}${price}`;
    })
    .filter(Boolean);

const buildOrderLogisticsLines = ({
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  customerPhone,
}) => {
  const isPickup = String(deliveryMethod || "").toLowerCase().includes("pickup");
  const details = isPickup ? pickupDetails : deliveryDetails;
  const lines = [`Fulfillment: ${isPickup ? "Pickup" : "Delivery"}`];

  if (details?.date) {
    lines.push(`${isPickup ? "Pickup" : "Delivery"} date: ${details.date}`);
  }
  if (details?.window) {
    lines.push(`${isPickup ? "Pickup" : "Delivery"} window: ${formatWindow(details.window)}`);
  }
  if (!isPickup && details?.address) {
    lines.push(`Address: ${details.address}`);
  }
  if (!isPickup && (details?.contact || customerPhone)) {
    lines.push(`Contact: ${details?.contact || customerPhone}`);
  }
  if (details?.notes) {
    lines.push(`Notes: ${details.notes}`);
  }

  return lines;
};

const buildOrderDetailRows = ({
  customerName,
  customerEmail,
  customerPhone,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
}) => {
  const isPickup = String(deliveryMethod || "").toLowerCase().includes("pickup");
  const details = isPickup ? pickupDetails : deliveryDetails;
  return [
    ["Customer", customerName || "Unknown"],
    ["Email", customerEmail || "Not provided"],
    ["Phone", customerPhone || "Not provided"],
    ["Fulfillment", isPickup ? "Pickup" : "Delivery"],
    ...(details?.date ? [[`${isPickup ? "Pickup" : "Delivery"} date`, details.date]] : []),
    ...(details?.window ? [[`${isPickup ? "Pickup" : "Delivery"} window`, formatWindow(details.window)]] : []),
    ...(!isPickup && details?.address ? [["Address", details.address]] : []),
    ...(!isPickup && (details?.contact || customerPhone) ? [["Contact", details?.contact || customerPhone]] : []),
    ...(details?.notes ? [["Notes", details.notes]] : []),
  ];
};

const buildBookingItemLines = (items = []) =>
  items
    .map((item) => {
      const name = item?.productName || (item?.productId ? `Item ${item.productId}` : "Item");
      const quantity = Number.isFinite(Number(item?.quantity)) ? ` x${item.quantity}` : "";
      const price = Number.isFinite(Number(item?.price))
        ? ` @ GHS ${formatAmount(item.price)}`
        : "";
      return `${name}${quantity}${price}`;
    })
    .filter(Boolean);

const buildBookingDetailRows = (booking) => {
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  return [
    ["Customer", booking?.customerName || "Unknown"],
    ["Email", booking?.customerEmail || "Not provided"],
    ["Phone", booking?.customerPhone || "Not provided"],
    ["Event date", `${booking?.eventDate || "Date TBD"}${start}${end}`],
    ...(booking?.venueAddress ? [["Venue", booking.venueAddress]] : []),
  ];
};

const renderListPanel = (title, items) =>
  renderPanel({
    theme: REEBS_THEME,
    title,
    bodyHtml: renderList(items.length ? items : ["No items listed"], { theme: REEBS_THEME }),
  });

const renderPaymentPanel = ({ paymentPreference, reference, internal = false }) =>
  renderPanel({
    theme: REEBS_THEME,
    eyebrow: "Payment",
    title: internal ? "Payment handling" : "Payment instructions",
    bodyHtml: renderList(
      buildPaymentInstructionLines({
        paymentPreference,
        reference,
        internal,
      }),
      { theme: REEBS_THEME }
    ),
  });

const buildBookingPaymentInstructionLines = (booking, reference = "", internal = false) =>
  buildPaymentInstructionLines({
    paymentPreference:
      booking?.paymentPreference || { method: "pay-later", payLater: true },
    reference,
    internal,
  });

const renderBookingPaymentPanel = ({ booking, reference = "", internal = false }) =>
  renderPanel({
    theme: REEBS_THEME,
    eyebrow: "Payment",
    title: internal ? "Payment handling" : "Payment instructions",
    bodyHtml: renderList(buildBookingPaymentInstructionLines(booking, reference, internal), {
      theme: REEBS_THEME,
    }),
  });

export const buildInternalOrderEmailText = ({
  orderNumber,
  customerName,
  customerEmail,
  customerPhone,
  totalAmountCents,
  items,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  paymentPreference,
}) => {
  const itemLines = buildOrderItemLines(items);
  return [
    `New order ${orderNumber}`,
    "",
    `Customer: ${customerName || "Unknown"}`,
    `Email: ${customerEmail || "Not provided"}`,
    `Phone: ${customerPhone || "Not provided"}`,
    `Total: GHS ${formatAmount(totalAmountCents)}`,
    `Items: ${items.length}`,
    ...buildOrderLogisticsLines({
      deliveryMethod,
      deliveryDetails,
      pickupDetails,
      customerPhone,
    }),
    "",
    "Payment:",
    ...buildPaymentInstructionLines({
      paymentPreference,
      reference: orderNumber,
      internal: true,
    }),
    "",
    "Order items:",
    ...(itemLines.length ? itemLines.map((line) => `- ${line}`) : ["- No order items listed"]),
  ].join("\n");
};

export const buildInternalOrderEmailHtml = ({
  orderNumber,
  customerName,
  customerEmail,
  customerPhone,
  totalAmountCents,
  items,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  paymentPreference,
}) =>
  renderEmailLayout({
    theme: REEBS_THEME,
    preheader: `New order ${orderNumber} from ${customerName || "a customer"}.`,
    brandName: "REEBS Party Themes",
    brandTagline: "Order operations",
    eyebrow: "New order",
    title: `Order ${orderNumber}`,
    subtitle: "A new customer order was created in the portal.",
    introHtml: renderParagraphs(
      `A new order has been submitted for review and fulfillment.`,
      { theme: REEBS_THEME }
    ),
    bodyHtml: [
      renderMetricGrid(
        [
          { label: "Total", value: `GHS ${formatAmount(totalAmountCents)}` },
          { label: "Items", value: String(items.length || 0) },
          { label: "Fulfillment", value: String(deliveryMethod || "Pickup").toLowerCase().includes("pickup") ? "Pickup" : "Delivery" },
        ],
        { theme: REEBS_THEME }
      ),
      renderPanel({
        theme: REEBS_THEME,
        eyebrow: "Customer details",
        title: customerName || "Unknown customer",
        bodyHtml: renderKeyValueTable(
          buildOrderDetailRows({
            customerName,
            customerEmail,
            customerPhone,
            deliveryMethod,
            deliveryDetails,
            pickupDetails,
          }),
          { theme: REEBS_THEME, labelWidth: "34%" }
        ),
      }),
      renderPaymentPanel({ paymentPreference, reference: orderNumber, internal: true }),
      renderListPanel("Order items", buildOrderItemLines(items)),
    ].join(""),
    footerHtml: `<p style="margin:0;color:${REEBS_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">Sent from the REEBS order system.</p>`,
  });

export const buildCustomerOrderEmailText = ({
  orderNumber,
  customerName,
  totalAmountCents,
  items,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  customerPhone,
  paymentPreference,
  supportEmail,
}) => {
  const itemLines = buildOrderItemLines(items);
  const safePaymentPreference = sanitizePaymentPreference(paymentPreference);
  return [
    `Hi ${customerName || "there"},`,
    "",
    "Thanks for placing your order with REEBS Party Themes.",
    `Order number: ${orderNumber}`,
    `Total: GHS ${formatAmount(totalAmountCents)}`,
    ...buildOrderLogisticsLines({
      deliveryMethod,
      deliveryDetails,
      pickupDetails,
      customerPhone,
    }),
    "",
    "Items:",
    ...(itemLines.length ? itemLines.map((line) => `- ${line}`) : ["- No order items listed"]),
    "",
    "Payment:",
    ...buildPaymentInstructionLines({
      paymentPreference: safePaymentPreference,
      reference: orderNumber,
    }),
    "",
    "Next steps:",
    safePaymentPreference.method === "card"
      ? "We review each order manually before collecting payment."
      : "Review your order details above and use the payment route you selected.",
    safePaymentPreference.method === "card"
      ? "You will receive your invoice and payment instructions after review."
      : "We will confirm your order and fulfillment timing once payment is reviewed.",
    "",
    `If you need to make changes, reply to this email or contact ${supportEmail}.`,
    "",
    "REEBS Party Themes",
  ].join("\n");
};

export const buildCustomerOrderEmailHtml = ({
  orderNumber,
  customerName,
  totalAmountCents,
  items,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  customerPhone,
  paymentPreference,
  supportEmail,
}) => {
  const safePaymentPreference = sanitizePaymentPreference(paymentPreference);
  const nextStepLines = [
    safePaymentPreference.method === "card"
      ? "We review each order manually before collecting payment."
      : "Review your order details above and use the payment route you selected.",
    safePaymentPreference.method === "card"
      ? "You will receive your invoice and payment instructions after review."
      : "We will confirm your order and fulfillment timing once payment is reviewed.",
    `If you need to make changes, reply to this email or contact ${supportEmail}.`,
  ];

  return renderEmailLayout({
    theme: REEBS_THEME,
    preheader: `We received your REEBS order ${orderNumber}.`,
    brandName: "REEBS Party Themes",
    brandTagline: "Celebration styling and event support",
    eyebrow: "Order confirmation",
    title: `We received your order ${orderNumber}`,
    subtitle: "Thank you for choosing REEBS Party Themes.",
    introHtml: renderParagraphs(
      `Hello ${customerName || "there"},\n\nThanks for placing your order with REEBS Party Themes. Here is a confirmation of what we received.`,
      { theme: REEBS_THEME }
    ),
    bodyHtml: [
      renderMetricGrid(
        [
          { label: "Total", value: `GHS ${formatAmount(totalAmountCents)}` },
          { label: "Items", value: String(items.length || 0) },
          { label: "Fulfillment", value: String(deliveryMethod || "Pickup").toLowerCase().includes("pickup") ? "Pickup" : "Delivery" },
        ],
        { theme: REEBS_THEME }
      ),
      renderPanel({
        theme: REEBS_THEME,
        eyebrow: "Order details",
        title: `Order ${orderNumber}`,
        bodyHtml: renderKeyValueTable(
          buildOrderDetailRows({
            customerName,
            customerEmail: "",
            customerPhone,
            deliveryMethod,
            deliveryDetails,
            pickupDetails,
          }).filter(([label]) => label !== "Email"),
          { theme: REEBS_THEME, labelWidth: "34%" }
        ),
      }),
      renderListPanel("Items", buildOrderItemLines(items)),
      renderPaymentPanel({ paymentPreference: safePaymentPreference, reference: orderNumber }),
      renderPanel({
        theme: REEBS_THEME,
        eyebrow: "Next steps",
        title: "What happens next",
        bodyHtml: renderList(nextStepLines, { theme: REEBS_THEME }),
      }),
    ].join(""),
    footerHtml: `<p style="margin:0;color:${REEBS_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">Reply to this email if you need to update your order.</p>`,
  });
};

export const buildInternalBookingEmailText = (booking) => {
  const itemLines = buildBookingItemLines(booking?.items || []);
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  const bookingReference = booking?.id ? `#${booking.id}` : "";

  const lines = [
    `New booking #${booking?.id || ""}`.trim(),
    "",
    `Customer: ${booking?.customerName || "Unknown"}`,
    `Email: ${booking?.customerEmail || "Not provided"}`,
    `Phone: ${booking?.customerPhone || "Not provided"}`,
    `Total: GHS ${formatAmount(booking?.totalAmount || 0)}`,
    `Event date: ${booking?.eventDate || "Date TBD"}${start}${end}`,
  ];

  if (booking?.venueAddress) {
    lines.push(`Venue: ${booking.venueAddress}`);
  }

  lines.push("", "Payment:");
  lines.push(...buildBookingPaymentInstructionLines(booking, bookingReference, true));

  lines.push("", "Booked items:");
  lines.push(...(itemLines.length ? itemLines.map((line) => `- ${line}`) : ["- No booking items listed"]));

  return lines.join("\n");
};

export const buildInternalBookingEmailHtml = (booking) =>
  renderEmailLayout({
    theme: REEBS_THEME,
    preheader: `New booking #${booking?.id || ""} from ${booking?.customerName || "a customer"}.`,
    brandName: "REEBS Party Themes",
    brandTagline: "Booking operations",
    eyebrow: "New booking",
    title: `Booking #${booking?.id || ""}`.trim(),
    subtitle: "A new event booking was created in the portal.",
    introHtml: renderParagraphs("A new booking has been captured and is ready for follow-up.", { theme: REEBS_THEME }),
    bodyHtml: [
      renderMetricGrid(
        [
          { label: "Total", value: `GHS ${formatAmount(booking?.totalAmount || 0)}` },
          { label: "Items", value: String(Array.isArray(booking?.items) ? booking.items.length : 0) },
          { label: "Event date", value: booking?.eventDate || "Date TBD" },
        ],
        { theme: REEBS_THEME }
      ),
      renderPanel({
        theme: REEBS_THEME,
        eyebrow: "Customer details",
        title: booking?.customerName || "Unknown customer",
        bodyHtml: renderKeyValueTable(buildBookingDetailRows(booking), { theme: REEBS_THEME, labelWidth: "34%" }),
      }),
      renderBookingPaymentPanel({
        booking,
        reference: booking?.id ? `#${booking.id}` : "",
        internal: true,
      }),
      renderListPanel("Booked items", buildBookingItemLines(booking?.items || [])),
    ].join(""),
    footerHtml: `<p style="margin:0;color:${REEBS_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">Sent from the REEBS booking system.</p>`,
  });

export const buildCustomerBookingEmailText = (booking, { supportEmail }) => {
  const itemLines = buildBookingItemLines(booking?.items || []);
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  const bookingReference = booking?.id ? `#${booking.id}` : "";

  const lines = [
    `Hi ${booking?.customerName || "there"},`,
    "",
    "Thanks for booking with REEBS Party Themes.",
    `Booking reference: #${booking?.id || ""}`.trim(),
    `Total: GHS ${formatAmount(booking?.totalAmount || 0)}`,
    `Event date: ${booking?.eventDate || "Date TBD"}${start}${end}`,
  ];

  if (booking?.venueAddress) {
    lines.push(`Venue address: ${booking.venueAddress}`);
  }

  lines.push("", "Payment:");
  lines.push(...buildBookingPaymentInstructionLines(booking, bookingReference));

  lines.push("", "Your booked items:");
  lines.push(...(itemLines.length ? itemLines.map((line) => `- ${line}`) : ["- No booking items listed"]));
  lines.push(
    "",
    "Next steps:",
    "Review your booking details above and arrange the required deposit using the payment instructions provided.",
    "We will confirm your booking and event timing once payment is reviewed.",
    "",
    `If you need to make changes, reply to this email or contact ${supportEmail}.`,
    "",
    "REEBS Party Themes"
  );

  return lines.join("\n");
};

export const buildCustomerBookingEmailHtml = (booking, { supportEmail }) => {
  const nextStepLines = [
    "Review your booking details above and arrange the required deposit using the payment instructions provided.",
    "We will confirm your booking and event timing once payment is reviewed.",
    `If you need to make changes, reply to this email or contact ${supportEmail}.`,
  ];

  return renderEmailLayout({
    theme: REEBS_THEME,
    preheader: `We received your REEBS booking #${booking?.id || ""}.`,
    brandName: "REEBS Party Themes",
    brandTagline: "Celebration styling and event support",
    eyebrow: "Booking confirmation",
    title: `We received your booking #${booking?.id || ""}`.trim(),
    subtitle: "Thanks for booking with REEBS Party Themes.",
    introHtml: renderParagraphs(
      `Hello ${booking?.customerName || "there"},\n\nThanks for booking with REEBS Party Themes. Your booking details are below.`,
      { theme: REEBS_THEME }
    ),
    bodyHtml: [
      renderMetricGrid(
        [
          { label: "Total", value: `GHS ${formatAmount(booking?.totalAmount || 0)}` },
          { label: "Items", value: String(Array.isArray(booking?.items) ? booking.items.length : 0) },
          { label: "Event date", value: booking?.eventDate || "Date TBD" },
        ],
        { theme: REEBS_THEME }
      ),
      renderPanel({
        theme: REEBS_THEME,
        eyebrow: "Booking details",
        title: booking?.customerName || "Your event",
        bodyHtml: renderKeyValueTable(buildBookingDetailRows(booking), { theme: REEBS_THEME, labelWidth: "34%" }),
      }),
      renderListPanel("Your booked items", buildBookingItemLines(booking?.items || [])),
      renderBookingPaymentPanel({
        booking,
        reference: booking?.id ? `#${booking.id}` : "",
      }),
      renderPanel({
        theme: REEBS_THEME,
        eyebrow: "Next steps",
        title: "What happens next",
        bodyHtml: renderList(nextStepLines, { theme: REEBS_THEME }),
      }),
    ].join(""),
    footerHtml: `<p style="margin:0;color:${REEBS_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">Reply to this email if you need to adjust your booking.</p>`,
  });
};
