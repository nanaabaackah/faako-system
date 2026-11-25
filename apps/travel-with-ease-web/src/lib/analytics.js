// GA web-stream identifiers are public configuration, not credentials.
export const TWE_MEASUREMENT_ID = "G-GVJ2HGT6YN";

export function analyticsMeasurementId({
  environment,
  configuredId = "",
  privacyAvailable,
  pathname = "/",
}) {
  if (!privacyAvailable || !analyticsPageAllowed(pathname)) return "";
  const id =
    configuredId.trim() ||
    (environment === "production" ? TWE_MEASUREMENT_ID : "");
  if (id && !/^G-[A-Z0-9]{4,20}$/.test(id))
    throw new Error("Invalid public Google Analytics measurement ID.");
  // A copied production environment file must not mix test visits into this stream.
  if (environment !== "production" && id === TWE_MEASUREMENT_ID) return "";
  return id;
}

export function analyticsPageAllowed(pathname) {
  const route = String(pathname || "/").replace(/\/+$/, "") || "/";
  return route !== "/plan-your-trip" && !route.startsWith("/plan-your-trip/") && route !== "/404";
}

// Only coarse, predefined interactions: never accept a URL, name, token,
// enquiry reference, answer, destination or other visitor-supplied parameter.
export const TWE_ANALYTICS_EVENTS = Object.freeze(["generate_lead", "plan_trip_click", "whatsapp_click"]);
export function analyticsInteraction(eventName, pageLocation, origin) {
  if (!TWE_ANALYTICS_EVENTS.includes(eventName)) return null;
  try {
    const url = new URL(pageLocation, origin);
    if (url.origin !== origin || !analyticsPageAllowed(url.pathname)) return null;
    return { name: eventName, page_location: url.origin + url.pathname, page_path: url.pathname, page_referrer: "" };
  } catch { return null; }
}
