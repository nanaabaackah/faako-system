import {
  buildPaymentInstructionLines,
  sanitizePaymentPreference,
} from "./paymentInstructions.js";

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
      return `- ${name}${quantity}${price}`;
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

const buildBookingItemLines = (items = []) =>
  items
    .map((item) => {
      const name = item?.productName || (item?.productId ? `Item ${item.productId}` : "Item");
      const quantity = Number.isFinite(Number(item?.quantity)) ? ` x${item.quantity}` : "";
      const price = Number.isFinite(Number(item?.price))
        ? ` @ GHS ${formatAmount(item.price)}`
        : "";
      return `- ${name}${quantity}${price}`;
    })
    .filter(Boolean);

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
    ...(itemLines.length ? itemLines : ["- No order items listed"]),
  ].join("\n");
};

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
    ...(itemLines.length ? itemLines : ["- No order items listed"]),
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
  lines.push(
    ...buildPaymentInstructionLines({
      paymentPreference: booking?.paymentPreference,
      reference: bookingReference,
      internal: true,
    })
  );

  lines.push("", "Booked items:");
  lines.push(...(itemLines.length ? itemLines : ["- No booking items listed"]));

  return lines.join("\n");
};

export const buildCustomerBookingEmailText = (booking, { supportEmail }) => {
  const itemLines = buildBookingItemLines(booking?.items || []);
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  const safePaymentPreference = sanitizePaymentPreference(booking?.paymentPreference);
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
  lines.push(
    ...buildPaymentInstructionLines({
      paymentPreference: safePaymentPreference,
      reference: bookingReference,
    })
  );

  lines.push("", "Your booked items:");
  lines.push(...(itemLines.length ? itemLines : ["- No booking items listed"]));
  lines.push(
    "",
    "Next steps:",
    safePaymentPreference.method === "card"
      ? "We review each booking manually before collecting payment."
      : "Review your booking details above and use the payment route you selected.",
    safePaymentPreference.method === "card"
      ? "You will receive your invoice and payment instructions after review."
      : "We will confirm your booking and event timing once payment is reviewed.",
    "",
    `If you need to make changes, reply to this email or contact ${supportEmail}.`,
    "",
    "REEBS Party Themes"
  );

  return lines.join("\n");
};
