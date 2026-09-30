import { buildBookingReference } from "./bookingPolicy.js";

const formatAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? (parsed / 100).toFixed(2) : "0.00";
};

export function buildBookingNotification(booking) {
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  const itemsCount = Array.isArray(booking?.items) ? booking.items.length : 0;
  const bodyParts = [
    booking?.customerName || "New customer",
    `GHS ${formatAmount(booking?.totalAmount || 0)}`,
    `${itemsCount} ${itemsCount === 1 ? "item" : "items"}`,
    `${booking?.eventDate || "Date TBD"}${start}${end}`,
  ];

  if (booking?.venueAddress) bodyParts.push(booking.venueAddress);

  return {
    title: `New booking ${booking?.reference || buildBookingReference(booking || {})}`.trim(),
    body: bodyParts.filter(Boolean).join(" · "),
    data: { type: "booking", id: booking?.id },
  };
}

export function buildBookingWhatsAppLines(booking) {
  const start = booking?.startTime ? ` ${booking.startTime}` : "";
  const end = booking?.endTime ? `-${booking.endTime}` : "";
  const items = Array.isArray(booking?.items) ? booking.items : [];
  const itemLines = items
    .map((item) => {
      const name = item?.productName || (item?.productId ? `Item ${item.productId}` : "");
      const quantity = Number.isFinite(Number(item?.quantity)) ? ` x${item.quantity}` : "";
      return name ? `${name}${quantity}` : "";
    })
    .filter(Boolean);
  const lines = [
    `New booking ${booking?.reference || buildBookingReference(booking || {})}`.trim(),
    `Customer: ${booking?.customerName || "Unknown"}`,
    `Total: GHS ${formatAmount(booking?.totalAmount || 0)}`,
    `Event date: ${booking?.eventDate || "Date TBD"}${start}${end}`,
  ];

  if (booking?.venueAddress) lines.push(`Venue: ${booking.venueAddress}`);
  if (itemLines.length) {
    lines.push(`Items: ${items.length}`, ...itemLines.slice(0, 6));
    if (itemLines.length > 6) lines.push(`+${itemLines.length - 6} more`);
  }
  return lines;
}
