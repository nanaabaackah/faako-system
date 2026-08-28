export const DEFAULT_SERVICE_PAYMENT_HEADING = "Payment instruction";

export const DEFAULT_SERVICE_PAYMENT_LINES = [
  "Use the payment instructions issued with this document.",
  "Payment account details are supplied through configured server-side channels.",
];

export const DEFAULT_SERVICE_PAYMENT_TERMS = [
  DEFAULT_SERVICE_PAYMENT_HEADING,
  ...DEFAULT_SERVICE_PAYMENT_LINES,
].join("\n");

export const DEFAULT_SERVICE_PAYMENT_NOTE = `${DEFAULT_SERVICE_PAYMENT_HEADING}: use the payment details issued with this document.`;

export const buildServicePaymentInstructionLines = ({
  includeHeading = true,
  reference = "",
} = {}) => [
  ...(includeHeading ? [DEFAULT_SERVICE_PAYMENT_HEADING] : []),
  ...DEFAULT_SERVICE_PAYMENT_LINES,
  ...(reference ? [`Reference: ${reference}`] : []),
];
