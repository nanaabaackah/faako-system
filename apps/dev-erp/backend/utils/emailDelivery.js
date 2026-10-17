const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_EMAIL_FALLBACK = "dev@nanaabaackah.com";

const normalizeEmailCandidate = (value) => String(value || "").trim();

export const resolveLocalEmailRecipient = (defaultAdminEmail, env = process.env) => {
  const forcedRecipient = normalizeEmailCandidate(env?.EMAIL_FORCE_TO);
  if (EMAIL_PATTERN.test(forcedRecipient)) {
    return forcedRecipient;
  }

  const normalized = String(defaultAdminEmail || "").trim();
  if (EMAIL_PATTERN.test(normalized)) {
    return normalized;
  }
  return LOCAL_EMAIL_FALLBACK;
};

export const resolveEmailDeliveryRecipients = ({
  recipients,
  parseRecipients,
  isProduction,
  defaultAdminEmail,
  env,
}) => {
  const intendedRecipients = parseRecipients(recipients);
  if (isProduction || !intendedRecipients.length) {
    return {
      intendedRecipients,
      deliveryRecipients: intendedRecipients,
      wasRerouted: false,
    };
  }

  const deliveryRecipient = resolveLocalEmailRecipient(defaultAdminEmail, env);
  const wasRerouted =
    intendedRecipients.length !== 1 ||
    intendedRecipients.some(
      (recipient) => recipient.toLowerCase() !== deliveryRecipient.toLowerCase()
    );

  return {
    intendedRecipients,
    deliveryRecipients: [deliveryRecipient],
    wasRerouted,
  };
};

export const resolveEmailBccRecipients = ({
  defaultAdminEmail,
  deliveryRecipients = [],
  isProduction,
}) => {
  if (!isProduction) return [];
  const normalizedAdmin = normalizeEmailCandidate(defaultAdminEmail).toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedAdmin)) return [];
  const delivered = new Set(
    (Array.isArray(deliveryRecipients) ? deliveryRecipients : [])
      .map((entry) => normalizeEmailCandidate(entry).toLowerCase())
      .filter(Boolean)
  );
  return delivered.has(normalizedAdmin) ? [] : [normalizedAdmin];
};

export const resolveSingleEmailDeliveryTarget = ({
  recipient,
  isProduction,
  defaultAdminEmail,
  env,
}) => {
  const intendedRecipient = String(recipient || "").trim();
  if (isProduction) {
    return {
      intendedRecipient,
      deliveryRecipient: intendedRecipient,
      wasRerouted: false,
    };
  }

  const deliveryRecipient = resolveLocalEmailRecipient(defaultAdminEmail, env);
  return {
    intendedRecipient,
    deliveryRecipient,
    wasRerouted: deliveryRecipient.toLowerCase() !== intendedRecipient.toLowerCase(),
  };
};
