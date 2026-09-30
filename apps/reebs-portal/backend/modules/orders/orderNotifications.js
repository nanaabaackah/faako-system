const formatGhs = (cents) => `GHS ${(Number(cents || 0) / 100).toFixed(2)}`;

export const buildOrderPlacedNotification = (order = {}) => ({
  title: `New storefront order ${order.orderNumber || ""}`.trim(),
  body: [
    order.customerName || "Customer",
    formatGhs(order.grandTotalCents ?? order.total_amount),
    order.fulfillmentMethod || "Pickup",
  ].join(" · "),
  data: { type: "order", id: order.id || null },
});

export const buildCustomerOrderPlacedText = (order = {}, { supportEmail = "" } = {}) => [
  `We received your REEBS order ${order.orderNumber || ""}.`.trim(),
  `Total: ${formatGhs(order.grandTotalCents ?? order.total_amount)}`,
  `Fulfillment: ${order.fulfillmentMethod || "Pickup"}`,
  "The order is pending payment confirmation. We will confirm the next step before dispatch or pickup.",
  supportEmail ? `Questions: ${supportEmail}` : "",
].filter(Boolean).join("\n");

export const buildInternalOrderPlacedText = (order = {}) => [
  `New storefront order ${order.orderNumber || ""}`.trim(),
  `Customer: ${order.customerName || "Customer"}`,
  `Total: ${formatGhs(order.grandTotalCents ?? order.total_amount)}`,
  `Fulfillment: ${order.fulfillmentMethod || "Pickup"}`,
  "Status: Pending payment",
].join("\n");
