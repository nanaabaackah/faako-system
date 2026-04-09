export const DEFAULT_SERVICE_PAYMENT_HEADING = "Payment instruction";
export const DEFAULT_SERVICE_DEPOSIT_DUE_DAYS = 2;
export const DEFAULT_SERVICE_DEPOSIT_DUE_LABEL = "48 hrs before service";

export const DEFAULT_SERVICE_PAYMENT_LINES = [
  "70% deposit 48hrs before service",
  "Payment method: cheque, cash or send MTN mobile money to 0244781819 (Sabina Ackah).",
  "Payments can also be made to the following account:",
  "1. Bank Name : Ecobank",
  "2. Branch : Tema mall",
  "3. Account name : REEBS Party Themes",
  "4. Account number : 1441001236578",
];

export const DEFAULT_SERVICE_PAYMENT_TERMS = [
  DEFAULT_SERVICE_PAYMENT_HEADING,
  ...DEFAULT_SERVICE_PAYMENT_LINES,
].join("\n");

export const DEFAULT_SERVICE_PAYMENT_NOTE = `${DEFAULT_SERVICE_PAYMENT_HEADING}: 70% deposit 48hrs before service.`;

export const buildServicePaymentInstructionLines = ({
  includeHeading = true,
  reference = "",
} = {}) => [
  ...(includeHeading ? [DEFAULT_SERVICE_PAYMENT_HEADING] : []),
  ...DEFAULT_SERVICE_PAYMENT_LINES,
  ...(reference ? [`Reference: ${reference}`] : []),
];
