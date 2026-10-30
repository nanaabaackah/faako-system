// GA web-stream identifiers are public configuration, not credentials.
export const TWE_MEASUREMENT_ID = "G-GVJ2HGT6YN";

export function analyticsMeasurementId({
  environment,
  configuredId = "",
  privacyAvailable,
}) {
  if (!privacyAvailable) return "";
  const id =
    configuredId.trim() ||
    (environment === "production" ? TWE_MEASUREMENT_ID : "");
  if (id && !/^G-[A-Z0-9]{4,20}$/.test(id))
    throw new Error("Invalid public Google Analytics measurement ID.");
  // A copied production environment file must not mix test visits into this stream.
  if (environment !== "production" && id === TWE_MEASUREMENT_ID) return "";
  return id;
}
